/**
 * DataJunction Analytics Tracker
 * CDN用軽量JavaScriptライブラリ
 * 
 * 使用方法:
 * <script src="https://unpkg.com/datajunction-tracker/dist/tracker.js"></script>
 * <script>
 *   DataJunction.init({
 *     gasUrl: 'YOUR_GAS_URL',
 *     siteId: 'your-site-id'
 *   });
 * </script>
 */

(function(window, document) {
  'use strict';

  // DataJunctionオブジェクトを作成
  const DataJunction = {
    config: {
      gasUrl: '',
      siteId: '',
      enabled: true,
      debug: false,
      batchSize: 10,
      batchTimeout: 5000
    },
    
    // データキュー（バッチ送信用）
    dataQueue: [],
    batchTimer: null,
    
    // セッション情報
    session: {
      visitorId: null,
      sessionId: null,
      startTime: Date.now(),
      pageViews: 0
    },

    /**
     * トラッカーを初期化
     */
    init: function(options) {
      // 設定をマージ
      Object.assign(this.config, options);
      
      if (!this.config.gasUrl) {
        console.error('DataJunction: gasUrl is required');
        return;
      }

      // セッション情報を初期化
      this.initSession();
      
      // 基本データを送信
      this.trackBasicData();
      
      // ページデータを送信
      this.trackPageData();
      
      // デバイス情報を送信
      this.trackDeviceData();
      
      // 位置情報を送信
      this.trackLocationData();
      
      // マーケティングデータを送信
      this.trackMarketingData();
      
      // パフォーマンスデータを送信
      this.trackPerformanceData();
      
      // イベントリスナーを設定
      this.setupEventListeners();
      
      this.log('DataJunction initialized for site:', this.config.siteId);
    },

    /**
     * セッション情報を初期化
     */
    initSession: function() {
      // visitor_id の取得/生成
      this.session.visitorId = this.getOrCreateVisitorId();
      
      // session_id を生成
      this.session.sessionId = this.generateSessionId();
      
      this.log('Session initialized:', this.session);
    },

    /**
     * Visitor IDを取得または生成
     */
    getOrCreateVisitorId: function() {
      const storageKey = 'dj_visitor_id';
      let visitorId = localStorage.getItem(storageKey);
      
      if (!visitorId) {
        visitorId = this.generateUUID();
        localStorage.setItem(storageKey, visitorId);
      }
      
      return visitorId;
    },

    /**
     * セッションIDを生成
     */
    generateSessionId: function() {
      return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * UUIDを生成
     */
    generateUUID: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    /**
     * 基本識別データを送信
     */
    trackBasicData: function() {
      this.sendData('basic', {
        visitor_id: this.session.visitorId,
        session_id: this.session.sessionId,
        ip_address: '', // サーバーサイドで取得
      });
    },

    /**
     * ページ・行動データを送信
     */
    trackPageData: function() {
      this.session.pageViews++;
      
      this.sendData('page', {
        page_url: window.location.href,
        referrer: document.referrer || '',
        time_on_page: 0, // 後で更新
        scroll_depth: 0, // 後で更新
        bounce_rate: this.session.pageViews === 1,
        page_views: this.session.pageViews
      });
    },

    /**
     * デバイス・技術情報を送信
     */
    trackDeviceData: function() {
      const deviceType = this.detectDeviceType();
      const browserInfo = this.getBrowserInfo();
      
      this.sendData('device', {
        device_type: deviceType,
        browser: browserInfo.name,
        os: browserInfo.os,
        viewport_size: window.innerWidth + 'x' + window.innerHeight
      });
    },

    /**
     * 地理・言語情報を送信
     */
    trackLocationData: function() {
      this.sendData('location', {
        country: '', // 外部APIで取得可能
        region: '',
        language: navigator.language || navigator.userLanguage || ''
      });
    },

    /**
     * マーケティングデータを送信
     */
    trackMarketingData: function() {
      const urlParams = new URLSearchParams(window.location.search);
      const trafficSource = this.getTrafficSource();
      
      this.sendData('marketing', {
        traffic_source: trafficSource,
        utm_campaign: urlParams.get('utm_campaign') || '',
        utm_medium: urlParams.get('utm_medium') || '',
        conversion_goal: false // 後でカスタムイベントで更新
      });
    },

    /**
     * パフォーマンス・UXデータを送信
     */
    trackPerformanceData: function() {
      // ページロード時間を取得
      window.addEventListener('load', () => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        
        this.sendData('performance', {
          page_load_time: loadTime,
          click_heatmap: {}, // 後でクリックイベントで更新
          form_abandonment: false
        });
      });
    },

    /**
     * イベントリスナーを設定
     */
    setupEventListeners: function() {
      // スクロール深度を追跡
      let maxScrollDepth = 0;
      window.addEventListener('scroll', this.throttle(() => {
        const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        maxScrollDepth = Math.max(maxScrollDepth, scrollDepth);
      }, 500));

      // ページ離脱時にスクロール深度を送信
      window.addEventListener('beforeunload', () => {
        this.sendData('page', {
          scroll_depth: maxScrollDepth,
          time_on_page: Date.now() - this.session.startTime
        });
      });

      // クリックイベントを追跡
      document.addEventListener('click', (e) => {
        const clickData = {
          x: e.clientX,
          y: e.clientY,
          element: e.target.tagName,
          timestamp: Date.now()
        };
        
        // クリックヒートマップデータを更新
        this.updateClickHeatmap(clickData);
      });
    },

    /**
     * デバイスタイプを検出
     */
    detectDeviceType: function() {
      const userAgent = navigator.userAgent;
      
      if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
        return 'Tablet';
      }
      if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
        return 'Mobile';
      }
      return 'PC';
    },

    /**
     * ブラウザ情報を取得
     */
    getBrowserInfo: function() {
      const userAgent = navigator.userAgent;
      let browserName = 'Unknown';
      let osName = 'Unknown';

      // ブラウザ検出
      if (userAgent.indexOf('Chrome') > -1) browserName = 'Chrome';
      else if (userAgent.indexOf('Firefox') > -1) browserName = 'Firefox';
      else if (userAgent.indexOf('Safari') > -1) browserName = 'Safari';
      else if (userAgent.indexOf('Edge') > -1) browserName = 'Edge';

      // OS検出
      if (userAgent.indexOf('Windows') > -1) osName = 'Windows';
      else if (userAgent.indexOf('Mac') > -1) osName = 'macOS';
      else if (userAgent.indexOf('Linux') > -1) osName = 'Linux';
      else if (userAgent.indexOf('Android') > -1) osName = 'Android';
      else if (userAgent.indexOf('iOS') > -1) osName = 'iOS';

      return { name: browserName, os: osName };
    },

    /**
     * トラフィックソースを判定
     */
    getTrafficSource: function() {
      const referrer = document.referrer;
      
      if (!referrer) return 'direct';
      
      const hostname = new URL(referrer).hostname;
      
      if (hostname.includes('google')) return 'organic';
      if (hostname.includes('facebook') || hostname.includes('twitter') || hostname.includes('instagram')) return 'social';
      if (window.location.search.includes('utm_')) return 'paid';
      
      return 'referral';
    },

    /**
     * クリックヒートマップを更新
     */
    updateClickHeatmap: function(clickData) {
      // 簡単なクリックヒートマップデータを作成
      // 実際の実装ではより詳細なデータ構造を使用
    },

    /**
     * データを送信
     */
    sendData: function(type, data) {
      if (!this.config.enabled) return;

      const payload = {
        type: type,
        site_id: this.config.siteId,
        timestamp: new Date().toISOString(),
        ...data
      };

      // バッチ送信用にキューに追加
      this.dataQueue.push(payload);
      
      // バッチサイズに達したら即座に送信
      if (this.dataQueue.length >= this.config.batchSize) {
        this.flushQueue();
      } else {
        // タイマーをリセット
        this.resetBatchTimer();
      }

      this.log('Data queued:', payload);
    },

    /**
     * バッチタイマーをリセット
     */
    resetBatchTimer: function() {
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(() => {
        this.flushQueue();
      }, this.config.batchTimeout);
    },

    /**
     * キューのデータを送信
     */
    flushQueue: function() {
      if (this.dataQueue.length === 0) return;

      const queueData = [...this.dataQueue];
      this.dataQueue = [];

      // 各データを個別に送信
      queueData.forEach(data => {
        this.sendToGAS(data);
      });

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
    },

    /**
     * GASにデータを送信
     */
    sendToGAS: function(data) {
      fetch(this.config.gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      .then(response => response.json())
      .then(result => {
        this.log('Data sent successfully:', result);
      })
      .catch(error => {
        console.error('DataJunction send error:', error);
      });
    },

    /**
     * スロットル関数
     */
    throttle: function(func, delay) {
      let timeoutId;
      let lastExecTime = 0;
      return function() {
        const currentTime = Date.now();
        
        if (currentTime - lastExecTime > delay) {
          func.apply(this, arguments);
          lastExecTime = currentTime;
        } else {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            func.apply(this, arguments);
            lastExecTime = Date.now();
          }, delay - (currentTime - lastExecTime));
        }
      };
    },

    /**
     * コンバージョンを記録
     */
    trackConversion: function(goalName) {
      this.sendData('marketing', {
        conversion_goal: true,
        goal_name: goalName || 'default'
      });
    },

    /**
     * カスタムイベントを記録
     */
    trackEvent: function(eventName, eventData) {
      this.sendData('custom', {
        event_name: eventName,
        event_data: eventData || {}
      });
    },

    /**
     * ログ出力
     */
    log: function(...args) {
      if (this.config.debug) {
        console.log('[DataJunction]', ...args);
      }
    }
  };

  // グローバルに公開
  window.DataJunction = DataJunction;

  // 自動初期化（data-* 属性から設定を読み取り）
  document.addEventListener('DOMContentLoaded', function() {
    const scripts = document.querySelectorAll('script[src*="datajunction"]');
    const script = scripts[scripts.length - 1];
    
    if (script && script.dataset.gasUrl) {
      DataJunction.init({
        gasUrl: script.dataset.gasUrl,
        siteId: script.dataset.siteId || 'default',
        debug: script.dataset.debug === 'true'
      });
    }
  });

})(window, document);
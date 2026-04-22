/**
 * 前端错误日志自动收集上报工具
 * 
 * 特性：
 * - 全局自动捕获：Vue错误、JS错误、Promise未捕获
 * - 去重：1分钟内同类型错误只上报一条
 * - 日志文件：写入后端日志文件，保留3天
 * - 挂载目录：确保写入生产环境挂载目录
 */

class ErrorReporter {
  constructor() {
    this.lastErrors = new Map()     // 去重缓存：{ errorKey: timestamp }
    this.debounceTime = 60000       // 去重时间窗口：60秒
    this.apiEndpoint = '/api/admin/frontend-error-log'
    this.isInitialized = false
  }

  /**
   * 初始化全局错误捕获
   */
  init() {
    if (this.isInitialized) return
    this.isInitialized = true

    console.log('[ErrorReporter] 初始化全局错误捕获')

    // #ifdef H5
    this.initH5ErrorHandlers()
    // #endif
  }

  /**
   * H5环境全局错误捕获
   */
  initH5ErrorHandlers() {
    if (typeof window === 'undefined') return

    // 1. JS运行错误（只捕获JS错误，忽略资源加载错误）
    window.addEventListener('error', (event) => {
      // 资源加载错误：event.target !== window
      if (event.target !== window) return
      
      this.report({
        type: 'js_error',
        message: event.message || 'unknown',
        stack: event.error?.stack || '',
        filename: event.filename || '',
        lineno: event.lineno || 0,
        colno: event.colno || 0
      })
    }, true)

    // 2. Promise未捕获错误
    window.addEventListener('unhandledrejection', (event) => {
      this.report({
        type: 'unhandled_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack || ''
      })
    })

    // 3. 定期清理去重缓存（每5分钟）
    setInterval(() => this.cleanupCache(), 300000)
  }

  /**
   * 上报错误（统一入口）
   * @param {Object} errorInfo - 错误信息
   */
  report(errorInfo) {
    if (!errorInfo || !errorInfo.type) return

    // 1. 补充基础信息
    const fullInfo = {
      ...errorInfo,
      timestamp: this.getBeijingTime(),
      route: this.getCurrentRoute(),
      url: this.getCurrentUrl(),
      userAgent: this.getUserAgent(),
      user: this.getCurrentUser()
    }

    // 2. 去重检查
    const errorKey = `${errorInfo.type}:${(errorInfo.message || '').substring(0, 50)}:${fullInfo.route}`
    const lastTime = this.lastErrors.get(errorKey)
    
    if (lastTime && (Date.now() - lastTime) < this.debounceTime) {
      console.log('[ErrorReporter] 1分钟内重复错误，跳过:', errorKey)
      return
    }
    
    this.lastErrors.set(errorKey, Date.now())

    // 3. 执行上报
    this.doReport(fullInfo)
  }

  /**
   * 页面业务追踪（保留给各页面使用）
   * @param {string} action - 追踪动作名
   * @param {Object} details - 追踪详情
   */
  track(action, details = {}) {
    this.report({
      type: 'business_track',
      action: action,
      ...details
    })
  }

  /**
   * 执行上报
   */
  doReport(errorInfo) {
    try {
      const token = this.getToken()
      const apiUrl = this.getApiUrl(this.apiEndpoint)
      
      uni.request({
        url: apiUrl,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        data: errorInfo,
        success: (res) => {
          if (res.statusCode === 200) {
            console.log('[ErrorReporter] 上报成功:', errorInfo.type)
          }
        },
        fail: (err) => {
          console.warn('[ErrorReporter] 上报失败:', err.errMsg || err)
        }
      })
    } catch (e) {
      console.error('[ErrorReporter] 上报异常:', e)
    }
  }

  /**
   * 获取北京时间字符串
   */
  getBeijingTime() {
    const d = new Date()
    const offset = 8 * 60 * 60 * 1000  // 北京时间偏移
    const beijing = new Date(d.getTime() + offset - d.getTimezoneOffset() * 60 * 1000)
    return beijing.toISOString().replace('T', ' ').substring(0, 19)
  }

  /**
   * 获取当前路由
   */
  getCurrentRoute() {
    try {
      const pages = getCurrentPages()
      if (pages.length > 0) {
        return pages[pages.length - 1].route || 'unknown'
      }
    } catch (e) {}

    // #ifdef H5
    if (typeof window !== 'undefined') {
      return window.location.hash || window.location.pathname || 'unknown'
    }
    // #endif

    return 'unknown'
  }

  /**
   * 获取当前URL
   */
  getCurrentUrl() {
    // #ifdef H5
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    // #endif
    return ''
  }

  /**
   * 获取UserAgent
   */
  getUserAgent() {
    // #ifdef H5
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent.substring(0, 200)
    }
    // #endif
    return ''
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    try {
      const adminInfo = uni.getStorageSync('adminInfo') || {}
      const coachInfo = uni.getStorageSync('coachInfo') || {}
      
      if (adminInfo.username) {
        return { type: 'admin', username: adminInfo.username, role: adminInfo.role || '' }
      }
      if (coachInfo.coachNo) {
        return { type: 'coach', coachNo: coachInfo.coachNo, stageName: coachInfo.stageName || '' }
      }
    } catch (e) {}
    
    return { type: 'anonymous' }
  }

  /**
   * 获取Token
   */
  getToken() {
    try {
      return uni.getStorageSync('adminToken') || 
             uni.getStorageSync('coachToken') || 
             uni.getStorageSync('memberToken') || ''
    } catch (e) {
      return ''
    }
  }

  /**
   * 获取API地址
   */
  getApiUrl(path) {
    // #ifdef H5
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      if (baseUrl) {
        return baseUrl + path
      }
    } catch (e) {}
    // #endif
    
    return 'https://tiangong.club/api' + path
  }

  /**
   * 清理过期去重缓存
   */
  cleanupCache() {
    const now = Date.now()
    for (const [key, time] of this.lastErrors.entries()) {
      if (now - time > this.debounceTime) {
        this.lastErrors.delete(key)
      }
    }
    // 限制缓存大小
    if (this.lastErrors.size > 100) {
      const keys = Array.from(this.lastErrors.keys())
      for (let i = 0; i < keys.length - 50; i++) {
        this.lastErrors.delete(keys[i])
      }
    }
  }
}

// 单例模式
const errorReporter = new ErrorReporter()

export default errorReporter
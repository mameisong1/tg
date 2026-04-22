/**
 * 天宫国际 - API请求工具
 */

// 基础URL配置 - 根据环境区分
// VITE_API_BASE_URL 由构建时的环境变量决定
// 生产环境: https://tiangong.club/api
// 开发环境: https://tg.tiangong.club/api
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'

// 生成设备指纹
const getDeviceFingerprint = () => {
  let fp = uni.getStorageSync('device_fp')
  if (!fp) {
    // 生成设备指纹：时间戳 + 随机数 + 平台信息
    const info = uni.getSystemInfoSync()
    const data = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${info.platform}_${info.model || ''}_${info.system || ''}`
    fp = data.hashCode ? data.hashCode() : Buffer.from(data).toString('base64').substr(0, 16)
    uni.setStorageSync('device_fp', fp)
  }
  return fp
}

// 简单的字符串哈希函数
if (!String.prototype.hashCode) {
  String.prototype.hashCode = function() {
    let hash = 0
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

// 请求封装 - 区分会员和教练
const request = (options) => {
  return new Promise((resolve, reject) => {
    // 获取对应的token
    const memberToken = uni.getStorageSync('memberToken')
    const coachToken = uni.getStorageSync('coachToken')
    const adminToken = uni.getStorageSync('adminToken')
    // QA-20260422: 修复 token 优先级 - 当有 coachToken 或 adminToken 时优先使用（内部员工权限）
    const token = options.authType === 'member' ? memberToken : (options.authType === 'coach' ? coachToken : (options.authType === 'admin' ? adminToken : (adminToken || coachToken || memberToken)))
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // 根据authType处理不同的登录状态
          if (options.authType === 'member') {
            uni.removeStorageSync('memberToken')
            // 会员401不跳转，静默处理
            reject(res.data)
          } else if (options.authType === 'coach') {
            uni.removeStorageSync('coachToken')
            uni.removeStorageSync('coachInfo')
            uni.showToast({ title: '请先登录', icon: 'none' })
            setTimeout(() => {
              uni.redirectTo({ url: '/pages/coach-login/coach-login' })
            }, 1500)
            reject(res.data)
          } else {
            // 未指定类型的，不跳转
            reject(res.data)
          }
        } else {
          reject(res.data)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

// API接口
export default {
  // 首页
  getHome: () => request({ url: '/home' }),

  // 前端配置
  getFrontConfig: () => request({ url: '/front-config' }),
  
  // 商品
  getCategories: () => request({ url: '/categories' }),
  getCategoryCounts: () => request({ url: '/categories/counts' }),
  getProducts: (category) => request({ url: '/products', data: { category } }),
  getProduct: (name) => request({ url: `/products/${encodeURIComponent(name)}` }),
  getProductOptions: (category, productName) => request({ url: '/product-options', data: { category, product_name: productName } }),
  
  // 购物车
  addCart: (data) => request({ url: '/cart', method: 'POST', data }),
  getCart: (sessionId) => request({ url: `/cart/${sessionId}` }),
  updateCart: (data) => request({ url: '/cart', method: 'PUT', data }),
  updateCartTable: (data) => request({ url: '/cart/table', method: 'PUT', data }),
  deleteCartItem: (data) => request({ url: '/cart', method: 'DELETE', data }),
  clearCart: (sessionId) => request({ url: `/cart/${sessionId}`, method: 'DELETE' }),
  
  // 订单
  createOrder: (sessionId, deviceFingerprint) => request({ 
    url: '/order', 
    method: 'POST', 
    data: { sessionId, deviceFingerprint } 
  }),
  getPendingOrders: (tableName) => request({ url: `/orders/pending/${encodeURIComponent(tableName)}` }),
  getMyPendingOrders: (deviceFingerprint) => request({ url: `/orders/my-pending?deviceFingerprint=${deviceFingerprint}` }),
  
  // 教练（需要coach认证）
  getCoaches: (level) => request({ url: '/coaches', data: { level } }),
  getCoach: (coachNo) => {
    const fp = getDeviceFingerprint()
    return request({ url: `/coaches/${coachNo}`, data: { fp } })
  },
  coachLogin: (data) => request({ url: '/coach/login', method: 'POST', data }),
  updateCoachProfile: (data) => request({ url: '/coach/profile', method: 'PUT', data, authType: 'coach' }),
  setCoachAvatar: (data) => request({ url: '/coach/avatar', method: 'PUT', data, authType: 'coach' }),
  getPopularityTop6: () => request({ url: '/coaches/popularity/top6' }),
  getCoachWaterStatus: (coachNo) => request({ url: `/coaches/${coachNo}/water-status` }),
  
  // 台桌
  getTableByPinyin: (pinyin) => request({ url: `/table/${pinyin}` }),
  getTables: () => request({ url: '/tables' }),
  
  // 包房
  getVipRooms: () => request({ url: '/vip-rooms' }),
  getVipRoom: (id) => request({ url: `/vip-rooms/${id}` }),
  
  // OSS签名
  getOSSSignature: (type = 'image', ext = 'jpg', dir) => request({ url: dir ? `/oss/sts?type=${type}&ext=${ext}&dir=${dir}` : `/oss/sts?type=${type}&ext=${ext}` }),
  
  // 上传图片到OSS（使用签名URL直传）
  uploadImageToOSS: async (filePath, fileType = 'image', dir) => {
    try {
      // 1. 获取签名URL
      const signUrl = dir ? `/oss/sts?type=${fileType}&ext=jpg&dir=${dir}` : `/oss/sts?type=${fileType}&ext=jpg`;
      const signRes = await request({ url: signUrl })
      if (!signRes.success || !signRes.signedUrl) {
        return { error: signRes?.error || '获取签名失败' }
      }
      
      // #ifdef H5
      // H5环境：fetch 获取 blob，XHR 直传 OSS
      const response = await fetch(filePath)
      const blob = await response.blob()
      
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', signRes.signedUrl, true)
        xhr.setRequestHeader('Content-Type', 'image/jpeg')
        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve({ success: true, url: signRes.accessUrl })
          } else {
            resolve({ error: `上传失败: ${xhr.status}` })
          }
        }
        xhr.onerror = () => resolve({ error: '网络错误，请检查网络连接' })
        xhr.ontimeout = () => resolve({ error: '上传超时，请重试' })
        xhr.timeout = 300000
        xhr.send(blob)
      })
      // #endif
      
      // #ifndef H5
      // 小程序环境：使用 uni.uploadFile 通过后端代理上传
      return new Promise((resolve, reject) => {
        uni.uploadFile({
          url: '/api/oss/upload',
          filePath: filePath,
          name: 'file',
          formData: { type: fileType },
          success: (res) => {
            try {
              const data = JSON.parse(res.data)
              if (data.success && data.url) {
                resolve({ success: true, url: data.url })
              } else {
                reject({ error: data.error || '上传失败' })
              }
            } catch (e) {
              reject({ error: '解析响应失败' })
            }
          },
          fail: (err) => reject({ error: err.errMsg || '上传失败' })
        })
      })
      // #endif
      
    } catch (e) {
      return { error: e.message || e.error || '上传失败' }
    }
  },  
  // 设备统计
  recordDeviceVisit: () => {
    const fp = getDeviceFingerprint()
    return request({ url: '/device/visit', method: 'POST', data: { deviceFp: fp } })
  },
  
  // =============== 后台用户登录 ===============
  adminLogin: (data) => request({ url: '/admin/login', method: 'POST', data }),
  
  // =============== 会员相关（需要member认证）==============
  
  // H5短信验证码发送
  sendSmsCode: (phone) => request({ url: '/sms/send', method: 'POST', data: { phone } }),
  
  // H5短信验证码登录
  loginBySms: (phone, code) => request({ url: '/member/login-sms', method: 'POST', data: { phone, code } }),
  
  // 微信手机号登录/注册
  memberLogin: (data) => request({ url: '/member/login', method: 'POST', data }),
  
  // 通过openid自动登录
  memberAutoLogin: (code) => request({ url: '/member/auto-login', method: 'POST', data: { code } }),
  
  // 获取会员信息
  getMemberProfile: () => request({ url: '/member/profile', authType: 'member' }),
  
  // 更新会员信息
  updateMemberProfile: (data) => request({ url: '/member/profile', method: 'PUT', data, authType: 'member' }),
  
  // 会员退出登录（清除openid）
  memberLogout: () => request({ url: '/member/logout', method: 'POST', authType: 'member' }),
  
  // 获取协议
  getUserAgreement: () => request({ url: '/agreement/user' }),
  getPrivacyPolicy: () => request({ url: '/agreement/privacy' }),
  
  // 摄像头错误日志上报
  reportCameraError: (errorInfo) => request({ 
    url: '/log/camera-error', 
    method: 'POST', 
    data: errorInfo 
  }),
  
  // 导出设备指纹函数
  getDeviceFingerprint,

  // =============== 奖罚管理 ===============
  getRewardPenaltyTypes: () => request({ url: "/admin/reward-penalty/types", authType: "admin" }),
  updateRewardPenaltyTypes: (data) => request({ url: "/admin/reward-penalty/types", method: "PUT", data, authType: "admin" }),
  upsertRewardPenalty: (data) => request({ url: "/reward-penalty/upsert", method: "POST", data, authType: "admin" }),
  getRewardPenaltyList: (params) => request({ url: "/reward-penalty/list", data: params }), // 不指定 authType，支持教练和后台用户
  getRewardPenaltyStats: (params) => request({ url: "/reward-penalty/stats", data: params, authType: "admin" }),
  batchExecuteRewardPenalty: (data) => request({ url: "/reward-penalty/batch-execute", method: "POST", data, authType: "admin" }),
  executeRewardPenalty: (id) => request({ url: `/reward-penalty/execute/${id}`, method: "POST", authType: "admin" }),
  getRewardPenaltyTargets: (role) => request({ url: "/reward-penalty/targets", data: { role }, authType: "admin" }),
  updateUserStatus: (username, status) => request({ url: `/admin/users/${username}/status`, method: "PUT", data: { employmentStatus: status }, authType: "admin" }),

  // =============== 申请/审批管理 ===============
  applications: {
    getPendingCount: () => request({ url: '/applications/pending-count', authType: 'admin' })
  },

  // =============== 奖罚管理 ===============
  rewardPenalty: {
    getRecentCount: (params) => request({ url: '/reward-penalty/recent-count', data: params }) // 不指定 authType，支持教练和后台用户
  }
}
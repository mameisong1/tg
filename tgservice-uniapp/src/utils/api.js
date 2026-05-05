/**
 * 天宫国际 - API请求工具
 */

// 基础URL配置 - 根据环境区分
// VITE_API_BASE_URL 由构建时的环境变量决定
// 生产环境: https://tiangong.club/api
// 开发环境: https://tg.tiangong.club/api
const BASE_URL = import.meta.env.VITE_API_BASE_URL
import errorReporter from './error-reporter.js'

// 生成设备指纹
// 简单的字符串哈希函数（必须在 getDeviceFingerprint 之前定义）
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

// QA-20260505: 修复 H5 浏览器环境 Buffer 未定义导致登录失败
// 浏览器没有 Node.js 的 Buffer API，必须确保 hashCode 可用，不能用 Buffer
const getDeviceFingerprint = () => {
  let fp = uni.getStorageSync('device_fp')
  if (!fp) {
    // 生成设备指纹：时间戳 + 随机数 + 平台信息
    const info = uni.getSystemInfoSync()
    const data = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${info.platform}_${info.model || ''}_${info.system || ''}`
    // ✅ 直接使用 hashCode（已在上方定义到 String.prototype）
    // ❌ 不使用 Buffer.from（浏览器环境不存在 Buffer）
    fp = data.hashCode()
    uni.setStorageSync('device_fp', fp)
  }
  return fp
}

// QA-20260504: 公共登出函数 - 清空所有登录相关的 Storage 数据
// 用于：登录前清空、退出登录、Token失效自动登出
const clearLoginStorage = () => {
  uni.removeStorageSync('memberToken')
  uni.removeStorageSync('memberInfo')
  uni.removeStorageSync('coachToken')
  uni.removeStorageSync('coachInfo')
  uni.removeStorageSync('adminToken')
  uni.removeStorageSync('adminInfo')
  uni.removeStorageSync('preferredRole')
  uni.removeStorageSync('sessionId')
  uni.removeStorageSync('tablePinyin')
  uni.removeStorageSync('tableName')
  uni.removeStorageSync('tableAuth')
  uni.removeStorageSync('highlightProduct')
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
          // QA-20260505: API 401 自动上报
          errorReporter.report({ type: 'api_401', message: `401: ${options.url}`, statusCode: 401, authType: options.authType, errorCode: res.data?.code || '' })
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
            // 未指定类型，检查是否是 token 过期阈值失效
            if (res.data?.code === 'TOKEN_EXPIRED_BY_THRESHOLD') {
              // QA-20260504: 使用公共函数清除所有登录信息
              clearLoginStorage()
              uni.showToast({ title: '登录已过期，请重新登录', icon: 'none', duration: 2000 })
              setTimeout(() => {
                uni.redirectTo({ url: '/pages/member/member' })
              }, 1500)
            } else if (res.data?.code === 'INVALID_TOKEN_TYPE' || res.data?.code === 'INVALID_TOKEN_FORMAT') {
              // QA-20260504: 使用公共函数清除登录信息
              clearLoginStorage()
              uni.showToast({ title: '请重新登录', icon: 'none', duration: 2000 })
              setTimeout(() => {
                uni.redirectTo({ url: '/pages/member/member' })
              }, 1500)
            }
            reject(res.data)
          }
        } else {
          // QA-20260505: API 非200 自动上报
          errorReporter.report({ type: 'api_error', message: `${res.statusCode}: ${options.url}`, statusCode: res.statusCode, detail: res.data })
          reject(res.data)
        }
      },
      fail: (err) => {
        // QA-20260505: API 网络失败 自动上报
        errorReporter.report({ type: 'api_network_fail', message: `网络失败: ${options.url}`, detail: err.errMsg || '' })
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

// ========== 水牌管理 ==========
export const waterBoards = {
  // 获取所有水牌
  getList: (params) => request({ url: '/water-boards', data: params }),
  // 获取单个助教水牌
  getOne: (coachNo) => request({ url: `/water-boards/${coachNo}` }),
  // 更新水牌状态（手动）
  updateStatus: (coachNo, data) => request({ url: `/water-boards/${coachNo}/status`, method: 'PUT', data })
}

// ========== 服务单 ==========
export const serviceOrders = {
  // 创建服务单
  create: (data) => request({ url: '/service-orders', method: 'POST', data }),
  // 获取服务单列表
  getList: (params) => request({ url: '/service-orders', data: params }),
  // 更新服务单状态
  updateStatus: (id, data) => request({ url: `/service-orders/${id}/status`, method: 'PUT', data })
}

// ========== 系统配置 ==========
export const systemConfig = {
  // 获取服务分类配置
  getServiceCategories: () => request({ url: '/system-config/service-categories' })
}

// ========== 上下桌单 ==========
export const tableActionOrders = {
  // 提交上桌/下桌/取消单
  create: (data) => request({ url: '/table-action-orders', method: 'POST', data }),
  // 获取上下桌单列表
  getList: (params) => request({ url: '/table-action-orders', data: params }),
  // 获取上下桌单统计
  getStats: (params) => request({ url: '/table-action-orders/stats', data: params }),
  // 更新上下桌单状态
  updateStatus: (id, data) => request({ url: `/table-action-orders/${id}/status`, method: 'PUT', data })
}

// ========== 商品订单 ==========
export const productOrders = {
  // 获取商品订单列表
  getList: (params) => request({ url: '/admin/orders', data: params, authType: 'admin' }),
  // 完成订单
  complete: (id) => request({ url: `/admin/orders/${id}/complete`, method: 'POST', authType: 'admin' }),
  // 取消订单
  cancel: (id) => request({ url: `/admin/orders/${id}/cancel`, method: 'POST', authType: 'admin' })
}

// ========== 申请事项 ==========
export const applications = {
  // 提交申请（加班/公休/乐捐）
  create: (data) => request({ url: '/applications', method: 'POST', data }),
  // 获取申请列表
  getList: (params) => request({ url: '/applications', data: params }),
  // 审批申请
  approve: (id, data) => request({ url: `/applications/${id}/approve`, method: 'PUT', data }),
  // 获取近期已审批记录
  getApprovedRecent: (params) => request({ url: '/applications/approved-recent', data: params }),
  // 获取当天已同意的加班小时数
  getTodayApprovedOvertime: () => request({ url: '/applications/today-approved-overtime' }),
  // 获取待审批数字
  getPendingCount: () => request({ url: '/applications/pending-count' }),
  // 获取班次统计
  getShiftStats: () => request({ url: '/applications/shift-stats' }),
  // 取消申请
  delete: (id, phone) => request({ url: `/applications/${id}?applicant_phone=${phone}`, method: 'DELETE' }),
  // 我的本月申请次数
  getMyMonthCount: (phone, type, month = '') => request({ url: `/applications/my-month-count?applicant_phone=${phone}&application_type=${type}${month ? '&month=' + month : ''}` }),
  // 撤销已同意的预约申请
  cancelApproved: (id) => request({ url: `/applications/${id}/cancel-approved`, method: 'POST' })
}

// ========== 约客管理 ==========
export const guestInvitations = {
  // 提交约客记录
  create: (data) => request({ url: '/guest-invitations', method: 'POST', data }),
  // 获取约客记录列表（params 会自动处理 URL 编码）
  getList: (params) => request({ url: '/guest-invitations', data: params }),
  // 获取当前助教的约客记录（最近10天）
  getMyRecords: () => request({ url: '/guest-invitations/my-records', authType: 'coach' }),
  // 审查约客记录
  review: (id, data) => request({ url: `/guest-invitations/${id}/review`, method: 'PUT', data }),
  // 锁定应约客人员（开始审查）
  lockShouldInvite: (data) => request({ url: '/guest-invitations/lock-should-invite', method: 'POST', data }),
  // 检查是否已锁定（内存变量）
  checkLock: (params) => request({ url: '/guest-invitations/check-lock', data: params }),
  // 获取应约客人员列表
  getShouldInvite: (params) => request({ url: '/guest-invitations/should-invite', data: params }),
  // 生成约客统计
  generateStats: (data) => request({ url: '/guest-invitations/statistics', method: 'POST', data }),
  // 获取约客统计结果
  getStats: (date, shift) => request({ url: `/guest-invitations/statistics/${date}/${encodeURIComponent(shift)}` }),
  // 按周期统计约客情况（新规约客统计页面）
  getPeriodStats: (params) => request({ url: '/guest-invitations/period-stats', data: params })
}

// ========== 助教管理（V2） ==========
export const coachesV2 = {
  // 上班（支持传递打卡截图等参数）
  clockIn: (coachNo, data = {}) => request({ url: `/coaches/v2/${coachNo}/clock-in`, method: 'POST', data }),
  // 下班
  clockOut: (coachNo) => request({ url: `/coaches/v2/${coachNo}/clock-out`, method: 'POST' }),
  // 批量修改班次
  batchShift: (data) => request({ url: '/coaches/v2/batch-shift', method: 'PUT', data }),
  // 单个修改班次
  updateShift: (coachNo, data) => request({ url: `/coaches/v2/${coachNo}/shift`, method: 'PUT', data })
}

// ========== 操作日志 ==========
export const operationLogs = {
  // 获取操作日志列表
  getList: (params) => request({ url: '/operation-logs', data: params })
}

// ========== 权限检查 ==========
export const authV2 = {
  // 检查用户权限（后台用户/助教）
  checkPermission: (phone) => request({ url: `/auth/check-permission?phone=${phone}` })
}

// ========== 乐捐记录 ==========
export const lejuanRecords = {
  // 提交乐捐报备
  create: (data) => request({ url: '/lejuan-records', method: 'POST', data }),
  // 我的乐捐记录（近2天）
  getMyList: (params) => request({ url: '/lejuan-records/my', data: params }),
  // 提交/修改付款截图
  updateProof: (id, data) => request({ url: `/lejuan-records/${id}/proof`, method: 'PUT', data }),
  // 删除乐捐预约
  delete: (id) => request({ url: `/lejuan-records/${id}`, method: 'DELETE' }),
  // 乐捐一览（管理）
  getList: (params) => request({ url: '/lejuan-records/list', data: params }),
  // 乐捐归来（管理）
  returnRecord: (id, data) => request({ url: `/lejuan-records/${id}/return`, method: 'POST', data })
}

// ========== 钉钉打卡查询（QA-20260501-1）==========
export const dingtalkAttendance = {
  // 查询/轮询钉钉打卡时间
  query: (data) => request({ url: '/dingtalk-attendance/query', method: 'POST', data }),
  // 查询轮询状态
  getStatus: (params) => request({ url: '/dingtalk-attendance-status', data: params })
}

// ========== 漏单统计 ==========
export const missingTableOutOrders = {
  // 获取统计列表
  getStats: (params) => request({ url: '/missing-table-out-orders/stats', data: params }),
  // 获取明细
  getDetail: (params) => request({ url: '/missing-table-out-orders/detail', data: params })
}

// ========== 奖罚管理 ==========
export const rewardPenalty = {
  // 获取昨天和今天的已确认奖罚数据条数
  getRecentCount: (params) => request({ url: '/reward-penalty/recent-count', data: params })
}

// ========== 助教休假日历 ==========
export const leaveCalendar = {
  // 获取本月和下月休假日历统计
  getStats: (yearMonth) => request({ url: '/leave-calendar/stats', data: yearMonth ? { yearMonth } : {} }),
  // 获取指定日期的休息人数
  getDayCount: (date) => request({ url: '/leave-calendar/day-count', data: { date } }),
  // 获取指定日期的请假/休息助教详情
  getDayDetail: (date) => request({ url: '/leave-calendar/day-detail', data: { date } })
}

// ========== 打卡审查 ==========
export const attendanceReview = {
  // 获取打卡审查列表
  getList: (params) => request({ url: '/attendance-review', data: params }),
  // 获取当天迟到且未审查的人数（用于角标）
  getPendingCount: () => request({ url: '/attendance-review/pending-count' }),
  // 标记单条打卡记录为已审查
  markReviewed: (id) => request({ url: `/attendance-review/${id}/review`, method: 'PUT' })
}

// ========== 门迎排序 ==========
export const guestRankings = {
  // 获取今日排序
  getToday: () => request({ url: '/guest-rankings/today' }),
  // 设置免门迎
  setExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'PUT' }),
  // 取消免门迎
  removeExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'DELETE' })
}

// ========== 通知管理 ==========
export const notifications = {
  // 获取我的通知列表
  getList: (params) => request({ url: '/notifications', data: params }),
  // 获取我的系统通知列表
  getSystemList: (params) => request({ url: '/notifications', data: { ...params, type: 'system,invitation_reminder' } }),
  // 获取未阅数量
  getUnreadCount: () => request({ url: '/notifications/unread-count' }),
  // 获取系统通知未阅数量
  getSystemUnreadCount: () => request({ url: '/notifications/unread-count', data: { type: 'system,invitation_reminder' } }),
  // 标记已阅
  markAsRead: (id) => request({ url: `/notifications/${id}/read`, method: 'POST' }),
  // 发送通知
  send: (data) => request({ url: '/notifications/manage/send', method: 'POST', data }),
  // 获取已发送列表
  getSentList: (params) => request({ url: '/notifications/manage/list', data: params }),
  // 获取接收者详情
  getRecipients: (id) => request({ url: `/notifications/manage/${id}/recipients` }),
  // 获取可选员工列表
  getEmployees: (params) => request({ url: '/notifications/manage/employees', data: params }),
  // 删除通知
  delete: (id) => request({ url: `/notifications/manage/${id}`, method: 'DELETE' })
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
  // QA-20260504: 新增 memberPhone 参数，解决 token 解析遗漏问题
  createOrder: (sessionId, deviceFingerprint, memberPhone) => request({ 
    url: '/order', 
    method: 'POST', 
    data: { sessionId, deviceFingerprint, memberPhone } 
  }),
  getPendingOrders: (tableName) => request({ url: `/orders/pending/${encodeURIComponent(tableName)}` }),
  getMyPendingOrders: (deviceFingerprint) => request({ url: `/orders/my-pending?deviceFingerprint=${deviceFingerprint}` }),
  // QA-20260429-1: 新增我的订单接口
  getMyOrders: (deviceFingerprint) => request({ url: `/orders/my-orders?deviceFingerprint=${deviceFingerprint}` }),
  
  // 教练（需要coach认证）
  getCoaches: (level) => request({ url: '/coaches', data: { level } }),
  getCoach: (coachNo) => {
    const fp = getDeviceFingerprint()
    return request({ url: `/coaches/${coachNo}`, data: { fp } })
  },
  // 助教登录已废弃，统一走 SMS 登录
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
  // QA-20260429-1: 新增 deviceFingerprint 参数
  loginBySms: (phone, code) => {
    const deviceFingerprint = getDeviceFingerprint();
    return request({ url: '/member/login-sms', method: 'POST', data: { phone, code, deviceFingerprint } });
  },
  
  // 微信手机号登录/注册
  // QA-20260429-1: 新增 deviceFingerprint 参数
  memberLogin: (data) => {
    const deviceFingerprint = getDeviceFingerprint();
    return request({ url: '/member/login', method: 'POST', data: { ...data, deviceFingerprint } });
  },
  
  // 通过openid自动登录
  memberAutoLogin: (code, preferredRole = null) => request({ 
    url: '/member/auto-login', 
    method: 'POST', 
    data: { code, preferredRole } 
  }),
  
  // 🔴 新增：设置用户偏好身份
  setPreferredRole: (role) => {
    if (!['member', 'coach', 'admin'].includes(role)) {
      console.error('setPreferredRole: 无效的角色值', role);
      return;
    }
    uni.setStorageSync('preferredRole', role);
    
    // 删除其他身份的 token
    if (role === 'coach') {
      uni.removeStorageSync('adminToken');
      uni.removeStorageSync('adminInfo');
    } else if (role === 'admin') {
      uni.removeStorageSync('coachToken');
      uni.removeStorageSync('coachInfo');
    } else if (role === 'member') {
      uni.removeStorageSync('adminToken');
      uni.removeStorageSync('adminInfo');
      uni.removeStorageSync('coachToken');
      uni.removeStorageSync('coachInfo');
    }
    console.log('已设置偏好身份:', role);
  },
  
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
  
  // =============== 奶茶果盘任务（助教个人） ===============
  getTeaFruitMyStats: (period, deviceFingerprint) => request({ url: '/tea-fruit/my-stats', data: { period, deviceFingerprint } }), // 助教个人统计
  
  // =============== 奶茶果盘管理（后台） ===============
  getTeaFruitAdminStats: (period) => request({ url: '/tea-fruit/admin-stats', data: { period }, authType: 'admin' }), // 管理员统计
  getTeaFruitCoachDetail: (params) => request({ url: '/tea-fruit/coach-detail', data: params, authType: 'admin' }), // 助教明细

  // =============== 奖罚管理 ===============
  getRewardPenaltyTypes: () => request({ url: "/reward-penalty/types" }),
  updateRewardPenaltyTypes: (data) => request({ url: "/admin/reward-penalty/types", method: "PUT", data, authType: "admin" }),
  upsertRewardPenalty: (data) => request({ url: "/reward-penalty/upsert", method: "POST", data, authType: "admin" }),
  getRewardPenaltyList: (params) => request({ url: "/reward-penalty/list", data: params }), // 不指定 authType，支持教练和后台用户
  getRewardPenaltyStats: (params) => request({ url: "/reward-penalty/stats", data: params, authType: "admin" }),
  batchExecuteRewardPenalty: (data) => request({ url: "/reward-penalty/batch-execute", method: "POST", data, authType: "admin" }),
  executeRewardPenalty: (id) => request({ url: `/reward-penalty/execute/${id}`, method: "POST", authType: "admin" }),
  getRewardPenaltyTargets: (role) => request({ url: "/reward-penalty/targets", data: { role }, authType: "admin" }),
  deleteRewardPenaltyDetail: (id) => request({ url: `/reward-penalty/detail/${id}`, method: "DELETE", authType: "admin" }),
  updateUserStatus: (username, status) => request({ url: `/admin/users/${username}/status`, method: "PUT", data: { employmentStatus: status }, authType: "admin" }),

  // ========== 内部模块（从 api-v2.js 迁移）==========
  waterBoards,
  serviceOrders,
  systemConfig,
  tableActionOrders,
  productOrders,
  applications,
  guestInvitations,
  coachesV2,
  operationLogs,
  authV2,
  lejuanRecords,
  missingTableOutOrders,
  rewardPenalty,
  leaveCalendar,
  attendanceReview,
  guestRankings,
  notifications,
  dingtalkAttendance,

  // ========== 工具函数 ===========
  clearLoginStorage,
  getDeviceFingerprint
}

// 命名导出设备指纹函数和登出函数（支持解构导入）
export { getDeviceFingerprint, clearLoginStorage }
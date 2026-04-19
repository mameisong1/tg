/**
 * 天宫国际 V2.0 - API请求工具
 * 用于内部专用模块（水牌、服务单、上下桌、申请、约客等）
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tiangong.club/api'

// 请求封装（后台用户认证 + 助教认证）
const request = (options) => {
  return new Promise((resolve, reject) => {
    const adminToken = uni.getStorageSync('adminToken')
    const coachToken = uni.getStorageSync('coachToken')
    // 优先使用 adminToken，否则使用 coachToken
    const token = adminToken || coachToken
    
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
          uni.removeStorageSync('adminToken')
          uni.removeStorageSync('adminInfo')
          uni.showToast({ title: '请先登录', icon: 'none' })
          reject(res.data)
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
  // 新增：获取待审批数字
  getPendingCount: () => request({ url: '/applications/pending-count' }),
  // 新增：获取班次统计
  getShiftStats: () => request({ url: '/applications/shift-stats' }),
  // 新增：取消申请
  delete: (id, phone) => request({ url: `/applications/${id}?applicant_phone=${phone}`, method: 'DELETE' }),
  // 新增：我的本月申请次数
  getMyMonthCount: (phone, type) => request({ url: `/applications/my-month-count?applicant_phone=${phone}&application_type=${type}` })
}

// ========== 约客管理 ==========
export const guestInvitations = {
  // 提交约客记录
  create: (data) => request({ url: '/guest-invitations', method: 'POST', data }),
  // 获取约客记录列表（params 会自动处理 URL 编码）
  getList: (params) => request({ url: '/guest-invitations', data: params }),
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
  // 上班
  clockIn: (coachNo) => request({ url: `/coaches/v2/${coachNo}/clock-in`, method: 'POST' }),
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
  returnRecord: (id, data) => request({ url: `/lejuan-records/${id}/return`, method: 'POST', data }),
}

// ========== 漏单统计 ==========
export const missingTableOutOrders = {
  // 获取统计列表
  getStats: (params) => request({ url: '/missing-table-out-orders/stats', data: params }),
  // 获取明细
  getDetail: (params) => request({ url: '/missing-table-out-orders/detail', data: params })
}

export default {
  waterBoards,
  serviceOrders,
  tableActionOrders,
  applications,
  guestInvitations,
  coachesV2,
  operationLogs,
  authV2,
  lejuanRecords,
  missingTableOutOrders
}

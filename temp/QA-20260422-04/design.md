# api.js 合并方案设计文档

## 一、现状分析

### 1.1 文件结构对比

| 文件 | 导出方式 | 行数 | 主要用途 |
|------|----------|------|----------|
| api.js | 默认导出 `export default {}` | ~300行 | 公共API（首页、商品、订单、教练等） |
| api-v2.js | 具名导出 + 默认导出 | ~220行 | 内部专用模块（水牌、服务单、上下桌等） |

### 1.2 api.js 导出结构

```javascript
export default {
  // 首页、商品、购物车、订单、教练、台桌等公共API
  getHome: () => request(...),
  getProducts: (category) => request(...),
  // ...
  
  // 部分嵌套模块
  applications: { getPendingCount: () => request(...) },
  rewardPenalty: { getRecentCount: () => request(...) }
}
```

### 1.3 api-v2.js 导出结构

```javascript
// 具名导出模块
export const waterBoards = { getList, getOne, updateStatus }
export const serviceOrders = { create, getList, updateStatus }
export const tableActionOrders = { create, getList, getStats, updateStatus }
export const applications = { create, getList, approve, ... }
export const guestInvitations = { create, getList, review, ... }
export const coachesV2 = { clockIn, clockOut, batchShift, updateShift }
export const operationLogs = { getList }
export const authV2 = { checkPermission }
export const lejuanRecords = { create, getMyList, ... }
export const missingTableOutOrders = { getStats, getDetail }
export const rewardPenalty = { getRecentCount }
export const leaveCalendar = { getStats, getDayCount }
export const attendanceReview = { getList, getPendingCount, markReviewed }
export const guestRankings = { getToday, setExempt, removeExempt }

// 默认导出（引用上述模块）
export default {
  getFrontConfig: () => request(...),
  waterBoards,
  serviceOrders,
  // ...所有模块
}
```

### 1.4 request 函数差异

| 特性 | api.js | api-v2.js |
|------|--------|-----------|
| authType 参数 | 支持 'member'/'coach'/'admin' | 不支持 |
| Token 选择逻辑 | `adminToken || coachToken || memberToken` | `adminToken || coachToken` |
| 401 处理 | 按类型跳转不同登录页 | 统一跳转（无 member 处理） |

**结论**：api.js 的 request 更完整，能覆盖 api-v2.js 的需求。

### 1.5 引用情况

**共 26 个文件引用 api-v2.js**：

| Import 方式 | 文件数 | 示例 |
|-------------|--------|------|
| 默认导入 `import api from '@/utils/api-v2.js'` | 20 | table-action.vue, clock.vue, ... |
| 具名导入 `import { xxx } from '@/utils/api-v2.js'` | 5 | overtime-apply.vue, invitation-upload.vue, ... |
| 混合使用 | 1 | 无 |

## 二、合并方案

### 2.1 设计原则

1. **向后兼容**：所有现有代码无需修改即可正常运行
2. **代码复用**：合并 request 函数，消除重复
3. **清晰架构**：具名导出 + 默认导出并存
4. **易于维护**：模块化组织，便于扩展

### 2.2 合并后结构

```javascript
// ========== 工具函数 ==========
const getDeviceFingerprint = () => { ... }

// ========== 请求封装（统一） ==========
const request = (options) => {
  // 合并后的逻辑，支持 authType 参数
  // 默认行为：adminToken || coachToken || memberToken
}

// ========== 公共 API（具名导出） ==========
export const home = {
  getHome: () => request({ url: '/home' }),
  getFrontConfig: () => request({ url: '/front-config' })
}

export const products = {
  getCategories: () => request({ url: '/categories' }),
  getProducts: (category) => request({ url: '/products', data: { category } })
}

export const cart = {
  add: (data) => request({ url: '/cart', method: 'POST', data }),
  get: (sessionId) => request({ url: `/cart/${sessionId}` })
}

// ... 其他公共模块

// ========== 内部模块（从 api-v2.js 迁移） ==========
export const waterBoards = {
  getList: (params) => request({ url: '/water-boards', data: params }),
  getOne: (coachNo) => request({ url: `/water-boards/${coachNo}` }),
  updateStatus: (coachNo, data) => request({ url: `/water-boards/${coachNo}/status`, method: 'PUT', data })
}

export const serviceOrders = {
  create: (data) => request({ url: '/service-orders', method: 'POST', data }),
  getList: (params) => request({ url: '/service-orders', data: params }),
  updateStatus: (id, data) => request({ url: `/service-orders/${id}/status`, method: 'PUT', data })
}

export const tableActionOrders = {
  create: (data) => request({ url: '/table-action-orders', method: 'POST', data }),
  getList: (params) => request({ url: '/table-action-orders', data: params }),
  getStats: (params) => request({ url: '/table-action-orders/stats', data: params }),
  updateStatus: (id, data) => request({ url: `/table-action-orders/${id}/status`, method: 'PUT', data })
}

export const applications = {
  create: (data) => request({ url: '/applications', method: 'POST', data }),
  getList: (params) => request({ url: '/applications', data: params }),
  approve: (id, data) => request({ url: `/applications/${id}/approve`, method: 'PUT', data }),
  getApprovedRecent: (params) => request({ url: '/applications/approved-recent', data: params }),
  getTodayApprovedOvertime: () => request({ url: '/applications/today-approved-overtime' }),
  getPendingCount: () => request({ url: '/applications/pending-count' }),
  getShiftStats: () => request({ url: '/applications/shift-stats' }),
  delete: (id, phone) => request({ url: `/applications/${id}?applicant_phone=${phone}`, method: 'DELETE' }),
  getMyMonthCount: (phone, type) => request({ url: `/applications/my-month-count?applicant_phone=${phone}&application_type=${type}` }),
  cancelApproved: (id) => request({ url: `/applications/${id}/cancel-approved`, method: 'POST' })
}

export const guestInvitations = {
  create: (data) => request({ url: '/guest-invitations', method: 'POST', data }),
  getList: (params) => request({ url: '/guest-invitations', data: params }),
  review: (id, data) => request({ url: `/guest-invitations/${id}/review`, method: 'PUT', data }),
  lockShouldInvite: (data) => request({ url: '/guest-invitations/lock-should-invite', method: 'POST', data }),
  checkLock: (params) => request({ url: '/guest-invitations/check-lock', data: params }),
  getShouldInvite: (params) => request({ url: '/guest-invitations/should-invite', data: params }),
  generateStats: (data) => request({ url: '/guest-invitations/statistics', method: 'POST', data }),
  getStats: (date, shift) => request({ url: `/guest-invitations/statistics/${date}/${encodeURIComponent(shift)}` }),
  getPeriodStats: (params) => request({ url: '/guest-invitations/period-stats', data: params })
}

export const coachesV2 = {
  clockIn: (coachNo, data = {}) => request({ url: `/coaches/v2/${coachNo}/clock-in`, method: 'POST', data }),
  clockOut: (coachNo) => request({ url: `/coaches/v2/${coachNo}/clock-out`, method: 'POST' }),
  batchShift: (data) => request({ url: '/coaches/v2/batch-shift', method: 'PUT', data }),
  updateShift: (coachNo, data) => request({ url: `/coaches/v2/${coachNo}/shift`, method: 'PUT', data })
}

export const operationLogs = {
  getList: (params) => request({ url: '/operation-logs', data: params })
}

export const authV2 = {
  checkPermission: (phone) => request({ url: `/auth/check-permission?phone=${phone}` })
}

export const lejuanRecords = {
  create: (data) => request({ url: '/lejuan-records', method: 'POST', data }),
  getMyList: (params) => request({ url: '/lejuan-records/my', data: params }),
  updateProof: (id, data) => request({ url: `/lejuan-records/${id}/proof`, method: 'PUT', data }),
  delete: (id) => request({ url: `/lejuan-records/${id}`, method: 'DELETE' }),
  getList: (params) => request({ url: '/lejuan-records/list', data: params }),
  returnRecord: (id, data) => request({ url: `/lejuan-records/${id}/return`, method: 'POST', data })
}

export const missingTableOutOrders = {
  getStats: (params) => request({ url: '/missing-table-out-orders/stats', data: params }),
  getDetail: (params) => request({ url: '/missing-table-out-orders/detail', data: params })
}

export const rewardPenalty = {
  getRecentCount: () => request({ url: '/reward-penalty/recent-count' })
}

export const leaveCalendar = {
  getStats: (yearMonth) => request({ url: '/leave-calendar/stats', data: yearMonth ? { yearMonth } : {} }),
  getDayCount: (date) => request({ url: '/leave-calendar/day-count', data: { date } })
}

export const attendanceReview = {
  getList: (params) => request({ url: '/attendance-review', data: params }),
  getPendingCount: () => request({ url: '/attendance-review/pending-count' }),
  markReviewed: (id) => request({ url: `/attendance-review/${id}/review`, method: 'PUT' })
}

export const guestRankings = {
  getToday: () => request({ url: '/guest-rankings/today' }),
  setExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'PUT' }),
  removeExempt: (coachNo) => request({ url: `/guest-rankings/exempt/${coachNo}`, method: 'DELETE' })
}

// ========== 默认导出（向后兼容） ==========
export default {
  // 公共 API（保留原 api.js 的方法）
  getHome: () => request({ url: '/home' }),
  getFrontConfig: () => request({ url: '/front-config' }),
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
  
  // 教练
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
  
  // 上传图片到OSS
  uploadImageToOSS: async (filePath, fileType = 'image', dir) => { ... },
  
  // 设备统计
  recordDeviceVisit: () => {
    const fp = getDeviceFingerprint()
    return request({ url: '/device/visit', method: 'POST', data: { deviceFp: fp } })
  },
  
  // 后台用户登录
  adminLogin: (data) => request({ url: '/admin/login', method: 'POST', data }),
  
  // 会员相关
  sendSmsCode: (phone) => request({ url: '/sms/send', method: 'POST', data: { phone } }),
  loginBySms: (phone, code) => request({ url: '/member/login-sms', method: 'POST', data: { phone, code } }),
  memberLogin: (data) => request({ url: '/member/login', method: 'POST', data }),
  memberAutoLogin: (code) => request({ url: '/member/auto-login', method: 'POST', data: { code } }),
  getMemberProfile: () => request({ url: '/member/profile', authType: 'member' }),
  updateMemberProfile: (data) => request({ url: '/member/profile', method: 'PUT', data, authType: 'member' }),
  memberLogout: () => request({ url: '/member/logout', method: 'POST', authType: 'member' }),
  
  // 协议
  getUserAgreement: () => request({ url: '/agreement/user' }),
  getPrivacyPolicy: () => request({ url: '/agreement/privacy' }),
  
  // 日志上报
  reportCameraError: (errorInfo) => request({ url: '/log/camera-error', method: 'POST', data: errorInfo }),
  
  // 奖罚管理
  getRewardPenaltyTypes: () => request({ url: "/admin/reward-penalty/types", authType: "admin" }),
  updateRewardPenaltyTypes: (data) => request({ url: "/admin/reward-penalty/types", method: "PUT", data, authType: "admin" }),
  upsertRewardPenalty: (data) => request({ url: "/reward-penalty/upsert", method: "POST", data, authType: "admin" }),
  getRewardPenaltyList: (params) => request({ url: "/reward-penalty/list", data: params }),
  getRewardPenaltyStats: (params) => request({ url: "/reward-penalty/stats", data: params, authType: "admin" }),
  batchExecuteRewardPenalty: (data) => request({ url: "/reward-penalty/batch-execute", method: "POST", data, authType: "admin" }),
  executeRewardPenalty: (id) => request({ url: `/reward-penalty/execute/${id}`, method: "POST", authType: "admin" }),
  getRewardPenaltyTargets: (role) => request({ url: "/reward-penalty/targets", data: { role }, authType: "admin" }),
  updateUserStatus: (username, status) => request({ url: `/admin/users/${username}/status`, method: "PUT", data: { employmentStatus: status }, authType: "admin" }),
  
  // 导出设备指纹函数
  getDeviceFingerprint,
  
  // 内部模块（从 api-v2.js 迁移）
  waterBoards,
  serviceOrders,
  tableActionOrders,
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
  guestRankings
}
```

## 三、迁移步骤

### 3.1 修改 api.js

1. 将 api-v2.js 的所有模块定义（waterBoards、serviceOrders 等）迁移到 api.js
2. 使用 `export const` 具名导出
3. 在默认导出对象中引用这些模块
4. 删除 api-v2.js 中的 request 函数（使用 api.js 的统一 request）

### 3.2 修改前端页面 Import

**需要修改的 26 个文件**：

```
src/pages/internal/attendance-review.vue
src/pages/internal/cashier-dashboard.vue
src/pages/internal/clock.vue
src/pages/internal/guest-invitation-stats.vue
src/pages/internal/invitation-review.vue
src/pages/internal/invitation-upload.vue
src/pages/internal/leave-apply.vue
src/pages/internal/leave-approval.vue
src/pages/internal/leave-calendar.vue
src/pages/internal/leave-request-apply.vue
src/pages/internal/leave-request-approval.vue
src/pages/internal/lejuan-list.vue
src/pages/internal/lejuan-proof.vue
src/pages/internal/lejuan.vue
src/pages/internal/missing-table-out-stats.vue
src/pages/internal/overtime-apply.vue
src/pages/internal/overtime-approval.vue
src/pages/internal/rest-apply.vue
src/pages/internal/rest-approval.vue
src/pages/internal/service-order.vue
src/pages/internal/shift-change-apply.vue
src/pages/internal/shift-change-approval.vue
src/pages/internal/table-action.vue
src/pages/internal/water-board-view.vue
src/pages/internal/water-board.vue
src/pages/member/member.vue
```

**修改规则**：

| 原 Import | 新 Import |
|-----------|-----------|
| `import api from '@/utils/api-v2.js'` | `import api from '@/utils/api.js'` |
| `import { applications } from '@/utils/api-v2.js'` | `import { applications } from '@/utils/api.js'` |
| `import { guestInvitations } from '@/utils/api-v2.js'` | `import { guestInvitations } from '@/utils/api.js'` |
| `import { missingTableOutOrders } from '@/utils/api-v2.js'` | `import { missingTableOutOrders } from '@/utils/api.js'` |
| `import { attendanceReview } from '@/utils/api-v2.js'` | `import { attendanceReview } from '@/utils/api.js'` |

**批量替换命令**：

```bash
# 替换所有 api-v2.js 为 api.js
cd /TG/tgservice-uniapp/src
find . -name "*.vue" -o -name "*.js" | xargs sed -i "s|from '@/utils/api-v2.js'|from '@/utils/api.js'|g"
```

### 3.3 删除 api-v2.js

确认所有页面正常工作后，删除 `/TG/tgservice-uniapp/src/utils/api-v2.js`。

## 四、注意事项

### 4.1 request 函数差异处理

api-v2.js 的模块调用时不传 authType，依赖默认逻辑。合并后的 request 函数需要保证：

```javascript
// 默认行为：adminToken || coachToken || memberToken
const token = options.authType === 'member' ? memberToken 
  : options.authType === 'coach' ? coachToken 
  : options.authType === 'admin' ? adminToken 
  : (adminToken || coachToken || memberToken)  // 默认逻辑
```

这与 api-v2.js 的 `adminToken || coachToken` 逻辑稍有不同（多了 memberToken），但这是**向后兼容**的，不会影响现有功能。

### 4.2 模块命名冲突

api.js 中已有的嵌套模块：
- `applications: { getPendingCount }`（默认导出对象中）
- `rewardPenalty: { getRecentCount }`（默认导出对象中）

合并后需要确保：
1. 具名导出的 `applications` 和 `rewardPenalty` 包含完整方法
2. 默认导出对象中引用这些模块（而不是重复定义）

### 4.3 测试验证

合并后需要测试：
1. 所有 26 个页面功能正常
2. 默认导入和具名导入都能正常工作
3. Token 认证逻辑正确（教练登录、后台登录、会员登录）

## 五、文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `/TG/tgservice-uniapp/src/utils/api.js` | 重写 | 合并 api-v2.js 的所有模块 |
| `/TG/tgservice-uniapp/src/utils/api-v2.js` | 删除 | 迁移完成后删除 |
| 26 个页面文件 | 修改 import | 替换 `api-v2.js` 为 `api.js` |

## 六、预期效果

1. **代码更清晰**：所有 API 集中在一个文件
2. **维护更方便**：修改 request 函数只需改一处
3. **向后兼容**：现有代码无需大幅修改
4. **扩展性强**：新模块可以直接使用具名导出
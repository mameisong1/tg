# 约客审查功能改造设计方案

## 一、现状分析

### 已有功能
- **invitation-review.vue**: 约客审查页面（标题"约客审查-{shift}"）
- **invitation-stats.vue**: 约客统计页面（需删除）
- **invitation-upload.vue**: 上传约客记录页面
- **后端 API**: 已有完整的约客管理接口（guest-invitations.js）

### 后端已实现
- POST `/api/guest-invitations/lock-should-invite` - 锁定应约客人员
- PUT `/api/guest-invitations/:id/review` - 审查（已有时间限制：早班16点前、晚班20点前报错）
- GET `/api/guest-invitations/statistics/:date/:shift` - 获取统计（已实现统计算法）

## 二、改造内容

### 1. 前端改造（invitation-review.vue）

#### 1.1 标题修改
- 当前：`约客审查-{shift}`
- 改为：`今日约客审查-{shift}`

#### 1.2 添加时间提示
在页面顶部添加提示区域：
```
早班约客审查需在16:00后开始
晚班约客审查需在20:00后开始
```

#### 1.3 新增"开始审查"按钮
- 添加按钮调用 `POST /api/guest-invitations/lock-should-invite`
- 锁定应约客人员（写入数据库，result='应约客'）
- 按钮状态：
  - 未开始：显示"开始审查"
  - 已开始：显示"已锁定应约客人员"，禁用按钮

#### 1.4 新增统计区域
在页面顶部显示：
- 应约客人数
- 已约客人数
- 未约客助教列表
- 无效约客列表

#### 1.5 统计算法（后端已实现）
```
应约客人数 = result IN ('应约客', '待审查', '约客有效', '约客无效')
已约客人数 = result IN ('待审查', '约客有效', '约客无效')
未约客助教 = result='应约客' AND 无截图
无效约客 = result='约客无效'
```

### 2. 删除约客统计页面

#### 2.1 删除文件
- `/TG/tgservice-uniapp/src/pages/internal/invitation-stats.vue`

#### 2.2 修改 pages.json
- 删除 invitation-stats 页面路由配置

#### 2.3 修改 internal-home.vue
- 删除"约客统计"入口按钮

### 3. 后端调整（已基本完成，无需改动）

后端 guest-invitations.js 已实现：
- 时间限制：早班16点前、晚班20点前审查报错
- lock-should-invite API：锁定应约客人员
- 统计算法：符合需求

## 三、实现步骤

### Step 1: 修改 invitation-review.vue
1. 修改标题
2. 添加时间提示
3. 添加"开始审查"按钮和统计区域
4. 添加 lockShouldInvite 方法

### Step 2: 删除约客统计页面
1. 删除 invitation-stats.vue
2. 修改 pages.json
3. 修改 internal-home.vue

### Step 3: 测试验证
1. 测试"开始审查"功能
2. 测试时间限制
3. 测试统计数据正确性

## 四、文件清单

| 文件 | 操作 |
|------|------|
| `/TG/tgservice-uniapp/src/pages/internal/invitation-review.vue` | 修改 |
| `/TG/tgservice-uniapp/src/pages/internal/invitation-stats.vue` | 删除 |
| `/TG/tgservice-uniapp/src/pages.json` | 修改（删除路由） |
| `/TG/tgservice-uniapp/src/pages/internal/internal-home.vue` | 修改（删除入口） |
| `/TG/tgservice-uniapp/src/utils/api-v2.js` | 检查 API 定义 |

## 五、API 接口

### 已有 API（api-v2.js 需要检查）
```javascript
guestInvitations: {
  getList: (params) => request.get('/guest-invitations', { params }),
  create: (data) => request.post('/guest-invitations', data),
  review: (id, data) => request.put(`/guest-invitations/${id}/review`, data),
  getStats: (date, shift) => request.get(`/guest-invitations/statistics/${date}/${shift}`),
  generateStats: (data) => request.post('/guest-invitations/statistics', data),
  // 需要添加
  lockShouldInvite: (data) => request.post('/guest-invitations/lock-should-invite', data),
  getShouldInvite: (params) => request.get('/guest-invitations/should-invite', { params })
}
```

---

*设计方案 - 2026-04-10*
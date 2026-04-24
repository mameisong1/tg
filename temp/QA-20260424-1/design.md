# QA-20260424-1 技术设计方案

## 项目信息

- **需求名称**: 前台H5助教详情页面，邀请助教上桌功能
- **设计日期**: 2026-04-24
- **设计师**: 程序员A
- **设计文档路径**: `/TG/temp/QA-20260424-1/design.md`

---

## 一、需求理解

### 1.1 功能概述

在助教详情页面（coach-detail）新增"邀请上桌"功能，替换现有的"预约教练"按钮。

### 1.2 需求要点

1. **按钮状态**：
   - 按钮名称：邀请上桌（原"预约教练"按钮改名）
   - 水牌状态为"空闲"时：按钮可用
   - 水牌状态非"空闲"时：按钮禁用（灰色）

2. **台桌号检测**：
   - 进入页面时：检查Storage中的台桌号是否失效
   - 失效处理：清空Storage中的台桌号
   - 点击按钮时：再次检查台桌号有效性

3. **交互流程**：
   - 台桌号失效：弹出对话框，提示重新扫码
   - 台桌号有效：弹出确认对话框，显示当前台桌号和助教信息
   - 确认后：发送服务单，显示成功提示

4. **对话框样式**：
   - 复用现有预约助教对话框样式（BeautyModal组件）

5. **服务单内容**：
   - 服务内容：`助教上桌邀请函（${助教工号} ${助教艺名}）`

### 1.3 验收重点

| 序号 | 验收点 | 说明 |
|------|--------|------|
| 1 | 按钮状态同步 | 水牌空闲→可用；非空闲→禁用 |
| 2 | 台桌号失效检测 | 页面加载时检测，失效清空 |
| 3 | 对话框样式一致 | 使用BeautyModal组件 |
| 4 | 服务单正确发送 | 调用POST /api/service-orders |

---

## 二、现有代码分析

### 2.1 助教详情页面

**文件路径**: `/TG/tgservice-uniapp/src/pages/coach-detail/coach-detail.vue`

**关键元素**：
- 按钮位置：底部固定栏 `.book-btn`
- 对话框：`BeautyModal` 组件，`showBookModal` 控制
- 助教数据：`coach.value`，包含 `coach_no`, `employee_id`, `stage_name`
- 水牌状态：`coach.display_status`, `coach.display_status_icon`, `coach.display_status_text`

**数据来源**：
- API调用：`api.getCoach(coachNo.value)`
- 该接口返回助教基本信息 + 水牌状态

### 2.2 水牌状态获取

**API接口**: `GET /api/water-boards/:coach_no`

**返回字段**：
```javascript
{
  coach_no: "001",
  stage_name: "小美",
  status: "早班空闲",  // 或 "早班上桌"、"晚班空闲"、"晚班上桌"、"乐捐"等
  employee_id: "TG001",
  table_no: "A1,A3"
}
```

**空闲状态判断**：
```javascript
// 空闲状态包括：早班空闲、晚班空闲
const isIdle = status === '早班空闲' || status === '晚班空闲'
```

**注意**：助教详情页面的 `coach.display_status` 已经包含了水牌状态的简化显示，但需要精确判断是否为"空闲"。

### 2.3 台桌号Storage

**存储结构**：
```javascript
// 台桌名称
uni.getStorageSync('tableName')  // 例如："A1"

// 台桌授权信息
uni.getStorageSync('tableAuth')  // JSON字符串
{
  tableNo: "A1",
  time: 1699876543210,  // 扫码时间戳
  tableName: "A1",
  tablePinyin: "a1"
}
```

**有效期检测**：
```javascript
// tableAuthExpireMinutes 默认为5分钟（从后端配置获取）
const authStr = uni.getStorageSync('tableAuth')
const auth = JSON.parse(authStr)
const isExpired = (Date.now() - auth.time) > tableAuthExpireMinutes * 60 * 1000
```

**失效处理**：
```javascript
if (isExpired) {
  uni.removeStorageSync('tableName')
  uni.removeStorageSync('tableAuth')
}
```

### 2.4 BeautyModal组件

**文件路径**: `/TG/tgservice-uniapp/src/components/BeautyModal.vue`

**Props**：
- `visible`: Boolean（控制显示）
- `title`: String（标题）
- `content`: String（内容，支持slot）
- `showCancel`: Boolean（是否显示取消按钮）
- `confirmText`: String（确认按钮文字）
- `cancelText`: String（取消按钮文字）

**Events**：
- `@confirm`: 确认回调
- `@cancel`: 取消回调

**样式**：金色主题，圆角卡片，品牌Logo，装饰线条

### 2.5 服务单API

**API接口**: `POST /api/service-orders`

**请求参数**：
```javascript
{
  table_no: "A1",           // 台桌号（必填）
  requirement: "助教上桌邀请函（TG001 小美）",  // 需求内容（必填）
  requester_name: "顾客",   // 请求人姓名（必填）
  requester_type: "顾客"    // 请求人类型（默认"助教"，顾客用"顾客"）
}
```

**返回结果**：
```javascript
{
  success: true,
  data: {
    id: 123,
    status: "待处理"
  }
}
```

---

## 三、技术方案设计

### 3.1 修改文件清单

| 序号 | 文件路径 | 修改类型 | 说明 |
|------|----------|----------|------|
| 1 | `/TG/tgservice-uniapp/src/pages/coach-detail/coach-detail.vue` | 修改 | 前端主逻辑 |
| 2 | `/TG/tgservice-uniapp/src/utils/api.js` | 无需修改 | 服务单API已存在 |

### 3.2 API变更

⚠️ **重要发现**：现有 `POST /api/service-orders` 需要登录认证，但顾客扫码进入时可能未登录。

需要新增公开API：

**新增API**：`POST /api/service-orders/guest`（游客创建服务单，无需认证）
- 路径：`/api/service-orders/guest`
- 认证：无需登录
- 参数：
  ```javascript
  {
    table_no: "普台1",           // 台桌号（必填）
    requirement: "助教上桌邀请函（2 陆飞）",  // 需求内容（必填）
    coach_no: "10002"          // 助教工号（可选，用于记录邀请对象）
  }
  ```
- 实现：在 server.js 中添加公开路由（参考 `/api/cart` 和 `/api/order` 的公开模式）

**现有公开API**（无需登录）：
- `GET /api/coaches/:coachNo`：获取助教详情+水牌状态（已存在，公开）
- `GET /api/coaches/:coachNo/water-status`：获取水牌详细状态（已存在，公开）
- `GET /api/table/:pinyin`：验证台桌有效性（已存在，公开）

### 3.3 数据库变更

无需新增表或字段，现有表结构已满足需求：
- `water_boards`表：存储水牌状态
- `service_orders`表：存储服务单

### 3.4 前端实现细节

#### 3.4.1 按钮改名和状态控制

**原代码**（coach-detail.vue底部栏）：
```vue
<view class="book-btn" @click="showBookModal = true">预约教练</view>
```

**新代码**：
```vue
<view 
  class="book-btn" 
  :class="{ 'disabled': !isCoachIdle }"
  @click="handleInviteClick"
>
  邀请上桌
</view>
```

**状态变量**：
```javascript
const isCoachIdle = ref(false)  // 助教是否空闲

// 在loadCoach中判断水牌状态
const loadCoach = async () => {
  // ... 现有逻辑 ...
  
  // 获取水牌状态（需要额外调用API）
  try {
    const waterBoard = await api.waterBoards.getOne(coachNo.value)
    const status = waterBoard.data?.status
    isCoachIdle.value = status === '早班空闲' || status === '晚班空闲'
  } catch (e) {
    isCoachIdle.value = false
  }
}
```

**样式**：
```css
.book-btn.disabled {
  opacity: 0.4;
  pointer-events: none;
}
```

#### 3.4.2 台桌号失效检测

**页面加载时检测**：
```javascript
onMounted(() => {
  // ... 现有逻辑 ...
  
  // 检查台桌号是否失效
  checkTableAuth()
})

const checkTableAuth = () => {
  const tableName = uni.getStorageSync('tableName')
  const authStr = uni.getStorageSync('tableAuth')
  
  if (!tableName || !authStr) {
    // 未扫码，清空
    clearTableAuth()
    return false
  }
  
  try {
    const auth = JSON.parse(authStr)
    const expireMinutes = 5  // 从配置获取或默认5分钟
    const isExpired = (Date.now() - auth.time) > expireMinutes * 60 * 1000
    
    if (isExpired) {
      clearTableAuth()
      return false
    }
    
    return true
  } catch (e) {
    clearTableAuth()
    return false
  }
}

const clearTableAuth = () => {
  uni.removeStorageSync('tableName')
  uni.removeStorageSync('tableAuth')
}
```

#### 3.4.3 点击按钮逻辑

```javascript
const handleInviteClick = () => {
  // 检查按钮状态
  if (!isCoachIdle.value) {
    uni.showToast({ title: '助教当前不在空闲状态', icon: 'none' })
    return
  }
  
  // 检查台桌号
  const tableName = uni.getStorageSync('tableName')
  const authStr = uni.getStorageSync('tableAuth')
  
  if (!tableName || !authStr) {
    // 未扫码
    showExpiredModal.value = true
    return
  }
  
  try {
    const auth = JSON.parse(authStr)
    const expireMinutes = 5
    const isExpired = (Date.now() - auth.time) > expireMinutes * 60 * 1000
    
    if (isExpired) {
      clearTableAuth()
      showExpiredModal.value = true
      return
    }
    
    // 台桌号有效，显示确认对话框
    currentTableNo.value = tableName
    showConfirmModal.value = true
  } catch (e) {
    clearTableAuth()
    showExpiredModal.value = true
  }
}
```

#### 3.4.4 对话框实现

**新增变量**：
```javascript
const showExpiredModal = ref(false)  // 台桌号失效对话框
const showConfirmModal = ref(false)  // 确认邀请对话框
const currentTableNo = ref('')       // 当前台桌号
const isSubmitting = ref(false)      // 提交状态
```

**失效提示对话框**（模板）：
```vue
<BeautyModal 
  v-model:visible="showExpiredModal"
  title="温馨提示"
  :showCancel="false"
  confirmText="知道了"
  @confirm="showExpiredModal = false"
>
  <template #default>
    <view class="modal-content">
      <text class="modal-text">台桌号已经失效，请重新扫码后进入</text>
    </view>
  </template>
</BeautyModal>
```

**确认邀请对话框**（模板）：
```vue
<BeautyModal 
  v-model:visible="showConfirmModal"
  title="邀请上桌确认"
  :showCancel="true"
  cancelText="取消"
  confirmText="确定邀请"
  @cancel="showConfirmModal = false"
  @confirm="submitInvitation"
>
  <template #default>
    <view class="modal-content">
      <text class="modal-text">
        当前台桌号：{{ currentTableNo }}
      </text>
      <text class="modal-text">
        是否确定邀请 {{ coach.employee_id }} {{ coach.stage_name }} 上桌？
      </text>
    </view>
  </template>
</BeautyModal>
```

**成功提示对话框**（复用原有showBookModal，改名showSuccessModal）：
```vue
<BeautyModal 
  v-model:visible="showSuccessModal"
  title="邀请成功"
  :showCancel="false"
  confirmText="知道了"
  @confirm="showSuccessModal = false"
>
  <template #default>
    <view class="modal-content">
      <text class="modal-text">服务下单成功，请稍等片刻</text>
    </view>
  </template>
</BeautyModal>
```

#### 3.4.5 服务单提交

```javascript
const submitInvitation = async () => {
  showConfirmModal.value = false
  
  if (isSubmitting.value) return
  isSubmitting.value = true
  
  uni.showLoading({ title: '提交中...' })
  
  try {
    const requirement = `助教上桌邀请函（${coach.value.employee_id} ${coach.value.stage_name}）`
    
    await api.serviceOrders.create({
      table_no: currentTableNo.value,
      requirement: requirement,
      requester_name: '顾客',
      requester_type: '顾客'
    })
    
    uni.hideLoading()
    
    // 显示成功提示
    showSuccessModal.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败，请重试', icon: 'none' })
  } finally {
    isSubmitting.value = false
  }
}
```

---

## 四、前后端交互流程

### 4.1 页面加载流程

```
用户进入助教详情页
    ↓
onMounted
    ↓
检查台桌号Storage（checkTableAuth）
    ↓
失效？ → 清空Storage（clearTableAuth）
有效？ → 保留Storage
    ↓
调用 api.getCoach(coachNo) 获取助教信息
    ↓
调用 api.waterBoards.getOne(coachNo) 获取水牌状态
    ↓
判断水牌是否空闲 → 更新 isCoachIdle
    ↓
渲染页面（按钮状态根据 isCoachIdle 显示）
```

### 4.2 点击按钮流程

```
用户点击"邀请上桌"按钮
    ↓
检查按钮是否禁用（isCoachIdle）
    ↓
禁用？ → 提示"助教不在空闲状态"，结束
可用？ → 继续
    ↓
检查台桌号Storage
    ↓
未扫码或失效？
    ↓
    YES → 显示失效对话框（showExpiredModal）
          用户点击"知道了" → 关闭对话框，结束
    ↓
    NO → 台桌号有效，显示确认对话框（showConfirmModal）
         内容：当前台桌号 + 助教工号艺名
    ↓
         用户点击"取消" → 关闭对话框，结束
         用户点击"确定邀请" → submitInvitation
    ↓
submitInvitation
    ↓
调用 POST /api/service-orders
参数：{
  table_no: "A1",
  requirement: "助教上桌邀请函（TG001 小美）",
  requester_name: "顾客",
  requester_type: "顾客"
}
    ↓
成功？ → 显示成功对话框（showSuccessModal）
失败？ → Toast提示错误信息
```

### 4.3 API调用时序图

```
页面加载阶段：
┌─────┐                 ┌──────┐                 ┌──────┐
│前端 │                 │后端  │                 │数据库│
└──┬──┘                 └──┬───┘                 └──┬───┘
   │ GET /api/coaches/:no  │                        │
   ├───────────────────────>│ SELECT FROM coaches    │
   │                        ├───────────────────────>│
   │                        │<───────────────────────┤
   │<───────────────────────┤ coach info             │
   │                        │                        │
   │ GET /api/water-boards/:no                       │
   ├───────────────────────>│ SELECT FROM water_boards│
   │                        ├───────────────────────>│
   │                        │<───────────────────────┤
   │<───────────────────────┤ water board status     │

提交服务单阶段：
┌─────┐                 ┌──────┐                 ┌──────┐
│前端 │                 │后端  │                 │数据库│
└──┬──┘                 └──┬───┘                 └──┬───┘
   │ POST /api/service-orders                      │
   ├───────────────────────>│ INSERT INTO service_orders│
   │                        ├───────────────────────>│
   │                        │<───────────────────────┤
   │<───────────────────────┤ { success: true }     │
```

---

## 五、边界情况和异常处理

### 5.1 边界情况

| 序号 | 边界情况 | 处理方案 |
|------|----------|----------|
| 1 | 助教离职或不存在 | 跳转前已处理，页面显示"教练不存在"后自动返回 |
| 2 | 水牌状态为"乐捐"、"请假"等 | 按钮禁用，不可点击 |
| 3 | Storage中tableAuth格式错误 | try-catch捕获，清空Storage，视为失效 |
| 4 | 台桌号授权有效期配置 | 从前端配置获取，默认5分钟 |
| 5 | 助教工号为空 | 显示"未知"，服务单内容为"助教上桌邀请函（未知 小美）" |
| 6 | 助教艺名为空 | 显示"未命名"，服务单内容为"助教上桌邀请函（TG001 未命名）" |
| 7 | 用户未扫码进入页面 | Storage为空，点击按钮显示"台桌号失效"对话框 |
| 8 | 用户扫码后离开页面很久 | 超过有效期，点击按钮显示"台桌号失效"对话框 |
| 9 | 服务单提交失败 | Toast提示错误信息，允许重试 |
| 10 | 网络请求失败 | Toast提示"网络请求失败" |

### 5.2 异常处理代码

```javascript
// 1. API调用异常
try {
  const waterBoard = await api.waterBoards.getOne(coachNo.value)
  // ...
} catch (e) {
  console.error('获取水牌状态失败:', e)
  isCoachIdle.value = false  // 默认禁用按钮
  uni.showToast({ title: '获取助教状态失败', icon: 'none' })
}

// 2. Storage解析异常
try {
  const auth = JSON.parse(authStr)
  // ...
} catch (e) {
  console.error('解析tableAuth失败:', e)
  clearTableAuth()
  showExpiredModal.value = true
}

// 3. 服务单提交异常
try {
  await api.serviceOrders.create({ ... })
  // ...
} catch (e) {
  console.error('提交服务单失败:', e)
  uni.showToast({ title: e.error || '提交失败，请重试', icon: 'none' })
}
```

---

## 六、编码规范遵守

### 6.1 时间处理

✅ **遵守规范**：
- 前端使用 `TimeUtil`（本项目暂未涉及时间处理）
- 后端API已使用 `TimeUtil.nowDB()`

❌ **禁止**：
- 不使用 `datetime('now')`
- 不手动时区偏移

### 6.2 数据库连接

✅ **遵守规范**：
- 后端使用 `const db = require('../db')`
- 服务单API使用 `enqueueRun`

❌ **禁止**：
- 不创建新的数据库连接

### 6.3 数据库写入

✅ **遵守规范**：
- 服务单API使用 `enqueueRun`（异步队列）
- 无需事务场景

❌ **禁止**：
- 不使用 `db.run('BEGIN TRANSACTION')`

### 6.4 页面显示规范

✅ **遵守规范**：
- 页面显示助教工号：`{{ coach.employee_id }}`
- 对话框显示：`${coach.employee_id} ${coach.stage_name}`

❌ **禁止**：
- 不在页面显示 `coach_no`
- `coach_no` 仅用于API参数（`api.waterBoards.getOne(coachNo)`）

---

## 七、测试建议

### 7.1 单元测试点

| 序号 | 测试点 | 测试方法 |
|------|--------|----------|
| 1 | 水牌状态判断 | 模拟不同水牌状态，验证按钮状态 |
| 2 | 台桌号失效检测 | 模拟过期Storage，验证清空逻辑 |
| 3 | 对话框显示 | 验证对话框内容正确性 |
| 4 | 服务单提交 | Mock API，验证参数正确性 |

### 7.2 集成测试流程

1. **准备数据**：
   - 创建测试助教（水牌状态为"早班空闲"）
   - 创建测试台桌

2. **测试步骤**：
   ```
   步骤1：扫码进入台桌页面
   步骤2：点击助教头像进入详情页
   步骤3：验证按钮状态（应该可用）
   步骤4：点击"邀请上桌"
   步骤5：验证对话框显示（台桌号、助教信息）
   步骤6：点击"确定邀请"
   步骤7：验证服务单创建（检查后台服务单列表）
   ```

3. **异常场景测试**：
   - 修改水牌状态为"早班上桌"，验证按钮禁用
   - 清空Storage，验证失效提示
   - 等待超过有效期，验证失效提示

---

## 八、开发工作量估算

| 序号 | 任务 | 预估时间 |
|------|------|----------|
| 1 | 分析现有代码 | 已完成（2小时） |
| 2 | 设计方案编写 | 已完成（1小时） |
| 3 | 前端代码修改 | 预估2小时 |
| 4 | 本地测试 | 预估1小时 |
| 5 | 测试环境部署 | 预估0.5小时 |
| 6 | 验收测试 | 预估1小时 |
| **总计** | **已完成3小时 + 预估4.5小时 = 7.5小时** |

---

## 九、风险评估

| 序号 | 风险 | 影响 | 应对措施 |
|------|------|------|----------|
| 1 | 水牌状态API延迟 | 用户等待时间长 | 添加loading提示，异步加载 |
| 2 | Storage清空时机 | 用户数据丢失 | 仅清空失效数据，不影响其他 |
| 3 | 服务单提交失败 | 用户无法邀请 | 提示重试，记录日志 |
| 4 | 对话框样式不一致 | 用户体验差 | 复用BeautyModal，保持一致 |

---

## 十、附录

### 10.1 关键代码文件

| 文件 | 路径 |
|------|------|
| 助教详情页 | `/TG/tgservice-uniapp/src/pages/coach-detail/coach-detail.vue` |
| 对话框组件 | `/TG/tgservice-uniapp/src/components/BeautyModal.vue` |
| API工具 | `/TG/tgservice-uniapp/src/utils/api.js` |
| 水牌API | `/TG/tgservice/backend/routes/water-boards.js` |
| 服务单API | `/TG/tgservice/backend/routes/service-orders.js` |

### 10.2 相关文档

| 文档 | 内容 |
|------|------|
| AGENTS.md | 编码规范、数据库规范、页面显示规范 |
| TOOLS.md | 测试环境地址、Chrome实例信息 |

### 10.3 设计方案输出

本设计方案已输出到：`/TG/temp/QA-20260424-1/design.md`

---

**设计方案完成时间**: 2026-04-24 12:30

**下一步**: 程序员B根据此方案进行开发实现。
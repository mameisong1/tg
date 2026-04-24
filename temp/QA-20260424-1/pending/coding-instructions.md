你是程序员A。请按设计稿编码实现。

## 设计稿
```
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
const...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

### 🔴 页面显示规范

- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止：在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止：使用回退逻辑 `employee_id || coach_no`（可能暴露系统编号）
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260424-1/fix-log.md（如有修复）
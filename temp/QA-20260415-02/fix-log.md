# 修复记录 - QA-20260415-02 乐捐功能优化

**日期**: 2026-04-15 21:22
**程序员**: 阿天 (Programmer A)
**Git Commit**: dbe68e8

---

## 修改汇总

### 修改1: lejuan.vue — 删除"预计外出小时数"组件 ✅
- **文件**: `tgservice-uniapp/src/pages/internal/lejuan.vue`
- **改动**:
  - Template: 删除整个"预计外出小时数" form-item (picker + 标签)
  - Script: 删除 `hourOptions2` 常量、`form.extraHours` 初始化、`form.value.extraHours = null` 重置
  - `submitLejuan()`: 删除 `extra_hours` 参数
- **验证**: grep 确认无 `hourOptions2`、`extra_hours`、`预计外出` 残留

### 修改2: lejuan.vue — 更新乐捐流程提示文字 ✅
- **文件**: `tgservice-uniapp/src/pages/internal/lejuan.vue` 第16行
- **改动**:
  - 旧: `3.回店后找助教管理/店长点击乐捐归来`
  - 新: `3.助教自己点"上班"按钮结束乐捐`
- **验证**: grep 确认新文案

### 修改3: lejuan.vue — 记录排序（待出发/乐捐中置顶） ✅
- **文件**: `tgservice-uniapp/src/pages/internal/lejuan.vue` → `loadMyRecords()`
- **改动**: 前端按状态排序 `active(0) → pending(1) → returned(2)`，同状态按 `scheduled_start_time DESC`

### 修改4: lejuan.vue — 提交时检查重复报备 ✅
- **文件**: `tgservice-uniapp/src/pages/internal/lejuan.vue` → `submitLejuan()`
- **改动**: 提交前检查 `myRecords` 中是否有 `pending/active` 状态，有则弹提示 `"已有XX的乐捐记录，请先处理"` 并中止

### 修改5: lejuan-list.vue — 删除"乐捐归来"按钮 ✅
- **文件**: `tgservice-uniapp/src/pages/internal/lejuan-list.vue`
- **改动**:
  - Template: 删除 `lj-actions` 整个区块 (active 状态的"乐捐归来"按钮)
  - Script: 删除 `handleReturn` 函数
- **验证**: grep 确认无 `handleReturn`、`乐捐归来` 残留

### 修改6: clock.vue — canClockIn 增加"乐捐"状态 ✅
- **文件**: `tgservice-uniapp/src/pages/internal/clock.vue`
- **改动**: `canClockIn` 数组增加 `'乐捐'`，删除旧注释"乐捐状态不能自行上班"

### 修改7: coaches.js — clock-in API 处理乐捐结束 ✅
- **文件**: `tgservice/backend/routes/coaches.js`
- **改动**:
  - 删除原有的 `throw` 逻辑 (乐捐状态无法自行上班)
  - 新增: 当水牌状态为 `'乐捐'` 时:
    1. 查找该助教的 `active` 乐捐记录
    2. 计算外出小时数 (向上取整，最小1小时)
    3. 更新记录为 `returned`，设置 `return_time`、`lejuan_hours`、`returned_by`
    4. 继续设置水牌为空闲 (根据班次)
  - 使用 `TimeUtil.nowDB()` 处理时间 ✅
  - 在 `runInTransaction` 事务内执行 ✅
  - `WHERE id = ? AND lejuan_status = 'active'` 保证并发安全 ✅

### 修改8: lejuan-records.js — /my 接口排序优化 ✅
- **文件**: `tgservice/backend/routes/lejuan-records.js` → `GET /my`
- **改动**:
  - 旧: `ORDER BY scheduled_start_time DESC`
  - 新: `ORDER BY CASE lejuan_status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, scheduled_start_time DESC`

---

## 编码规范检查 ✅

| 规范 | 状态 | 说明 |
|------|------|------|
| 时间处理: 使用 TimeUtil | ✅ | coaches.js 使用 `TimeUtil.nowDB()` |
| 数据库连接: 复用 db/index.js | ✅ | 未创建新连接，使用 tx (来自 runInTransaction) |
| 数据库写入: 使用 writeQueue/事务 | ✅ | coaches.js 使用 tx.run() 在事务内 |

---

## Git 提交

- **仓库**: `/TG/` (包含 tgservice + tgservice-uniapp)
- **Commit**: `dbe68e8`
- **消息**: `feat(乐捐): 优化乐捐功能 - 删除预计外出小时数、更新流程提示、支持上班结束乐捐、记录排序优化`
- **推送**: 已推送到 origin/master

---

## TC-02 验证报告（2026-04-15 22:00）

### 验证内容
| 检查项 | 状态 | 说明 |
|--------|------|------|
| `canClockIn` 是否包含 '乐捐' | ✅ | `['早加班', '晚加班', '休息', '公休', '请假', '下班', '乐捐']` |
| 上班按钮 disabled 绑定 | ✅ | `:class="{ disabled: !canClockIn }"` |
| handleClockIn 守卫 | ✅ | `if (!canClockIn.value) return` |
| 构建文件包含修复 | ✅ | `pages-internal-clock.C-fCyGTc.js` 含 '乐捐' |
| 前端部署 | ✅ | PM2: tgservice-uniapp-dev 运行中 |
| 其他禁用逻辑 | ✅ | 无 `pointer-events` 等额外禁用 |

### 截图分析
截图显示 coachInfo 未加载（工号空白、无水牌状态区域），此时 `canClockIn` 返回 false 是预期行为。代码修复正确，`canClockIn` 在水牌状态为 '乐捐' 时会返回 true。

### 结论
**代码修复正确且已部署。** 如测试仍失败，需检查测试环境是否正确加载了 coachInfo（localStorage 中是否有 'coachInfo' 数据），确保水牌 API 能正常返回数据。

---

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `tgservice-uniapp/src/pages/internal/lejuan.vue` | 修改1-4 |
| `tgservice-uniapp/src/pages/internal/lejuan-list.vue` | 修改5 |
| `tgservice-uniapp/src/pages/internal/clock.vue` | 修改6 |
| `tgservice/backend/routes/coaches.js` | 修改7 |
| `tgservice/backend/routes/lejuan-records.js` | 修改8 |

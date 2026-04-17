# 浏览器功能测试报告

**测试时间**: 2026-04-17 19:21 (CST)
**测试环境**: http://127.0.0.1:8089
**Chrome**: 端口 9222 (headless)

## 测试结果总览

| # | 测试用例 | 状态 | 说明 |
|---|---------|------|------|
| 1 | F1: 助教进入购物车页面 - storage中台桌号被清空 | ✅ PASS | 助教登录后 tableName 被清空 |
| 2 | F2: 助教进入商品点单页 - storage中台桌号被清空 | ✅ PASS | 助教登录后 tableName 被清空 |
| 3 | F3: 助教进入服务下单页 - form.table_no为空 | ✅ PASS | 页面显示时台桌号字段为空 |
| 4 | F4: 助教单台桌自动选中 | ❌ FAIL | 点击台桌号字段后未检测到自动选中效果 |
| 5 | TC-BR-01: 普通用户扫码进入 - 台桌号不被清空 | ❌ FAIL | products 页面加载后 tableName 被清空 |
| 6 | TC-BR-02: 助教进入购物车 - 无台桌号下单报错 | ✅ PASS | 页面显示"台桌：未选择" |
| 7 | TC-BR-03: 后台用户进入购物车 - 无台桌号下单报错 | ✅ PASS | 页面显示"台桌：未选择" |
| 8 | TC-BR-04: 助教进入服务下单页 - 无台桌号提交报错 | ✅ PASS | 提交后弹出"请选择台桌"提示 |
| 9 | TC-BR-05: 后台用户进入服务下单页 - 无台桌号提交报错 | ✅ PASS | 提交后弹出"请选择台桌"提示 |

## 统计

| 指标 | 数量 |
|------|------|
| ✅ 通过 | 7 |
| ❌ 失败 | 2 |
| ⚠️ 错误 | 0 |
| **总计** | **9** |
| **通过率** | **78%** |

---

## 失败用例分析

### F4: 助教单台桌自动选中 — FAIL

**测试步骤**：
1. DB 设置教练 10011 的 water_boards status='晚班上桌', table_no='VIP3'
2. 助教登录后进入服务下单页
3. 点击台桌号字段，期望自动选中 VIP3

**实际结果**：点击后未检测到自动选中效果，页面没有 toast 提示也没有选中 VIP3

**可能原因**：
- 助教登录后 coachInfo 存储在 localStorage 中，但在服务下单页的 handleTableFieldClick 中读取 coachNo 可能为空或不匹配
- API 请求 `waterBoards.getOne(coachNo)` 可能返回的数据结构不符合预期
- headless Chrome 环境下 Vue 组件的点击事件可能没有被正确触发

**建议**：手动在浏览器中验证 F4 功能，确认水牌 API 返回是否正确。

### TC-BR-01: 普通用户扫码进入 - 台桌号不被清空 — FAIL

**测试步骤**：
1. 未登录，设置 localStorage tableName="VIP3", tableAuth
2. 进入商品页 `/pages/products/products`
3. 进入购物车页 `/pages/cart/cart`
4. 期望 tableName 仍为 "VIP3"

**实际结果**：进入商品页后 tableName 变为 null

**可能原因**：
- products 页面的 `onShow` 或 `onMounted` 钩子中清空了 tableName
- 对于非扫码用户（没有有效 coachInfo/adminInfo），页面逻辑可能错误地清除了 tableName

**建议**：检查 products.vue 和 cart.vue 的 onShow/onMounted 逻辑，确认是否对非登录用户也清除了 tableName。

---

## 测试环境说明

- 助教登录使用实际凭证：工号=12, 艺名=十七, 身份证后6位=171542
- 后台用户登录因 admin-login 页面需要手机号（tgadmin 用户无手机号），改用 API 直接获取 token
- 助教登录时 coach-login 页面检测到已有登录态会自动跳转到 coach-profile，测试中使用已有登录态继续执行

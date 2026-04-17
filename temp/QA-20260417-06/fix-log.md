# QA-20260417-06 修复日志

## 需求
为 table-action-orders API 新增专用统计接口 `/api/table-action-orders/stats`，返回指定日期范围内的上桌单、下桌单、取消单统计数量。解决当前前端数据概览页面因 limit=50 导致统计数据不准确的问题。

## 修改内容

### 后端
- **文件**: `/TG/tgservice/backend/routes/table-action-orders.js`
- **新增路由**: `GET /api/table-action-orders/stats`
  - 参数: `date_start` (YYYY-MM-DD), `date_end` (YYYY-MM-DD)，均必填
  - 返回: `table_in_count`, `table_out_count`, `cancel_count`, `total_count`
  - 使用 SQL `COALESCE(SUM(CASE WHEN ...))` 聚合查询，不受 limit 限制
  - 参数校验：必填检查、格式校验、逻辑校验（start ≤ end）

### 前端
- **文件**: `/TG/tgservice-uniapp/src/utils/api-v2.js`
- **新增方法**: `tableActionOrders.getStats(params)`

## 测试结果

| # | 测试场景 | 结果 |
|---|---------|------|
| 1 | 正常查询日期范围 (2026-04-15 ~ 2026-04-17) | ✅ 上桌76/下桌24/取消16/总计116 |
| 2 | 查询今天（无数据） | ✅ 所有计数为0 |
| 3 | 缺少 date_start | ✅ 返回 400 错误 |
| 4 | 日期格式错误 | ✅ 返回 400 错误 |
| 5 | 起始晚于结束 | ✅ 返回 400 错误 |
| 6 | 无认证 token | ✅ 返回未授权 |
| 7 | 统计值准确性验证（对比 list 接口手动计算） | ✅ 完全匹配 |

## Git 提交
- tgservice: `fa2765f` - feat: 新增 GET /api/table-action-orders/stats 统计接口
- tgservice-uniapp: 包含在同一 commit 中（统一仓库）

# 修复记录 - QA-20260418-02

## Bug Fix: summary.executedCount 按执行状态过滤时计算错误

**发现时间**: 2026-04-18 21:56
**发现用例**: TC-004（统计查询-按执行状态过滤）

**问题**: 当 `execStatus=已执行` 时，`summary.executedCount = -4`（负数）

**原因**: `pendingCount` 查询固定查询 `exec_status='未执行'` 的记录数，未加入 `execStatus` 过滤条件。
当用户过滤 `execStatus=已执行` 时，`totalCount` 是已执行记录数（如5条），但 `pendingCount` 仍然是全部未执行记录数（如9条），导致 `executedCount = 5 - 9 = -4`。

**修复**: 根据 `execStatus` 参数正确计算：
- `execStatus=已执行` → pendingCount=0, executedCount=totalCount
- `execStatus=未执行` → pendingCount=totalCount, executedCount=0
- 无过滤 → 用原 pendingCount 查询结果

**Git commit**: `992ea34`

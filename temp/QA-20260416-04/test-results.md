# 测试报告 - 助教离店后水牌台桌号清除修复

## 测试环境
- 后端: http://127.0.0.1:8088 (PM2: tgservice-dev)
- 数据库: /TG/tgservice/db/tgservice.db
- 测试时间: 2026-04-16 10:50

## 测试结果汇总

| 状态 | 数量 |
|------|------|
| ✅ 通过 | 10 |
| ❌ 失败 | 0 |

## 详细测试用例

| 用例ID | 测试项 | 优先级 | 操作步骤 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|----------|------|
| TC-001 | 水牌状态改为休息 - table_no清除 | P0 | PUT /api/water-boards/10999/status {"status":"休息"} | table_no=NULL | table_no=NULL | ✅通过 |
| TC-002 | 水牌状态改为公休 - table_no清除 | P0 | PUT /api/water-boards/10999/status {"status":"公休"} | table_no=NULL | table_no=NULL | ✅通过 |
| TC-003 | 水牌状态改为请假 - table_no清除 | P0 | PUT /api/water-boards/10999/status {"status":"请假"} | table_no=NULL | table_no=NULL | ✅通过 |
| TC-004 | 水牌状态改为下班 - table_no+clock_in_time清除 | P0 | PUT /api/water-boards/10999/status {"status":"下班"} | table_no=NULL, clock_in_time=NULL | table_no=NULL, clock_in_time=NULL | ✅通过 |
| TC-005 | 审批通过公休申请 - table_no清除 | P0 | PUT /api/applications/:id/approve {"status":1} | status=公休, table_no=NULL | status=公休, table_no=NULL | ✅通过 |
| TC-006 | 批量修改班次 - table_no保留 | P1 | PUT /api/coaches/v2/batch-shift {"coach_no_list":["10999"],"shift":"晚班"} | status=晚班上桌, table_no=QA台1 | status=晚班上桌, table_no=QA台1 | ✅通过 |
| TC-007 | 单个修改班次 - table_no保留 | P1 | PUT /api/coaches/v2/10999/shift {"shift":"晚班"} | status=晚班上桌, table_no=QA台1 | status=晚班上桌, table_no=QA台1 | ✅通过 |
| TC-008 | 正常业务 - 空闲→上桌 | P0 | PUT /api/water-boards/10999/status {"status":"早班上桌","table_no":"QA台1"} | status=早班上桌, table_no=QA台1 | status=早班上桌, table_no=QA台1 | ✅通过 |
| TC-011 | 异常流程 - 水牌不存在 | P2 | PUT /api/water-boards/99999/status {"status":"休息"} | 返回404 | 返回404 | ✅通过 |
| TC-012 | 异常流程 - 无效状态值 | P2 | PUT /api/water-boards/10999/status {"status":"非法状态"} | 返回400 | 返回400 | ✅通过 |

## 修复验证结论

**所有核心修复均验证通过：**

1. ✅ 后台手动改状态为休息/公休/请假/下班时，table_no 被正确清除
2. ✅ 下班状态额外清除 clock_in_time
3. ✅ 审批通过公休申请时，table_no 被正确清除
4. ✅ 正常业务（空闲↔上桌、班次切换）不受影响，table_no 正确保留
5. ✅ 异常流程处理正确（404/400）

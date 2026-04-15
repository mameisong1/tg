# QA2 测试结果：助教重复上桌功能支持

**测试日期**: 2026-04-15 03:43:55
**测试员**: B2
**测试环境**: 后端 http://127.0.0.1:8088 (PM2 tgservice-dev)
**测试助教**: 10007 小月

## 测试概览

| 项目 | 数量 |
|------|------|
| 总计 | 21 |
| ✅ 通过 | 9 |
| ❌ 失败 | 11 |
| ⚠️ 警告 | 1 |

## 通过率

**45.0%** (9/20 不含警告项)

## 详细结果

| # | 测试用例 | 结果 | 详情 |
|---|---------|------|------|
| SETUP | 登录 | ✅ PASS | 获取 token 成功 |
| SETUP | 初始化 | ✅ PASS | status=N/A, table_no=null |
| TC-F01 | 空闲助教首次上桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":186,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A |
| TC-F02 | 已在桌上再上另一桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":187,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A |
| TC-F03 | 多桌助教上第三桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":188,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A |
| TC-F04 | 下桌单移除指定台桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":189,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A |
| TC-F05 | 继续下桌直到剩余一桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":190,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A |
| TC-F06 | 最后一桌下桌变空闲 | ❌ FAIL | API=200 {"success":true,"data":{"id":191,"status":"待处理","water_board_status":"晚班空闲"}}, table_no=null, status=N/A |
| TC-F07 | 一致性检查-A1在列表中 | ❌ FAIL | A1 ∉ [] |
| TC-F08 | 一致性检查-B2不在列表中 | ✅ PASS | B2 ∉ []（应被拒绝） |
| TC-B01 | 重复上同一桌 | ✅ PASS | 已在台桌 A1 上，不能重复上桌 |
| TC-B02 | 下桌选择不在桌上的台桌号 | ✅ PASS | 当前不在台桌 B99 上 |
| TC-B03 | 空闲状态下下桌 | ✅ PASS | 当前状态（晚班空闲）不允许下桌 |
| TC-B04 | 取消单移除指定台桌 | ❌ FAIL | API=200 {"success":true,"data":{"id":196,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null |
| TC-B05 | 取消全部后变空闲 | ❌ FAIL | API=400 {"success":false,"error":"当前状态（晚班空闲）不允许下桌"}, table_no=null, status=N/A |
| TC-D01 | 水牌列表显示多桌号 | ✅ PASS | table_no=A1,A3, table_no_list=["A1","A3"] |
| TC-D02 | 水牌单条查询显示多桌号 | ✅ PASS | table_no=A1,A3, table_no_list=["A1","A3"] |
| TC-D03 | 水牌状态查询显示多桌号 | ❌ FAIL | table_no=null, table_no_list=null, raw={"success":true,"data":{"coach_no":"10007","stage_name":"小月","status":"晚班上桌","table_no":"A1,A3","updated_at":"2026-04-15 03:43:54","table_no_list":["A1","A3"]}} |
| TC-D04 | 前端商品页默认台桌号为空 | ⚠️ WARN | 需要前端H5登录后验证，本次跳过 |
| TC-A01 | water-boards返回table_no_list | ✅ PASS | ["A1","A3"] |
| TC-A02 | water-status返回table_no_list | ❌ FAIL | table_no_list=null, raw={"success":true,"data":{"coach_no":"10007","stage_name":"小月","status":"晚班上桌","table_no":"A1,A3","updated_at":"2026-04-15 03:43:54","table_no_list":["A1","A3"]}} |

## 结论

**存在 11 个失败项**，需要修复。

### 失败项分析

- **TC-F01** 空闲助教首次上桌: API=200 {"success":true,"data":{"id":186,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A
- **TC-F02** 已在桌上再上另一桌: API=200 {"success":true,"data":{"id":187,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A
- **TC-F03** 多桌助教上第三桌: API=200 {"success":true,"data":{"id":188,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A
- **TC-F04** 下桌单移除指定台桌: API=200 {"success":true,"data":{"id":189,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A
- **TC-F05** 继续下桌直到剩余一桌: API=200 {"success":true,"data":{"id":190,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null, status=N/A
- **TC-F06** 最后一桌下桌变空闲: API=200 {"success":true,"data":{"id":191,"status":"待处理","water_board_status":"晚班空闲"}}, table_no=null, status=N/A
- **TC-F07** 一致性检查-A1在列表中: A1 ∉ []
- **TC-B04** 取消单移除指定台桌: API=200 {"success":true,"data":{"id":196,"status":"待处理","water_board_status":"晚班上桌"}}, table_no=null
- **TC-B05** 取消全部后变空闲: API=400 {"success":false,"error":"当前状态（晚班空闲）不允许下桌"}, table_no=null, status=N/A
- **TC-D03** 水牌状态查询显示多桌号: table_no=null, table_no_list=null, raw={"success":true,"data":{"coach_no":"10007","stage_name":"小月","status":"晚班上桌","table_no":"A1,A3","updated_at":"2026-04-15 03:43:54","table_no_list":["A1","A3"]}}
- **TC-A02** water-status返回table_no_list: table_no_list=null, raw={"success":true,"data":{"coach_no":"10007","stage_name":"小月","status":"晚班上桌","table_no":"A1,A3","updated_at":"2026-04-15 03:43:54","table_no_list":["A1","A3"]}}

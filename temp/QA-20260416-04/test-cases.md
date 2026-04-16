# 助教离店后水牌台桌号清除 - API 测试用例

## 测试环境
- 后端地址: `http://127.0.0.1:8088`
- 数据库: `/TG/tgservice/db/tgservice.db`
- 登录账号: `tgadmin` / `mms633268`

## 测试数据
- 测试助教: `coach_no=10999`, `stage_name=QA测试助教`, `shift=早班`
- 初始状态: `早班上桌`, `table_no=QA台1`

---

## TC-001: 水牌状态改为休息 - table_no 必须清除
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 登录获取 token
2. 确认初始状态: `GET /api/water-boards/10999` → status=早班上桌, table_no=QA台1
3. 修改状态为休息: `PUT /api/water-boards/10999/status` body=`{"status":"休息"}`
4. 验证 API 返回: success=true, data.status=休息
5. 查询数据库: `SELECT table_no FROM water_boards WHERE coach_no='10999'`
6. 查询操作日志: `SELECT old_value, new_value FROM operation_logs WHERE target_type='water_board' ORDER BY id DESC LIMIT 1`

**预期结果：**
- API 返回成功，status=休息
- 数据库中 table_no 为 NULL 或空字符串
- 操作日志中 old_value.table_no="QA台1", new_value.table_no=null

---

## TC-002: 水牌状态改为公休 - table_no 必须清除
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 先重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 修改状态为公休: `PUT /api/water-boards/10999/status` body=`{"status":"公休"}`
3. 验证 API 返回: success=true, data.status=公休
4. 查询数据库验证 table_no 为空

**预期结果：**
- API 返回成功，status=公休
- 数据库中 table_no 为 NULL 或空字符串

---

## TC-003: 水牌状态改为请假 - table_no 必须清除
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 先重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 修改状态为请假: `PUT /api/water-boards/10999/status` body=`{"status":"请假"}`
3. 验证 API 返回: success=true, data.status=请假
4. 查询数据库验证 table_no 为空

**预期结果：**
- API 返回成功，status=请假
- 数据库中 table_no 为 NULL 或空字符串

---

## TC-004: 水牌状态改为下班 - table_no 必须清除
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 先重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 修改状态为下班: `PUT /api/water-boards/10999/status` body=`{"status":"下班"}`
3. 验证 API 返回: success=true, data.status=下班
4. 查询数据库验证 table_no 为空，clock_in_time 为 NULL

**预期结果：**
- API 返回成功，status=下班
- 数据库中 table_no 为 NULL 或空字符串
- clock_in_time 为 NULL

---

## TC-005: 审批通过公休申请 - table_no 必须清除
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/applications/:id/approve (applications.js) |
| 前置条件 | 存在一条公休申请待审批，对应助教 status=早班空闲, table_no 有值 |

**操作步骤：**
1. 重置测试数据: `UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999'`
2. 插入一条待审批的公休申请: `INSERT INTO applications (applicant_phone, application_type, status, apply_date) VALUES ('10999', '公休申请', '待处理', date('now'))`
3. 获取申请 ID
4. 审批通过: `PUT /api/applications/:id/approve` body=`{"approveStatus":1}`
5. 查询数据库: `SELECT status, table_no FROM water_boards WHERE coach_no='10999'`

**预期结果：**
- API 返回成功
- 数据库中 water_boards 的 status=公休, table_no 为 NULL 或空字符串

---

## TC-006: 批量修改班次 - 工作状态切换时 table_no 应保留
| 字段 | 内容 |
|------|------|
| 优先级 | P1 |
| 操作路径 | PUT /api/coaches/batch-shift (coaches.js) |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 重置教练班次: `UPDATE coaches SET shift='早班' WHERE coach_no='10999'`
3. 批量修改班次为晚班: `PUT /api/coaches/batch-shift` body=`{"coach_no_list":["10999"],"shift":"晚班"}`
4. 查询数据库: `SELECT status, table_no FROM water_boards WHERE coach_no='10999'`

**预期结果：**
- API 返回成功
- 数据库中 status=晚班上桌, table_no=QA台1（保留）

---

## TC-007: 单个修改班次 - 工作状态切换时 table_no 应保留
| 字段 | 内容 |
|------|------|
| 优先级 | P1 |
| 操作路径 | PUT /api/coaches/v2/:coach_no/shift (coaches.js) |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 重置教练班次: `UPDATE coaches SET shift='早班' WHERE coach_no='10999'`
3. 单个修改班次为晚班: `PUT /api/coaches/v2/10999/shift` body=`{"shift":"晚班"}`
4. 查询数据库: `SELECT status, table_no FROM water_boards WHERE coach_no='10999'`

**预期结果：**
- API 返回成功
- 数据库中 status=晚班上桌, table_no=QA台1（保留）

---

## TC-008: 正常业务 - 空闲→上桌 不受影响
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班空闲, table_no 为空 |

**操作步骤：**
1. 重置测试数据: `UPDATE water_boards SET status='早班空闲', table_no=NULL WHERE coach_no='10999'`
2. 修改状态为上桌: `PUT /api/water-boards/10999/status` body=`{"status":"早班上桌","table_no":"QA台1"}`
3. 验证返回

**预期结果：**
- API 返回成功，status=早班上桌, table_no=QA台1
- 数据库中 table_no=QA台1

---

## TC-009: 正常业务 - 上桌→空闲 不受影响
| 字段 | 内容 |
|------|------|
| 优先级 | P0 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |
| 前置条件 | coach_no=10999, status=早班上桌, table_no=QA台1 |

**操作步骤：**
1. 重置测试数据: `UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999'`
2. 修改状态为空闲: `PUT /api/water-boards/10999/status` body=`{"status":"早班空闲","table_no":""}`
3. 验证返回

**预期结果：**
- API 返回成功，status=早班空闲
- 数据库中 table_no 为空字符串（手动传空）

---

## TC-010: 操作日志记录 table_no 变更
| 字段 | 内容 |
|------|------|
| 优先级 | P1 |
| 操作路径 | 综合验证 |
| 前置条件 | 完成 TC-001 |

**操作步骤：**
1. 查询操作日志: `SELECT operation_type, old_value, new_value FROM operation_logs WHERE target_type='water_board' ORDER BY id DESC LIMIT 5`
2. 验证最近的水牌变更日志中 old_value 包含原 table_no

**预期结果：**
- 操作日志中 old_value 为 `{"status":"早班上桌","table_no":"QA台1"}`
- new_value 中 table_no 为 null

---

## TC-011: 异常流程 - 水牌不存在时修改状态
| 字段 | 内容 |
|------|------|
| 优先级 | P2 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |

**操作步骤：**
1. 修改不存在的助教: `PUT /api/water-boards/99999/status` body=`{"status":"休息"}`

**预期结果：**
- API 返回 404, error="水牌不存在"

---

## TC-012: 异常流程 - 无效状态值
| 字段 | 内容 |
|------|------|
| 优先级 | P2 |
| 操作路径 | PUT /api/water-boards/:coach_no/status |

**操作步骤：**
1. 传入无效状态: `PUT /api/water-boards/10999/status` body=`{"status":"非法状态"}`

**预期结果：**
- API 返回 400, error="无效的状态值"
- 数据库中 table_no 保持不变

---

## 测试执行顺序

```
1. 登录获取 token
2. TC-001: 水牌→休息
3. TC-002: 水牌→公休
4. TC-003: 水牌→请假
5. TC-004: 水牌→下班
6. TC-005: 审批公休申请
7. TC-006: 批量修改班次（保留table_no）
8. TC-007: 单个修改班次（保留table_no）
9. TC-008: 空闲→上桌（正常业务）
10. TC-009: 上桌→空闲（正常业务）
11. TC-010: 验证操作日志
12. TC-011: 异常-不存在
13. TC-012: 异常-无效状态
```

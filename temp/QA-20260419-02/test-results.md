# 测试结果：上下班打卡时间记录功能

**需求编号**: QA-20260419-02  
**测试日期**: 2026-04-19  
**测试环境**: http://127.0.0.1:8088 (PM2 开发环境)  
**数据库**: /TG/tgservice/db/tgservice.db  
**测试策略**: 纯 API/curl + sqlite3 数据库操作  
**测试员**: B（自动化测试）  

---

## 验收重点完成情况

| # | 验收重点 | 状态 |
|---|---------|------|
| 1 | 打卡表结构正确，字段完整 | ✅ 通过 (TC-001) |
| 2 | 上班打卡正常记录 | ✅ 通过 (TC-010, TC-011, TC-012) |
| 3 | 下班打卡能正确关联上班记录 | ✅ 通过 (TC-020, TC-021) |
| 4 | 无上班记录时下班打卡被丢弃 | ✅ 通过 (TC-030) |

---

## 测试用例汇总

| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|------|
| TC-001 | 打卡表存在且字段完整 | P0 | 表存在，包含全部必需字段 | 所有字段均已存在（含3个索引），额外有coach_no字段 | ✅通过 |
| TC-010 | 正常上班打卡创建记录 | P0 | API返回success，DB有clock_in_time无clock_out_time | success=true, clock_in_time已写入, clock_out_time=NULL | ✅通过 |
| TC-011 | 重复上班打卡处理 | P0 | 不产生重复记录(最多1条) | 返回"助教已在班状态,无需重复上班"，记录数=1 | ✅通过 |
| TC-012 | 水牌状态同步验证 | P0 | status为空闲，clock_in_time有值 | status=早班空闲, clock_in_time=2026-04-19 11:38:57 | ✅通过 |
| TC-020 | 正常下班打卡关联上班记录 | P0 | clock_out_time写入，clock_in不变，wb=下班，wb_clock=NULL | clock_in/out均已写入，water_boards.status=下班,clock_in=NULL | ✅通过 |
| TC-021 | 多条上班记录关联最新的 | P0 | 下班时间只写入最新记录(08:00) | 最新记录(08:00)cot有值，旧记录(06:00)cot为空 | ✅通过 |
| TC-030 | 无上班记录时下班打卡被丢弃 | P0 | 不创建attendance_records记录 | API返回success但attendance_records无新记录产生 | ✅通过 |
| TC-040 | 多助教各自打卡互不影响 | P1 | 两人各有独立记录 | 陆飞和六六各有独立记录，employee_id/stage_name正确对应 | ✅通过 |
| TC-041 | 助教A下班不影响助教B | P1 | A有clock_out，B无clock_out | A_cot已填写，B_cot仍为NULL | ✅通过 |
| TC-050 | 查询今日打卡记录 | P1 | 返回今日所有打卡记录 | **API不存在**（无查询接口） | ❌失败 |
| TC-051 | 查询指定日期打卡记录 | P1 | 按日期过滤正确 | **API不存在**（无查询接口） | ❌失败 |
| TC-052 | 查询指定助教打卡记录 | P1 | 只返回指定助教记录 | **API不存在**（无查询接口） | ❌失败 |
| TC-060 | 助教只能打自己的卡 | P1 | 返回权限错误 | 返回"只能操作自己的数据"(HTTP 403) | ✅通过 |
| TC-061 | 未登录不能打卡 | P1 | 返回401未登录 | HTTP 401, error="未授权访问" | ✅通过 |
| TC-070 | 跨天场景(晚班跨午夜) | P2 | date为上班当天日期 | date=2026-04-19(正确) | ✅通过 |
| TC-071 | 早班晚班同时打卡 | P2 | 两人记录各自独立正确 | 陆飞/六六记录均正确写入 | ✅通过 |
| TC-072 | 助教不存在时打卡 | P2 | 返回404/不存在错误 | HTTP 404, error="助教不存在" | ✅通过 |
| TC-073 | 离职助教打卡 | P2 | 返回403/已离职错误 | HTTP 403, error="该账号已离职" | ✅通过 |
| TC-074 | 水牌不存在时打卡 | P2 | 返回404/水牌不存在 | HTTP 404, error="水牌不存在" | ✅通过 |
| TC-080 | 多次上下班数据一致性 | P2 | 每次形成完整记录 | 2条完整记录（clock_in和clock_out均有值） | ✅通过 |
| TC-081 | 时间格式验证 | P2 | YYYY-MM-DD HH:MM:SS，无时区标记 | cit=2026-04-19 11:41:28, cot=2026-04-19 11:41:29（格式正确） | ✅通过 |

---

## 统计

| 统计项 | 数量 |
|--------|------|
| 总计 | 21 |
| ✅ 通过 | 18 |
| ❌ 失败 | 3 |
| 通过率 | 85.7% |

### 按优先级

| 优先级 | 通过 | 失败 | 总计 | 通过率 |
|--------|------|------|------|--------|
| P0 | 7 | 0 | 7 | 100% |
| P1 | 4 | 3 | 7 | 57.1% |
| P2 | 7 | 0 | 7 | 100% |

---

## 失败项说明

### TC-050/051/052：查询打卡记录API

**原因**：系统中尚未实现打卡记录查询接口。当前仅有打卡写入接口（`POST /api/coaches/v2/:coach_no/clock-in` 和 `POST /api/coaches/v2/:coach_no/clock-out`），无查询接口。

**建议**：后续补充以下接口：
- `GET /api/admin/attendance-records?date=YYYY-MM-DD` — 查询指定日期打卡记录
- `GET /api/admin/attendance-records?employee_id=X&limit=N` — 查询指定助教打卡记录
- `GET /api/coaches/v2/my-attendance?date=YYYY-MM-DD` — 助教查询自己的打卡记录

**注意**：此功能不影响核心的上下班打卡功能，仅影响管理和查询功能。

---

## 补充发现

1. **API 路径**：打卡接口实际路径为 `/api/coaches/v2/:coach_no/clock-in` 和 `/api/coaches/v2/:coach_no/clock-out`（非测试用例中写的 `/api/coaches/:coach_no/clock-in`）。
2. **表结构差异**：实际表结构比预期多了一个 `coach_no` 字段（INTEGER NOT NULL），且有3个索引（`idx_attendance_date_coach`、`idx_attendance_coach_no`、`idx_attendance_date`）。`employee_id` 字段允许为 NULL（测试用例预期为 NOT NULL），但实际写入时都会填充值。
3. **重复打卡**：系统通过水牌状态校验防止重复打卡（返回"助教已在班状态,无需重复上班"），而非通过attendance_records记录去重。
4. **数据库路径**：测试环境使用 `/TG/tgservice/db/tgservice.db`。

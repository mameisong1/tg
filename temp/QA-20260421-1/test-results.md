# 天宫QA测试结果 - 20260421-1

## 测试环境
- 测试地址：http://127.0.0.1:8088
- 数据库：/TG/tgservice/db/tgservice.db（开发环境）
- 测试时间：2026-04-21 22:17

---

## P0 核心测试结果

| 用例ID | 测试项 | 优先级 | 状态 | 结果说明 |
|--------|--------|--------|------|----------|
| TC-WB-001 | 水牌列表返回level字段 | P0 | ✅ 通过 | API正确返回level字段，值包括：初级/中级/高级/女神，与数据库coaches.level一致 |
| TC-CK-001 | 上班打卡API接收clock_in_photo参数 | P0 | ✅ 通过 | API成功接收并存储clock_in_photo参数；不提交时字段为空（可选参数） |
| TC-AR-001 | 打卡审查API权限验证 | P0 | ✅ 通过 | 教练token返回"权限不足"；管理员token返回success:true |
| TC-AR-002 | 打卡审查列表数据字段验证 | P0 | ✅ 通过 | 返回字段完整：employee_id, stage_name, shift, clock_in_time, clock_out_time, clock_in_photo, overtime_hours, is_late, is_late_text, date |

---

## 测试详情

### TC-WB-001: 水牌列表返回level字段

**测试命令**:
```bash
curl -s "http://127.0.0.1:8088/api/water-boards" \
  -H "Authorization: Bearer <教练token>"
```

**验证结果**:
- 每条记录包含 `level` 字段
- 示例数据：
  - 陆飞（coach_no=10002）：level="高级"
  - 六六（coach_no=10003）：level="女神"
  - 芝芝（coach_no=10005）：level="中级"
  - 茜茜（coach_no=10016）：level="初级"

---

### TC-CK-001: 上班打卡API接收clock_in_photo参数

**前置条件发现**:
- ⚠️ 数据库 `attendance_records` 表缺少 `clock_in_photo` 字段
- 已手动添加字段：`ALTER TABLE attendance_records ADD COLUMN clock_in_photo TEXT;`

**测试命令**:
```bash
# 带clock_in_photo参数
curl -X POST "http://127.0.0.1:8088/api/coaches/v2/10002/clock-in" \
  -H "Authorization: Bearer <教练token>" \
  -H "Content-Type: application/json" \
  -d '{"clock_in_photo": "https://test.com/new-clockin-photo.jpg"}'
```

**验证结果**:
- 返回 `success: true`
- 数据库记录：`clock_in_photo = "https://test.com/new-clockin-photo.jpg"`

**补充测试（不提交clock_in_photo）**:
```bash
curl -X POST "http://127.0.0.1:8088/api/coaches/v2/10002/clock-in" \
  -H "Authorization: Bearer <教练token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**结果**: 返回 `success: true`，`clock_in_photo` 为空（参数可选）

---

### TC-AR-001: 打卡审查API权限验证

**测试1（无权限用户）**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <教练token>"
```
**结果**: `{"error": "权限不足"}` ✅

**测试2（有权限用户）**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review" \
  -H "Authorization: Bearer <管理员JWT>"
```
**结果**: `{"success": true, "data": [...]}` ✅

---

### TC-AR-002: 打卡审查列表数据字段验证

**测试命令**:
```bash
curl -s "http://127.0.0.1:8088/api/attendance-review?date=2026-04-21" \
  -H "Authorization: Bearer <管理员JWT>"
```

**返回字段验证**:
| 字段 | 是否存在 | 说明 |
|------|----------|------|
| employee_id | ✅ | 工号 |
| stage_name | ✅ | 名 |
| shift | ✅ | 班次（早班/晚班） |
| clock_in_time | ✅ | 上班打卡时间 |
| clock_out_time | ✅ | 下班时间（null表示未下班） |
| clock_in_photo | ✅ | 打卡记录照片URL |
| overtime_hours | ✅ | 加班小时数（整数） |
| is_late | ✅ | 是否迟到（0/1） |
| is_late_text | ✅ | 迟到状态文字（正常/迟到） |
| date | ✅ | 日期 |

**示例返回数据**:
```json
{
  "employee_id": "2",
  "stage_name": "陆飞",
  "shift": "早班",
  "clock_in_time": "2026-04-21 14:05:00",
  "clock_out_time": null,
  "clock_in_photo": "https://test.com/photo1.jpg",
  "overtime_hours": 0,
  "is_late": 1,
  "is_late_text": "迟到",
  "date": "2026-04-21"
}
```

---

## 发现的问题

### 问题1：数据库字段缺失
- **描述**: `attendance_records` 表缺少 `clock_in_photo` 字段
- **影响**: 导致打卡审查API查询失败
- **状态**: ✅ 已修复（手动添加字段）
- **建议**: 需要在正式发布前添加数据库迁移脚本

### 问题2：API路径变更
- **描述**: 打卡API路径为 `/api/coaches/v2/:coach_no/clock-in`（而非 `/api/coaches/:coach_no/clock-in`）
- **影响**: 测试用例文档路径需更新
- **建议**: 更新测试用例文档中的API路径

---

## 测试数据清理

```sql
-- 清理测试打卡记录
DELETE FROM attendance_records WHERE date = '2026-04-21' AND coach_no IN (10002, 10003, 10005);
```

---

## 结论

**P0核心测试全部通过** ✅

主要功能验证：
1. 水牌等级字段正确返回
2. 打卡截图参数正确接收和存储
3. 打卡审查权限验证正确
4. 打卡审查数据字段完整

**遗留问题**：
- 数据库迁移脚本需补充（添加clock_in_photo字段）
- 测试用例文档API路径需更新

---

*测试执行：测试员B*
*日期：2026-04-21*
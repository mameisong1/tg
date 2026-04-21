# 编码完成报告 - QA-20260422-01 打卡审查改进

> 程序员A | 2026-04-22 07:40

---

## ✅ 文件变更清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `backend/db/migrations/v2.4-attendance-late-reviewed.sql` | **新增** | ALTER TABLE 添加 is_late, is_reviewed + 索引 |
| 2 | `backend/routes/coaches.js` | **修改** | 新增 calculateIsLate 函数，上班打卡 INSERT 写入 is_late |
| 3 | `backend/routes/attendance-review.js` | **修改** | SQL 增加 ar.id/is_late/is_reviewed，删除动态计算逻辑，新增 pending-count 和 review 路由 |
| 4 | `src/utils/api-v2.js` | **修改** | attendanceReview 新增 getPendingCount, markReviewed |
| 5 | `src/pages/member/member.vue` | **修改** | 打卡审查按钮加 badge 角标，新增 attendanceReviewCount ref |
| 6 | `src/pages/internal/attendance-review.vue` | **修改** | 顶部审查提示、审查完毕按钮、is_reviewed 状态显示 |

---

## ✅ 数据库迁移（测试环境已执行）

```sql
ALTER TABLE attendance_records ADD COLUMN is_late INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN is_reviewed INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_attendance_late_unreviewed ON attendance_records(date, is_late, is_reviewed);
```

**验证结果**：
- `is_late` 列: ✅ 存在（位置 10）
- `is_reviewed` 列: ✅ 存在（位置 11）
- `idx_attendance_late_unreviewed` 索引: ✅ 存在

---

## ✅ Git 提交

| 仓库 | Commit | 说明 |
|------|--------|------|
| tgservice (后端) | `c01118a` | feat: 打卡审查改进 - 新增is_late/is_reviewed字段 |
| tgservice (后端) | `975eef0` | fix: attendance-review list API 使用 all 而非 get |

> 前端文件与后端在同一仓库中，已包含在上述提交中。

---

## ✅ API 验证（测试环境）

### 1. GET /api/attendance-review/pending-count
```json
{ "success": true, "data": { "count": 0 } }
```
✅ 正常返回

### 2. GET /api/attendance-review
```json
{
  "success": true,
  "data": [{
    "id": 29,
    "employee_id": "999",
    "is_late": 0,
    "is_late_text": "正常",
    "is_reviewed": 0,
    ...
  }]
```
✅ 返回包含 id、is_late、is_reviewed 字段

### 3. PUT /api/attendance-review/:id/review (404测试)
```json
{ "success": false, "error": "打卡记录不存在" }
```
✅ 正确返回 404

### 4. 迟到计算逻辑（calculateIsLate）
- ✅ 早班基准 14:00，晚班基准 18:00
- ✅ 加班小时数从 applications 表查询
- ✅ expectedHour 使用 Math.max(0, ...) 防御负数
- ✅ 字符串时间比较（YYYY-MM-DD HH:MM:SS 格式）
- ✅ 在 runInTransaction 事务内执行

---

## ⚠️ 已知问题

1. **历史数据 is_late=0**: 迁移前已有的打卡记录 is_late 默认为 0，不算迟到。这是设计预期的行为。
2. **教练 clock-in 测试**: 测试环境的教练登录方式（微信小程序）无法通过 curl 模拟，因此无法直接测试 clock-in 时的 is_late 计算。逻辑代码已按设计稿实现，需要前端测试员验证。

---

## 编码规范检查

| 规范项 | 状态 |
|--------|------|
| 时间处理: 使用 TimeUtil.nowDB() / TimeUtil.todayStr() | ✅ |
| 禁止 datetime('now') / 手动时区偏移 | ✅ |
| 数据库连接: 使用 require('../db') 导出方法 | ✅ |
| 数据库写入: 使用 runInTransaction / run | ✅ |
| 页面显示: employee_id，不显示 coach_no | ✅ |

---

## 待测试员B验证

1. 早班助教正常时间打卡（14:00 前）→ is_late = 0
2. 早班助教迟到打卡（14:01）→ is_late = 1
3. 有加班申请的迟到计算
4. 审查页面提示显示
5. 审查完毕按钮功能
6. 角标数量显示和更新

---

*编码完成，等待测试员B验收。*

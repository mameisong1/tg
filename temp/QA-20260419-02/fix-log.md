# 修复记录 QA-20260419-02

## 程序员A - 上下班打卡时间记录功能编码实现

### 日期
2026-04-19

### 变更文件

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `backend/db/migrations/v2.2-attendance.sql` | 数据库迁移脚本：创建 attendance_records 表及索引 |
| 修改 | `backend/routes/coaches.js` | clock-in 端点增加 INSERT 打卡记录；clock-out 端点增加 SELECT+UPDATE 下班时间逻辑 |

### 具体改动

#### 1. 新建迁移脚本 `v2.2-attendance.sql`
- 创建 `attendance_records` 表，字段：id, date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, created_at, updated_at
- 创建 3 个索引：idx_attendance_date_coach, idx_attendance_coach_no, idx_attendance_date

#### 2. 修改 `coaches.js` — clock-in 端点
- SELECT coaches 时增加 `employee_id` 字段
- 在 `runInTransaction` 事务内，水牌状态更新后，新增：
  ```javascript
  await tx.run(`INSERT INTO attendance_records (date, coach_no, employee_id, stage_name, clock_in_time, clock_out_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`, [...])
  ```
- 时间使用 `TimeUtil.nowDB()` 和 `TimeUtil.todayStr()`

#### 3. 修改 `coaches.js` — clock-out 端点
- 在 `runInTransaction` 事务内，水牌状态更新后，新增：
  ```javascript
  const attendanceRecord = await tx.get(`SELECT id FROM attendance_records WHERE coach_no = ? AND date = ? AND clock_out_time IS NULL ORDER BY clock_in_time DESC LIMIT 1`, [coach_no, todayStr]);
  if (attendanceRecord) {
    await tx.run(`UPDATE attendance_records SET clock_out_time = ?, updated_at = ? WHERE id = ?`, [nowDB, nowDB, attendanceRecord.id]);
  } else {
    console.log(`[attendance] 下班打卡丢弃：coach_no=${coach_no}, 当天无上班记录`);
  }
  ```

### 编码规范合规检查

| 规范 | 状态 | 说明 |
|------|------|------|
| 时间处理使用 TimeUtil | ✅ | 全部使用 `TimeUtil.nowDB()` 和 `TimeUtil.todayStr()` |
| 数据库连接唯一 | ✅ | 使用 `require('../db')` 的 `runInTransaction`，无新建连接 |
| 数据库写入在事务内 | ✅ | 所有 INSERT/UPDATE 在 `runInTransaction` 内通过 `tx.run()` 执行 |
| 页面不显示 Coach_no | N/A | 本次只改后端，不涉及页面 |

### 代码提交
- Git commit: `02c2804`
- 已推送到远程 master

### PM2 重启
- 测试环境已重启: `pm2 restart tgservice-dev`
- 状态: 启动成功，无报错

### 自动化测试结果

| 测试用例 | 结果 | 说明 |
|----------|------|------|
| TC-1: 正常上下班打卡 | ✅ PASS | 上班插入记录(clock_in有值,clock_out=NULL)，下班后clock_out有值 |
| TC-2: 无上班记录时下班打卡丢弃 | ✅ PASS | 打卡记录数为0，水牌状态正常变为"下班" |
| TC-3: 同一天多次上下班 | ✅ PASS | 每次clock-in→clock-out产生一条完整记录 |
| TC-4: 只有上班无下班 | ✅ PASS | 新增一条clock_out_time为NULL的记录 |

### 注意事项
- PM2 测试环境使用 `/TG/tgservice/db/tgservice.db`（cwd 为 `/TG/tgservice/backend`，相对路径 `../../db/tgservice.db`）
- 迁移脚本需在两个数据库文件上各执行一次

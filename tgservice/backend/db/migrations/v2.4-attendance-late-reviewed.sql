-- v2.4: 打卡表新增迟到和审查状态字段
-- 日期：2026-04-22
-- 说明：上班打卡时预计算迟到状态，审查页面直接读取

ALTER TABLE attendance_records ADD COLUMN is_late INTEGER DEFAULT 0;
ALTER TABLE attendance_records ADD COLUMN is_reviewed INTEGER DEFAULT 0;

-- 查询优化索引
CREATE INDEX IF NOT EXISTS idx_attendance_late_unreviewed 
    ON attendance_records(date, is_late, is_reviewed);

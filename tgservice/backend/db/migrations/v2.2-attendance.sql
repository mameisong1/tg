-- v2.2: 上下班打卡记录表
-- 日期：2026-04-19
-- 说明：记录助教上下班打卡历史，water_boards 表只存当前状态

CREATE TABLE IF NOT EXISTS attendance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,              -- 日期 "YYYY-MM-DD"
    coach_no INTEGER NOT NULL,       -- 助教工号（内部编号，对应 coaches.coach_no）
    employee_id TEXT,                -- 助教工号（页面显示用）
    stage_name TEXT NOT NULL,        -- 艺名
    clock_in_time TEXT,              -- 上班时间 "YYYY-MM-DD HH:MM:SS"
    clock_out_time TEXT,             -- 下班时间 "YYYY-MM-DD HH:MM:SS"，NULL 表示未下班
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date_coach ON attendance_records(date, coach_no);
CREATE INDEX IF NOT EXISTS idx_attendance_coach_no ON attendance_records(coach_no);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);

-- QA-20260429-2: 通知功能数据库迁移脚本
-- 执行环境：生产 (libsql://tgservice-mameisong.aws-ap-northeast-1.turso.io)
-- 日期：2026-04-29

-- 1. 创建通知主表
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  notification_type TEXT DEFAULT 'manual',
  error_type TEXT,
  created_at TEXT NOT NULL,
  total_recipients INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0
);

-- 2. 创建通知接收者表
CREATE TABLE IF NOT EXISTS notification_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id INTEGER NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  recipient_name TEXT,
  recipient_employee_id TEXT,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id 
  ON notification_recipients(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient 
  ON notification_recipients(recipient_type, recipient_id, is_read);

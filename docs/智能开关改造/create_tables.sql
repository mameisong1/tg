-- 天宫智能开关改造 - 数据库表创建脚本
-- 版本: v1.0 | 日期: 2026-04-14

-- ============================================================
-- 1. 设备开关表 (switch_device)
--    存储每个智能开关设备的信息
--    一个物理大开关（由switch_id标识）包含多个小开关（由switch_seq标识）
-- ============================================================
CREATE TABLE IF NOT EXISTS switch_device (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  switch_id         TEXT    NOT NULL,               -- 开关ID（大开关标识，如 0xa4c1380bbd942cbe）
  switch_seq        TEXT    NOT NULL,               -- 开关序号（小开关标识，如 state_l1）
  switch_label      TEXT    NOT NULL DEFAULT '',    -- 开关标签（数字标签，如 1, 2, tv 等）
  auto_off_start    TEXT    DEFAULT '',             -- 自动关灯开始时间（格式 HH:MM，如 04:00）
  auto_off_end      TEXT    DEFAULT '',             -- 自动关灯结束时间（格式 HH:MM，如 14:00）
  auto_on_start     TEXT    DEFAULT '',             -- 定时自动开灯开始时间（格式 HH:MM，如 06:00）
  auto_on_end       TEXT    DEFAULT '',             -- 定时自动开灯结束时间（格式 HH:MM，如 22:00）
  created_at        TEXT    NOT NULL,               -- 创建时间
  updated_at        TEXT    NOT NULL,               -- 更新时间
  UNIQUE(switch_id, switch_seq)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_switch_device_label ON switch_device(switch_label);
CREATE INDEX IF NOT EXISTS idx_switch_device_auto_off ON switch_device(auto_off_start, auto_off_end);
CREATE INDEX IF NOT EXISTS idx_switch_device_auto_on ON switch_device(auto_on_start, auto_on_end);

-- ============================================================
-- 2. 台桌设备表 (table_device)
--    存储台桌与开关设备的多对多关联关系
-- ============================================================
CREATE TABLE IF NOT EXISTS table_device (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name_en   TEXT    NOT NULL,               -- 台桌英文名（如 putai1, tvtai）
  switch_seq      TEXT    NOT NULL,               -- 开关序号（如 state_l1）
  switch_label    TEXT    NOT NULL,               -- 开关标签（如 1, 2, tv 等）
  created_at      TEXT    NOT NULL,               -- 创建时间
  updated_at      TEXT    NOT NULL,               -- 更新时间
  UNIQUE(table_name_en, switch_seq, switch_label)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_table_device_table ON table_device(table_name_en);
CREATE INDEX IF NOT EXISTS idx_table_device_switch ON table_device(switch_seq, switch_label);

-- ============================================================
-- 3. 开关场景表 (switch_scene)
--    存储预设的开关场景（如全部开灯、全部关灯等）
-- ============================================================
CREATE TABLE IF NOT EXISTS switch_scene (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_name      TEXT    NOT NULL UNIQUE,        -- 场景名称（如 全部开灯, 全部关灯）
  action          TEXT    NOT NULL,               -- 动作：ON（开灯）/ OFF（关灯）
  switches        TEXT    NOT NULL,               -- 开关数组（JSON格式）
  sort_order      INTEGER NOT NULL DEFAULT 0,     -- 排序序号
  created_at      TEXT    NOT NULL,               -- 创建时间
  updated_at      TEXT    NOT NULL                -- 更新时间
);

-- ============================================================
-- 4. 系统配置表 (system_settings)
--    存储系统级配置项（如自动关灯/开灯启停状态）
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 初始化系统配置
INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES ('switch_auto_off_enabled', '1', datetime('now', '+8 hours'));

INSERT OR IGNORE INTO system_settings (key, value, updated_at)
VALUES ('switch_auto_on_enabled', '1', datetime('now', '+8 hours'));

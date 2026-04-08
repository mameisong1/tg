-- =====================================================
-- 天宫国际 V2.0 数据库迁移脚本
-- 日期：2026-04-08
-- 说明：SQLite 语法
-- =====================================================

-- =====================================================
-- 1. 修改现有表
-- =====================================================

-- 1.1 admin_users 表：role 字段已存在，仅需确保索引存在
-- 扩充值域说明（文档说明，不需要执行 ALTER TABLE）
-- role 字段枚举值扩展为：管理员/店长/助教管理/教练/前厅管理/收银/服务员
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- 1.2 coaches 表：新增班次字段
ALTER TABLE coaches ADD COLUMN shift TEXT DEFAULT '早班';  -- 班次：早班/晚班

-- =====================================================
-- 2. 创建新表
-- =====================================================

-- 2.1 water_boards - 水牌表
CREATE TABLE IF NOT EXISTS water_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coach_no TEXT NOT NULL,  -- 助教工号
    stage_name TEXT NOT NULL,  -- 艺名
    status TEXT DEFAULT '下班',  -- 水牌状态
    table_no TEXT,  -- 台桌号（上桌时填写）
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no),
    UNIQUE(coach_no)  -- 唯一约束，确保每个助教只有一个水牌记录
);

-- 状态枚举值：早班上桌/早班空闲/晚班空闲/晚班上桌/早加班/晚加班/休息/公休/请假/乐捐/下班
CREATE INDEX idx_water_boards_status ON water_boards(status);
CREATE INDEX idx_water_boards_coach_no ON water_boards(coach_no);

-- 2.2 service_orders - 服务单表
CREATE TABLE IF NOT EXISTS service_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_time DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 下单时间
    table_no TEXT NOT NULL,  -- 台桌号
    requirement TEXT NOT NULL,  -- 需求
    requester_name TEXT NOT NULL,  -- 下单人（助教艺名或后台用户姓名）
    requester_type TEXT DEFAULT '助教',  -- 下单人类型：助教/后台用户
    status TEXT DEFAULT '待处理',  -- 状态：待处理/已完成/已取消
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_orders_status ON service_orders(status);
CREATE INDEX idx_service_orders_table_no ON service_orders(table_no);
CREATE INDEX idx_service_orders_created_at ON service_orders(created_at);

-- 2.3 table_action_orders - 上下桌单表
CREATE TABLE IF NOT EXISTS table_action_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_time DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 下单时间
    table_no TEXT NOT NULL,  -- 台桌号
    coach_no TEXT NOT NULL,  -- 助教工号
    order_type TEXT NOT NULL,  -- 单类型：上桌单/下桌单/取消单
    action_category TEXT,  -- 上桌类别：普通课/标签课（仅上桌单需要）
    stage_name TEXT NOT NULL,  -- 助教艺名
    status TEXT DEFAULT '待处理',  -- 状态：待处理/已完成/已取消
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no)
);

CREATE INDEX idx_table_action_orders_type ON table_action_orders(order_type);
CREATE INDEX idx_table_action_orders_status ON table_action_orders(status);
CREATE INDEX idx_table_action_orders_coach_no ON table_action_orders(coach_no);
CREATE INDEX idx_table_action_orders_created_at ON table_action_orders(created_at);

-- 2.4 applications - 申请事项表
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    applicant_phone TEXT NOT NULL,  -- 申请人手机号
    application_type TEXT NOT NULL,  -- 申请类型：早加班申请/晚加班申请/公休申请/乐捐报备/约客记录
    remark TEXT,  -- 备注
    proof_image_url TEXT,  -- 证明图片 URL（加班截图/约客截图等）
    status INTEGER DEFAULT 0,  -- 状态：0 待处理/1 同意或有效/2 拒绝或无效
    approver_phone TEXT,  -- 审批人手机号
    approve_time DATETIME,  -- 审批时间
    extra_data TEXT,  -- 额外数据（JSON 格式，如乐捐的小时数等）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_applications_type ON applications(application_type);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_applicant ON applications(applicant_phone);
CREATE INDEX idx_applications_created_at ON applications(created_at);

-- 2.5 guest_invitation_results - 约客结果表
CREATE TABLE IF NOT EXISTS guest_invitation_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,  -- 日期（YYYY-MM-DD 格式）
    shift TEXT NOT NULL,  -- 早班/晚班
    coach_no TEXT NOT NULL,  -- 助教工号
    stage_name TEXT NOT NULL,  -- 艺名
    invitation_image_url TEXT,  -- 约客记录图片 URL
    result TEXT DEFAULT '待审查',  -- 结果：待审查/未约客/约客有效/约客无效
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,  -- 审查时间
    reviewer_phone TEXT,  -- 审查人手机号
    FOREIGN KEY (coach_no) REFERENCES coaches(coach_no),
    UNIQUE(date, shift, coach_no)  -- 每天每班每个助教只有一条记录
);

CREATE INDEX idx_guest_invitation_date ON guest_invitation_results(date);
CREATE INDEX idx_guest_invitation_shift ON guest_invitation_results(shift);
CREATE INDEX idx_guest_invitation_coach_no ON guest_invitation_results(coach_no);
CREATE INDEX idx_guest_invitation_result ON guest_invitation_results(result);

-- 2.6 operation_logs - 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_phone TEXT NOT NULL,  -- 操作人手机号
    operator_name TEXT,  -- 操作人姓名
    operation_type TEXT NOT NULL,  -- 操作类型：水牌状态变更/约客审查/服务单处理/上下桌单处理/加班审批/公休审批等
    target_type TEXT,  -- 目标类型：water_board/guest_invitation/service_order/table_action_order/application
    target_id INTEGER,  -- 目标记录 ID
    old_value TEXT,  -- 旧值（JSON 格式）
    new_value TEXT,  -- 新值（JSON 格式）
    remark TEXT,  -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operation_logs_operator ON operation_logs(operator_phone);
CREATE INDEX idx_operation_logs_type ON operation_logs(operation_type);
CREATE INDEX idx_operation_logs_target ON operation_logs(target_type, target_id);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);

-- =====================================================
-- 3. 数据初始化
-- =====================================================

-- 3.1 初始化水牌表（从现有助教数据）
INSERT OR IGNORE INTO water_boards (coach_no, stage_name, status, table_no)
SELECT coach_no, stage_name, '下班', NULL FROM coaches;

-- =====================================================
-- 4. 默认后台用户创建（示例）
-- =====================================================

-- 店长（示例，实际密码需要 bcrypt 加密）
-- INSERT OR IGNORE INTO admin_users (username, password, name, role) 
-- VALUES ('13800138000', 'bcrypt_hash', '张店长', '店长');

-- 助教管理（示例）
-- INSERT OR IGNORE INTO admin_users (username, password, name, role) 
-- VALUES ('13800138001', 'bcrypt_hash', '李管理', '助教管理');

-- 收银（示例）
-- INSERT OR IGNORE INTO admin_users (username, password, name, role) 
-- VALUES ('13800138002', 'bcrypt_hash', '王收银', '收银');

-- =====================================================
-- 迁移完成
-- =====================================================

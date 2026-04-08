/**
 * 数据库迁移脚本 - Phase 3 申请审批模块
 * 执行：node migrate-phase3.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'db/tgservice.db');
const db = new sqlite3.Database(dbPath);

const runSQL = (sql, desc) => {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        console.error(`❌ ${desc}: ${err.message}`);
        reject(err);
      } else {
        console.log(`✅ ${desc}`);
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const runAll = (sql, desc) => {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error(`❌ ${desc}: ${err.message}`);
        reject(err);
      } else {
        console.log(`✅ ${desc}: ${rows.length} 条`);
        resolve(rows);
      }
    });
  });
};

async function migrate() {
  console.log('🚀 开始 Phase 3 数据库迁移...\n');
  
  try {
    // 1. 创建 water_boards 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS water_boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_no TEXT NOT NULL,
        stage_name TEXT NOT NULL,
        status TEXT DEFAULT '下班',
        table_no TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(coach_no)
      )
    `, '创建 water_boards 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_water_boards_status ON water_boards(status)`, '创建 water_boards status 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_water_boards_coach_no ON water_boards(coach_no)`, '创建 water_boards coach_no 索引');
    
    // 2. 创建 service_orders 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS service_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        table_no TEXT NOT NULL,
        requirement TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        requester_type TEXT DEFAULT '助教',
        status TEXT DEFAULT '待处理',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, '创建 service_orders 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status)`, '创建 service_orders status 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_service_orders_table_no ON service_orders(table_no)`, '创建 service_orders table_no 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders(created_at)`, '创建 service_orders created_at 索引');
    
    // 3. 创建 table_action_orders 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS table_action_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        table_no TEXT NOT NULL,
        coach_no TEXT NOT NULL,
        order_type TEXT NOT NULL,
        action_category TEXT,
        stage_name TEXT NOT NULL,
        status TEXT DEFAULT '待处理',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, '创建 table_action_orders 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_table_action_orders_type ON table_action_orders(order_type)`, '创建 table_action_orders type 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_table_action_orders_status ON table_action_orders(status)`, '创建 table_action_orders status 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_table_action_orders_coach_no ON table_action_orders(coach_no)`, '创建 table_action_orders coach_no 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_table_action_orders_created_at ON table_action_orders(created_at)`, '创建 table_action_orders created_at 索引');
    
    // 4. 创建 applications 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applicant_phone TEXT NOT NULL,
        application_type TEXT NOT NULL,
        remark TEXT,
        proof_image_url TEXT,
        status INTEGER DEFAULT 0,
        approver_phone TEXT,
        approve_time DATETIME,
        extra_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, '创建 applications 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_applications_type ON applications(application_type)`, '创建 applications type 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)`, '创建 applications status 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_phone)`, '创建 applications applicant 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at)`, '创建 applications created_at 索引');
    
    // 5. 创建 guest_invitation_results 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS guest_invitation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        coach_no TEXT NOT NULL,
        stage_name TEXT NOT NULL,
        invitation_image_url TEXT,
        result TEXT DEFAULT '待审查',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        reviewer_phone TEXT,
        UNIQUE(date, shift, coach_no)
      )
    `, '创建 guest_invitation_results 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_guest_invitation_date ON guest_invitation_results(date)`, '创建 guest_invitation_results date 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_guest_invitation_shift ON guest_invitation_results(shift)`, '创建 guest_invitation_results shift 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_guest_invitation_coach_no ON guest_invitation_results(coach_no)`, '创建 guest_invitation_results coach_no 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_guest_invitation_result ON guest_invitation_results(result)`, '创建 guest_invitation_results result 索引');
    
    // 6. 创建 operation_logs 表
    await runSQL(`
      CREATE TABLE IF NOT EXISTS operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operator_phone TEXT NOT NULL,
        operator_name TEXT,
        operation_type TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        old_value TEXT,
        new_value TEXT,
        remark TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, '创建 operation_logs 表');
    
    // 创建索引
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_operation_logs_operator ON operation_logs(operator_phone)`, '创建 operation_logs operator 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type)`, '创建 operation_logs type 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_operation_logs_target ON operation_logs(target_type, target_id)`, '创建 operation_logs target 索引');
    await runSQL(`CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at)`, '创建 operation_logs created_at 索引');
    
    // 7. 修改 coaches 表，添加 shift 字段
    try {
      await runSQL(`ALTER TABLE coaches ADD COLUMN shift TEXT DEFAULT '早班'`, '添加 coaches.shift 字段');
    } catch (e) {
      console.log('⚠️  coaches.shift 字段可能已存在，跳过');
    }
    
    // 8. 初始化水牌表（从现有助教数据）
    const coaches = await runAll('SELECT coach_no, stage_name FROM coaches', '查询现有助教');
    
    if (coaches.length > 0) {
      for (const coach of coaches) {
        await runSQL(`
          INSERT OR IGNORE INTO water_boards (coach_no, stage_name, status, table_no)
          VALUES ('${coach.coach_no}', '${coach.stage_name}', '下班', NULL)
        `, `初始化水牌：${coach.stage_name}`);
      }
    }
    
    console.log('\n✅ Phase 3 数据库迁移完成！\n');
    
  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrate();

/**
 * 数据迁移脚本：将单图片 URL 字段迁移到 images JSON 数组字段
 * 
 * 用途：将 proof_image_url / invitation_image_url 的单 URL 字符串
 *       迁移到新增的 images 字段（JSON 数组格式）
 * 
 * 执行方式（发布时手动执行）：
 *   node backend/migrations/migrate-images-to-array.js <db_path>
 * 
 * 示例：
 *   # 测试环境
 *   node backend/migrations/migrate-images-to-array.js /TG/tgservice/db/tgservice.db
 * 
 *   # 生产环境（Docker 容器内）
 *   docker exec tgservice node /app/backend/migrations/migrate-images-to-array.js /app/db/tgservice.db
 * 
 *   # 生产环境（宿主机直接执行）
 *   cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js /TG/run/db/tgservice.db
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ========== 获取数据库路径 ==========

function getDbPath() {
  // 支持命令行参数
  const cliArg = process.argv[2];
  if (cliArg) {
    return path.resolve(cliArg);
  }

  // 根据 TGSERVICE_ENV 自动选择
  const env = process.env.TGSERVICE_ENV || 'development';
  if (env === 'production') {
    // 生产环境：/TG/run/db/tgservice.db（Docker 挂载路径）
    return path.resolve(__dirname, '../../../run/db/tgservice.db');
  } else {
    // 开发/测试环境：/TG/tgservice/db/tgservice.db
    return path.resolve(__dirname, '../../db/tgservice.db');
  }
}

// ========== 辅助函数 ==========

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) reject(new Error(`无法打开数据库: ${err.message}`));
      else resolve(db);
    });
  });
}

function closeDb(db) {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

function runSql(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function dbGet(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function columnExists(db, tableName, columnName) {
  const cols = await new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  return cols.some(c => c.name === columnName);
}

async function getStats(db) {
  const [appsTotal, appsImages, appsProof, guestTotal, guestImages, guestInvitation] = await Promise.all([
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications WHERE images IS NOT NULL AND images != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications WHERE proof_image_url IS NOT NULL AND proof_image_url != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE images IS NOT NULL AND images != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE invitation_image_url IS NOT NULL AND invitation_image_url != ''"),
  ]);
  return {
    appsTotal: appsTotal.cnt,
    appsImages: appsImages.cnt,
    appsProof: appsProof.cnt,
    guestTotal: guestTotal.cnt,
    guestImages: guestImages.cnt,
    guestInvitation: guestInvitation.cnt,
  };
}

// ========== 主函数 ==========

async function migrate(dbPath) {
  console.log(`\n📦 开始迁移: ${dbPath}`);
  console.log(`   TGSERVICE_ENV: ${process.env.TGSERVICE_ENV || 'development'}\n`);

  const db = await openDb(dbPath);

  try {
    // 步骤1：检查 images 列是否已存在
    const appsHasImages = await columnExists(db, 'applications', 'images');
    const guestHasImages = await columnExists(db, 'guest_invitation_results', 'images');

    // 步骤2：applications 表迁移
    if (!appsHasImages) {
      console.log('  [1/4] applications 表：新增 images 列...');
      await runSql(db, 'ALTER TABLE applications ADD COLUMN images TEXT');
      console.log('        ✅ 列已添加');
    } else {
      console.log('  [1/4] applications 表：images 列已存在，跳过 ALTER');
    }

    console.log('  [2/4] applications 表：迁移 proof_image_url → images...');
    const appsMigrated = await runSql(db,
      "UPDATE applications SET images = json_array(proof_image_url) WHERE proof_image_url IS NOT NULL AND proof_image_url != '' AND (images IS NULL OR images = '')"
    );
    console.log(`        ✅ 迁移了 ${appsMigrated.changes} 行`);

    // 步骤3：guest_invitation_results 表迁移
    if (!guestHasImages) {
      console.log('  [3/4] guest_invitation_results 表：新增 images 列...');
      await runSql(db, 'ALTER TABLE guest_invitation_results ADD COLUMN images TEXT');
      console.log('        ✅ 列已添加');
    } else {
      console.log('  [3/4] guest_invitation_results 表：images 列已存在，跳过 ALTER');
    }

    console.log('  [4/4] guest_invitation_results 表：迁移 invitation_image_url → images...');
    const guestMigrated = await runSql(db,
      "UPDATE guest_invitation_results SET images = json_array(invitation_image_url) WHERE invitation_image_url IS NOT NULL AND invitation_image_url != '' AND (images IS NULL OR images = '')"
    );
    console.log(`        ✅ 迁移了 ${guestMigrated.changes} 行`);

    // 步骤4：统计汇总
    const stats = await getStats(db);
    console.log('\n📊 迁移统计:');
    console.log(`   applications 总行数:        ${stats.appsTotal}`);
    console.log(`   applications images 有数据:  ${stats.appsImages}`);
    console.log(`   applications proof_image_url 有数据: ${stats.appsProof}`);
    console.log(`   guest_invitation_results 总行数:     ${stats.guestTotal}`);
    console.log(`   guest_invitation_results images 有数据: ${stats.guestImages}`);
    console.log(`   guest_invitation_results invitation_image_url 有数据: ${stats.guestInvitation}`);

    // 步骤5：验证数据一致性
    console.log('\n🔍 数据一致性检查:');
    const appsOrphan = await dbGet(db,
      "SELECT COUNT(*) as cnt FROM applications WHERE proof_image_url IS NOT NULL AND proof_image_url != '' AND (images IS NULL OR images = '')"
    );
    if (appsOrphan.cnt > 0) {
      console.log(`   ⚠️  applications 表有 ${appsOrphan.cnt} 行 proof_image_url 有值但 images 为空`);
    } else {
      console.log('   ✅ applications 表数据一致');
    }

    const guestOrphan = await dbGet(db,
      "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE invitation_image_url IS NOT NULL AND invitation_image_url != '' AND (images IS NULL OR images = '')"
    );
    if (guestOrphan.cnt > 0) {
      console.log(`   ⚠️  guest_invitation_results 表有 ${guestOrphan.cnt} 行 invitation_image_url 有值但 images 为空`);
    } else {
      console.log('   ✅ guest_invitation_results 表数据一致');
    }

    console.log('\n✅ 迁移完成！\n');

  } catch (err) {
    console.error('\n❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    await closeDb(db);
  }
}

// ========== 入口 ==========

const dbPath = getDbPath();
migrate(dbPath);

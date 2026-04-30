/**
 * 通知管理 API
 * 路径: /api/notifications
 * QA-20260429-2: 通知功能实现
 */

const express = require('express');
const router = express.Router();
const { dbAll, dbGet, enqueueRun, runInTransaction } = require('../db');
const authMiddleware = require('../middleware/auth').required;
const { hasBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');

// ========== 启动时自动创建表 ==========

async function initTables() {
  try {
    // 创建 notifications 表
    await enqueueRun(`
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
      )
    `);

    // 创建 notification_recipients 表
    await enqueueRun(`
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
      )
    `);

    // 创建索引
    await enqueueRun(`
      CREATE INDEX IF NOT EXISTS idx_notification_recipients_notification_id 
      ON notification_recipients(notification_id)
    `);
    await enqueueRun(`
      CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient 
      ON notification_recipients(recipient_type, recipient_id, is_read)
    `);

    console.log('[Notifications] 表创建完成');
  } catch (err) {
    console.error('[Notifications] 表创建失败:', err.message);
  }
}

// 启动时初始化
initTables();

// ========== 权限中间件 ==========

// 管理权限检查：店长/助教管理/管理员
const canManageNotification = (req, res, next) => {
  const user = req.user;
  if (user.userType === 'coach') {
    return res.status(403).json({ error: '权限不足' });
  }
  if (!['管理员', '店长', '助教管理'].includes(user.role)) {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

// ========== API 接口 ==========

/**
 * GET /api/notifications
 * 获取我的通知列表（所有员工）
 * 参数: page(默认1), pageSize(默认20,上限50)
 * 排序: 未阅优先 + 发送时间倒序
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 50); // LIMIT上限50
    const offset = (page - 1) * pageSize;

    // 确定接收者类型和ID
    const recipientType = user.userType === 'coach' ? 'coach' : 'admin';
    const recipientId = user.userType === 'coach' ? user.coachNo : user.username;

    // 可选：按通知类型过滤（逗号分隔，如 'system,invitation_reminder'）
    const typeFilter = req.query.type;
    let typeCondition = '';
    const queryParams = [recipientType, recipientId];
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(',');
        typeCondition = ` AND n.notification_type IN (${placeholders})`;
        queryParams.push(...types);
      }
    }

    // 查询通知列表（联表查询获取 is_read 状态）
    queryParams.push(pageSize, offset);
    const notifications = await dbAll(`
      SELECT 
        n.id, n.title, n.content, n.sender_name, n.notification_type, n.created_at,
        nr.is_read, nr.read_at
      FROM notifications n
      INNER JOIN notification_recipients nr ON n.id = nr.notification_id
      WHERE nr.recipient_type = ? AND nr.recipient_id = ?${typeCondition}
      ORDER BY nr.is_read ASC, n.created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // 查询总数
    const countParams = [recipientType, recipientId];
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        countParams.push(...types);
      }
    }
    const totalRow = await dbGet(`
      SELECT COUNT(*) as total
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.recipient_type = ? AND nr.recipient_id = ?${typeCondition}
    `, countParams);

    res.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          sender_name: n.sender_name,
          notification_type: n.notification_type,
          created_at: n.created_at,
          is_read: n.is_read,
          read_at: n.read_at
        })),
        total: totalRow.total,
        page,
        pageSize
      }
    });
  } catch (err) {
    console.error('[Notifications] 获取列表失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/notifications/unread-count
 * 获取未阅数量（所有员工）
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const recipientType = user.userType === 'coach' ? 'coach' : 'admin';
    const recipientId = user.userType === 'coach' ? user.coachNo : user.username;

    // 可选：按通知类型过滤
    const typeFilter = req.query.type;
    let typeCondition = '';
    const params = [recipientType, recipientId];
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(',');
        typeCondition = ` AND n.notification_type IN (${placeholders})`;
        params.push(...types);
      }
    }

    const row = await dbGet(`
      SELECT COUNT(*) as unread_count
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.recipient_type = ? AND nr.recipient_id = ? AND nr.is_read = 0${typeCondition}
    `, params);

    res.json({
      success: true,
      data: {
        unread_count: row.unread_count
      }
    });
  } catch (err) {
    console.error('[Notifications] 获取未阅数量失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/notifications/:id/read
 * 标记已阅（所有员工，只能标记自己的通知）
 * 注意：已阅不可改回未阅
 * 同步更新 notifications.read_count
 */
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    const notificationId = parseInt(req.params.id);
    const recipientType = user.userType === 'coach' ? 'coach' : 'admin';
    const recipientId = user.userType === 'coach' ? user.coachNo : user.username;

    // 检查通知是否属于当前用户
    const recipientRow = await dbGet(`
      SELECT id, is_read FROM notification_recipients
      WHERE notification_id = ? AND recipient_type = ? AND recipient_id = ?
    `, [notificationId, recipientType, recipientId]);

    if (!recipientRow) {
      return res.status(403).json({ error: '无权操作此通知' });
    }

    // 已阅则直接返回成功（幂等）
    if (recipientRow.is_read === 1) {
      return res.json({ success: true, message: '已标记已阅' });
    }

    // 使用 runInTransaction 同步更新 read_count
    // 事务内加 is_read=0 条件防止并发重复标记
    const now = TimeUtil.nowDB();
    await runInTransaction(async (tx) => {
      // 更新接收者状态（加 AND is_read = 0 防并发）
      const recipientResult = await tx.run(`
        UPDATE notification_recipients
        SET is_read = 1, read_at = ?
        WHERE notification_id = ? AND recipient_type = ? AND recipient_id = ? AND is_read = 0
      `, [now, notificationId, recipientType, recipientId]);

      // 只有接收者确实被更新时才递增 read_count，且加 read_count < total_recipients 防超
      if (recipientResult.changes > 0) {
        await tx.run(`
          UPDATE notifications
          SET read_count = read_count + 1
          WHERE id = ? AND read_count < total_recipients
        `, [notificationId]);
      }
    });

    res.json({ success: true, message: '已标记已阅' });
  } catch (err) {
    console.error('[Notifications] 标记已阅失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/notifications/manage/send
 * 发送通知（店长/助教管理/管理员）
 * 参数:
 *   title - 标题（必填）
 *   content - 内容（必填）
 *   recipient_type - 'all'全员 或 'selected'指定员工
 *   recipients - 指定员工时必填：[{type:'coach', id:'coach_no'}, {type:'admin', id:'username'}]
 */
router.post('/manage/send', authMiddleware, canManageNotification, async (req, res) => {
  try {
    const { title, content, recipient_type, recipients } = req.body;
    const sender = req.user;

    // 参数校验
    if (!title || !content) {
      return res.status(400).json({ error: '缺少必填字段：标题或内容' });
    }

    if (recipient_type === 'selected' && (!recipients || recipients.length === 0)) {
      return res.status(400).json({ error: '请选择接收者' });
    }

    // 构建接收者列表
    let finalRecipients = [];

    if (recipient_type === 'all') {
      // 全员发送：查询所有未离职助教 + 所有后台用户
      const coaches = await dbAll(`
        SELECT coach_no, stage_name, employee_id
        FROM coaches
        WHERE status != '离职' AND employee_id IS NOT NULL
      `);
      const admins = await dbAll(`
        SELECT username, name, role
        FROM admin_users
      `);

      finalRecipients = [
        ...coaches.map(c => ({
          type: 'coach',
          id: c.coach_no,
          name: c.stage_name,
          employee_id: c.employee_id
        })),
        ...admins.map(a => ({
          type: 'admin',
          id: a.username,
          name: a.name || a.username,
          employee_id: null
        }))
      ];
    } else {
      // 指定员工发送：验证并获取详细信息
      for (const r of recipients) {
        if (r.type === 'coach') {
          const coach = await dbGet(`
            SELECT coach_no, stage_name, employee_id
            FROM coaches
            WHERE coach_no = ? AND status != '离职'
          `, [r.id]);
          if (coach) {
            finalRecipients.push({
              type: 'coach',
              id: coach.coach_no,
              name: coach.stage_name,
              employee_id: coach.employee_id
            });
          }
        } else if (r.type === 'admin') {
          const admin = await dbGet(`
            SELECT username, name
            FROM admin_users
            WHERE username = ?
          `, [r.id]);
          if (admin) {
            finalRecipients.push({
              type: 'admin',
              id: admin.username,
              name: admin.name || admin.username,
              employee_id: null
            });
          }
        }
      }
    }

    if (finalRecipients.length === 0) {
      return res.status(400).json({ error: '无有效接收者' });
    }

    // 使用 runInTransaction 创建通知
    const notificationId = await runInTransaction(async (tx) => {
      const now = TimeUtil.nowDB();
      const senderType = 'admin';
      const senderId = sender.username;
      const senderName = sender.name || sender.username;

      // 创建通知主记录
      const result = await tx.run(`
        INSERT INTO notifications (title, content, sender_type, sender_id, sender_name, created_at, total_recipients)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [title, content, senderType, senderId, senderName, now, finalRecipients.length]);

      const nid = result.lastID;

      // 创建接收者记录
      for (const r of finalRecipients) {
        await tx.run(`
          INSERT INTO notification_recipients (notification_id, recipient_type, recipient_id, recipient_name, recipient_employee_id)
          VALUES (?, ?, ?, ?, ?)
        `, [nid, r.type, r.id, r.name, r.employee_id]);
      }

      return nid;
    });

    res.json({
      success: true,
      data: {
        notification_id: notificationId,
        total_recipients: finalRecipients.length
      }
    });
  } catch (err) {
    console.error('[Notifications] 发送失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/notifications/manage/list
 * 获取已发送通知列表（店长/助教管理/管理员）
 * 参数: page(默认1), pageSize(默认50,上限50)
 * 排序: created_at 倒序
 */
router.get('/manage/list', authMiddleware, canManageNotification, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 50); // LIMIT上限50
    const offset = (page - 1) * pageSize;

    // 可选参数：sender_type 过滤，默认 'admin'（排除系统自动发送）
    // 传 'all' 查全部，传 'system' 查系统通知
    const senderTypeFilter = req.query.sender_type || 'admin';
    let senderCondition = '';
    const queryParams = [];
    if (senderTypeFilter === 'all') {
      // 不加条件
    } else {
      senderCondition = ' WHERE sender_type = ?';
      queryParams.push(senderTypeFilter);
    }

    // 可选：按通知类型过滤
    const typeFilter = req.query.type;
    let typeCondition = '';
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(',');
        if (senderCondition) {
          typeCondition = ` AND notification_type IN (${placeholders})`;
        } else {
          typeCondition = ` WHERE notification_type IN (${placeholders})`;
        }
        queryParams.push(...types);
      }
    }

    queryParams.push(pageSize, offset);
    const notifications = await dbAll(`
      SELECT id, title, content, sender_name, sender_type, notification_type, created_at, total_recipients, read_count
      FROM notifications
      ${senderCondition}${typeCondition}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, queryParams);

    // 查询总数
    const countParams = [];
    let countCondition = '';
    if (senderTypeFilter === 'all') {
      // 不加条件
    } else {
      countCondition = ' WHERE sender_type = ?';
      countParams.push(senderTypeFilter);
    }
    if (typeFilter) {
      const types = typeFilter.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) {
        const placeholders = types.map(() => '?').join(',');
        if (countCondition) {
          countCondition += ` AND notification_type IN (${placeholders})`;
        } else {
          countCondition = ` WHERE notification_type IN (${placeholders})`;
        }
        countParams.push(...types);
      }
    }

    const totalRow = await dbGet(`
      SELECT COUNT(*) as total
      FROM notifications
      ${countCondition}
    `, countParams);

    res.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          sender_name: n.sender_name,
          sender_type: n.sender_type,
          notification_type: n.notification_type,
          created_at: n.created_at,
          total_recipients: n.total_recipients,
          read_count: n.read_count,
          unread_count: Math.max(0, n.total_recipients - n.read_count)
        })),
        total: totalRow.total
      }
    });
  } catch (err) {
    console.error('[Notifications] 获取已发送列表失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/notifications/manage/:id/recipients
 * 获取通知接收者详情（店长/助教管理/管理员）
 * 加LIMIT，最多50条
 */
router.get('/manage/:id/recipients', authMiddleware, canManageNotification, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    // 验证通知存在
    const notification = await dbGet(`
      SELECT id FROM notifications WHERE id = ?
    `, [notificationId]);

    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    // 查询接收者详情（LIMIT最多50条）
    const recipients = await dbAll(`
      SELECT recipient_type, recipient_name, recipient_employee_id, is_read, read_at
      FROM notification_recipients
      WHERE notification_id = ?
      ORDER BY is_read ASC, recipient_name ASC
      LIMIT 50
    `, [notificationId]);

    res.json({
      success: true,
      data: {
        recipients: recipients.map(r => ({
          recipient_type: r.recipient_type,
          recipient_name: r.recipient_name,
          recipient_employee_id: r.recipient_employee_id,
          is_read: r.is_read,
          read_at: r.read_at
        }))
      }
    });
  } catch (err) {
    console.error('[Notifications] 获取接收者详情失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * GET /api/notifications/manage/employees
 * 获取可选员工列表（店长/助教管理/管理员）
 * 参数: search(搜索关键词), level(助教级别), role(后台角色)
 * 加LIMIT，最多50条
 */
router.get('/manage/employees', authMiddleware, canManageNotification, async (req, res) => {
  try {
    const { search, level, role } = req.query;

    // 查询未离职助教（LIMIT最多50条）
    let coachSql = `
      SELECT coach_no, stage_name, employee_id, level
      FROM coaches
      WHERE status != '离职' AND employee_id IS NOT NULL
    `;
    const coachParams = [];

    if (search) {
      coachSql += ` AND (stage_name LIKE ? OR employee_id LIKE ?)`;
      coachParams.push(`%${search}%`, `%${search}%`);
    }
    if (level) {
      coachSql += ` AND level = ?`;
      coachParams.push(level);
    }
    coachSql += ` ORDER BY stage_name ASC LIMIT 50`;

    const coaches = await dbAll(coachSql, coachParams);

    // 查询后台用户（LIMIT最多50条）
    let adminSql = `
      SELECT username, name, role
      FROM admin_users
    `;
    const adminParams = [];

    if (search) {
      adminSql += ` WHERE (name LIKE ? OR username LIKE ?)`;
      adminParams.push(`%${search}%`, `%${search}%`);
    }
    if (role) {
      if (adminSql.includes('WHERE')) {
        adminSql += ` AND role = ?`;
      } else {
        adminSql += ` WHERE role = ?`;
      }
      adminParams.push(role);
    }
    adminSql += ` ORDER BY name ASC LIMIT 50`;

    const admins = await dbAll(adminSql, adminParams);

    res.json({
      success: true,
      data: {
        coaches: coaches.map(c => ({
          coach_no: c.coach_no,
          employee_id: c.employee_id,
          stage_name: c.stage_name,
          level: c.level
        })),
        admins: admins.map(a => ({
          username: a.username,
          name: a.name,
          role: a.role
        }))
      }
    });
  } catch (err) {
    console.error('[Notifications] 获取员工列表失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * DELETE /api/notifications/manage/:id
 * 删除通知及其接收者（店长/助教管理/管理员）
 * 利用 ON DELETE CASCADE 级联删除 notification_recipients
 */
router.delete('/manage/:id', authMiddleware, canManageNotification, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    // 验证通知存在
    const notification = await dbGet(`
      SELECT id FROM notifications WHERE id = ?
    `, [notificationId]);

    if (!notification) {
      return res.status(404).json({ error: '通知不存在' });
    }

    // 删除通知主记录（CASCADE 自动删除 recipients）
    await enqueueRun(`DELETE FROM notifications WHERE id = ?`, [notificationId]);

    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Notifications] 删除失败:', err.message);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ========== 系统通知辅助函数 ==========

/**
 * 发送系统通知给所有管理员
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {string} errorType - 错误类型: 'table_sync_error' | 'cron_error' | 'timer_error'
 * @returns {Promise<{notificationId, recipientCount}>}
 */
async function sendSystemNotificationToAdmins(title, content, errorType) {
  // 1. 查询所有管理员（role IN ('店长', '助教管理', '管理员')）
  const admins = await dbAll(`
    SELECT username, name, role
    FROM admin_users
    WHERE role IN ('店长', '助教管理', '管理员')
    LIMIT 50
  `);

  if (!admins || admins.length === 0) {
    console.warn('[SystemNotification] 无管理员用户，跳过通知');
    return { notificationId: null, recipientCount: 0 };
  }

  const now = TimeUtil.nowDB();

  // 2. 使用 runInTransaction 创建通知 + 批量插入接收者
  const notificationId = await runInTransaction(async (tx) => {
    // 创建通知记录
    const result = await tx.run(`
      INSERT INTO notifications (title, content, sender_type, sender_id, sender_name, 
                                 notification_type, error_type, created_at, total_recipients)
      VALUES (?, ?, 'system', 'system', '系统', ?, ?, ?, ?)
    `, [title, content, 'system', errorType, now, admins.length]);

    const nid = result.lastID;

    // 3. 批量插入接收者记录
    for (const admin of admins) {
      await tx.run(`
        INSERT INTO notification_recipients (notification_id, recipient_type, recipient_id, 
                                             recipient_name, recipient_employee_id)
        VALUES (?, 'admin', ?, ?, NULL)
      `, [nid, admin.username, admin.name || admin.username]);
    }

    return nid;
  });

  console.log(`[SystemNotification] 发送系统通知(${errorType})给 ${admins.length} 位管理员, ID: ${notificationId}`);
  return { notificationId, recipientCount: admins.length };
}

module.exports = router;
module.exports.sendSystemNotificationToAdmins = sendSystemNotificationToAdmins;
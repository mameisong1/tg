/**
 * 系统报告 API
 * 路径: /api/system-report
 */

const express = require('express');
const router = express.Router();
const { all, get, enqueueRun, runInTransaction } = require('../db');
const auth = require('../middleware/auth');
const { requireBackendPermission } = require('../middleware/permission');
const TimeUtil = require('../utils/time');
const timerManager = require('../services/timer-manager');
const cronScheduler = require('../services/cron-scheduler');
const fs = require('fs');
const path = require('path');

// 所有接口需要认证
router.use(auth.required);

/**
 * GET /api/system-report/overview
 * 系统运行概览
 */
router.get('/overview', async (req, res) => {
    try {
        // 计时器状态
        const timerStats = {
            total: timerManager.getActiveCount(),
            lejuan: timerManager.getCountByType('lejuan'),
            application: timerManager.getCountByType('application')
        };

        // Cron 任务状态
        const cronTasks = await cronScheduler.getAllTasks();

        // 最近 Cron 执行日志
        const recentLogs = await cronScheduler.getCronLogs(null, 10);

        res.json({
            success: true,
            timerStats,
            cronTasks,
            recentLogs
        });
    } catch (err) {
        console.error(`系统报告概览失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/system-report/timer-logs
 * 计时器生命周期日志
 */
router.get('/timer-logs', async (req, res) => {
    try {
        const { type, action, limit = 50 } = req.query;

        let sql = 'SELECT * FROM timer_log WHERE 1=1';
        const params = [];

        if (type) {
            sql += ' AND timer_type = ?';
            params.push(type);
        }
        if (action) {
            sql += ' AND action = ?';
            params.push(action);
        }

        sql += ' ORDER BY id DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = await all(sql, params);

        res.json({
            success: true,
            logs,
            total: logs.length
        });
    } catch (err) {
        console.error(`计时器日志查询失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/system-report/cron-logs
 * Cron 执行历史
 */
router.get('/cron-logs', async (req, res) => {
    try {
        const { taskName, status, limit = 50 } = req.query;

        let sql = 'SELECT * FROM cron_log WHERE 1=1';
        const params = [];

        if (taskName) {
            // 支持 task_name 精确匹配 或 task_type 类型匹配
            sql += ' AND (task_name = ? OR task_type = ?)';
            params.push(taskName, taskName);
        }
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY id DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = await all(sql, params);

        res.json({
            success: true,
            logs,
            total: logs.length
        });
    } catch (err) {
        console.error(`Cron 日志查询失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/system-report/cron-tasks
 * Cron 任务列表
 */
router.get('/cron-tasks', async (req, res) => {
    try {
        const tasks = await cronScheduler.getAllTasks();

        res.json({
            success: true,
            tasks
        });
    } catch (err) {
        console.error(`Cron 任务列表查询失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * POST /api/system-report/cron/:taskName/trigger
 * 手动触发 Cron 任务
 */
router.post('/cron/:taskName/trigger', async (req, res) => {
    try {
        const { taskName } = req.params;
        const result = await cronScheduler.triggerTask(taskName);

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error(`手动触发任务失败: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/system-report/cron/:taskName/toggle
 * 启用/禁用 Cron 任务
 */
router.post('/cron/:taskName/toggle', async (req, res) => {
    try {
        const { taskName } = req.params;
        const { enabled } = req.body;

        if (enabled === undefined) {
            return res.status(400).json({ error: '缺少 enabled 参数' });
        }

        const result = await cronScheduler.toggleTask(taskName, enabled);

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error(`切换任务状态失败: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/system-report/active-timers
 * 获取当前内存中所有活跃计时器的详细信息
 */
router.get('/active-timers', async (req, res) => {
    try {
        const timers = await timerManager.getActiveTimersWithDetails();

        res.json({
            success: true,
            data: timers,
            total: timers.length
        });
    } catch (err) {
        console.error(`获取活跃计时器失败: ${err.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * GET /api/system-report/sql-audit
 * 读取 SQL 审计日志（超过300行的查询）
 */
router.get('/sql-audit', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../../logs/sql-audit.log');
        if (!fs.existsSync(logPath)) {
            return res.json({ success: true, entries: [] });
        }
        const content = fs.readFileSync(logPath, 'utf-8').trim();
        if (!content) {
            return res.json({ success: true, entries: [] });
        }
        const lines = content.split('\n').filter(l => l.trim());
        const entries = lines.map(line => {
            try { return JSON.parse(line); }
            catch (e) { return { raw: line }; }
        });
        res.json({ success: true, entries, total: entries.length });
    } catch (err) {
        console.error('SQL审计日志读取失败:', err.message);
        res.status(500).json({ error: '服务器错误' });
    }
});

/**
 * DELETE /api/system-report/sql-audit
 * 清空 SQL 审计日志
 */
router.delete('/sql-audit', async (req, res) => {
    try {
        const logPath = path.join(__dirname, '../../logs/sql-audit.log');
        if (fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, '', 'utf-8');
        }
        res.json({ success: true });
    } catch (err) {
        console.error('SQL审计日志清空失败:', err.message);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;

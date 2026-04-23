/**
 * 钉钉回调接口
 * 路径: /api/dingtalk/callback
 */

const express = require('express');
const router = express.Router();
const dingtalkService = require('../services/dingtalk-service');
const { get, all, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');

/**
 * GET /api/dingtalk/callback
 * 钉钉回调 URL 验证
 * 
 * 钉钉在配置回调 URL 时会发送 GET 请求验证
 */
router.get('/', async (req, res) => {
  try {
    const { signature, timestamp, nonce, echostr } = req.query;
    
    dingtalkService.dingtalkLog.write(`收到验证请求: signature=${signature}, timestamp=${timestamp}, nonce=${nonce}`);
    
    // 验证签名
    if (!dingtalkService.verifySignature(timestamp, nonce, signature)) {
      dingtalkService.dingtalkLog.write('验证签名失败');
      return res.status(403).send('Invalid signature');
    }
    
    // 解密 echostr 并返回
    const decrypted = dingtalkService.decryptMessage(echostr);
    dingtalkService.dingtalkLog.write(`验证成功，返回: ${decrypted}`);
    
    res.send(decrypted);
  } catch (err) {
    dingtalkService.dingtalkLog.write(`验证处理失败: ${err.message}`);
    res.status(500).send('Error');
  }
});

/**
 * POST /api/dingtalk/callback
 * 接收钉钉打卡事件推送
 * 
 * 钉钉推送格式:
 * {
 *   "encrypt": "AES加密数据..."
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { signature, timestamp, nonce } = req.query;
    const { encrypt } = req.body;
    
    dingtalkService.dingtalkLog.write(`收到 POST 回调: signature=${signature}, timestamp=${timestamp}, encrypt=${encrypt ? '有' : '无'}`);
    
    // 验证签名
    if (!dingtalkService.verifySignature(timestamp, nonce, signature)) {
      dingtalkService.dingtalkLog.write('签名验证失败');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    // 解密数据
    const event = dingtalkService.decryptMessage(encrypt);
    
    dingtalkService.dingtalkLog.write(`解密数据: ${JSON.stringify(event)}`);
    
    // 判断事件类型
    const eventType = event.EventType || event.eventType || event.type;
    
    if (eventType === 'attendance_check_in' || eventType === 'check_in') {
      // 打卡事件
      await dingtalkService.handleAttendanceEvent(event, { get, all, enqueueRun });
    } else {
      dingtalkService.dingtalkLog.write(`忽略非打卡事件: ${eventType}`);
    }
    
    // 返回加密响应给钉钉
    const responseTimestamp = Date.now().toString();
    const responseNonce = Math.random().toString(36).substring(2);
    const successMsg = JSON.stringify({ success: true });
    
    const encryptedResponse = dingtalkService.encryptMessage(successMsg);
    const responseSignature = dingtalkService.calculateSignature(responseTimestamp, responseNonce, encryptedResponse);
    
    res.json({
      msg_signature: responseSignature,
      timeStamp: responseTimestamp,
      nonce: responseNonce,
      encrypt: encryptedResponse
    });
    
  } catch (err) {
    dingtalkService.dingtalkLog.write(`处理打卡回调失败: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/dingtalk/callback/logs
 * 查看最近日志（调试用）
 */
router.get('/logs', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logPath = path.join(__dirname, '../../logs/dingtalk-callback.log');
    
    if (!fs.existsSync(logPath)) {
      return res.json({ success: true, logs: [] });
    }
    
    // 读取最后 100 行
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).slice(-100);
    
    res.json({ success: true, logs: lines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dingtalk/callback/test-userid
 * 测试通过手机号获取 userid（调试用）
 */
router.get('/test-userid', async (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ error: '缺少 phone 参数' });
    }
    
    const userid = await dingtalkService.getUserIdByMobile(phone);
    
    res.json({ success: true, phone, userid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
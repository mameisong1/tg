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
    
    dingtalkService.dingtalkLog.write(`收到验证请求: signature=${signature}, timestamp=${timestamp}, nonce=${nonce}, echostr=${echostr ? '有' : '无'}`);
    
    // GET 验证请求：钉钉会发送 echostr，签名算法需要包含 echostr
    if (echostr) {
      // 验证签名（包含 echostr）
      if (!dingtalkService.verifySignature(timestamp, nonce, echostr, signature)) {
        dingtalkService.dingtalkLog.write('GET 验证签名失败');
        return res.status(403).send('Invalid signature');
      }
      
      // 解密 echostr 并返回
      const decrypted = dingtalkService.decryptMessage(echostr);
      dingtalkService.dingtalkLog.write(`GET 验证成功，返回: ${decrypted}`);
      
      res.send(decrypted);
    } else {
      // 没有 echostr，简单验证（仅 timestamp + token + nonce）
      // 这种情况不应该发生
      dingtalkService.dingtalkLog.write('警告: GET 请求没有 echostr 参数');
      res.status(403).send('Missing echostr');
    }
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
    
    // 验证签名（必须包含 encrypt）
    if (!dingtalkService.verifySignature(timestamp, nonce, encrypt, signature)) {
      dingtalkService.dingtalkLog.write('POST 签名验证失败');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    
    dingtalkService.dingtalkLog.write('POST 签名验证成功');
    
    // 解密数据
    const event = dingtalkService.decryptMessage(encrypt);
    
    dingtalkService.dingtalkLog.write(`解密数据: ${JSON.stringify(event)}`);
    
    // 判断事件类型
    const eventType = event.EventType || event.eventType || event.type;
    
    if (eventType === 'check_url') {
      // 测试回调 URL 的正确性
      dingtalkService.dingtalkLog.write('测试回调 URL 的正确性');
    } else if (eventType === 'attendance_check_in' || eventType === 'check_in' || eventType === 'user_check_in' || eventType === 'attendance_check_record') {
      // 打卡事件（包括新格式 attendance_check_record）
      await dingtalkService.handleAttendanceEvent(event, { get, all, enqueueRun });
    } else {
      dingtalkService.dingtalkLog.write(`忽略非打卡事件: ${eventType}`);
    }
    
    // ⚠️ 无论什么事件，都必须返回加密后的 "success" 字符串
    const responseTimestamp = Date.now().toString();
    const responseNonce = Math.random().toString(36).substring(2);
    const successMsg = 'success';  // 钉钉官方 sample：返回加密的 "success" 字符串
    
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

/**
 * GET /api/dingtalk/callback/test-attendance
 * 测试获取钉钉打卡记录（调试用）
 */
router.get('/test-attendance', async (req, res) => {
  try {
    const { userid, date } = req.query;
    
    if (!userid) {
      return res.status(400).json({ error: '缺少 userid 参数' });
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const records = await dingtalkService.getAttendanceList(userid, targetDate, targetDate);
    
    dingtalkService.dingtalkLog.write(`测试获取打卡记录: userid=${userid}, date=${targetDate}, count=${records.length}`);
    
    // 如果有记录，打印第一条的结构
    if (records.length > 0) {
      dingtalkService.dingtalkLog.write(`第一条打卡记录结构: ${JSON.stringify(records[0])}`);
    }
    
    res.json({ success: true, userid, date: targetDate, count: records.length, records });
  } catch (err) {
    dingtalkService.dingtalkLog.write(`测试获取打卡记录失败: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
# 天宫QA项目 - 强制钉钉打卡翻牌设计方案

## QA需求概述

**核心目标**：用户上班打卡不再提交钉钉打卡截图证明打卡时间，改为系统直接使用钉钉推送的打卡时间或系统主动调用接口获取钉钉打卡时间。

**流程设计**：
1. 如果已收到钉钉接口推送的打卡时间 → 直接打卡成功，不需提交截图
2. 系统主动获取10分钟内的钉钉打卡时间 → 成功获取则打卡成功
3. 如果前两个都未成功 → 弹框告知用户必须先钉钉打卡，确认后进入轮询获取
4. 沙漏对话框 + 后台每隔10秒调用接口获取钉钉打卡数据 → 5分钟超时未获取则打卡失败

**验收重点**：
1. 前端打卡流程（提示、勾选框、弹框、沙漏、超时处理）
2. 后端获取钉钉打卡时间（推送+主动查询）
3. 时间写入正确性（Clock_in_time = 钉钉打卡时间）
4. 各场景（上班打卡、乐捐归来、双重场景）处理正确性
5. 5分钟超时逻辑

---

## 技术方案设计

### 1. 新增/修改的文件

#### 1.1 后端新增文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/routes/dingtalk-attendance-query.js` | 新增钉钉打卡查询 API（主动查询+轮询状态） |

#### 1.2 后端修改文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice/backend/routes/coaches.js` | 修改 clock-in API：强制使用钉钉打卡时间（含正常上班 + 乐捐状态上班双重场景） |
| `/TG/tgservice/backend/services/dingtalk-service.js` | 新增轮询查询方法 |
| `/TG/tgservice/backend/server.js` | 注册新路由 `dingtalk-attendance-query` |

**⚠️ 本次不修改**：管理端手动乐捐归来（`lejuan-records.js` 的 return API）本次不做任何修改，维持现状。该功能由助教管理/店长操作，不需要强制钉钉打卡。

#### 1.3 前端修改文件

| 文件路径 | 说明 |
|---------|------|
| `/TG/tgservice-uniapp/src/pages/internal/clock.vue` | 上班打卡页面：新增提示+勾选框、隐藏截图上传、沙漏弹框、超时处理 |
| `/TG/tgservice-uniapp/src/pages/internal/lejuan-return.vue` | 乐捐归来页面（如有）：同上改造 |
| `/TG/tgservice-uniapp/src/utils/api.js` | 新增 API 调用方法 |

#### 1.4 数据库变更

**无需新增表/字段**，现有表结构已支持：
- `attendance_records.dingtalk_in_time` - 钉钉上班打卡时间
- `attendance_records.clock_in_time` - 系统打卡时间（将改为同步钉钉时间）
- `lejuan_records.dingtalk_return_time` - 钉钉乐捐归来时间
- `lejuan_records.return_time` - 系统归来时间（将改为同步钉钉时间）

---

### 2. API 变更设计

#### 2.1 新增 API：钉钉打卡轮询查询

```
POST /api/dingtalk-attendance/query
```

**请求参数**：
```json
{
  "coach_no": "TG001",
  "clock_type": "in",  // in=上班打卡, return=乐捐归来
  "lejuan_id": 123,    // 仅 clock_type=return 时需要
  "timeout_seconds": 300  // 轅时时间，默认300秒（5分钟）
}
```

**响应格式**：
```json
{
  "success": true,
  "data": {
    "status": "found",  // found=已查到, pending=等待中, timeout=超时
    "dingtalk_time": "2026-05-01 14:00:00",  // 钉钉打卡时间
    "message": "已获取钉钉打卡时间"
  }
}
```

**实现逻辑**：
1. 先检查数据库是否已有 `dingtalk_in_time` / `dingtalk_return_time`（钉钉推送）
2. 如果没有，调用钉钉 API `getAttendanceList` 查询最近10分钟内的打卡记录
3. 如果查到 → 返回 `status=found`
4. 如果没查到 → 返回 `status=pending`，启动后台轮询任务
5. 后台每10秒查询一次，5分钟超时 → 返回 `status=timeout`

#### 2.2 修改 API：上班打卡

```
POST /api/coaches/:coach_no/clock-in
```

**变更内容**：
- **删除** `clock_in_photo` 参数（截图改为非必须）
- **新增** `force_dingtalk` 参数（强制使用钉钉时间，默认 true）
- **逻辑变更**：
  1. 先调用 `/api/dingtalk-attendance/query` 检查钉钉打卡时间
  2. 如果钉钉时间存在 → `clock_in_time = dingtalk_in_time`
  3. 如果钉钉时间不存在 → 返回错误码 `DINGTALK_NOT_FOUND`，前端弹框

**响应变更**：
```json
{
  "success": false,
  "error": "DINGTALK_NOT_FOUND",
  "message": "未获取到钉钉打卡时间，请先在钉钉打卡"
}
```

#### 2.3 ⚠️ 不修改：管理端手动乐捐归来

```
POST /api/lejuan-records/:id/return
```

**本次不做任何修改**。该 API 由助教管理/店长在乐捐一览页面操作，不需要强制钉钉打卡时间，维持现状。

> 注：助教在乐捐状态下点击「上班」走的是 `coaches.js` 的 clock-in API（双重场景），已在 2.2 中覆盖。

---

### 3. 前后端交互流程

#### 3.1 上班打卡流程

```
用户点击「上班」按钮
    ↓
前端检查勾选框是否勾选
    ↓ (未勾选)
提示「请先勾选确认钉钉打卡」
    ↓ (已勾选)
前端调用 POST /api/dingtalk-attendance/query
    ↓
后端检查数据库 dingtalk_in_time
    ↓ (已存在)
直接返回 status=found, dingtalk_time=XXX
    ↓
前端调用 POST /api/coaches/:coach_no/clock-in
    ↓
后端写入 clock_in_time = dingtalk_time
    ↓
打卡成功，显示成功提示

--- 分支：钉钉时间未找到 ---
    ↓ (dingtalk_in_time 不存在)
后端调用钉钉 API 查询最近10分钟记录
    ↓ (找到)
返回 status=found, 写入 dingtalk_in_time
    ↓ (未找到)
返回 status=pending, 启动后台轮询
    ↓
前端显示沙漏弹框「正在获取钉钉打卡数据...」
    ↓
前端每隔3秒调用 GET /api/dingtalk-attendance/status?coach_no=XXX
    ↓ (status=found)
关闭沙漏弹框，调用 clock-in API
    ↓ (status=timeout, 5分钟超时)
关闭沙漏弹框，显示失败提示
「打卡失败：未获取到钉钉打卡时间，请联系助教管理或店长提交打卡截图手动打卡翻牌」
```

#### 3.2 乐捐状态上班流程（双重场景）

```
用户当前状态：乐捐中
    ↓
用户点击「上班」按钮
    ↓
前端显示提示+勾选框（同正常上班打卡）
    ↓
调用 POST /api/dingtalk-attendance/query
    ↓
后端获取钉钉打卡时间
    ↓
后端判断 oldStatus === '乐捐' → 同时处理：
  - clock_in_time = dingtalk_in_time
  - return_time = dingtalk_return_time（同一钉钉时间）
    ↓
返回成功
```

**⚠️ 管理端手动乐捐归来**（助教管理/店长在乐捐一览页面操作）不在本次修改范围内，维持现状。

#### 3.3 双重场景流程

```
用户状态：乐捐中 + 需上班打卡
    ↓
用户点击「上班」按钮（同时也是乐捐归来）
    ↓
调用 clock-in API
    ↓
后端判断 oldStatus === '乐捐'
    ↓
同时处理：
  - clock_in_time = dingtalk_in_time
  - return_time = dingtalk_return_time（同一条钉钉打卡记录）
    ↓
返回成功
```

---

### 4. 前端 UI 设计

#### 4.1 上班打卡页面改造

**新增元素**：
```vue
<!-- 打卡提示区域（显眼位置） -->
<view class="dingtalk-tip-section">
  <view class="tip-alert">
    <text class="tip-icon">⚠️</text>
    <text class="tip-text">请先在钉钉打卡，并在5分钟内完成系统打卡</text>
  </view>
  <view class="checkbox-row">
    <checkbox :checked="dingtalkConfirmed" @change="onCheckboxChange" />
    <text class="checkbox-label">我确认已完成钉钉打卡</text>
  </view>
</view>

<!-- 沙漏弹框 -->
<view class="hourglass-modal" v-if="showHourglass">
  <view class="hourglass-content">
    <text class="hourglass-icon">⏳</text>
    <text class="hourglass-text">正在获取钉钉打卡数据...</text>
    <text class="hourglass-counter">{{ countdownSeconds }}秒</text>
  </view>
</view>
```

**隐藏元素**：
```vue
<!-- 打卡截图上传区域（改为非必填，隐藏或可选） -->
<view class="photo-section" v-if="showPhotoUpload">
  <text class="photo-title">上传打卡截图（可选）</text>
  ...
</view>
```

**样式要求**：
- 提示区域使用醒目颜色（红色/橙色背景）
- 勾选框未勾选时禁用「上班」按钮
- 沙漏弹框居中显示，带动画效果

#### 4.2 超时处理 UI

```vue
<!-- 超时弹框 -->
<uni-modal
  v-if="showTimeoutModal"
  title="打卡失败"
  content="未获取到钉钉打卡时间，请联系助教管理或店长提交打卡截图手动打卡翻牌"
  :show-cancel="false"
  confirm-text="我知道了"
  @confirm="onTimeoutConfirm"
/>
```

---

### 5. 后端核心代码设计

#### 5.1 钉钉打卡查询路由

```javascript
// /TG/tgservice/backend/routes/dingtalk-attendance-query.js

const express = require('express');
const router = express.Router();
const dingtalkService = require('../services/dingtalk-service');
const { get, all, enqueueRun } = require('../db');
const TimeUtil = require('../utils/time');

// 轮询状态缓存（内存存储，5分钟过期）
const pollStatusCache = new Map();

/**
 * POST /api/dingtalk-attendance/query
 * 查询/轮询钉钉打卡时间
 */
router.post('/query', async (req, res) => {
  try {
    const { coach_no, clock_type, lejuan_id, timeout_seconds = 300 } = req.body;
    
    // 1. 检查数据库是否已有钉钉打卡时间（推送）
    const todayStr = TimeUtil.todayStr();
    let dingtalkTime;
    
    if (clock_type === 'in') {
      const attendance = await get(
        'SELECT dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
        [coach_no, todayStr]
      );
      dingtalkTime = attendance?.dingtalk_in_time;
    } else if (clock_type === 'return') {
      const lejuan = await get(
        'SELECT dingtalk_return_time FROM lejuan_records WHERE id = ?',
        [lejuan_id]
      );
      dingtalkTime = lejuan?.dingtalk_return_time;
    }
    
    if (dingtalkTime) {
      // 已有推送数据 → 直接返回
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: dingtalkTime }
      });
    }
    
    // 2. 主动查询最近10分钟内的钉钉打卡记录
    const coach = await get('SELECT dingtalk_user_id FROM coaches WHERE coach_no = ?', [coach_no]);
    if (!coach || !coach.dingtalk_user_id) {
      return res.json({
        success: true,
        data: { status: 'error', message: '助教未绑定钉钉用户ID' }
      });
    }
    
    const yesterdayStr = TimeUtil.offsetDateStr(-1);
    const records = await dingtalkService.getAttendanceList(
      coach.dingtalk_user_id,
      yesterdayStr,
      todayStr
    );
    
    // 筛选10分钟内的打卡记录
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    
    const recentRecords = records.filter(r => {
      const checkTime = r.userCheckTime || r.checkTime;
      return checkTime && checkTime >= tenMinutesAgo;
    });
    
    if (recentRecords.length > 0) {
      // 找到10分钟内的打卡记录
      const lastRecord = recentRecords[recentRecords.length - 1];
      const checkTimeStr = TimeUtil.formatTimestamp(lastRecord.userCheckTime || lastRecord.checkTime);
      
      // 写入数据库
      if (clock_type === 'in') {
        await enqueueRun(
          'UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE coach_no = ? AND date = ?',
          [checkTimeStr, TimeUtil.nowDB(), coach_no, todayStr]
        );
      } else if (clock_type === 'return') {
        await enqueueRun(
          'UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?',
          [checkTimeStr, TimeUtil.nowDB(), lejuan_id]
        );
      }
      
      return res.json({
        success: true,
        data: { status: 'found', dingtalk_time: checkTimeStr }
      });
    }
    
    // 3. 未找到 → 启动后台轮询
    const pollKey = `${coach_no}_${clock_type}_${lejuan_id || ''}`;
    pollStatusCache.set(pollKey, {
      status: 'pending',
      startTime: Date.now(),
      timeoutSeconds: timeout_seconds,
      coach_no,
      clock_type,
      lejuan_id,
      dingtalk_user_id: coach.dingtalk_user_id
    });
    
    // 启动后台轮询任务（非阻塞）
    startBackgroundPolling(pollKey);
    
    return res.json({
      success: true,
      data: { status: 'pending', message: '正在获取钉钉打卡数据...' }
    });
    
  } catch (err) {
    console.error('查询钉钉打卡失败:', err);
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

/**
 * GET /api/dingtalk-attendance/status
 * 查询轮询状态
 */
router.get('/status', async (req, res) => {
  try {
    const { coach_no, clock_type, lejuan_id } = req.query;
    const pollKey = `${coach_no}_${clock_type}_${lejuan_id || ''}`;
    
    const status = pollStatusCache.get(pollKey);
    
    if (!status) {
      return res.json({ success: true, data: { status: 'unknown' } });
    }
    
    res.json({ success: true, data: status });
    
  } catch (err) {
    res.status(500).json({ success: false, error: '查询失败' });
  }
});

/**
 * 后台轮询任务
 */
function startBackgroundPolling(pollKey) {
  const status = pollStatusCache.get(pollKey);
  if (!status) return;
  
  const interval = setInterval(async () => {
    try {
      const elapsed = (Date.now() - status.startTime) / 1000;
      
      // 检查超时
      if (elapsed >= status.timeoutSeconds) {
        status.status = 'timeout';
        status.message = '5分钟超时，未获取到钉钉打卡时间';
        pollStatusCache.set(pollKey, status);
        clearInterval(interval);
        return;
      }
      
      // 查询钉钉打卡记录
      const todayStr = TimeUtil.todayStr();
      const yesterdayStr = TimeUtil.offsetDateStr(-1);
      const records = await dingtalkService.getAttendanceList(
        status.dingtalk_user_id,
        yesterdayStr,
        todayStr
      );
      
      // 筛选最近的打卡记录
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      const recentRecords = records.filter(r => {
        const checkTime = r.userCheckTime || r.checkTime;
        return checkTime && checkTime >= fiveMinutesAgo;
      });
      
      if (recentRecords.length > 0) {
        // 找到打卡记录
        const lastRecord = recentRecords[recentRecords.length - 1];
        const checkTimeStr = TimeUtil.formatTimestamp(lastRecord.userCheckTime || lastRecord.checkTime);
        
        // 写入数据库
        if (status.clock_type === 'in') {
          await enqueueRun(
            'UPDATE attendance_records SET dingtalk_in_time = ?, updated_at = ? WHERE coach_no = ? AND date = ?',
            [checkTimeStr, TimeUtil.nowDB(), status.coach_no, todayStr]
          );
        } else if (status.clock_type === 'return') {
          await enqueueRun(
            'UPDATE lejuan_records SET dingtalk_return_time = ?, updated_at = ? WHERE id = ?',
            [checkTimeStr, TimeUtil.nowDB(), status.lejuan_id]
          );
        }
        
        status.status = 'found';
        status.dingtalk_time = checkTimeStr;
        pollStatusCache.set(pollKey, status);
        clearInterval(interval);
      }
      
    } catch (err) {
      dingtalkService.dingtalkLog.write(`轮询异常: ${err.message}`);
    }
  }, 10000); // 每10秒查询一次
  
  // 5分钟后自动清理缓存
  setTimeout(() => {
    pollStatusCache.delete(pollKey);
  }, status.timeoutSeconds * 1000 + 1000);
}

module.exports = router;
```

#### 5.2 修改 clock-in API

```javascript
// /TG/tgservice/backend/routes/coaches.js

/**
 * POST /api/coaches/:coach_no/clock-in
 * 助教上班（强制使用钉钉打卡时间）
 */
router.post('/:coach_no/clock-in', auth.required, requireBackendPermission(['coachManagement'], { coachSelfOnly: true }), async (req, res) => {
  try {
    const { coach_no } = req.params;
    const { clock_in_photo, force_dingtalk = true } = req.body;
    
    // 1. 获取钉钉打卡时间
    const todayStr = TimeUtil.todayStr();
    const attendance = await get(
      'SELECT dingtalk_in_time FROM attendance_records WHERE coach_no = ? AND date = ?',
      [coach_no, todayStr]
    );
    
    const dingtalkTime = attendance?.dingtalk_in_time;
    
    if (force_dingtalk && !dingtalkTime) {
      // 未找到钉钉打卡时间 → 返回错误码
      return res.json({
        success: false,
        error: 'DINGTALK_NOT_FOUND',
        message: '未获取到钉钉打卡时间，请先在钉钉打卡'
      });
    }
    
    // 2. 执行打卡逻辑
    const result = await runInTransaction(async (tx) => {
      // ... 现有逻辑 ...
      
      // 【关键变更】clock_in_time 使用钉钉打卡时间
      const clockInTime = dingtalkTime || TimeUtil.nowDB();
      
      // 更新水牌状态
      await tx.run(`
        UPDATE water_boards
        SET status = ?, table_no = NULL, clock_in_time = ?, updated_at = ?
        WHERE coach_no = ?
      `, [newStatus, clockInTime, TimeUtil.nowDB(), coach_no]);
      
      // 写入打卡记录
      await tx.run(`
        UPDATE attendance_records
        SET clock_in_time = ?, clock_in_photo = ?, is_late = ?, updated_at = ?
        WHERE coach_no = ? AND date = ?
      `, [clockInTime, clock_in_photo || null, isLate, TimeUtil.nowDB(), coach_no, todayStr]);
      
      return { coach_no, clock_in_time: clockInTime, ... };
    });
    
    res.json({ success: true, data: result });
    
  } catch (error) {
    // ...
  }
});
```

---

### 6. 边界情况和异常处理

#### 6.1 钉钉用户ID未绑定

**场景**：助教未绑定钉钉用户ID（`dingtalk_user_id` 为空）

**处理**：
```javascript
if (!coach.dingtalk_user_id) {
  return res.json({
    success: true,
    data: { 
      status: 'error', 
      message: '助教未绑定钉钉用户ID，请联系管理员配置'
    }
  });
}
```

**前端提示**：
```
您的账号未绑定钉钉用户ID，请联系助教管理或店长配置后再打卡
```

#### 6.2 钉钉打卡时间不在范围内

**场景**：钉钉打卡时间超过10分钟（可能忘记了）

**处理**：
- 第一次查询返回 `pending`
- 后台轮询继续查找最近5分钟内的记录
- 如果找到更早的记录，写入但标记为「异常」

**建议**：前端显示确认弹框
```
检测到您的钉钉打卡时间为 XX:XX（超过10分钟），是否继续使用该时间打卡？
```

#### 6.3 双重场景时间一致性

**场景**：乐捐归来 + 上班打卡（双重场景）

**处理**：
```javascript
// 使用同一条钉钉打卡记录
const dingtalkTime = attendance?.dingtalk_in_time;

// 同时写入两个表
await tx.run(`
  UPDATE attendance_records SET clock_in_time = ?, dingtalk_in_time = ? ...
`, [dingtalkTime, dingtalkTime, ...]);

await tx.run(`
  UPDATE lejuan_records SET return_time = ?, dingtalk_return_time = ? ...
`, [dingtalkTime, dingtalkTime, ...]);
```

#### 6.4 网络异常处理

**场景**：钉钉 API 调用失败（网络异常、API限流）

**处理**：
```javascript
try {
  const records = await dingtalkService.getAttendanceList(...);
} catch (err) {
  dingtalkService.dingtalkLog.write(`钉钉API调用失败: ${err.message}`);
  return res.json({
    success: true,
    data: { status: 'error', message: '钉钉API调用失败，请稍后重试' }
  });
}
```

#### 6.5 轮询并发控制

**场景**：用户多次点击打卡按钮，启动多个轮询任务

**处理**：
```javascript
// 使用 pollKey 防止重复启动
const pollKey = `${coach_no}_${clock_type}_${lejuan_id || ''}`;
if (pollStatusCache.has(pollKey)) {
  // 已有轮询任务 → 返回当前状态
  return res.json({ success: true, data: pollStatusCache.get(pollKey) });
}
```

---

### 7. 下班打卡说明

**不变**：下班打卡维持现状，不强制使用钉钉打卡时间

**原因**：
- 下班打卡时间不影响迟到判定
- 夜间下班可能忘记钉钉打卡，强制会影响用户体验
- 钉钉下班时间只用于记录对比，不强制同步

---

### 8. 测试用例设计

#### 8.1 正常流程测试

| 测试编号 | 场景 | 前端操作 | 后端响应 | 预期结果 |
|---------|------|---------|---------|---------|
| T01 | 钉钉已推送 | 点击上班 | 直接返回 found | clock_in_time = dingtalk_in_time |
| T02 | 钉钉10分钟内 | 点击上班 | 主动查询 found | clock_in_time = dingtalk_in_time |
| T03 | 钉钉未打卡 | 点击上班 | 返回 pending | 显示沙漏弹框 |
| T04 | 轮询成功 | 沙漏等待 | 10秒后查到 | 打卡成功 |
| T05 | 轮询超时 | 沙漏等待 | 5分钟后 timeout | 显示失败提示 |

#### 8.2 异常流程测试

| 测试编号 | 场景 | 前端操作 | 后端响应 | 预期结果 |
|---------|------|---------|---------|---------|
| T06 | 未勾选确认框 | 点击上班 | 前端拦截 | 提示「请先勾选确认」 |
| T07 | 未绑定钉钉ID | 点击上班 | 返回 error | 提示「未绑定钉钉用户ID」 |
| T08 | 钉钉API失败 | 点击上班 | 返回 error | 提示「钉钉API调用失败」 |
| T09 | 双重场景 | 乐捐状态上班 | 同时写入两表 | clock_in_time = return_time |
| T10 | 网络中断 | 沙漏等待 | 后端轮询继续 | 恢复后继续查询 |

---

### 9. 部署计划

#### 9.1 分阶段部署

**第一阶段**（后端）：
1. 新增 `dingtalk-attendance-query.js` 路由
2. 修改 `dingtalk-service.js` 新增轮询方法
3. 注册新路由

**第二阶段**（前端）：
1. 修改 `clock.vue` 新增提示+勾选框
2. 修改 `clock.vue` 添加沙漏弹框
3. 隐藏/可选截图上传区域

**第三阶段**（集成测试）：
1. 测试正常流程
2. 测试异常流程
3. 测试边界情况

#### 9.2 回滚方案

如果出现严重问题：
1. 后端：`force_dingtalk` 参数设为 `false`，恢复原有逻辑
2. 前端：隐藏钉钉提示区域，恢复截图上传为必填

---

### 10. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 钉钉API不稳定 | 无法获取打卡时间 | 增加重试机制，超时后提供手动打卡路径 |
| 用户忘记钉钉打卡 | 无法系统打卡 | 提前提示+勾选框确认 |
| 轮询任务堆积 | 内存占用增加 | 5分钟后自动清理缓存 |
| 双重场景时间不一致 | 数据异常 | 使用同一时间写入两表 |
| 前端沙漏体验差 | 用户焦虑 | 显示倒计时+进度提示 |

---

## 附录：现有代码参考

### A. 钉钉回调处理

位置：`/TG/tgservice/backend/routes/dingtalk-callback.js`

关键函数：`handleAttendanceEvent` - 处理钉钉推送的打卡事件

写入字段：
- `attendance_records.dingtalk_in_time` - 上班打卡时间
- `attendance_records.dingtalk_out_time` - 下班打卡时间
- `lejuan_records.dingtalk_return_time` - 乐捐归来时间

### B. 钉钉服务

位置：`/TG/tgservice/backend/services/dingtalk-service.js`

关键函数：
- `getAttendanceList(userid, dateFrom, dateTo)` - 获取钉钉打卡记录
- `queryRecentAttendance(...)` - 查询最近5分钟内的打卡记录（已有，可复用）
- `getUserIdByMobile(mobile)` - 通过手机号获取钉钉用户ID

### C. 前端打卡页面

位置：`/TG/tgservice-uniapp/src/pages/internal/clock.vue`

现有逻辑：
- 上班打卡需上传截图（`clock_in_photo`）
- 下班打卡无需截图
- 水牌状态判断（`canClockIn` / `canClockOut`）

---

## 设计方案完成

**输出位置**：`/TG/temp/QA-20260501-1/design.md`

**设计者**：程序员A（子代理）

**审核建议**：
1. 确认钉钉 API 调用频率限制（避免被限流）
2. 确认前端沙漏弹框 UI 细节
3. 确认超时后的手动打卡流程（店长操作）
4. 确认双重场景的测试用例

---

_设计方案 v1.0 - 2026-05-01_
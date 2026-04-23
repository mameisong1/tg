# 天宫国际 - 核心业务逻辑文档

本文档详细描述系统的核心业务流程和逻辑规则。

---

## 1. 订单流程

### 1.1 完整业务流程

```
扫码选台 → 浏览商品 → 加购物车 → 下单 → 后台处理
```

### 1.2 员工免扫码下单流程

#### 1.2.1 登录员工定义

当用户通过手机号+验证码登录H5前台时,如果手机号匹配以下任一表,则视为**登录员工**:
- **助教表**(coaches.phone):返回 `coachInfo` + `coachToken`
- **后台用户表**(admin_users.username):返回 `adminInfo` + `adminToken`

前端通过 `uni.getStorageSync('adminToken')` 或 `uni.getStorageSync('coachToken')` 判断是否为员工。

#### 1.2.2 员工特权

1. **跳过扫码检查**:商品添加购物车、下单时不再检查台桌扫码授权状态
2. **手动选台**:员工通过页面顶部的「切换台桌」按钮选择/切换台桌号
3. **默认台桌号**:已上桌助教(水牌状态=早/晚班上桌)打开台桌选择器时,默认高亮当前台桌号
4. 商品一览和购物车不再显示扫码提示,改为显示当前台桌号

#### 1.2.3 员工台桌管理

员工在购物车/商品页顶部显示台桌号:
- **已选台桌**:显示当前台桌号 + 「切换台桌」按钮
- **未选台桌**:显示「未选择」 + 「切换台桌」按钮

点击「切换台桌」弹出 TableSelector → 选择后:
1. 更新 localStorage 中的 `tableName`
2. 调用 `PUT /api/cart/table` 更新购物车所有商品的 `table_no`
3. 刷新购物车显示

#### 1.2.4 员工下单流程

```
员工登录 → 选择台桌(可选)→ 浏览商品(无需扫码)→ 加购物车 → 下单
  → 有台桌号?→ 直接下单
  → 无台桌号?→ 提示「请先选择台桌号」
```

⚠️ 商品页:员工添加商品到购物车前,如无台桌号会先弹出 TableSelector 供选择。

#### 1.2.5 服务单权限

> **前端快捷需求按钮(2026-04-11 新增)**:
> 服务下单页面(`/pages/internal/service-order.vue`)提供 5 组快捷需求按钮(共 11 个),点击自动填入需求内容,仍需手动提交。
>
> | 分组 | 颜色 | 按钮 |
> |------|------|------|
> | 账务 | 🔴 #e74c3c | 看账单 |
> | 挂烟 | 🟠 #e67e22 | 挂烟1包、挂烟2包 |
> | 配件 | 🟡 #f39c12 | 打火机、换电池 |
> | 酒具 | 🔵 #3498db | 啤酒杯、样酒杯 |
> | 其它 | 🟣 #9b59b6 | 零食推车、换垃圾袋、搞卫生、音响连接、加水 |
>
> 布局:分组名与按钮左右排列(flex row),每组占一行,按钮自动换行。

助教、教练和所有后台用户都能下服务单。`POST /api/service-orders` 仅需 `auth.required` 认证,不需要特殊权限。

#### 1.2.6 已知问题修复

| 问题 | 原因 | 修复日期 |
|------|------|----------|
| 购物车切换台桌后台桌号不更新 | `tableName` 使用 `computed` 依赖 `getStorageSync`,不是响应式的 | 2026-04-10 |
| 商品页员工仍显示扫码过期提示 | `TableInfo` 未传入 `isEmployee` prop | 2026-04-10 |
| 服务单接口拒绝助教提交 | `POST /api/service-orders` 要求 `cashierDashboard` 权限 | 2026-04-10 |

**响应式修复**:`tableName` 改用 `ref` 初始化,切换台桌时手动 `tableName.value = tableNo`,`onShow` 时从 localStorage 同步。

⚠️ **一般顾客必须先扫码后下单的逻辑不变**。

### 1.3 详细步骤说明

#### 第一步:扫码选台(非员工)
1. 用户扫描台桌二维码(每个台桌有唯一二维码)
2. 二维码URL格式:`https://xxx.com/h5?table=台桌名称`
3. 前端解析URL参数获取 `table` 值
4. 将台桌号存储到本地:
   ```javascript
   // 小程序
   uni.setStorageSync('selectedTable', tableName)

   // H5(30分钟有效)
   uni.setStorageSync('h5SessionTable', tableName)
   uni.setStorageSync('h5SessionTime', Date.now())
   ```

#### 第二步:浏览商品
1. 调用 `GET /api/products` 获取商品列表
2. 商品按分类展示:
   - 热销商品(首页展示)
   - 按分类筛选(后端支持 `category` 参数)
3. 商品信息包含:名称、价格、图片、库存状态

#### 第三步:加购物车
1. 调用 `POST /api/cart` 添加商品
2. 请求参数:
   ```json
   {
     "sessionId": "会话标识",
     "tableNo": "台桌号",
     "productName": "商品名称",
     "quantity": 1
   }
   ```
3. 购物车逻辑:
   - 同一 sessionId + productName 则累加数量
   - 不同则新建记录
   - 台桌号绑定到购物车记录

#### 第四步:下单
1. 调用 `POST /api/order` 提交订单
2. 后端处理流程:
   ```javascript
   // 1. 获取购物车商品
   const items = await getCartItems(sessionId);

   // 2. 验证台桌号(必须存在且有效)
   if (!tableNo) {
     return { error: '请扫台桌码进入后再下单' };
   }

   // 3. 检查台桌是否存在
   const table = await checkTable(tableNo);
   if (!table) {
     return { error: '台桌不存在,请重新扫码' };
   }

   // 4. 检查购物车是否有多个台桌(防止混单)
   if (tableSet.size > 1) {
     return { error: '购物车存在多个台桌商品,请清空后重新下单' };
   }

   // 5. 生成订单号
   const orderNo = `TG${Date.now()}`;

   // 6. 发送钉钉通知
   await sendDingtalkMessage(orderInfo);

   // 7. 保存订单记录
   await saveOrder(orderNo, tableNo, items, totalPrice);

   // 8. 清空购物车
   await clearCart(sessionId);
   ```

#### 第五步:后台处理
1. 钉钉消息格式:
   ```
   【天宫国际 - 新订单】

   台桌号: 普台1号
   商品:
     • 啤酒 x2 = ¥56.00
     • 花生 x1 = ¥18.00

   合计: ¥74.00
   订单号: TG1711234567890
   时间: 2024/3/22 15:30:00
   ```
2. 后台可在订单管理页面查看和处理订单
3. 订单状态流转:`待处理` → `已完成`

---

## 2. 助教系统

### 2.1 助教登录验证

助教通过前台独立入口登录,验证规则如下:

#### 登录条件(三要素验证)
- **工号**:`employee_id`
- **艺名**:`stage_name`
- **身份证后6位**:`id_last6`

#### 验证流程
```javascript
// POST /api/coaches/login
app.post('/api/coaches/login', async (req, res) => {
  const { employeeId, stageName, idLast6 } = req.body;

  // 1. 查询助教(只查在职状态)
  const coach = await dbGet(
    `SELECT * FROM coaches
     WHERE employee_id = ?
     AND (status = '全职' OR status = '兼职' OR status IS NULL)`,
    [employeeId]
  );

  // 2. 验证工号
  if (!coach) {
    return res.status(401).json({ error: '工号不存在或已离职' });
  }

  // 3. 验证艺名
  if (coach.stage_name !== stageName) {
    return res.status(401).json({ error: '艺名不匹配' });
  }

  // 4. 验证身份证后6位(从 real_name 字段提取或专门存储)
  // 注:当前实现简化,实际项目需要身份证字段

  // 5. 返回助教信息和 token
  res.json({
    success: true,
    coach: { coachNo, stageName, level, ... }
  });
});
```

#### 登录后可操作功能
- 编辑个人简介 (`intro`)
- 管理照片 (`photos`)
- 管理视频 (`videos`)
- 编辑年龄和身高

### 2.2 人气值防刷机制

为防止恶意刷人气值,系统实现了多层防护:

#### 防刷规则
1. **同一 session 限制**:同一会话对同一助教只能投一次票
2. **时间间隔限制**:同一 session 两次投票间隔 >= 30 秒
3. **日投票上限**:单日投票次数限制(可配置)

#### 实现代码
```javascript
// POST /api/coaches/:coachNo/popularity
app.post('/api/coaches/:coachNo/popularity', async (req, res) => {
  const { sessionId } = req.body;
  const { coachNo } = req.params;

  // 1. 检查是否已投过票
  const voted = await dbGet(
    `SELECT id FROM popularity_votes
     WHERE session_id = ? AND coach_no = ?`,
    [sessionId, coachNo]
  );

  if (voted) {
    return res.status(400).json({ error: '您已投票过,感谢支持!' });
  }

  // 2. 检查投票间隔
  const lastVote = await dbGet(
    `SELECT created_at FROM popularity_votes
     WHERE session_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );

  if (lastVote) {
    const interval = Date.now() - new Date(lastVote.created_at).getTime();
    if (interval < 30000) { // 30秒
      return res.status(400).json({ error: '投票太频繁,请稍后再试' });
    }
  }

  // 3. 记录投票并更新人气值
  await dbRun(
    `INSERT INTO popularity_votes (session_id, coach_no, created_at)
     VALUES (?, ?, ?)`,  -- TimeUtil.nowDB() 北京时间
    [sessionId, coachNo, TimeUtil.nowDB()]
    [sessionId, coachNo]
  );

  await dbRun(
    `UPDATE coaches SET popularity = popularity + 1 WHERE coach_no = ?`,
    [coachNo]
  );

  res.json({ success: true, message: '投票成功!' });
});
```

### 2.3 照片管理

助教可自行管理个人照片集:

#### 照片上传流程
1. 前端选择图片 → 调用 `POST /api/upload/image` 上传至 OSS
2. 获取图片 URL 后调用 `PUT /api/coaches/:coachNo/profile` 更新
3. 照片存储格式:JSON 数组
   ```json
   {
     "photos": [
       "https://oss.xxx.com/coaches/001_1.jpg",
       "https://oss.xxx.com/coaches/001_2.jpg"
     ]
   }
   ```

#### 照片数量限制
- 默认最多 9 张照片
- 后台管理可不受此限制

---

## 3. 会员系统

### 3.1 微信小程序登录流程

```
用户点击登录 → wx.login() 获取 code → 后端换取 openid → 创建/更新会员 → 返回 token
```

#### 详细步骤

**前端代码示例**:
```javascript
// pages/login/login.vue
async handleWxLogin() {
  // 1. 调用微信登录获取 code
  const loginRes = await uni.login({ provider: 'weixin' });
  const code = loginRes.code;

  // 2. 发送到后端换取 openid
  const res = await api.post('/api/member/wechat-login', { code });

  // 3. 保存 token
  if (res.success) {
    uni.setStorageSync('token', res.token);
    uni.setStorageSync('memberInfo', res.member);
  }
}
```

**后端处理**:
```javascript
// POST /api/member/wechat-login
app.post('/api/member/wechat-login', async (req, res) => {
  const { code } = req.body;

  // 1. 调用微信 API 换取 openid
  const wxRes = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?` +
    `appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`
  );
  const { openid, session_key } = await wxRes.json();

  // 2. 查询或创建会员
  let member = await dbGet('SELECT * FROM members WHERE openid = ?', [openid]);

  if (!member) {
    // 新用户,创建会员记录
    await dbRun(
      `INSERT INTO members (openid, created_at, updated_at)
       VALUES (?, ?, ?)`,  -- TimeUtil.nowDB() 北京时间
      [openid, TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    member = await dbGet('SELECT * FROM members WHERE openid = ?', [openid]);
  }

  // 3. 生成 JWT token(30天有效)
  const token = jwt.sign(
    { memberNo: member.member_no, openid },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ success: true, token, member });
});
```

### 3.2 H5 短信登录流程(SMS)

由于 H5 无法使用微信登录,提供手机号 + 短信验证码登录方式:

```
输入手机号 → 发送验证码 → 输入验证码 → 验证登录 → 返回 token
```

#### 发送验证码
```javascript
// POST /api/member/send-sms
app.post('/api/member/send-sms', async (req, res) => {
  const { phone } = req.body;

  // 1. 验证手机号格式
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不正确' });
  }

  // 2. 检查发送频率(60秒内只能发一次)
  const lastSend = smsCodeCache.get(phone);
  if (lastSend && Date.now() - lastSend.time < 60000) {
    return res.status(400).json({ error: '发送太频繁,请稍后再试' });
  }

  // 3. 生成6位验证码
  const code = Math.random().toString().slice(2, 8);

  // 4. 调用阿里云短信 API 发送
  const smsResult = await sendAliyunSms(phone, code);

  // 5. 缓存验证码(5分钟有效)
  smsCodeCache.set(phone, { code, time: Date.now() });

  res.json({ success: true });
});
```

#### 验证码登录
```javascript
// POST /api/member/sms-login
app.post('/api/member/sms-login', async (req, res) => {
  const { phone, code } = req.body;

  // 1. 验证验证码
  const cached = smsCodeCache.get(phone);
  if (!cached || cached.code !== code) {
    return res.status(401).json({ error: '验证码错误' });
  }

  // 2. 检查是否过期(5分钟)
  if (Date.now() - cached.time > 5 * 60 * 1000) {
    return res.status(401).json({ error: '验证码已过期' });
  }

  // 3. 查询或创建会员
  let member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);

  if (!member) {
    await dbRun(
      `INSERT INTO members (phone, created_at, updated_at)
       VALUES (?, ?, ?)`,  -- TimeUtil.nowDB() 北京时间
      [phone, TimeUtil.nowDB(), TimeUtil.nowDB()]
    );
    member = await dbGet('SELECT * FROM members WHERE phone = ?', [phone]);
  }

  // 4. 生成 token
  const token = jwt.sign(
    { memberNo: member.member_no, phone },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  // 5. 清除已使用的验证码
  smsCodeCache.delete(phone);

  res.json({ success: true, token, member });
});
```

### 3.3 Token 管理

#### Token 规则
- **有效期**:30天(`expiresIn: '30d'`)
- **签名算法**:HS256
- **密钥**:配置文件中的 `jwt_secret`

#### Token 验证中间件
```javascript
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
};
```

#### 前端 Token 存储
```javascript
// 登录成功后
uni.setStorageSync('token', res.token);

// API 请求时携带
const request = (url, options) => {
  const token = uni.getStorageSync('token');
  return uni.request({
    url,
    ...options,
    header: {
      'Authorization': token ? `Bearer ${token}` : ''
    }
  });
};
```

---

## 4. H5 授权机制

### 4.1 授权流程概述

H5 端(非小程序)通过扫码获得临时台桌授权,无需登录即可下单。

```
扫描台桌码 → 解析 table 参数 → 存储授权信息 → 10分钟内有效(生产环境)/ 5分钟内有效(测试环境)
```

### 4.2 扫码授权

#### 二维码格式
- 每个台桌生成唯一二维码
- URL 格式:`https://your-domain.com/h5?table=普台1号`

#### 授权存储
```javascript
// App.vue onLaunch
onLaunch() {
  // 获取 URL 参数
  const query = this.getUrlParams();

  if (query.table) {
    if (query.table === 'clear') {
      // 特殊指令:清空授权
      this.clearH5Session();
    } else {
      // 存储台桌授权
      uni.setStorageSync('h5SessionTable', query.table);
      uni.setStorageSync('h5SessionTime', Date.now());
    }
  }
}
```

### 4.3 30分钟有效期

#### 有效期检查
```javascript
// utils/h5Auth.js
export function checkH5Auth() {
  const table = uni.getStorageSync('h5SessionTable');
  const time = uni.getStorageSync('h5SessionTime');

  if (!table || !time) {
    return { valid: false, reason: 'no_auth' };
  }

  // 检查是否过期(30分钟 = 30 * 60 * 1000 ms)
  const elapsed = Date.now() - time;
  const THIRTY_MINUTES = 30 * 60 * 1000;

  if (elapsed > THIRTY_MINUTES) {
    // 清除过期授权
    uni.removeStorageSync('h5SessionTable');
    uni.removeStorageSync('h5SessionTime');
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, table, remainingMs: THIRTY_MINUTES - elapsed };
}
```

#### 页面中使用
```javascript
// pages/cart/cart.vue
onShow() {
  // #ifdef H5
  const auth = checkH5Auth();
  if (!auth.valid) {
    uni.showModal({
      title: '授权已过期',
      content: '请重新扫描台桌二维码',
      showCancel: false,
      success: () => {
        // 跳转到首页或提示扫码
        uni.switchTab({ url: '/pages/index/index' });
      }
    });
    return;
  }
  // #endif

  this.loadCart();
}
```

### 4.4 过期重新扫码

当授权过期时,用户需要:
1. 看到"授权已过期"提示
2. 重新扫描台桌二维码
3. 系统自动更新授权信息和时间戳

### 4.5 table=clear 清空授权

特殊 URL 参数 `table=clear` 用于主动清除授权:

```javascript
// 清空授权的场景
// 1. 用户离开台桌
// 2. 管理员重置
// 3. 调试/测试

// URL: https://your-domain.com/h5?table=clear

if (query.table === 'clear') {
  uni.removeStorageSync('h5SessionTable');
  uni.removeStorageSync('h5SessionTime');
  uni.removeStorageSync('sessionId');  // 同时清空购物车 session
  uni.showToast({ title: '授权已清除', icon: 'success' });
}
```

---

## 5. 购物车逻辑

### 5.1 Session 绑定

购物车通过 `sessionId` 关联,确保用户隔离:

```javascript
// 生成或获取 sessionId
function getSessionId() {
  let sessionId = uni.getStorageSync('sessionId');
  if (!sessionId) {
    // 生成唯一标识
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    uni.setStorageSync('sessionId', sessionId);
  }
  return sessionId;
}
```

### 5.2 台桌关联

购物车商品与台桌号绑定:

```javascript
// 添加商品时关联台桌
async addToCart(product) {
  const sessionId = getSessionId();

  // #ifdef H5
  const auth = checkH5Auth();
  if (!auth.valid) {
    return uni.showToast({ title: '请先扫码选台', icon: 'none' });
  }
  const tableNo = auth.table;
  // #endif

  // #ifdef MP-WEIXIN
  const tableNo = uni.getStorageSync('selectedTable');
  // #endif

  await api.post('/api/cart', {
    sessionId,
    tableNo,
    productName: product.name,
    quantity: 1
  });
}
```

### 5.3 H5 授权检查

在关键操作前检查 H5 授权状态:

```javascript
// 加购前检查
async addToCart(product) {
  // #ifdef H5
  if (!this.checkH5Auth()) {
    return;  // checkH5Auth 内部会提示并跳转
  }
  // #endif

  // 执行添加逻辑...
}

// 下单前检查
async submitOrder() {
  // #ifdef H5
  if (!this.checkH5Auth()) {
    return;
  }
  // #endif

  // 执行下单逻辑...
}

// 统一检查函数
checkH5Auth() {
  const auth = checkH5Auth();
  if (!auth.valid) {
    const msg = auth.reason === 'expired'
      ? '授权已过期,请重新扫码'
      : '请扫描台桌二维码';

    uni.showModal({
      title: '提示',
      content: msg,
      showCancel: false
    });
    return false;
  }
  return true;
}
```

### 5.4 切换台桌

当用户扫描不同台桌码时,更新购物车关联:

```javascript
// PUT /api/cart/table
app.put('/api/cart/table', async (req, res) => {
  const { sessionId, tableNo } = req.body;

  // 验证台桌存在
  const table = await dbGet('SELECT name FROM tables WHERE name = ?', [tableNo]);
  if (!table) {
    return res.status(400).json({ error: '台桌不存在' });
  }

  // 更新购物车所有商品的台桌号
  await dbRun(
    'UPDATE carts SET table_no = ? WHERE session_id = ?',
    [tableNo, sessionId]
  );

  res.json({ success: true });
});
```

---

## 6. 业务规则汇总

| 规则 | 说明 |
|------|------|
| H5授权有效期 | 生产10分钟 / 测试5分钟 |
| Token有效期 | 30天 |
| 短信验证码有效期 | 5分钟 |
| 短信发送间隔 | 60秒 |
| 人气投票间隔 | 30秒 |
| 同助教投票限制 | 同session只能投一次 |
| 下单必须选台 | 台桌号为空时拒绝下单 |
| 助教照片上限 | 9张 |
| 订单号格式 | TG + 时间戳 |
| 水牌状态 | 根据助教班次(shift)自动判断上桌/空闲/加班 |

### 水牌状态管理

**状态列表**:早班上桌、早班空闲、晚班上桌、晚班空闲、早加班、晚加班、休息、公休、请假、乐捐、下班

**状态简化规则**:
| 操作按钮 | 早班助教 → 实际状态 | 晚班助教 → 实际状态 |
|---------|-------------------|-------------------|
| 上桌 | 早班上桌 | 晚班上桌 |
| 空闲 | 早班空闲 | 晚班空闲 |
| 加班 | 早加班 | 晚加班 |
| 其他 | 休息、公休、请假、乐捐、下班 | 同左 |

**水牌数据关联**:
- `water_boards` 表存储水牌状态
- 通过 `coach_no` 关联 `coaches` 表
- 关联字段:`stage_name`、`shift`(班次)、`photos`、`employee_id`

### 打卡逻辑（2026-04-22 更新）

**上班打卡**:
- API: `POST /api/coaches/:coach_no/clock-in`
- 水牌状态从「下班/乐捐/加班」变为对应班次的「空闲」
- 写入 `attendance_records` 表：`date = 今天`, `clock_in_time = 当前时间`, `clock_out_time = NULL`

**下班打卡**:
- API: `POST /api/coaches/:coach_no/clock-out`
- 水牌状态变为「下班」
- 查找未下班记录：`WHERE coach_no = ? AND date IN (今天, 昨天) AND clock_out_time IS NULL`
- 更新 `attendance_records.clock_out_time = 当前时间`

**凌晨下班处理**:
- 晚班助教可能在凌晨（如02:00）下班
- 此时 `todayStr()` 已变成第二天，上班记录在昨天
- 查询范围扩大为 `date IN (今天, 昨天)` 确保找到前一天晚上的上班记录
- 2026-04-22 修复：之前只查当天导致凌晨下班找不到上班记录，误判漏卡

---

## 7. 错误处理

### 常见错误码

| 场景 | 错误信息 | 处理建议 |
|------|----------|----------|
| 未选台下单 | 请扫台桌码进入后再下单 | 引导用户扫码 |
| 台桌不存在 | 台桌不存在,请重新扫码 | 检查二维码是否正确 |
| H5授权过期 | 授权已过期 | 重新扫码 |
| 验证码错误 | 验证码错误或已过期 | 重新获取 |
| 投票太频繁 | 投票太频繁,请稍后再试 | 等待30秒 |
| 已投过票 | 您已投票过,感谢支持! | 无需重复操作 |
| 助教已离职 | 工号不存在或已离职 | 联系管理员 |

---

## 8. 智能开关业务逻辑

### 8.1 MQTT 开关控制

**架构**:
- 后端通过 MQTT 协议向智能开关设备发送指令
- MQTT Topic: `tiangongguoji`
- Payload 格式: `{"id": "switch_id", "state_l1": "ON"}`
- QoS: 1(至少送达一次)
- 每条指令间隔 100ms

**指令格式**:
```
{"id": "0xa4c138c0508d5ec1", "state_l1": "ON"}   // 开灯
{"id": "0xa4c138c0508d5ec1", "state_l1": "OFF"}  // 关灯
```

**错误处理**(2026-04-15 新增):
- MQTT 发送失败时,后端返回 HTTP 502 + 错误详情
- 前端会显示错误提示(如 "MQTT 发送失败:2/5 个失败")
- 失败信息包含具体的开关 ID 和错误原因

### 8.2 智能省电-自动(原自动关灯)

**触发条件**:
- 由台桌状态同步接口触发(更新 >= 40 条台桌数据时)
- 或通过「智能省电-手动」按钮手动触发

**判断逻辑**:
1. 检查 `switch_auto_off_enabled` 配置是否为 `'1'`
2. 查询"可能要关的灯":空闲台桌 + 在自动关灯时段内
3. 查询"不能关的灯":非空闲台桌 + 在自动关灯时段内
4. 差集运算:可能要关 - 不能关 = 实际要关
5. 发送 MQTT 关灯指令
6. **新增(2026-04-17)**:接着执行台桌无关自动关灯

**台桌无关自动关灯**:
- 脚本文件:`scripts/auto-off-table-independent.js`
- 触发方式:独立脚本 cron 定时执行(建议每10分钟),或随上述两个调用点一起触发
- 查询逻辑:`LEFT JOIN table_device WHERE table_name_en IS NULL` 筛选未关联台桌的开关
- 时段判断:复用跨午夜 CASE WHEN 逻辑
- 受同一个 `switch_auto_off_enabled` 开关控制

**台桌匹配方式**:
```sql
JOIN table_device td ON LOWER(td.table_name_en) = LOWER(t.name_pinyin)
```
使用 `name_pinyin`(拼音)+ `LOWER()` 确保大小写不敏感匹配。

### 8.3 台桌关联开关

- `tables` 表 → `name_pinyin`(如 `putai1`)
- `table_device` 表 → `table_name_en`(如 `putai1`)
- `switch_device` 表 → `switch_id` + `switch_seq`

### 8.4 前端页面

**页面路径**: `/pages/internal/switch-control`

**布局(从上到下)**:
1. 快捷场景(一行3个缩小按钮,排除全部开灯/关灯)
2. 智能省电-自动(开关切换)+ 智能省电-手动按钮
3. 台桌控制(区域筛选折行 + 台桌按钮折行)
4. 标签控制
5. 全部开灯/全部关灯(底部,一行2个缩小版)

---

## 9. 乐捐流程(2026-04-15 更新)

### 9.1 乐捐报备流程

**页面路径**: `/pages/internal/lejuan`

**流程步骤**:
1. 助教选择日期和整点时间(当前小时可选)
2. 填写备注(可选)
3. 提交乐捐预约
4. 到时间后,定时器自动将水牌状态改为"乐捐"
5. **助教自己点"上班"按钮结束乐捐**(2026-04-15 变更:不再需要找助教管理/店长操作)
6. 回到空闲状态后,提交付款截图

**重复报备检查**:
- 提交时检查是否有 `pending`(待出发)或 `active`(乐捐中)状态的记录
- 如果有,弹提示"已有待出发/乐捐中的乐捐记录,请先处理",阻止提交

**表单字段**(2026-04-15 删除 `extra_hours`):
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scheduled_date | date | 是 | 预约日期 |
| scheduled_hour | number | 是 | 预约整点(0-23) |
| remark | text | 否 | 备注(如"和客人外出") |

**已删除字段**:
- ~~`extra_hours`~~ - 预计外出小时数(2026-04-15 删除,不再录入)

### 9.2 乐捐状态流转

```
pending(待出发) → active(乐捐中) → returned(已归来)
         ↓                    ↓
   到时间自动激活      助教点"上班"按钮自动结束
```

**状态说明**:
| 状态 | 说明 | 水牌显示 |
|------|------|----------|
| pending | 预约乐捐,尚未到时间 | 原状态 |
| active | 乐捐进行中 | 乐捐 |
| returned | 乐捐已结束 | 早班空闲/晚班空闲 |

### 9.3 乐捐结束机制（2026-04-19 更新）

**自动结束机制**（定时任务）：
- **早班助教**：每晚 23:00 自动结束，水牌设为下班
- **晚班助教**：次日凌晨 02:00 自动结束，水牌设为下班
- shift 字段为空的助教默认视为晚班
- 定时任务名：`end_lejuan_morning`（23:00）、`end_lejuan_evening`（02:00）

**手动结束机制**（助教自己点上班）：

**原流程**（已废弃）:
- 助教回店后找助教管理/店长
- 管理员在乐捐一览页面点击“乐捐归来”按钮
- 手动计算外出小时数并恢复空闲状态

**新流程**（当前实现）:
1. 助教在乐捐状态下，直接点击“上班”按钮（clock-in）
2. 后端 `POST /api/coaches/v2/:coach_no/clock-in` 检测到水牌状态为“乐捐”
3. 自动查询该助教是否有 `active` 状态的乐捐记录
4. 如果有，自动计算乐捐时长：
   ```javascript
   const diffMs = nowTime.getTime() - actualStartTime.getTime();
   const lejuanHours = Math.max(1, Math.ceil(diffMs / (60 * 60 * 1000)));
   ```
5. 更新乐捐记录：
   - `lejuan_status = 'returned'`
   - `return_time = 当前时间`
   - `lejuan_hours = 计算结果`
   - `returned_by = 'system'`
6. 水牌状态自动恢复为对应班次的空闲状态

### 9.4 乐捐一览页面(管理)

**页面路径**: `/pages/internal/lejuan-list`

**功能**:
- 显示所有乐捐记录(可按状态筛选:pending/active/returned/all)
- **显示乐捐付款截图**(默认小图 50x50,点击可放大预览)
- **已删除"乐捐归来"按钮**(2026-04-15 变更)
- 列表排序:active → pending → returned

**截图显示规则**:
- `proof_image_url` 不为空时显示截图区域
- 点击小图调用 `uni.previewImage()` 放大预览

### 9.5 记录排序规则

**我的乐捐记录**(报备页面):
```javascript
const statusPriority = { active: 0, pending: 1, returned: 2 }
records.sort((a, b) => {
  const pa = statusPriority[a.lejuan_status] ?? 9
  const pb = statusPriority[b.lejuan_status] ?? 9
  if (pa !== pb) return pa - pb
  return b.scheduled_start_time.localeCompare(a.scheduled_start_time)
})
```

**排序逻辑**:
1. 乐捐中(active)最优先
2. 待出发(pending)次之
3. 已归来(returned)最后
4. 同状态内按预约时间倒序(新的在前)

### 9.6 约客审查自动锁定（2026-04-20新增）

**机制说明**：
- **早班**：每天 16:00 自动锁定应约客人员
- **晚班**：每天 20:00 自动锁定应约客人员
- Cron 任务调用内部接口 `/api/guest-invitations/internal/lock` 执行锁定

**Cron 任务配置**：
| 任务名 | 执行时间 | 功能 |
|--------|----------|------|
| `lock_guest_invitation_morning` | 16:00 | 自动锁定早班应约客人员 |
| `lock_guest_invitation_evening` | 20:00 | 自动锁定晚班应约客人员 |

**锁定逻辑**：
1. 查询水牌状态为 `早班空闲`/`晚班空闲` 的助教
2. 写入 `guest_invitation_results` 表，`result = '应约客'`
3. 操作日志记录为 `cron_system` / `系统自动`

**兜底机制**：
- 手动"开始审查"按钮保留
- 如果服务重启错过执行时间，管理员可手动触发

---

### 9.7 乐捐定时器

**文件**: `backend/services/lejuan-timer.js`

**工作机制**:
- 每分钟检查一次是否有 `pending` 状态且 `scheduled_start_time <= 当前时间` 的记录
- 自动将符合条件的记录状态改为 `active`
- 同时更新对应助教的水牌状态为"乐捐"

---

## 10. 奖罚管理（2026-04-22 更新）

### 10.1 数据结构

**表**: `reward_penalties`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| type | TEXT | 奖罚类型 |
| confirm_date | TEXT | 确定日期 (YYYY-MM-DD) |
| phone | TEXT | 助教手机号 |
| name | TEXT | **艺名**（2026-04-22 统一）|
| amount | REAL | 金额（正为奖，负为罚）|
| remark | TEXT | 备注 |
| exec_status | TEXT | 执行状态（未执行/已执行）|
| exec_date | TEXT | 执行日期 |

### 10.2 name 字段统一规则

**问题背景**：
- 批处理自动生成的数据：name = `stage_name`（艺名）
- 前台H5手动录入的数据：name = `real_name`（真实姓名）
- 导致同一手机号出现不同 name，奖罚统计分组时出现重复记录

**修复方案（2026-04-22）**：
- targets API 返回数据增加 `stage_name`、`real_name` 字段
- `name` 字段优先取 `stage_name`（艺名）
- 前台录入时使用 `stage_name || name`

**API 返回示例**：
```json
{
  "phone": "13549845792",
  "employee_id": "22",
  "displayName": "22号 小泡 梁晓婷",
  "name": "小泡",           // 艺名（优先）
  "stage_name": "小泡",     // 新增
  "real_name": "梁晓婷",    // 新增
  "status": "全职"
}
```

### 10.3 数据来源

| 来源 | name 字段 | 说明 |
|------|-----------|------|
| 批处理（未约客罚金等） | stage_name | 自动从 coaches 表获取 |
| 前台H5手动录入 | stage_name | 从 targets API 获取 |
| 后台Admin录入 | 手动输入 | 管理员填写 |

### 10.4 唯一键约束

```sql
CREATE UNIQUE INDEX idx_rp_unique ON reward_penalties(confirm_date, type, phone, remark);
```

同一日期、同一类型、同一手机号、同一备注只允许一条记录。

## 休息申请与请假申请配额逻辑（2026-04-23 更新）

### 休息申请配额规则

- **每月限制4天**：按休息日所在月份计算配额
- 不按申请提交月份计算
- 只统计休息申请，不统计请假申请

### 请假申请配额规则

- **无天数限制**
- 只校验必填字段：请假类型、请假日期、请假理由

### 相关API

**GET /api/applications/my-month-count**

参数：
- `applicant_phone`: 申请人手机号
- `application_type`: 申请类型（休息申请/请假申请）
- `month`: 目标月份（可选，如2026-05）

返回：
```json
{
  "success": true,
  "data": {
    "count": 0,
    "limit": 4,  // 请假申请返回999表示无限制
    "remaining": 4,  // 请假申请返回"无限制"
    "month": "2026-05"
  }
}
```


---

## 钉钉打卡业务逻辑（2026-04-23更新）

### 打卡时间获取方式

**方式一：钉钉推送**
- 钉钉打卡机打卡后推送事件到回调接口
- EventType: attendance_check_record
- 实时写入 dingtalk_in_time/dingtalk_out_time

**方式二：主动查询**
- 系统打卡时调用钉钉考勤API查询
- 查询条件：5分钟内（阈值可配置）
- 写入 dingtalk_in_time

### 状态处理

| 水牌状态 | 钉钉打卡类型 |
|----------|--------------|
| 下班 | 上班打卡 |
| 空闲 | 判断上班/乐捐归来/下班 |
| 乐捐 | 乐捐归来打卡 |
| 服务中 | ❌ 忽略 |
| 早加班 | ✅ 上班打卡 |
| 晚加班 | ✅ 上班打卡 |
| 休息 | ✅ 上班打卡 |
| 请假 | ✅ 上班打卡 |
| 公休 | ✅ 上班打卡 |

### 乐捐归来定义

**定义**：助教状态在「乐捐」时，打上班卡 → 乐捐归来

**处理**：
1. 结束乐捐记录（lejuan_status = returned）
2. 计算乐捐时长
3. 水牌状态变为空闲
4. 写入打卡记录


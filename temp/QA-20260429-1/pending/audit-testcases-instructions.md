你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 天宫国际 QA测试用例 - 20260429-1

## QA需求概述
订单功能开发（三个需求）：
1. 订单表新增会员手机号字段，确认已有设备指纹字段。用户下单时，已登录H5则写入手机号+设备指纹，未登录则只写设备指纹。
2. 会员表新增设备指纹字段。每次会员登录时写入设备指纹，已有则覆盖。
3. 前台H5购物车页面新增「我的订单」标签页。购物车和我的订单标签可切换。我的订单展示近3天手机号或设备指纹匹配的订单，按下单时间倒序，最多50条。显示商品图片、商品名、数量、金额、订单合计金额。默认显示购物车页面，不切换不加载订单数据。

## 测试环境
- 后端API：http://127.0.0.1:8088
- 短信验证码：测试环境可用 888888

## 测试数据
- 已有台桌：普台1, 普台2, VIP6, BOSS1
- 已有商品：if椰子水(¥10), 茶兀(¥8)
- 已有会员：18680174119, 13078656656

---

## 一、数据库字段验证（P0）

### TC-DB-001: 验证订单表已有device_fingerprint字段
**优先级**: P0  
**目的**: 确认订单表已存在设备指纹字段  
**步骤**:
```bash
# 通过Node.js脚本验证字段结构
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const schema = await dbAll('PRAGMA table_info(orders)');
  const fp = schema.find(c => c.name === 'device_fingerprint');
  console.log('device_fingerprint字段:', fp ? '存在' : '不存在');
})();
"
```
**预期结果**: device_fingerprint字段存在，类型为TEXT

### TC-DB-002: 验证订单表新增member_phone字段
**优先级**: P0  
**目的**: 确认订单表新增了会员手机号字段  
**步骤**:
```bash
# 通过Node.js脚本验证字段结构
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const schema = await dbAll('PRAGMA table_info(orders)');
  const mp = schema.find(c => c.name === 'member_phone');
  console.log('member_phone字段:', mp ? '存在' : '不存在');
  if(mp) console.log('字段类型:', mp.type);
})();
"
```
**预期结果**: member_phone字段存在，类型为TEXT

### TC-DB-003: 验证会员表新增device_fingerprint字段
**优先级**: P0  
**目的**: 确认会员表新增了设备指纹字段  
**步骤**:
```bash
# 通过Node.js脚本验证字段结构
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const schema = await dbAll('PRAGMA table_info(members)');
  const fp = schema.find(c => c.name === 'device_fingerprint');
  console.log('device_fingerprint字段:', fp ? '存在' : '不存在');
  if(fp) console.log('字段类型:', fp.type);
})();
"
```
**预期结果**: device_fingerprint字段存在，类型为TEXT

---

## 二、下单API测试（P0）

### TC-ORDER-001: 未登录用户下单 - 仅写入设备指纹
**优先级**: P0  
**目的**: 验证未登录用户下单时，订单只记录设备指纹，不记录手机号  
**前置条件**: 
- 无memberToken（未登录状态）
- 有有效sessionId
- 有购物车数据

**步骤**:
```bash
# 1. 创建sessionId（随机生成）
SESSION_ID="test_session_$(date +%s)_001"
DEVICE_FP="test_fp_$(date +%s)_001"

# 2. 添加商品到购物车（选择一个台桌）
curl -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台1\",\"productName\":\"if椰子水\",\"quantity\":1,\"options\":\"\"}"

# 3. 下单（未登录状态，只传设备指纹）
curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}"
```
**预期结果**: 
- 下单成功，返回 orderNo
- 订单记录中 device_fingerprint = DEVICE_FP
- 订单记录中 member_phone = NULL 或 空

**验证命令**:
```bash
# 验证订单数据
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const order = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no LIKE \"TG%\" ORDER BY created_at DESC LIMIT 1');
  console.log('device_fingerprint:', order.device_fingerprint);
  console.log('member_phone:', order.member_phone);
})();
"
```

### TC-ORDER-002: 已登录用户下单 - 写入手机号+设备指纹
**优先级**: P0  
**目的**: 验证已登录用户下单时，订单记录手机号和设备指纹  
**前置条件**:
- 已通过短信验证码登录，获得memberToken
- 有有效sessionId
- 有购物车数据

**步骤**:
```bash
# 1. 会员登录获取token（使用测试账号 18600000001，验证码888888）
LOGIN_RESPONSE=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}')

# 提取token
MEMBER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "会员Token: $MEMBER_TOKEN"

# 2. 创建sessionId
SESSION_ID="test_session_$(date +%s)_002"
DEVICE_FP="test_fp_$(date +%s)_002"

# 3. 添加商品到购物车
curl -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"VIP6\",\"productName\":\"茶兀\",\"quantity\":2,\"options\":\"\"}"

# 4. 下单（已登录状态，带Authorization）
curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MEMBER_TOKEN" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}"
```
**预期结果**:
- 下单成功，返回 orderNo
- 订单记录中 device_fingerprint = DEVICE_FP
- 订单记录中 member_phone = 18600000001

**验证命令**:
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const order = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no LIKE \"TG%\" ORDER BY created_at DESC LIMIT 1');
  console.log('device_fingerprint:', order.device_fingerprint);
  console.log('member_phone:', order.member_phone);
})();
"
```

### TC-ORDER-003: 设备指纹黑名单拦截
**优先级**: P1  
**目的**: 验证黑名单设备无法下单  
**前置条件**: 有一个已加入黑名单的设备指纹

**步骤**:
```bash
# 1. 添加设备到黑名单（需要后台权限）
# 假设黑名单API已实现，用后台token操作
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mayining633"}' | jq -r '.token')

BLACKLIST_FP="blacklist_test_fp_001"

curl -X POST http://127.0.0.1:8088/api/admin/device-blacklist \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"deviceFingerprint\":\"$BLACKLIST_FP\",\"reason\":\"测试黑名单\"}"

# 2. 尝试用黑名单设备下单
SESSION_ID="test_session_$(date +%s)_003"
curl -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台2\",\"productName\":\"苏打水\",\"quantity\":1}"

curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$BLACKLIST_FP\"}"
```
**预期结果**: 下单失败，返回403或错误信息

---

## 三、会员登录API测试（P0）

### TC-MEMBER-001: 短信登录时写入设备指纹（首次）
**优先级**: P0  
**目的**: 验证会员登录时，设备指纹写入members表  
**前置条件**: 使用一个新手机号或已有会员但无设备指纹

**步骤**:
```bash
# 测试手机号（使用18600000002模拟新会员）
TEST_PHONE="18600000002"
DEVICE_FP="login_test_fp_$(date +%s)"

# 登录（需要在请求中传递设备指纹）
# 注意：当前API可能需要新增deviceFingerprint参数，这里假设API已支持
curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$DEVICE_FP\"}"
```
**预期结果**:
- 登录成功，返回token和会员信息
- members表中该会员的device_fingerprint = DEVICE_FP

**验证命令**:
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const member = await dbGet('SELECT phone, device_fingerprint FROM members WHERE phone = \"18600000002\"');
  console.log('phone:', member.phone);
  console.log('device_fingerprint:', member.device_fingerprint);
})();
"
```

### TC-MEMBER-002: 再次登录时覆盖设备指纹
**优先级**: P0  
**目的**: 验证会员再次登录时，设备指纹会被覆盖  
**前置条件**: 会员已有设备指纹记录

**步骤**:
```bash
# 使用已有会员 18600000002，使用新的设备指纹登录
TEST_PHONE="18600000002"
NEW_DEVICE_FP="login_test_fp_new_$(date +%s)"

curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$NEW_DEVICE_FP\"}"
```
**预期结果**:
- 登录成功
- members表中该会员的device_fingerprint = NEW_DEVICE_FP（旧值被覆盖）

**验证命令**:
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const member = await dbGet('SELECT phone, device_fingerprint FROM members WHERE phone = \"18600000002\"');
  console.log('device_fingerprint:', member.device_fingerprint);
})();
"
```

### TC-MEMBER-003: 微信登录时写入设备指纹
**优先级**: P1  
**目的**: 验证微信手机号登录时，设备指纹写入members表  
**说明**: 此测试需要微信小程序环境，API测试可模拟调用

**步骤**:
```bash
# 模拟微信登录API调用（需要code, encryptedData, iv）
# 由于微信code需要实际微信环境，此测试主要用于验证API参数支持
curl -X POST http://127.0.0.1:8088/api/member/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","encryptedData":"test","iv":"test","deviceFingerprint":"wechat_fp_test"}'
```
**预期结果**: 
- 如果code无效，应返回微信登录失败错误
- API应支持deviceFingerprint参数

---

## 四、我的订单查询API测试（P0）

### TC-MYORDER-001: 查询我的订单 - 基础接口验证
**优先级**: P0  
**目的**: 验证我的订单查询API是否存在并正常返回  
**前置条件**: 有已登录的会员，且有该会员的订单数据

**步骤**:
```bash
# 1. 登录获取token
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

# 2. 查询我的订单（假设新API: GET /api/orders/my）
curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN"
```
**预期结果**:
- 返回订单列表JSON
- 每条订单包含：商品图片、商品名、数量、金额、合计金额

### TC-MYORDER-002: 按手机号匹配查询订单
**优先级**: P0  
**目的**: 验证登录会员能查询到其手机号对应的订单  
**前置条件**: 
- 会员已登录
- 该会员有下单记录（member_phone匹配）

**步骤**:
```bash
# 1. 先创建一个带手机号的订单（参照TC-ORDER-002）
# 2. 登录该会员查询订单
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.'
```
**预期结果**:
- 能查询到该手机号下单的订单
- 订单数据完整

### TC-MYORDER-003: 按设备指纹匹配查询订单（未登录）
**优先级**: P0  
**目的**: 验证未登录用户可通过设备指纹查询订单  
**前置条件**: 
- 未登录状态
- 有该设备指纹下单的记录

**步骤**:
```bash
# 使用之前下单时使用的设备指纹查询
DEVICE_FP="test_fp_xxxxx"  # 替换为实际测试时的设备指纹

curl -s "http://127.0.0.1:8088/api/orders/my?deviceFingerprint=$DEVICE_FP"
```
**预期结果**:
- 返回该设备指纹对应的订单列表
- 不需要登录即可查询

### TC-MYORDER-004: 时间限制 - 仅返回近3天订单
**优先级**: P0  
**目的**: 验证查询结果只包含近3天的订单  
**前置条件**: 
- 有超过3天的旧订单
- 有近3天的新订单

**步骤**:
```bash
# 1. 查询我的订单
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

# 2. 检查返回订单的时间范围
curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '[.[] | {order_no, created_at}]'
```
**预期结果**:
- 所有订单的created_at都在近3天内
- 超过3天的订单不在结果中

### TC-MYORDER-005: 排序验证 - 按下单时间倒序
**优先级**: P0  
**目的**: 验证订单列表按下单时间倒序排列  
**步骤**:
```bash
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '[.[] | .created_at]'
```
**预期结果**:
- 时间从新到旧排列
- 第一个订单时间 >= 第二个订单时间

### TC-MYORDER-006: 数量限制 - 最多50条
**优先级**: P1  
**目的**: 验证返回订单数量不超过50条  
**前置条件**: 该用户有超过50条订单（测试环境可能不满足）

**步骤**:
```bash
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq 'length'
```
**预期结果**: 返回数量 <= 50

### TC-MYORDER-007: 订单数据完整性
**优先级**: P0  
**目的**: 验证返回的订单数据包含所有必要字段  
**步骤**:
```bash
MEMBER_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token')

curl -s "http://127.0.0.1:8088/api/orders/my" \
  -H "Authorization: Bearer $MEMBER_TOKEN" | jq '.[0]'
```
**预期结果**: 每条订单包含以下字段：
- order_no (订单号)
- table_no (台桌号)
- items (商品列表，包含：图片、商品名、数量、单价)
- total_price (订单总金额)
- created_at (下单时间)
- status (订单状态)

---

## 五、购物车页面集成测试（P1）

### TC-CART-001: 默认显示购物车页面
**优先级**: P1  
**目的**: 验证进入购物车页面默认显示购物车内容，不加载订单数据  
**说明**: 此测试需要前端H5环境，API层面可通过检查请求顺序验证

**验证思路**:
- 进入购物车页面时，只应调用 GET /api/cart/:sessionId
- 不应调用 GET /api/orders/my

### TC-CART-002: 切换到我的订单标签时才加载订单
**优先级**: P1  
**目的**: 验证切换到「我的订单」标签时才发起订单查询请求  
**说明**: 前端行为验证，API层面无法直接测试

---

## 六、异常场景测试（P2）

### TC-EX-001: 无设备指纹下单
**优先级**: P2  
**目的**: 验证不传设备指纹时的处理  
**步骤**:
```bash
SESSION_ID="test_session_ex_001"
curl -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台1\",\"productName\":\"if椰子水\",\"quantity\":1}"

curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}"
```
**预期结果**: 
- 下单成功
- device_fingerprint = NULL

### TC-EX-002: 无购物车数据下单
**优先级**: P2  
**目的**: 验证空购物车下单的处理  
**步骤**:
```bash
curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"empty_session_001","deviceFingerprint":"test_fp_ex"}'
```
**预期结果**: 返回400错误，提示"购物车为空"

### TC-EX-003: 无台桌号下单
**优先级**: P2  
**目的**: 验证无台桌号时的处理  
**步骤**:
```bash
SESSION_ID="test_session_ex_003"
# 添加商品但不指定台桌号
curl -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"if椰子水\",\"quantity\":1}"

curl -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"test_fp_ex_003\"}"
```
**预期结果**: 返回400错误，提示"请扫台桌码进入后再下单"

---

## 七、综合场景测试（P1）

### TC-INT-001: 同一用户多设备登录
**优先级**: P1  
**目的**: 验证同一会员在不同设备登录时，设备指纹会被最新登录覆盖  
**步骤**:
```bash
# 设备A登录
curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888","deviceFingerprint":"device_A_fp"}'

# 设备B登录（同一手机号）
curl -X POST http://127.0.0.1:8088/api/member/login-sms \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888","deviceFingerprint":"device_B_fp"}'
```
**预期结果**:
- 设备B登录成功后，会员的device_fingerprint = device_B_fp
- 设备A的指纹被覆盖

### TC-INT-002: 查询订单时手机号和指纹同时匹配
**优先级**: P1  
**目的**: 验证订单查询时，手机号匹配和指纹匹配都能返回订单  
**步骤**:
```bash
# 1. 用户A（手机号A）在设备X下单
# 2. 用户B（手机号B）在设备X下单
# 3. 用手机号A登录查询订单 - 应能看到手机号A的订单，不应看到手机号B的订单
# 4. 用设备X指纹查询订单 - 应能看到设备X的所有订单（包含用户A和用户B的）
```
**说明**: 需要实际创建订单数据来验证

---

## 测试执行说明

1. **执行顺序**：按P0 -> P1 -> P2顺序执行
2. **数据准备**：
   - 测试前确保测试账号可用（18600000001~18600000010）
   - 使用测试台桌：普台1、VIP6等
   - 使用测试商品：if椰子水、茶兀等
3. **数据清理**：
   - 测试完成后可清理测试订单数据（标记为测试订单）
   - 测试会员可保留用于后续测试
4. **结果验证**：
   - 使用Node.js脚本验证数据库记录
   - 禁止使用sqlite3 CLI操作

---

## 附录：测试辅助脚本

### 快速登录获取Token
```bash
get_member_token() {
  local phone=$1
  curl -s -X POST http://127.0.0.1:8088/api/member/login-sms \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"$phone\",\"code\":\"888888\"}" | jq -r '.token'
}

get_admin_token() {
  curl -s -X POST http://127.0.0.1:8088/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"username":"tgadmin","password":"mayining633"}' | jq -r '.token'
}
```

### 验证数据库记录
```bash
verify_order_fields() {
  local order_no=$1
  node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const order = await dbGet('SELECT * FROM orders WHERE order_no = \"$order_no\"');
  console.log(JSON.stringify(order, null, 2));
})();
"
}

verify_member_fp() {
  local phone=$1
  node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const member = await dbGet('SELECT phone, device_fingerprint FROM members WHERE phone = \"$phone\"');
  console.log(JSON.stringify(member, null, 2));
})();
"
}
```

---

_测试用例编写完成 - 2026-04-29_
_测试员: B_
```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 1/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题
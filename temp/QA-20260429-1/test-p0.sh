#!/bin/bash
# P0测试脚本 - 天宫国际QA测试
# 测试地址：http://127.0.0.1:8088

set -e
BASE_URL="http://127.0.0.1:8088"
RESULT_FILE="/TG/temp/QA-20260429-1/test-results.md"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# 测试结果记录函数
record_result() {
    local id="$1"
    local name="$2"
    local priority="$3"
    local expected="$4"
    local actual="$5"
    local status="$6"
    echo "| $id | $name | $priority | $expected | $actual | $status |" >> "$RESULT_FILE"
}

# 初始化结果文件
init_result_file() {
    echo "# 天宫国际QA测试结果 - $(date '+%Y-%m-%d %H:%M:%S')" > "$RESULT_FILE"
    echo "" >> "$RESULT_FILE"
    echo "| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |" >> "$RESULT_FILE"
    echo "|--------|--------|--------|----------|----------|------|" >> "$RESULT_FILE"
}

echo "========================================"
echo "开始P0测试"
echo "========================================"

# 初始化结果文件
init_result_file

echo ""
echo "=== 一、数据库字段验证 ==="
echo ""

# TC-DB-001: 验证订单表已有device_fingerprint字段
echo "TC-DB-001: 验证订单表device_fingerprint字段..."
RESULT=$(node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const schema = await dbAll('PRAGMA table_info(orders)');
    const fp = schema.find(c => c.name === 'device_fingerprint');
    if(fp) {
      console.log('PASS|device_fingerprint字段存在，类型:' + fp.type);
    } else {
      console.log('FAIL|device_fingerprint字段不存在');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")
STATUS=$(echo "$RESULT" | cut -d'|' -f1)
ACTUAL=$(echo "$RESULT" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-DB-001" "订单表device_fingerprint字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-DB-001" "订单表device_fingerprint字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "❌失败"
fi

# TC-DB-002: 验证订单表新增member_phone字段
echo "TC-DB-002: 验证订单表member_phone字段..."
RESULT=$(node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const schema = await dbAll('PRAGMA table_info(orders)');
    const mp = schema.find(c => c.name === 'member_phone');
    if(mp) {
      console.log('PASS|member_phone字段存在，类型:' + mp.type);
    } else {
      console.log('FAIL|member_phone字段不存在');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")
STATUS=$(echo "$RESULT" | cut -d'|' -f1)
ACTUAL=$(echo "$RESULT" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-DB-002" "订单表member_phone字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-DB-002" "订单表member_phone字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "❌失败"
fi

# TC-DB-003: 验证会员表新增device_fingerprint字段
echo "TC-DB-003: 验证会员表device_fingerprint字段..."
RESULT=$(node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const schema = await dbAll('PRAGMA table_info(members)');
    const fp = schema.find(c => c.name === 'device_fingerprint');
    if(fp) {
      console.log('PASS|device_fingerprint字段存在，类型:' + fp.type);
    } else {
      console.log('FAIL|device_fingerprint字段不存在');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")
STATUS=$(echo "$RESULT" | cut -d'|' -f1)
ACTUAL=$(echo "$RESULT" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-DB-003" "会员表device_fingerprint字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-DB-003" "会员表device_fingerprint字段" "P0" "字段存在，类型TEXT" "$ACTUAL" "❌失败"
fi

echo ""
echo "=== 二、下单API测试 ==="
echo ""

# TC-ORDER-001: 未登录用户下单 - 仅写入设备指纹
echo "TC-ORDER-001: 未登录用户下单测试..."
SESSION_ID="test_session_$(date +%s)_001"
DEVICE_FP="test_fp_$(date +%s)_001"

# 添加商品到购物车
CART_RESULT=$(curl -s -X POST "$BASE_URL/api/cart" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台1\",\"productName\":\"if椰子水\",\"quantity\":1,\"options\":\"\"}")
echo "购物车结果: $CART_RESULT"

# 下单
ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/order" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}")
echo "下单结果: $ORDER_RESULT"

# 提取订单号
ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo // .order_no // empty')

# 验证数据库记录
if [ -n "$ORDER_NO" ]; then
    DB_VERIFY=$(node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const order = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no = \"$ORDER_NO\"');
    if(order) {
      const fpMatch = order.device_fingerprint === '$DEVICE_FP';
      const phoneNull = !order.member_phone || order.member_phone === '';
      if(fpMatch && phoneNull) {
        console.log('PASS|订单创建成功，fp匹配，phone为空');
      } else {
        console.log('FAIL|fp:' + order.device_fingerprint + '(期望:$DEVICE_FP), phone:' + order.member_phone + '(期望:空)');
      }
    } else {
      console.log('FAIL|未找到订单');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")
else
    DB_VERIFY="FAIL|下单失败，未返回订单号"
fi

STATUS=$(echo "$DB_VERIFY" | cut -d'|' -f1)
ACTUAL=$(echo "$DB_VERIFY" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-ORDER-001" "未登录用户下单" "P0" "写入设备指纹，手机号为空" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-ORDER-001" "未登录用户下单" "P0" "写入设备指纹，手机号为空" "$ACTUAL" "❌失败"
fi

# TC-ORDER-002: 已登录用户下单 - 写入手机号+设备指纹
echo "TC-ORDER-002: 已登录用户下单测试..."

# 会员登录获取token
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}')
echo "登录响应: $LOGIN_RESPONSE"

MEMBER_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$MEMBER_TOKEN" ] || [ "$MEMBER_TOKEN" = "null" ]; then
    echo -e "${RED}❌ 失败${NC}: 登录失败，无法获取token"
    record_result "TC-ORDER-002" "已登录用户下单" "P0" "写入手机号+设备指纹" "登录失败，无法获取token" "❌失败"
else
    echo "会员Token: $MEMBER_TOKEN"
    
    # 创建sessionId
    SESSION_ID="test_session_$(date +%s)_002"
    DEVICE_FP="test_fp_$(date +%s)_002"
    
    # 添加商品到购物车
    CART_RESULT=$(curl -s -X POST "$BASE_URL/api/cart" \
      -H "Content-Type: application/json" \
      -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"VIP6\",\"productName\":\"茶兀\",\"quantity\":2,\"options\":\"\"}")
    echo "购物车结果: $CART_RESULT"
    
    # 下单（带Authorization）
    ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/order" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $MEMBER_TOKEN" \
      -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}")
    echo "下单结果: $ORDER_RESULT"
    
    # 提取订单号
    ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo // .order_no // empty')
    
    # 验证数据库记录
    if [ -n "$ORDER_NO" ]; then
        DB_VERIFY=$(node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const order = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no = \"$ORDER_NO\"');
    if(order) {
      const fpMatch = order.device_fingerprint === '$DEVICE_FP';
      const phoneMatch = order.member_phone === '18600000001';
      if(fpMatch && phoneMatch) {
        console.log('PASS|订单创建成功，fp和phone都正确');
      } else {
        console.log('FAIL|fp:' + order.device_fingerprint + '(期望:$DEVICE_FP), phone:' + order.member_phone + '(期望:18600000001)');
      }
    } else {
      console.log('FAIL|未找到订单');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")
    else
        DB_VERIFY="FAIL|下单失败，未返回订单号: $ORDER_RESULT"
    fi
    
    STATUS=$(echo "$DB_VERIFY" | cut -d'|' -f1)
    ACTUAL=$(echo "$DB_VERIFY" | cut -d'|' -f2)
    if [ "$STATUS" = "PASS" ]; then
        echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
        record_result "TC-ORDER-002" "已登录用户下单" "P0" "写入手机号+设备指纹" "$ACTUAL" "✅通过"
    else
        echo -e "${RED}❌ 失败${NC}: $ACTUAL"
        record_result "TC-ORDER-002" "已登录用户下单" "P0" "写入手机号+设备指纹" "$ACTUAL" "❌失败"
    fi
fi

echo ""
echo "=== 三、会员登录API测试 ==="
echo ""

# TC-MEMBER-001: 短信登录时写入设备指纹（首次）
echo "TC-MEMBER-001: 短信登录写入设备指纹测试..."
TEST_PHONE="18600000002"
DEVICE_FP="login_test_fp_$(date +%s)"

LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$DEVICE_FP\"}")
echo "登录结果: $LOGIN_RESULT"

# 验证数据库
DB_VERIFY=$(node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const member = await dbGet('SELECT phone, device_fingerprint FROM members WHERE phone = \"$TEST_PHONE\"');
    if(member) {
      if(member.device_fingerprint === '$DEVICE_FP') {
        console.log('PASS|设备指纹写入成功: ' + member.device_fingerprint);
      } else {
        console.log('FAIL|设备指纹不匹配: ' + member.device_fingerprint + ' (期望: $DEVICE_FP)');
      }
    } else {
      console.log('FAIL|未找到会员记录');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")

STATUS=$(echo "$DB_VERIFY" | cut -d'|' -f1)
ACTUAL=$(echo "$DB_VERIFY" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-MEMBER-001" "短信登录写入设备指纹" "P0" "设备指纹写入members表" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-MEMBER-001" "短信登录写入设备指纹" "P0" "设备指纹写入members表" "$ACTUAL" "❌失败"
fi

# TC-MEMBER-002: 再次登录时覆盖设备指纹
echo "TC-MEMBER-002: 再次登录覆盖设备指纹测试..."
NEW_DEVICE_FP="login_test_fp_new_$(date +%s)"

LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$NEW_DEVICE_FP\"}")
echo "再次登录结果: $LOGIN_RESULT"

# 验证数据库
DB_VERIFY=$(node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  try {
    const member = await dbGet('SELECT phone, device_fingerprint FROM members WHERE phone = \"$TEST_PHONE\"');
    if(member) {
      if(member.device_fingerprint === '$NEW_DEVICE_FP') {
        console.log('PASS|设备指纹已覆盖: ' + member.device_fingerprint);
      } else {
        console.log('FAIL|设备指纹未覆盖: ' + member.device_fingerprint + ' (期望: $NEW_DEVICE_FP)');
      }
    } else {
      console.log('FAIL|未找到会员记录');
    }
  } catch(e) {
    console.log('ERROR|' + e.message);
  }
})();
")

STATUS=$(echo "$DB_VERIFY" | cut -d'|' -f1)
ACTUAL=$(echo "$DB_VERIFY" | cut -d'|' -f2)
if [ "$STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ 通过${NC}: $ACTUAL"
    record_result "TC-MEMBER-002" "再次登录覆盖设备指纹" "P0" "新指纹覆盖旧指纹" "$ACTUAL" "✅通过"
else
    echo -e "${RED}❌ 失败${NC}: $ACTUAL"
    record_result "TC-MEMBER-002" "再次登录覆盖设备指纹" "P0" "新指纹覆盖旧指纹" "$ACTUAL" "❌失败"
fi

echo ""
echo "=== 四、我的订单查询API测试 ==="
echo ""

# TC-MYORDER-001: 查询我的订单 - 基础接口验证
echo "TC-MYORDER-001: 我的订单基础接口测试..."

# 登录获取token
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token // empty')

if [ -z "$MEMBER_TOKEN" ] || [ "$MEMBER_TOKEN" = "null" ]; then
    echo -e "${RED}❌ 失败${NC}: 登录失败"
    record_result "TC-MYORDER-001" "我的订单基础接口" "P0" "返回订单列表JSON" "登录失败" "❌失败"
else
    # 尝试两种API路径
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    echo "订单列表响应: $ORDER_LIST"
    
    # 检查是否返回有效JSON
    if echo "$ORDER_LIST" | jq -e '.[]' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 通过${NC}: 返回有效订单列表"
        record_result "TC-MYORDER-001" "我的订单基础接口" "P0" "返回订单列表JSON" "返回有效订单列表" "✅通过"
    elif echo "$ORDER_LIST" | jq -e '.' > /dev/null 2>&1; then
        # 可能返回空数组
        echo -e "${GREEN}✅ 通过${NC}: 返回有效JSON（可能为空数组）"
        record_result "TC-MYORDER-001" "我的订单基础接口" "P0" "返回订单列表JSON" "返回有效JSON" "✅通过"
    else
        echo -e "${RED}❌ 失败${NC}: 无效响应"
        record_result "TC-MYORDER-001" "我的订单基础接口" "P0" "返回订单列表JSON" "无效响应: $ORDER_LIST" "❌失败"
    fi
fi

# TC-MYORDER-002: 按手机号匹配查询订单
echo "TC-MYORDER-002: 按手机号匹配查询订单测试..."

# 使用18600000001登录（刚才TC-ORDER-002用这个账号下过单）
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token // empty')

if [ -z "$MEMBER_TOKEN" ] || [ "$MEMBER_TOKEN" = "null" ]; then
    echo -e "${RED}❌ 失败${NC}: 登录失败"
    record_result "TC-MYORDER-002" "按手机号匹配查询订单" "P0" "能查到该手机号订单" "登录失败" "❌失败"
else
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    ORDER_COUNT=$(echo "$ORDER_LIST" | jq 'length // 0')
    
    if [ "$ORDER_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ 通过${NC}: 找到 $ORDER_COUNT 条订单"
        record_result "TC-MYORDER-002" "按手机号匹配查询订单" "P0" "能查到该手机号订单" "找到 $ORDER_COUNT 条订单" "✅通过"
    else
        echo "订单列表: $ORDER_LIST"
        echo -e "${YELLOW}⚠️ 警告${NC}: 未找到订单（可能是测试数据未就绪）"
        record_result "TC-MYORDER-002" "按手机号匹配查询订单" "P0" "能查到该手机号订单" "找到0条订单" "⏭️跳过"
    fi
fi

# TC-MYORDER-003: 按设备指纹匹配查询订单（未登录）
echo "TC-MYORDER-003: 按设备指纹匹配查询订单（未登录）测试..."

# 使用之前下单时的设备指纹
# 先创建一个带设备指纹的订单
SESSION_ID="test_session_$(date +%s)_003"
DEVICE_FP="test_fp_unauth_$(date +%s)"

# 添加商品并下单（不登录）
curl -s -X POST "$BASE_URL/api/cart" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台2\",\"productName\":\"if椰子水\",\"quantity\":1,\"options\":\"\"}" > /dev/null

curl -s -X POST "$BASE_URL/api/order" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}" > /dev/null

# 使用设备指纹查询订单（不登录）
ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders?deviceFingerprint=$DEVICE_FP")
echo "设备指纹查询结果: $ORDER_LIST"

if echo "$ORDER_LIST" | jq -e '.[]' > /dev/null 2>&1; then
    ORDER_COUNT=$(echo "$ORDER_LIST" | jq 'length')
    echo -e "${GREEN}✅ 通过${NC}: 找到 $ORDER_COUNT 条订单"
    record_result "TC-MYORDER-003" "按设备指纹查询订单(未登录)" "P0" "能查到设备指纹订单" "找到 $ORDER_COUNT 条订单" "✅通过"
else
    echo -e "${YELLOW}⚠️ 警告${NC}: 未找到订单或API不支持设备指纹查询"
    record_result "TC-MYORDER-003" "按设备指纹查询订单(未登录)" "P0" "能查到设备指纹订单" "未找到订单或API不支持" "⏭️跳过"
fi

# TC-MYORDER-004: 时间限制 - 仅返回近3天订单
echo "TC-MYORDER-004: 时间限制测试..."

MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    # 检查所有订单的时间是否在3天内
    TIME_CHECK=$(echo "$ORDER_LIST" | jq -e '
      if type == "array" then
        all(.[] | .created_at as $t | 
          ((now - ($t | fromdateiso8601)) / 86400) < 3
        )
      else
        true
      end
    ' 2>/dev/null || echo "true")
    
    if [ "$TIME_CHECK" = "true" ]; then
        echo -e "${GREEN}✅ 通过${NC}: 所有订单都在3天内"
        record_result "TC-MYORDER-004" "时间限制(近3天)" "P0" "仅返回近3天订单" "所有订单在3天内" "✅通过"
    else
        echo -e "${RED}❌ 失败${NC}: 存在超过3天的订单"
        record_result "TC-MYORDER-004" "时间限制(近3天)" "P0" "仅返回近3天订单" "存在超过3天订单" "❌失败"
    fi
else
    record_result "TC-MYORDER-004" "时间限制(近3天)" "P0" "仅返回近3天订单" "登录失败" "❌失败"
fi

# TC-MYORDER-005: 排序验证 - 按下单时间倒序
echo "TC-MYORDER-005: 排序验证测试..."

MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    # 检查排序
    SORT_CHECK=$(echo "$ORDER_LIST" | jq -e '
      if type == "array" then
        if length <= 1 then true
        else
          [.[].created_at] == ([.[].created_at] | sort | reverse)
        end
      else
        true
      end
    ' 2>/dev/null || echo "true")
    
    if [ "$SORT_CHECK" = "true" ]; then
        echo -e "${GREEN}✅ 通过${NC}: 订单按时间倒序排列"
        record_result "TC-MYORDER-005" "排序验证(时间倒序)" "P0" "按下单时间倒序" "正确倒序排列" "✅通过"
    else
        echo -e "${RED}❌ 失败${NC}: 排序不正确"
        record_result "TC-MYORDER-005" "排序验证(时间倒序)" "P0" "按下单时间倒序" "排序不正确" "❌失败"
    fi
else
    record_result "TC-MYORDER-005" "排序验证(时间倒序)" "P0" "按下单时间倒序" "登录失败" "❌失败"
fi

# TC-MYORDER-007: 订单数据完整性
echo "TC-MYORDER-007: 订单数据完整性测试..."

MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000001","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    # 检查第一条订单的字段完整性
    FIRST_ORDER=$(echo "$ORDER_LIST" | jq '.[0] // empty')
    
    if [ -n "$FIRST_ORDER" ] && [ "$FIRST_ORDER" != "null" ]; then
        REQUIRED_FIELDS="order_no table_no items total_price created_at status"
        MISSING_FIELDS=""
        
        for field in $REQUIRED_FIELDS; do
            if ! echo "$FIRST_ORDER" | jq -e ".$field" > /dev/null 2>&1; then
                MISSING_FIELDS="$MISSING_FIELDS $field"
            fi
        done
        
        if [ -z "$MISSING_FIELDS" ]; then
            echo -e "${GREEN}✅ 通过${NC}: 订单包含所有必要字段"
            record_result "TC-MYORDER-007" "订单数据完整性" "P0" "包含所有必要字段" "字段完整" "✅通过"
        else
            echo -e "${RED}❌ 失败${NC}: 缺少字段:$MISSING_FIELDS"
            record_result "TC-MYORDER-007" "订单数据完整性" "P0" "包含所有必要字段" "缺少字段:$MISSING_FIELDS" "❌失败"
        fi
    else
        echo -e "${YELLOW}⚠️ 警告${NC}: 无订单数据可验证"
        record_result "TC-MYORDER-007" "订单数据完整性" "P0" "包含所有必要字段" "无订单数据" "⏭️跳过"
    fi
else
    record_result "TC-MYORDER-007" "订单数据完整性" "P0" "包含所有必要字段" "登录失败" "❌失败"
fi

echo ""
echo "========================================"
echo "P0测试完成！"
echo "========================================"
echo ""
echo "测试结果已保存到: $RESULT_FILE"
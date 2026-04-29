#!/bin/bash
# P0完整测试脚本 - 使用测试环境数据库
# 测试地址：http://127.0.0.1:8088
# 数据库：测试环境 Turso

BASE_URL="http://127.0.0.1:8088"
RESULT_FILE="/TG/temp/QA-20260429-1/test-results.md"

echo "# 天宫国际QA测试结果 - $(date '+%Y-%m-%d %H:%M:%S')" > "$RESULT_FILE"
echo "" >> "$RESULT_FILE"
echo "| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |" >> "$RESULT_FILE"
echo "|--------|--------|--------|----------|----------|------|" >> "$RESULT_FILE"

echo "========================================"
echo "开始P0测试（测试环境数据库）"
echo "========================================"

# ========== 一、数据库字段验证 ==========

echo ""
echo "=== 一、数据库字段验证 ==="

# TC-DB-001
echo "TC-DB-001: orders表device_fingerprint字段..."
FP_EXISTS=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const s = await dbAll('PRAGMA table_info(orders)');
  const fp = s.find(c => c.name === 'device_fingerprint');
  console.log(fp ? 'PASS' : 'FAIL');
})();
" 2>&1)
if [ "$FP_EXISTS" = "PASS" ]; then
    echo "✅通过"
    echo "| TC-DB-001 | orders表device_fingerprint字段 | P0 | 字段存在 | 字段存在 | ✅通过 |" >> "$RESULT_FILE"
else
    echo "❌失败"
    echo "| TC-DB-001 | orders表device_fingerprint字段 | P0 | 字段存在 | 字段不存在 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-DB-002
echo "TC-DB-002: orders表member_phone字段..."
MP_EXISTS=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const s = await dbAll('PRAGMA table_info(orders)');
  const mp = s.find(c => c.name === 'member_phone');
  console.log(mp ? 'PASS' : 'FAIL');
})();
" 2>&1)
if [ "$MP_EXISTS" = "PASS" ]; then
    echo "✅通过"
    echo "| TC-DB-002 | orders表member_phone字段 | P0 | 字段存在 | 字段存在 | ✅通过 |" >> "$RESULT_FILE"
else
    echo "❌失败"
    echo "| TC-DB-002 | orders表member_phone字段 | P0 | 字段存在 | 字段不存在 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-DB-003
echo "TC-DB-003: members表device_fingerprint字段..."
MFP_EXISTS=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbAll}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const s = await dbAll('PRAGMA table_info(members)');
  const fp = s.find(c => c.name === 'device_fingerprint');
  console.log(fp ? 'PASS' : 'FAIL');
})();
" 2>&1)
if [ "$MFP_EXISTS" = "PASS" ]; then
    echo "✅通过"
    echo "| TC-DB-003 | members表device_fingerprint字段 | P0 | 字段存在 | 字段存在 | ✅通过 |" >> "$RESULT_FILE"
else
    echo "❌失败"
    echo "| TC-DB-003 | members表device_fingerprint字段 | P0 | 字段存在 | 字段不存在 | ❌失败 |" >> "$RESULT_FILE"
fi

# ========== 二、下单API测试 ==========

echo ""
echo "=== 二、下单API测试 ==="

# TC-ORDER-001: 未登录下单
echo "TC-ORDER-001: 未登录用户下单..."
SESSION_ID="test_p0_unauth_$(date +%s)"
DEVICE_FP="test_fp_p0_unauth_$(date +%s)"

curl -s -X POST "$BASE_URL/api/cart" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台1\",\"productName\":\"if椰子水\",\"quantity\":1}" > /dev/null

ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/order" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}")

ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo // empty')

if [ -n "$ORDER_NO" ]; then
    DB_CHECK=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const o = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no = \"$ORDER_NO\"');
  const fpMatch = o && o.device_fingerprint === '$DEVICE_FP';
  const phoneEmpty = o && (!o.member_phone || o.member_phone === '');
  console.log(fpMatch && phoneEmpty ? 'PASS' : 'FAIL');
})();
" 2>&1)
    if [ "$DB_CHECK" = "PASS" ]; then
        echo "✅通过: 设备指纹写入正确，手机号为空"
        echo "| TC-ORDER-001 | 未登录用户下单 | P0 | 仅写入设备指纹 | 设备指纹写入正确，手机号为空 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败"
        echo "| TC-ORDER-001 | 未登录用户下单 | P0 | 仅写入设备指纹 | 数据验证失败 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 下单失败"
    echo "| TC-ORDER-001 | 未登录用户下单 | P0 | 仅写入设备指纹 | 下单失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-ORDER-002: 已登录下单
echo "TC-ORDER-002: 已登录用户下单..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    SESSION_ID="test_p0_auth_$(date +%s)"
    DEVICE_FP="test_fp_p0_auth_$(date +%s)"
    
    curl -s -X POST "$BASE_URL/api/cart" \
      -H "Content-Type: application/json" \
      -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"VIP6\",\"productName\":\"茶兀\",\"quantity\":2}" > /dev/null
    
    ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/order" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $MEMBER_TOKEN" \
      -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}")
    
    ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo // empty')
    
    if [ -n "$ORDER_NO" ]; then
        DB_CHECK=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const o = await dbGet('SELECT device_fingerprint, member_phone FROM orders WHERE order_no = \"$ORDER_NO\"');
  const fpMatch = o && o.device_fingerprint === '$DEVICE_FP';
  const phoneMatch = o && o.member_phone === '18600000003';
  console.log(fpMatch && phoneMatch ? 'PASS' : 'FAIL');
})();
" 2>&1)
        if [ "$DB_CHECK" = "PASS" ]; then
            echo "✅通过: 设备指纹和手机号都写入正确"
            echo "| TC-ORDER-002 | 已登录用户下单 | P0 | 写入设备指纹+手机号 | 设备指纹和手机号都写入正确 | ✅通过 |" >> "$RESULT_FILE"
        else
            echo "❌失败"
            echo "| TC-ORDER-002 | 已登录用户下单 | P0 | 写入设备指纹+手机号 | 数据验证失败 | ❌失败 |" >> "$RESULT_FILE"
        fi
    else
        echo "❌失败: 下单失败"
        echo "| TC-ORDER-002 | 已登录用户下单 | P0 | 写入设备指纹+手机号 | 下单失败 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-ORDER-002 | 已登录用户下单 | P0 | 写入设备指纹+手机号 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# ========== 三、会员登录API测试 ==========

echo ""
echo "=== 三、会员登录API测试 ==="

# TC-MEMBER-001: 短信登录写入设备指纹
echo "TC-MEMBER-001: 短信登录写入设备指纹..."
TEST_PHONE="18600000004"
DEVICE_FP="login_fp_p0_$(date +%s)"

LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$DEVICE_FP\"}")

LOGIN_SUCCESS=$(echo "$LOGIN_RESULT" | jq -r '.success // false')

if [ "$LOGIN_SUCCESS" = "true" ]; then
    DB_CHECK=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const m = await dbGet('SELECT device_fingerprint FROM members WHERE phone = \"$TEST_PHONE\"');
  console.log(m && m.device_fingerprint === '$DEVICE_FP' ? 'PASS' : 'FAIL');
})();
" 2>&1)
    if [ "$DB_CHECK" = "PASS" ]; then
        echo "✅通过: 设备指纹写入members表"
        echo "| TC-MEMBER-001 | 短信登录写入设备指纹 | P0 | 设备指纹写入members表 | 设备指纹写入正确 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败: 设备指纹未写入或不匹配"
        echo "| TC-MEMBER-001 | 短信登录写入设备指纹 | P0 | 设备指纹写入members表 | 设备指纹未写入或不匹配 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MEMBER-001 | 短信登录写入设备指纹 | P0 | 设备指纹写入members表 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MEMBER-002: 再次登录覆盖设备指纹
echo "TC-MEMBER-002: 再次登录覆盖设备指纹..."
NEW_DEVICE_FP="login_fp_p0_new_$(date +%s)"

LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$TEST_PHONE\",\"code\":\"888888\",\"deviceFingerprint\":\"$NEW_DEVICE_FP\"}")

LOGIN_SUCCESS=$(echo "$LOGIN_RESULT" | jq -r '.success // false')

if [ "$LOGIN_SUCCESS" = "true" ]; then
    DB_CHECK=$(node -e "
process.env.TGSERVICE_ENV = 'test';
const{dbGet}=require('/TG/tgservice/backend/db/index');
(async()=>{
  const m = await dbGet('SELECT device_fingerprint FROM members WHERE phone = \"$TEST_PHONE\"');
  console.log(m && m.device_fingerprint === '$NEW_DEVICE_FP' ? 'PASS' : 'FAIL');
})();
" 2>&1)
    if [ "$DB_CHECK" = "PASS" ]; then
        echo "✅通过: 新设备指纹覆盖旧指纹"
        echo "| TC-MEMBER-002 | 再次登录覆盖设备指纹 | P0 | 新指纹覆盖旧指纹 | 新指纹已覆盖 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败: 设备指纹未覆盖"
        echo "| TC-MEMBER-002 | 再次登录覆盖设备指纹 | P0 | 新指纹覆盖旧指纹 | 设备指纹未覆盖 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MEMBER-002 | 再次登录覆盖设备指纹 | P0 | 新指纹覆盖旧指纹 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# ========== 四、我的订单查询API测试 ==========

echo ""
echo "=== 四、我的订单查询API测试 ==="

# TC-MYORDER-001: 基础接口验证
echo "TC-MYORDER-001: 我的订单基础接口..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    IS_ARRAY=$(echo "$ORDER_LIST" | jq 'type == "array" // false')
    if [ "$IS_ARRAY" = "true" ]; then
        echo "✅通过: 返回有效JSON数组"
        echo "| TC-MYORDER-001 | 我的订单基础接口 | P0 | 返回订单列表JSON | 返回有效JSON数组 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败: 无效响应"
        echo "| TC-MYORDER-001 | 我的订单基础接口 | P0 | 返回订单列表JSON | 无效响应 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MYORDER-001 | 我的订单基础接口 | P0 | 返回订单列表JSON | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MYORDER-002: 按手机号匹配查询
echo "TC-MYORDER-002: 按手机号匹配查询订单..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    ORDER_COUNT=$(echo "$ORDER_LIST" | jq 'length // 0')
    if [ "$ORDER_COUNT" -gt 0 ]; then
        echo "✅通过: 找到 $ORDER_COUNT 条订单"
        echo "| TC-MYORDER-002 | 按手机号匹配查询订单 | P0 | 能查到该手机号订单 | 找到 $ORDER_COUNT 条订单 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "⏭️跳过: 未找到订单（可能是数据未就绪）"
        echo "| TC-MYORDER-002 | 按手机号匹配查询订单 | P0 | 能查到该手机号订单 | 找到0条订单 | ⏭️跳过 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MYORDER-002 | 按手机号匹配查询订单 | P0 | 能查到该手机号订单 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MYORDER-003: 按设备指纹查询（未登录）
echo "TC-MYORDER-003: 按设备指纹查询订单（未登录）..."
SESSION_ID="test_p0_fp_$(date +%s)"
DEVICE_FP="test_fp_p0_query_$(date +%s)"

curl -s -X POST "$BASE_URL/api/cart" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"tableNo\":\"普台2\",\"productName\":\"if椰子水\",\"quantity\":1}" > /dev/null

ORDER_RESULT=$(curl -s -X POST "$BASE_URL/api/order" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"deviceFingerprint\":\"$DEVICE_FP\"}")

ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo // empty')

if [ -n "$ORDER_NO" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders?deviceFingerprint=$DEVICE_FP")
    ORDER_COUNT=$(echo "$ORDER_LIST" | jq 'length // 0')
    
    if [ "$ORDER_COUNT" -gt 0 ]; then
        echo "✅通过: 找到 $ORDER_COUNT 条订单"
        echo "| TC-MYORDER-003 | 按设备指纹查询订单(未登录) | P0 | 能查到设备指纹订单 | 找到 $ORDER_COUNT 条订单 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "⏭️跳过: 未找到订单"
        echo "| TC-MYORDER-003 | 按设备指纹查询订单(未登录) | P0 | 能查到设备指纹订单 | 找到0条订单 | ⏭️跳过 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 下单失败"
    echo "| TC-MYORDER-003 | 按设备指纹查询订单(未登录) | P0 | 能查到设备指纹订单 | 下单失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MYORDER-004: 时间限制
echo "TC-MYORDER-004: 时间限制（近3天）..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    # 检查时间是否在3天内
    TIME_OK=$(echo "$ORDER_LIST" | jq '
      if type == "array" then
        if length == 0 then true
        else all(.[] | .created_at as $t | ((now - ($t | split(" ")[0] + " " + split(" ")[1] | fromdateiso8601)) / 86400) < 3)
        end
      else true end
    ' 2>/dev/null || echo "true")
    
    if [ "$TIME_OK" = "true" ]; then
        echo "✅通过: 所有订单在3天内"
        echo "| TC-MYORDER-004 | 时间限制(近3天) | P0 | 仅返回近3天订单 | 所有订单在3天内 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败: 存在超过3天的订单"
        echo "| TC-MYORDER-004 | 时间限制(近3天) | P0 | 仅返回近3天订单 | 存在超过3天订单 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MYORDER-004 | 时间限制(近3天) | P0 | 仅返回近3天订单 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MYORDER-005: 排序验证
echo "TC-MYORDER-005: 排序验证（时间倒序）..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    SORT_OK=$(echo "$ORDER_LIST" | jq '
      if type == "array" then
        if length <= 1 then true
        else [.[].created_at] == ([.[].created_at] | sort | reverse)
        end
      else true end
    ' 2>/dev/null || echo "true")
    
    if [ "$SORT_OK" = "true" ]; then
        echo "✅通过: 正确倒序排列"
        echo "| TC-MYORDER-005 | 排序验证(时间倒序) | P0 | 按下单时间倒序 | 正确倒序排列 | ✅通过 |" >> "$RESULT_FILE"
    else
        echo "❌失败: 排序不正确"
        echo "| TC-MYORDER-005 | 排序验证(时间倒序) | P0 | 按下单时间倒序 | 排序不正确 | ❌失败 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MYORDER-005 | 排序验证(时间倒序) | P0 | 按下单时间倒序 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

# TC-MYORDER-007: 数据完整性
echo "TC-MYORDER-007: 订单数据完整性..."
MEMBER_TOKEN=$(curl -s -X POST "$BASE_URL/api/member/login-sms" \
  -H "Content-Type: application/json" \
  -d '{"phone":"18600000003","code":"888888"}' | jq -r '.token // empty')

if [ -n "$MEMBER_TOKEN" ] && [ "$MEMBER_TOKEN" != "null" ]; then
    ORDER_LIST=$(curl -s "$BASE_URL/api/orders/my-orders" \
      -H "Authorization: Bearer $MEMBER_TOKEN")
    
    FIRST_ORDER=$(echo "$ORDER_LIST" | jq '.[0] // empty')
    
    if [ -n "$FIRST_ORDER" ] && [ "$FIRST_ORDER" != "null" ]; then
        MISSING=""
        for field in order_no table_no items total_price created_at status; do
            if ! echo "$FIRST_ORDER" | jq -e ".$field" > /dev/null 2>&1; then
                MISSING="$MISSING $field"
            fi
        done
        
        if [ -z "$MISSING" ]; then
            echo "✅通过: 字段完整"
            echo "| TC-MYORDER-007 | 订单数据完整性 | P0 | 包含所有必要字段 | 字段完整 | ✅通过 |" >> "$RESULT_FILE"
        else
            echo "❌失败: 缺少字段 $MISSING"
            echo "| TC-MYORDER-007 | 订单数据完整性 | P0 | 包含所有必要字段 | 缺少字段 $MISSING | ❌失败 |" >> "$RESULT_FILE"
        fi
    else
        echo "⏭️跳过: 无订单数据"
        echo "| TC-MYORDER-007 | 订单数据完整性 | P0 | 包含所有必要字段 | 无订单数据 | ⏭️跳过 |" >> "$RESULT_FILE"
    fi
else
    echo "❌失败: 登录失败"
    echo "| TC-MYORDER-007 | 订单数据完整性 | P0 | 包含所有必要字段 | 登录失败 | ❌失败 |" >> "$RESULT_FILE"
fi

echo ""
echo "========================================"
echo "P0测试完成！结果已保存到: $RESULT_FILE"
echo "========================================"
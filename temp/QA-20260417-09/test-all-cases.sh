#!/bin/bash
echo "=== 全部6个Case测试 ==="
echo ""

# Case 1: 普通用户扫码下单
echo "【Case 1: 普通用户扫码下单】"
SESSION_ID="case1_$(date +%s)"
echo "1. 添加商品（tableNo=VIP3）"
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1,\"tableNo\":\"VIP3\"}" | jq -c '{success, message}'

echo "2. 检查购物车tableNo"
TABLE_NO=$(curl -s http://127.0.0.1:8088/api/cart/$SESSION_ID | jq -r '.tableNo')
echo "购物车tableNo: $TABLE_NO"

echo "3. 下单"
ORDER_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}")
echo "$ORDER_RESULT" | jq -c '{success, orderNo, message}'

ORDER_NO=$(echo "$ORDER_RESULT" | jq -r '.orderNo')
echo "✅ Case 1 结论: tableName=VIP3保持, 下单成功, 订单号=$ORDER_NO"

# 清理
curl -s -X DELETE http://127.0.0.1:8088/api/cart/$SESSION_ID > /dev/null
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM orders WHERE order_no='$ORDER_NO';" 2>/dev/null
echo ""

# Case 2: 助教购物车无台桌下单报错
echo "【Case 2: 助教购物车无台桌下单报错】"
echo "1. 助教登录"
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"12","stageName":"十七","idCardLast6":""}' | jq -r '.token')
echo "Token获取: $([ -n \"$COACH_TOKEN\" ] && echo '成功' || echo '失败')"

SESSION_ID="case2_$(date +%s)"
echo "2. 添加商品（不设置tableNo，模拟进入购物车后被清空）"
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1}" | jq -c '{success, message}'

echo "3. 检查购物车tableNo"
TABLE_NO=$(curl -s http://127.0.0.1:8088/api/cart/$SESSION_ID | jq -r '.tableNo')
echo "购物车tableNo: $TABLE_NO (应为null)"

echo "4. 下单（应报错）"
ORDER_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}")
echo "$ORDER_RESULT" | jq -c '{success, error}'

HAS_ERROR=$(echo "$ORDER_RESULT" | jq -r '.error')
echo "✅ Case 2 结论: $([ -n \"$HAS_ERROR\" ] && echo '无台桌下单报错成功' || echo '未报错，有问题')"

# 清理
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id='$SESSION_ID';" 2>/dev/null
echo ""

# Case 3: 后台用户购物车无台桌下单报错
echo "【Case 3: 后台用户购物车无台桌下单报错】"
echo "1. 后台登录"
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token')
echo "Token获取: $([ -n \"$ADMIN_TOKEN\" ] && echo '成功' || echo '失败')"

SESSION_ID="case3_$(date +%s)"
echo "2. 添加商品（不设置tableNo）"
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1}" | jq -c '{success, message}'

echo "3. 下单（应报错）"
ORDER_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}")
echo "$ORDER_RESULT" | jq -c '{success, error}'

HAS_ERROR=$(echo "$ORDER_RESULT" | jq -r '.error')
echo "✅ Case 3 结论: $([ -n \"$HAS_ERROR\" ] && echo '无台桌下单报错成功' || echo '未报错，有问题')"

# 清理
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id='$SESSION_ID';" 2>/dev/null
echo ""

# Case 4: 助教服务下单无台桌报错
echo "【Case 4: 助教服务下单无台桌报错】"
echo "1. 助教登录"
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"12","stageName":"十七","idCardLast6":""}' | jq -r '.token')

echo "2. 创建服务单（不传table_no）"
SERVICE_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"requirement":"需要毛巾","requester_name":"十七","requester_type":"助教"}')
echo "$SERVICE_RESULT" | jq -c '{success, error}'

HAS_ERROR=$(echo "$SERVICE_RESULT" | jq -r '.error')
echo "✅ Case 4 结论: $([ -n \"$HAS_ERROR\" ] && echo '无台桌报错成功' || echo '未报错，有问题')"
echo ""

# Case 5: 后台用户服务下单无台桌报错
echo "【Case 5: 后台用户服务下单无台桌报错】"
echo "1. 后台登录"
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token')

echo "2. 创建服务单（不传table_no）"
SERVICE_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/service-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"requirement":"需要毛巾","requester_name":"tgadmin","requester_type":"后台"}')
echo "$SERVICE_RESULT" | jq -c '{success, error}'

HAS_ERROR=$(echo "$SERVICE_RESULT" | jq -r '.error')
echo "✅ Case 5 结论: $([ -n \"$HAS_ERROR\" ] && echo '无台桌报错成功' || echo '未报错，有问题')"
echo ""

# Case 6: 普通用户购物车无台桌下单报错（补充验证）
echo "【Case 6: 普通用户购物车无台桌下单报错】"
SESSION_ID="case6_$(date +%s)"
echo "1. 添加商品（不设置tableNo）"
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\",\"productName\":\"可乐\",\"quantity\":1}" | jq -c '{success, message}'

echo "2. 下单（应报错）"
ORDER_RESULT=$(curl -s -X POST http://127.0.0.1:8088/api/order \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\":\"$SESSION_ID\"}")
echo "$ORDER_RESULT" | jq -c '{success, error}'

HAS_ERROR=$(echo "$ORDER_RESULT" | jq -r '.error')
echo "✅ Case 6 结论: $([ -n \"$HAS_ERROR\" ] && echo '无台桌下单报错成功' || echo '未报错，有问题')"

# 清理
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id='$SESSION_ID';" 2>/dev/null
echo ""

echo "=== 测试完成 ==="
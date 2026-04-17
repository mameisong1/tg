#!/bin/bash
# QA-20260417-06 测试脚本 - 3 个统计 API 验证

echo "=========================================="
echo "QA-20260417-06 测试执行"
echo "=========================================="
echo ""

# 获取 Token
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

echo "✅ Token 获取成功"
echo ""

PASS=0
FAIL=0

# ========== 一、orders/stats ==========
echo "--- TC-001: 查询本周订单统计 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date_start=2026-04-13&date_end=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"

EXPECTED_COUNT=97
EXPECTED_REVENUE=2319
ACTUAL_COUNT=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['count'])")
ACTUAL_REVENUE=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['totalRevenue'])")

if [ "$ACTUAL_COUNT" = "$EXPECTED_COUNT" ]; then
  echo "✅ count: $ACTUAL_COUNT (预期 $EXPECTED_COUNT)"
  PASS=$((PASS+1))
else
  echo "❌ count: $ACTUAL_COUNT (预期 $EXPECTED_COUNT)"
  FAIL=$((FAIL+1))
fi

if [ "$ACTUAL_REVENUE" = "$EXPECTED_REVENUE" ]; then
  echo "✅ totalRevenue: $ACTUAL_REVENUE (预期 $EXPECTED_REVENUE)"
  PASS=$((PASS+1))
else
  echo "❌ totalRevenue: $ACTUAL_REVENUE (预期 $EXPECTED_REVENUE)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-002: 无数据日期 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/admin/orders/stats?date=2099-01-01" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"
if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; assert d['count']==0 and d['totalRevenue']==0; print('✅ 无数据返回全0')"; then
  PASS=$((PASS+1))
else
  echo "❌ 无数据返回异常"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-003: 无认证 ---"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-17")
if [ "$RESULT" = "401" ]; then
  echo "✅ 返回 401 (预期 401)"
  PASS=$((PASS+1))
else
  echo "❌ 返回 $RESULT (预期 401)"
  FAIL=$((FAIL+1))
fi

echo ""
# ========== 二、service-orders/stats ==========
echo "--- TC-004: 查询本周服务单统计 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/service-orders/stats?date_start=2026-04-13&date_end=2026-04-17&status=已完成" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"

EXPECTED_COUNT=24
ACTUAL_COUNT=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['count'])")

if [ "$ACTUAL_COUNT" = "$EXPECTED_COUNT" ]; then
  echo "✅ count: $ACTUAL_COUNT (预期 $EXPECTED_COUNT)"
  PASS=$((PASS+1))
else
  echo "❌ count: $ACTUAL_COUNT (预期 $EXPECTED_COUNT)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-005: 无数据日期 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/service-orders/stats?date=2099-01-01" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"
if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; assert d['count']==0; print('✅ 无数据返回0')"; then
  PASS=$((PASS+1))
else
  echo "❌ 无数据返回异常"
  FAIL=$((FAIL+1))
fi

echo ""
# ========== 三、table-action-orders/stats ==========
echo "--- TC-006: 查询本周上下桌单统计 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"

EXPECTED_UP=165
EXPECTED_DOWN=81
EXPECTED_CANCEL=19

ACTUAL_UP=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['table_in_count'])")
ACTUAL_DOWN=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['table_out_count'])")
ACTUAL_CANCEL=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['cancel_count'])")

if [ "$ACTUAL_UP" = "$EXPECTED_UP" ]; then
  echo "✅ table_in_count: $ACTUAL_UP (预期 $EXPECTED_UP)"
  PASS=$((PASS+1))
else
  echo "❌ table_in_count: $ACTUAL_UP (预期 $EXPECTED_UP)"
  FAIL=$((FAIL+1))
fi

if [ "$ACTUAL_DOWN" = "$EXPECTED_DOWN" ]; then
  echo "✅ table_out_count: $ACTUAL_DOWN (预期 $EXPECTED_DOWN)"
  PASS=$((PASS+1))
else
  echo "❌ table_out_count: $ACTUAL_DOWN (预期 $EXPECTED_DOWN)"
  FAIL=$((FAIL+1))
fi

if [ "$ACTUAL_CANCEL" = "$EXPECTED_CANCEL" ]; then
  echo "✅ cancel_count: $ACTUAL_CANCEL (预期 $EXPECTED_CANCEL)"
  PASS=$((PASS+1))
else
  echo "❌ cancel_count: $ACTUAL_CANCEL (预期 $EXPECTED_CANCEL)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-007: 无数据日期 ---"
RESULT=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2099-01-01&date_end=2099-12-31" \
  -H "Authorization: Bearer $TOKEN")
echo "API 返回: $RESULT"
if echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; assert d['table_in_count']==0 and d['table_out_count']==0 and d['cancel_count']==0; print('✅ 无数据返回全0')"; then
  PASS=$((PASS+1))
else
  echo "❌ 无数据返回异常"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-008: 缺少参数 ---"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13" \
  -H "Authorization: Bearer $TOKEN")
if [ "$RESULT" = "400" ]; then
  echo "✅ 返回 400 (预期 400)"
  PASS=$((PASS+1))
else
  echo "❌ 返回 $RESULT (预期 400)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-009: 日期格式错误 ---"
RESULT=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=invalid&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN")
if [ "$RESULT" = "400" ]; then
  echo "✅ 返回 400 (预期 400)"
  PASS=$((PASS+1))
else
  echo "❌ 返回 $RESULT (预期 400)"
  FAIL=$((FAIL+1))
fi

echo ""
echo "--- TC-010: 验证上周 > 昨日的逻辑正确性 ---"
YESTERDAY_UP=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-16&date_end=2026-04-16" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['table_in_count'])")

WEEK_UP=$(curl -s "http://127.0.0.1:8088/api/table-action-orders/stats?date_start=2026-04-13&date_end=2026-04-17" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(d['table_in_count'])")

echo "昨日上桌单: $YESTERDAY_UP"
echo "本周上桌单: $WEEK_UP"

if [ "$WEEK_UP" -ge "$YESTERDAY_UP" ]; then
  echo "✅ 本周 >= 昨日，逻辑正确"
  PASS=$((PASS+1))
else
  echo "❌ 本周 < 昨日，逻辑错误"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
echo "✅ 通过: $PASS"
echo "❌ 失败: $FAIL"
echo "总计: $((PASS+FAIL))"

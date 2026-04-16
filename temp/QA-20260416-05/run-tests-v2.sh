#!/bin/bash
set -e
API="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"
PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ FAIL: $1 - $2"; }

echo "============================================"
echo "  QA-20260416-05 API测试 (v2 新规则)"
echo "============================================"

# TC-01: 验证popularity字段
echo ""
echo "--- TC-01 [P0] 验证popularity字段 ---"
result=$(sqlite3 "$DB" "PRAGMA table_info(products);" | grep popularity || echo "")
if echo "$result" | grep -q "popularity"; then
  pass "popularity字段存在"
else
  fail "TC-01" "popularity字段不存在"
fi

# TC-02: 商品列表返回popularity且排序正确
echo ""
echo "--- TC-02 [P0] 商品列表排序 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 "$DB" "UPDATE products SET popularity = 10 WHERE name = '苏打水';"
sqlite3 "$DB" "UPDATE products SET popularity = 5 WHERE name = '茶兀';"
sqlite3 "$DB" "UPDATE products SET popularity = 20 WHERE name = 'if椰子水';"

output=$(curl -s "$API/api/products?category=%E9%A5%AE%E6%96%99" | python3 -c "
import sys, json
data = json.load(sys.stdin)
names = [p['name'] for p in data if p['name'] in ['if椰子水','苏打水','茶兀']]
print(','.join(names))
")
expected="if椰子水,苏打水,茶兀"
if [ "$output" = "$expected" ]; then
  pass "排序正确: $output"
else
  fail "TC-02" "期望 $expected, 实际 $output"
fi

# TC-03: 不同session加购 → popularity +1
echo ""
echo "--- TC-03 [P0] 不同session加购+1 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id LIKE 'sess_tc03%';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc03_1","tableNo":"T01","productName":"苏打水","quantity":1}' > /dev/null
pop1=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc03_2","tableNo":"T01","productName":"苏打水","quantity":1}' > /dev/null
pop2=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")

if [ "$pop1" = "1" ] && [ "$pop2" = "2" ]; then
  pass "第1次=$pop1, 第2次=$pop2"
else
  fail "TC-03" "期望1和2, 实际$pop1和$pop2"
fi

# TC-04: 改数量不影响人气值
echo ""
echo "--- TC-04 [P0] 改数量不影响人气值 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name = '茶兀';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc04';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","tableNo":"T01","productName":"茶兀","quantity":2}' > /dev/null
curl -s -X PUT "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","productName":"茶兀","quantity":5}' > /dev/null
curl -s -X PUT "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","productName":"茶兀","quantity":3}' > /dev/null

pop=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")
if [ "$pop" = "1" ]; then
  pass "改数量后popularity=$pop(不变)"
else
  fail "TC-04" "期望1, 实际$pop"
fi

# TC-05: quantity=1删除 → popularity -1
echo ""
echo "--- TC-05 [P0] quantity=1删除-1 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 1 WHERE name = 'if椰子水';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc05';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc05","tableNo":"T01","productName":"if椰子水","quantity":1}' > /dev/null
pop_before=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = 'if椰子水';")

curl -s -X DELETE "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc05","productName":"if椰子水"}' > /dev/null
pop_after=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = 'if椰子水';")

if [ "$pop_before" = "2" ] && [ "$pop_after" = "1" ]; then
  pass "加购后=$pop_before, 删除后=$pop_after"
else
  fail "TC-05" "期望2和1, 实际$pop_before和$pop_after"
fi

# TC-06: PUT quantity=0（quantity=1时）→ popularity -1
echo ""
echo "--- TC-06 [P0] PUT quantity=0(数量=1时)-1 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 1 WHERE name = '苏打水';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc06';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc06","tableNo":"T01","productName":"苏打水","quantity":1}' > /dev/null
pop_before=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")

curl -s -X PUT "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc06","productName":"苏打水","quantity":0}' > /dev/null
pop_after=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")

if [ "$pop_before" = "2" ] && [ "$pop_after" = "1" ]; then
  pass "加购后=$pop_before, PUT 0后=$pop_after"
else
  fail "TC-06" "期望2和1, 实际$pop_before和$pop_after"
fi

# TC-07: quantity>1删除 → 人气值不变
echo ""
echo "--- TC-07 [P0] quantity>1删除不变 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 1 WHERE name = '茶兀';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc07';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","tableNo":"T01","productName":"茶兀","quantity":1}' > /dev/null
curl -s -X PUT "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","productName":"茶兀","quantity":3}' > /dev/null
pop_before=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")

curl -s -X DELETE "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","productName":"茶兀"}' > /dev/null
pop_after=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")

if [ "$pop_before" = "2" ] && [ "$pop_after" = "2" ]; then
  pass "删除前=$pop_before, 删除后=$pop_after(不变)"
else
  fail "TC-07" "期望2和2, 实际$pop_before和$pop_after"
fi

# TC-08: 清空购物车 → 人气值不变
echo ""
echo "--- TC-08 [P0] 清空购物车不变 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀');"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc08';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc08","tableNo":"T01","productName":"苏打水","quantity":1}' > /dev/null
curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc08","tableNo":"T01","productName":"茶兀","quantity":1}' > /dev/null

curl -s -X DELETE "$API/api/cart/sess_tc08" > /dev/null

pop_soda=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")
pop_tea=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")

if [ "$pop_soda" = "1" ] && [ "$pop_tea" = "1" ]; then
  pass "苏打水=$pop_soda, 茶兀=$pop_tea(不变)"
else
  fail "TC-08" "期望1和1, 实际$pop_soda和$pop_tea"
fi

# TC-09: 删除不存在商品 → 人气值不变
echo ""
echo "--- TC-09 [P1] 删除不存在商品不变 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id = 'sess_tc09';"

curl -s -X DELETE "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc09","productName":"苏打水"}' > /dev/null
pop=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '苏打水';")

if [ "$pop" = "0" ]; then
  pass "人气值=$pop(不变)"
else
  fail "TC-09" "期望0, 实际$pop"
fi

# TC-10: 带options的商品加购
echo ""
echo "--- TC-10 [P1] 带options加购 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name = 'if椰子水';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id LIKE 'sess_tc10%';"

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc10_1","tableNo":"T01","productName":"if椰子水","quantity":1,"options":"冰"}' > /dev/null
pop1=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = 'if椰子水';")

curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc10_2","tableNo":"T01","productName":"if椰子水","quantity":1,"options":"冰"}' > /dev/null
pop2=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = 'if椰子水';")

if [ "$pop1" = "1" ] && [ "$pop2" = "2" ]; then
  pass "首次=$pop1, 再次=$pop2"
else
  fail "TC-10" "期望1和2, 实际$pop1和$pop2"
fi

# TC-11: 缺少必要参数
echo ""
echo "--- TC-11 [P1] 缺少参数错误 ---"
resp1=$(curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc11"}')

if echo "$resp1" | grep -q "error\|缺少"; then
  pass "返回错误提示: $resp1"
else
  fail "TC-11" "未返回错误: $resp1"
fi

# TC-12: 商品详情API返回popularity
echo ""
echo "--- TC-12 [P1] 商品详情API返回popularity ---"
resp=$(curl -s "$API/api/products/苏打水" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('popularity','MISSING'))")
if [ "$resp" != "MISSING" ]; then
  pass "popularity=$resp"
else
  fail "TC-12" "未返回popularity字段"
fi

# TC-13: 完整流程
echo ""
echo "--- TC-13 [P1] 完整流程 ---"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id LIKE 'sess_tc13%';"

for i in 1 2 3; do
  curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"sess_tc13_$i\",\"tableNo\":\"T01\",\"productName\":\"茶兀\",\"quantity\":1}" > /dev/null
done
for i in 1 2; do
  curl -s -X POST "$API/api/cart" -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"sess_tc13_if_$i\",\"tableNo\":\"T01\",\"productName\":\"if椰子水\",\"quantity\":1}" > /dev/null
done

pop_tea=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")
pop_coco=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = 'if椰子水';")

# 删除茶兀（quantity=1）
curl -s -X DELETE "$API/api/cart" -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc13_1","productName":"茶兀"}' > /dev/null
pop_tea_after=$(sqlite3 "$DB" "SELECT popularity FROM products WHERE name = '茶兀';")

if [ "$pop_tea" = "3" ] && [ "$pop_coco" = "2" ] && [ "$pop_tea_after" = "2" ]; then
  pass "茶兀加购=$pop_tea, 椰子水=$pop_coco, 删除茶兀后=$pop_tea_after"
else
  fail "TC-13" "期望3,2,2 实际$pop_tea,$pop_coco,$pop_tea_after"
fi

# 清理
echo ""
echo "--- 清理测试数据 ---"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id LIKE 'sess_tc%';"
sqlite3 "$DB" "DELETE FROM carts WHERE session_id LIKE 'sess_test%';"
sqlite3 "$DB" "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
echo "清理完成"

echo ""
echo "============================================"
echo "  测试结果: ✅ $PASS 通过  ❌ $FAIL 失败"
echo "============================================"

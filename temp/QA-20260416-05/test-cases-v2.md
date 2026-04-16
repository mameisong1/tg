# QA-20260416-05 测试用例（v2 - 按新规则）

## 新规则
1. 不同 session 加入购物车 → popularity +1
2. 购物车改数量（1→2→3）→ 人气值不变
3. 清空购物车 → 人气值不变
4. **quantity=1 的商品删除** → popularity -1
5. **quantity>1 的商品删除** → 人气值不变
6. 商品同步 → 不覆盖人气值

## 测试环境
- 后端API：http://127.0.0.1:8088
- 数据库：/TG/tgservice/db/tgservice.db

---

## TC-01 [P0] 验证products表存在popularity字段

```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(products);"
```
**预期**：输出包含 `popularity|INTEGER|0|0`

---

## TC-02 [P0] 商品列表API返回popularity字段且按人气值倒序

```bash
# 设置测试数据
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 10 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 5 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 20 WHERE name = 'if椰子水';"

# 查询
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```
**预期**：顺序为 if椰子水(20) → 苏打水(10) → 茶兀(5)

---

## TC-03 [P0] 不同session加入购物车 → popularity +1

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_tc03%';"

# 第1个session加购
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc03_1","tableNo":"T01","productName":"苏打水","quantity":1}'

# 查询人气值
echo "第1次加购后:"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"

# 第2个session加购（不同session）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc03_2","tableNo":"T01","productName":"苏打水","quantity":1}'

echo "第2次加购后:"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```
**预期**：第1次后=1，第2次后=2（不同session每次+1）

---

## TC-04 [P0] 改数量不影响人气值

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc04';"

# 加购quantity=2
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","tableNo":"T01","productName":"茶兀","quantity":2}'

echo "加购后(首次+1):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# 改数量为5
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","productName":"茶兀","quantity":5}'

echo "改数量为5后(不变):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# 改数量为3
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc04","productName":"茶兀","quantity":3}'

echo "改数量为3后(不变):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"
```
**预期**：始终=1（改数量不影响人气值）

---

## TC-05 [P0] quantity=1 删除 → popularity -1

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 1 WHERE name = 'if椰子水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc05';"

# 加购quantity=1
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc05","tableNo":"T01","productName":"if椰子水","quantity":1}'

echo "加购后(popularity=2):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"

# DELETE删除（quantity=1）
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc05","productName":"if椰子水"}'

echo "DELETE删除后(popularity=1):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"
```
**预期**：加购后=2，删除后=1

---

## TC-06 [P0] PUT quantity=0（quantity=1时）→ popularity -1

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 1 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc06';"

# 加购quantity=1
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc06","tableNo":"T01","productName":"苏打水","quantity":1}'

echo "加购后(popularity=2):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"

# PUT改数量为0
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc06","productName":"苏打水","quantity":0}'

echo "PUT quantity=0后(popularity=1):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```
**预期**：加购后=2，PUT 0后=1

---

## TC-07 [P0] quantity>1 删除 → 人气值不变

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 1 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc07';"

# 加购quantity=1
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","tableNo":"T01","productName":"茶兀","quantity":1}'

# 改数量为3
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","productName":"茶兀","quantity":3}'

echo "改数量为3后(popularity仍=2):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# DELETE删除（quantity=3）
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc07","productName":"茶兀"}'

echo "DELETE删除后(popularity仍=2):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"
```
**预期**：始终=2（quantity>1删除不减人气）

---

## TC-08 [P0] 清空购物车 → 人气值不变

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀');"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc08';"

# 加购两个商品
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc08","tableNo":"T01","productName":"苏打水","quantity":1}'
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc08","tableNo":"T01","productName":"茶兀","quantity":1}'

echo "加购后:"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, popularity FROM products WHERE name IN ('苏打水', '茶兀');"

# 清空购物车
curl -s -X DELETE http://127.0.0.1:8088/api/cart/sess_tc08

echo "清空后(人气值不变):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, popularity FROM products WHERE name IN ('苏打水', '茶兀');"
```
**预期**：苏打水=1, 茶兀=1（清空不减人气）

---

## TC-09 [P1] 删除不存在的商品 → 人气值不变

```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_tc09';"

curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc09","productName":"苏打水"}'

echo "删除不存在的商品后(popularity仍=0):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```
**预期**：人气值=0（不变成负数）

---

## TC-10 [P1] 带options的商品加购/删除

```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = 'if椰子水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_tc10%';"

# 加购带options的商品
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc10_1","tableNo":"T01","productName":"if椰子水","quantity":1,"options":"冰"}'

echo "加购后(popularity=1):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"

# 不同session加购同一商品+同一options
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc10_2","tableNo":"T01","productName":"if椰子水","quantity":1,"options":"冰"}'

echo "再次加购后(popularity=2):"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"
```
**预期**：首次=1，再次=2

---

## TC-11 [P1] 缺少必要参数 → 400错误

```bash
# 缺少productName
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc11"}'

echo ""

# 缺少sessionId
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"productName":"苏打水"}'

echo ""
```
**预期**：返回 `{"error":"缺少必要参数"}` 或类似错误

---

## TC-12 [P1] 商品详情API返回popularity

```bash
curl -s http://127.0.0.1:8088/api/products/苏打水 | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'popularity={d.get(\"popularity\",\"N/A\")}')"
```
**预期**：返回包含 popularity 字段

---

## TC-13 [P1] 完整流程：加购→排序→删除→排序

```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_tc13%';"

# 加购茶兀3次（不同session）
for i in 1 2 3; do
  curl -s -X POST http://127.0.0.1:8088/api/cart \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"sess_tc13_$i\",\"tableNo\":\"T01\",\"productName\":\"茶兀\",\"quantity\":1}" > /dev/null
done

# 加购if椰子水2次
for i in 1 2; do
  curl -s -X POST http://127.0.0.1:8088/api/cart \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"sess_tc13_if_$i\",\"tableNo\":\"T01\",\"productName\":\"if椰子水\",\"quantity\":1}" > /dev/null
done

echo "加购后排序:"
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"

# 删除茶兀（quantity=1）
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_tc13_1","productName":"茶兀"}'

echo "删除茶兀后排序:"
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```
**预期**：
- 加购后：茶兀(3) > if椰子水(2) > 苏打水(0)
- 删除后：茶兀(2) > if椰子水(2) > 苏打水(0)

---

## 测试数据清理

```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_tc%';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_test%';"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM products WHERE name LIKE '测试商品%';"
```

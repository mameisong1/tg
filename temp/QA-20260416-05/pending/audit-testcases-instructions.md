你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA-20260416-05 测试用例：前端H5商品页面排序优化

## 需求概述
1. 数据库商品表新增人气值字段（默认0）
2. 用户将商品加入购物车时人气值+1，从购物车删除时人气值-1
3. 前台H5商品页面按人气值倒序排序

## 验收重点
- 人气值字段新增
- 购物车加减人气值逻辑
- H5商品页面按人气值倒序排序

## 测试环境
- 后端API：http://127.0.0.1:8088
- 数据库：/TG/tgservice/db/tgservice.db
- 测试用商品名：`苏打水`（饮料类，stock_available=192）、`茶兀`（饮料类，stock_available=131）、`if椰子水`（饮料类，stock_available=23）

## 测试用Session
- 测试Session ID：`sess_test_popularity_001`
- 测试台桌号：`T01`

---

## 一、人气值字段新增

### TC-01 [P0] 验证products表存在popularity字段

**目的**：确认数据库已添加人气值列

**前置**：无

**操作**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(products);"
```

**预期结果**：
- 输出中包含 `popularity` 字段
- 字段类型为 INTEGER（或类似数值类型）
- 默认值为 0

**验证SQL**：
```bash
# 确认默认值为0
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, popularity FROM products LIMIT 5;"
```
- 所有已有商品的 popularity 值应为 0

---

### TC-02 [P2] 验证新增商品popularity默认值为0

**目的**：确认新插入商品的人气值默认为0

**操作**：
```bash
# 插入测试商品
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO products (name, category, price, stock_total, stock_available, status) VALUES ('测试商品_popularity', '其他', 1.0, 100, 100, '上架');"

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '测试商品_popularity';"
```

**预期结果**：
- 查询返回 `0`

**清理**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM products WHERE name = '测试商品_popularity';"
```

---

### TC-03 [P1] 验证商品详情API返回popularity字段

**目的**：确认 `/api/products/:name` 接口返回人气值

**操作**：
```bash
curl -s http://127.0.0.1:8088/api/products/苏打水 | python3 -m json.tool
```

**预期结果**：
- 返回的 JSON 中包含 `popularity` 字段
- 值为数字类型（初始为0）

---

### TC-04 [P1] 验证商品列表API返回popularity字段

**目的**：确认 `/api/products` 接口返回人气值

**操作**：
```bash
curl -s "http://127.0.0.1:8088/api/products" | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data[:3], ensure_ascii=False, indent=2))"
```

**预期结果**：
- 返回的商品数组中每个商品都包含 `popularity` 字段

---

## 二、购物车加减人气值逻辑

### TC-05 [P0] 添加到购物车 → 人气值+1

**目的**：验证首次将商品加入购物车，人气值增加1

**前置**：
```bash
# 先将测试商品人气值清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
```

**操作**：
```bash
# 1. 确认初始人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"

# 2. 添加到购物车
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_001","tableNo":"T01","productName":"苏打水","quantity":1}'

# 3. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```

**预期结果**：
- 步骤1：人气值 = 0
- 步骤2：返回 `{"success":true,"message":"已添加到购物车"}`
- 步骤3：人气值 = 1

---

### TC-06 [P0] 再次添加同一商品 → 人气值再+1

**目的**：验证同一商品重复加入购物车，人气值继续增加

**前置**：已完成 TC-05（苏打水 popularity = 1，购物车中已有1个）

**操作**：
```bash
# 1. 再次添加
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_001","tableNo":"T01","productName":"苏打水","quantity":1}'

# 2. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```

**预期结果**：
- 人气值 = 2（注意：quantity=1时每次+1，不是+数量）

---

### TC-07 [P0] 从购物车删除商品 → 人气值-1

**目的**：验证从购物车删除商品，人气值减少1

**前置**：已完成 TC-06（苏打水 popularity = 2，购物车中数量为2）

**操作**：
```bash
# 1. 删除商品
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_001","productName":"苏打水"}'

# 2. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"

# 3. 确认购物车中已无该商品
curl -s http://127.0.0.1:8088/api/cart/sess_test_popularity_001 | python3 -m json.tool
```

**预期结果**：
- 人气值 = 1
- 购物车中不再包含苏打水

---

### TC-08 [P1] 更新购物车数量为0（等效删除）→ 人气值减去当前数量

**目的**：验证通过 PUT 将数量设为0时，人气值正确减少

**前置**：
```bash
# 清理测试数据
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_popularity_002';"

# 先加入购物车（quantity=3）
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_002","tableNo":"T01","productName":"茶兀","quantity":3}'
# 此时 popularity 应为 3
```

**操作**：
```bash
# 1. 确认当前人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# 2. 更新数量为0（删除）
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_002","productName":"茶兀","quantity":0}'

# 3. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"
```

**预期结果**：
- 步骤1：人气值 = 3
- 步骤3：人气值 = 0

---

### TC-09 [P1] 添加带options的商品 → 人气值正确增加

**目的**：验证带选项的商品加入购物车时，人气值正确处理

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = 'if椰子水';"
```

**操作**：
```bash
# 添加带选项的商品
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_003","tableNo":"T01","productName":"if椰子水","quantity":1,"options":"冰"}'

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"
```

**预期结果**：
- 人气值 = 1

---

### TC-10 [P1] 删除带options的商品 → 人气值正确减少

**目的**：验证删除带选项的商品时，人气值正确减少

**前置**：已完成 TC-09（if椰子水 popularity = 1）

**操作**：
```bash
# 删除带选项的商品
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_003","productName":"if椰子水","options":"冰"}'

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = 'if椰子水';"
```

**预期结果**：
- 人气值 = 0

---

### TC-11 [P1] 清空购物车（DELETE /api/cart/:sessionId）→ 所有相关商品人气值减少

**目的**：验证清空购物车时，涉及的所有商品人气值都正确减少

**前置**：
```bash
# 清理并准备
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀');"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_popularity_004';"

# 添加两个商品
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_004","tableNo":"T01","productName":"苏打水","quantity":1}'
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_004","tableNo":"T01","productName":"茶兀","quantity":1}'

# 确认初始人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, popularity FROM products WHERE name IN ('苏打水', '茶兀');"
# 应返回：苏打水=1, 茶兀=1
```

**操作**：
```bash
# 清空购物车
curl -s -X DELETE http://127.0.0.1:8088/api/cart/sess_test_popularity_004

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, popularity FROM products WHERE name IN ('苏打水', '茶兀');"
```

**预期结果**：
- 苏打水 popularity = 0
- 茶兀 popularity = 0

---

### TC-12 [P2] 添加 quantity > 1 的商品 → 人气值增加逻辑

**目的**：验证一次性添加多个数量时，人气值的增加方式

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_popularity_005';"
```

**操作**：
```bash
# 一次性添加3个
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_005","tableNo":"T01","productName":"苏打水","quantity":3}'

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```

**预期结果**：
- 人气值 = 3（按 quantity 增加）
- **注意**：需确认实现是按quantity增加还是固定+1，根据需求描述"加入购物车时人气值+1"，应确认实现逻辑与需求一致

---

### TC-13 [P1] 对不存在于购物车的商品执行删除 → 人气值不变

**目的**：验证删除不存在的购物车商品不会导致人气值变为负数

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_nonexist';"
```

**操作**：
```bash
# 删除不存在的商品
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_nonexist","productName":"苏打水"}'

# 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '苏打水';"
```

**预期结果**：
- 人气值仍为 0（不应变成负数）

---

### TC-14 [P2] 更新购物车数量（非删除）→ 人气值按差值调整

**目的**：验证修改购物车数量时，人气值按新旧差值调整

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_popularity_006';"

# 先加入购物车
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_006","tableNo":"T01","productName":"茶兀","quantity":2}'
# 此时 popularity = 2
```

**操作**：
```bash
# 1. 确认当前人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# 2. 修改数量为5
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_006","productName":"茶兀","quantity":5}'

# 3. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"

# 4. 再修改数量为3
curl -s -X PUT http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_popularity_006","productName":"茶兀","quantity":3}'

# 5. 查询人气值
sqlite3 /TG/tgservice/db/tgservice.db "SELECT popularity FROM products WHERE name = '茶兀';"
```

**预期结果**：
- 步骤1：人气值 = 2
- 步骤3：人气值 = 5（增加了3，差值 = 5-2）
- 步骤5：人气值 = 3（减少了2，差值 = 3-5）

---

## 三、H5商品页面按人气值倒序排序

### TC-15 [P0] 商品列表按人气值倒序排序

**目的**：验证商品列表 API 按人气值从高到低排序

**前置**：
```bash
# 设置不同的人气值
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 10 WHERE name = '苏打水';"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 5 WHERE name = '茶兀';"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 20 WHERE name = 'if椰子水';"
```

**操作**：
```bash
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```

**预期结果**：
- 返回的饮料类商品按 popularity 降序排列
- 顺序应为：if椰子水(20) → 苏打水(10) → 茶兀(5)
- （同人气值的商品顺序可任意）

---

### TC-16 [P0] 全部商品列表按人气值倒序排序

**目的**：验证不带分类筛选的商品列表也按人气值排序

**前置**：保持 TC-15 的人气值设置

**操作**：
```bash
curl -s "http://127.0.0.1:8088/api/products" | python3 -c "
import sys, json
data = json.load(sys.stdin)
# 检查前10个商品的排序
for p in data[:10]:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
print(f'--- 共 {len(data)} 个商品 ---')
"
```

**预期结果**：
- if椰子水(popularity=20) 排在苏打水(popularity=10) 前面
- 苏打水(popularity=10) 排在茶兀(popularity=5) 前面
- 整体按 popularity DESC 排序

---

### TC-17 [P1] 人气值相同的商品排序

**目的**：验证人气值相同时的排序规则（应有次级排序，如按created_at）

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 5 WHERE name IN ('茶兀', '苏打水');"
```

**操作**：
```bash
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```

**预期结果**：
- 茶兀和苏打水人气值相同(=5)，应有确定的排序（如按创建时间降序）
- 排序结果应稳定（多次请求顺序一致）

---

### TC-18 [P1] 按分类筛选后仍按人气值排序

**目的**：验证带分类参数时，筛选结果仍按人气值排序

**前置**：保持 TC-15 的人气值设置

**操作**：
```bash
# 零食类
curl -s "http://127.0.0.1:8088/api/products?category=零食" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data[:5]:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
print(f'--- 共 {len(data)} 个零食 ---')
"
```

**预期结果**：
- 返回的零食类商品按 popularity DESC 排序

---

### TC-19 [P2] 新增商品（人气值=0）的排序位置

**目的**：验证新商品（人气值为0）在列表中的位置

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO products (name, category, price, stock_total, stock_available, status) VALUES ('测试商品_新排序', '饮料', 5.0, 100, 100, '上架');"
```

**操作**：
```bash
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```

**预期结果**：
- 测试商品_新排序(popularity=0) 应排在人气值大于0的商品后面
- 如果所有商品人气值都为0，则按次级排序规则排列

**清理**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM products WHERE name = '测试商品_新排序';"
```

---

## 四、完整业务流程集成测试

### TC-20 [P0] 完整购物流程：加购 → 排序变化 → 删除 → 排序恢复

**目的**：验证完整的用户行为对排序的影响

**前置**：
```bash
# 清零
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id = 'sess_test_full_flow';"
```

**操作**：
```bash
# 步骤1：初始状态，所有商品人气值=0
echo "=== 初始状态 ==="
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"

# 步骤2：将茶兀加入购物车5次
echo "=== 加购茶兀5次 ==="
for i in 1 2 3 4 5; do
  curl -s -X POST http://127.0.0.1:8088/api/cart \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"sess_test_full_flow","tableNo":"T01","productName":"茶兀","quantity":1}' > /dev/null
done
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"

# 步骤3：将if椰子水加入购物车3次
echo "=== 加购if椰子水3次 ==="
for i in 1 2 3; do
  curl -s -X POST http://127.0.0.1:8088/api/cart \
    -H "Content-Type: application/json" \
    -d '{"sessionId":"sess_test_full_flow","tableNo":"T01","productName":"if椰子水","quantity":1}' > /dev/null
done
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"

# 步骤4：删除茶兀
echo "=== 删除茶兀 ==="
curl -s -X DELETE http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_full_flow","productName":"茶兀"}'
curl -s "http://127.0.0.1:8088/api/products?category=饮料" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data:
    print(f\"{p['name']}: popularity={p.get('popularity','N/A')}\")
"
```

**预期结果**：
- 步骤1：所有饮料人气值=0，排序不确定
- 步骤2：茶兀 popularity=5，应排在最前面
- 步骤3：茶兀 popularity=5, if椰子水 popularity=3 → 茶兀排第一，if椰子水排第二
- 步骤4：茶兀 popularity=0, if椰子水 popularity=3 → if椰子水排第一

---

## 五、异常场景测试

### TC-21 [P1] 添加不存在的商品到购物车 → 人气值不变

**目的**：验证添加不存在的商品不会导致异常

**前置**：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM products WHERE name = '不存在的商品_xyz';"
# 应返回 0
```

**操作**：
```bash
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_invalid","tableNo":"T01","productName":"不存在的商品_xyz","quantity":1}'
```

**预期结果**：
- 返回成功或错误提示（取决于实现）
- 不应导致服务器崩溃

---

### TC-22 [P2] 缺少必要参数的购物车请求

**目的**：验证缺少参数时的错误处理

**操作**：
```bash
# 缺少productName
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_test_invalid"}'

# 缺少sessionId
curl -s -X POST http://127.0.0.1:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"productName":"苏打水"}'
```

**预期结果**：
- 返回 400 错误和提示

---

## 测试数据清理脚本

所有测试完成后执行：

```bash
# 清理测试购物车
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM carts WHERE session_id LIKE 'sess_test%';"

# 清理测试商品
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM products WHERE name LIKE '测试商品%';"

# 重置测试商品人气值
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE products SET popularity = 0 WHERE name IN ('苏打水', '茶兀', 'if椰子水');"
```

---

## 测试用例汇总

| 编号 | 优先级 | 类别 | 测试内容 | 状态 |
|------|--------|------|----------|------|
| TC-01 | P0 | 字段 | products表存在popularity字段 | ⏭️ |
| TC-02 | P2 | 字段 | 新增商品popularity默认值为0 | ⏭️ |
| TC-03 | P1 | 字段 | 商品详情API返回popularity字段 | ⏭️ |
| TC-04 | P1 | 字段 | 商品列表API返回popularity字段 | ⏭️ |
| TC-05 | P0 | 加减逻辑 | 添加到购物车→人气值+1 | ⏭️ |
| TC-06 | P0 | 加减逻辑 | 重复添加同一商品→人气值再+1 | ⏭️ |
| TC-07 | P0 | 加减逻辑 | 从购物车删除→人气值-1 | ⏭️ |
| TC-08 | P1 | 加减逻辑 | PUT数量=0→人气值减当前数量 | ⏭️ |
| TC-09 | P1 | 加减逻辑 | 带options的商品加购→人气值+1 | ⏭️ |
| TC-10 | P1 | 加减逻辑 | 带options的商品删除→人气值-1 | ⏭️ |
| TC-11 | P1 | 加减逻辑 | 清空购物车→所有商品人气值减少 | ⏭️ |
| TC-12 | P2 | 加减逻辑 | quantity>1时人气值增加逻辑 | ⏭️ |
| TC-13 | P1 | 加减逻辑 | 删除不存在商品→人气值不变 | ⏭️ |
| TC-14 | P2 | 加减逻辑 | 更新数量→人气值按差值调整 | ⏭️ |
| TC-15 | P0 | 排序 | 分类商品列表按人气值倒序 | ⏭️ |
| TC-16 | P0 | 排序 | 全部商品列表按人气值倒序 | ⏭️ |
| TC-17 | P1 | 排序 | 人气值相同时的次级排序 | ⏭️ |
| TC-18 | P1 | 排序 | 分类筛选后仍按人气值排序 | ⏭️ |
| TC-19 | P2 | 排序 | 新商品(popularity=0)排序位置 | ⏭️ |
| TC-20 | P0 | 集成 | 完整购物流程排序变化 | ⏭️ |
| TC-21 | P1 | 异常 | 添加不存在商品→不崩溃 | ⏭️ |
| TC-22 | P2 | 异常 | 缺少参数的错误处理 | ⏭️ |

**总计**：22个测试用例
- P0（核心）：7个
- P1（重要）：10个
- P2（次要）：5个

---

## ⚠️ 实施前注意

当前代码分析发现：
1. **products表当前没有popularity字段** - 需要执行 `ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;`
2. **POST /api/cart** - 当前只操作购物车表，没有修改products.popularity
3. **DELETE /api/cart** - 当前只操作购物车表，没有修改products.popularity
4. **PUT /api/cart** - 当前只操作购物车表，没有修改products.popularity
5. **GET /api/products** - 当前排序规则为 `ORDER BY created_at DESC`，需改为 `ORDER BY popularity DESC`（次级排序可保留 `created_at DESC`）

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
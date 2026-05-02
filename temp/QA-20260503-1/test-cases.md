# 奶茶果盘任务统计功能 - API测试用例

> 测试地址：`http://127.0.0.1:8088`（严禁使用 8081 和 8083！）
> 编写时间：2026-05-03
> 测试策略：只用 API/curl 测试，不需要浏览器测试
> 更新：增加P0边界测试 - 任务商品识别和进度计算

---

## 一、测试数据准备

### 1.1 商品分类确认
```bash
# P0 - 确认奶茶店分类商品
curl -s "http://127.0.0.1:8088/api/products?category=奶茶店" | jq '.[] | {name, category}'

# 预期：返回奶茶店分类下的所有商品（约20+个）
# 当前商品：珍珠奶茶、椰丸奶茶、红茶拿铁、生椰拿铁、招牌柠檬茶...
```

### 1.2 果盘商品确认
```bash
# P0 - 确认果盘相关商品
curl -s "http://127.0.0.1:8088/api/products" | jq '.[] | select(.name | contains("果盘") or contains("水果")) | {name, category}'

# 当前商品：
# - 至尊果盘
# - 六宫格果盘
# - 六宫格果盘（不可选择水果搭配） ← ❗关键测试商品
# - 单份水果 ← ❗关键测试商品
```

---

## 二、任务商品识别逻辑测试（P0核心）

> ⚠️ 重点测试：商品识别和进度计算的边界情况

### 2.1 奶茶商品识别 - 分类匹配

**用例编号：TC-LOGIC-TEA-001**
**优先级：P0**
**测试重点：验证商品分类="奶茶店"的商品是否被正确识别**

```bash
# P0 - 奶茶分类商品识别测试

# ❗ 关键：验证奶茶店分类下所有商品是否计入奶茶任务

# 1. 创建订单，包含多种奶茶店分类商品
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "珍珠奶茶", "quantity": 2, "price": 10},
      {"name": "生椰拿铁", "quantity": 1, "price": 18},
      {"name": "港式鸳鸯", "quantity": 1, "price": 15}
    ],
    "total_price": 43,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

# 2. 验证任务进度（奶茶应增加4杯）
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.teaTask'
# 预期：current = 4, display = "4/30"
```

**验证点：**
- ❗ **奶茶店分类商品全部计入奶茶任务**
- ❗ 边界：验证"柠c美式"、"橙c美式"、"椰青美式"等非传统奶茶饮品是否计入
- ❗ 边界：验证"港式鸳鸯"（奶茶+咖啡混合）是否计入
- ❗ 边界：验证"美式"（纯咖啡）是否计入（虽然分类是奶茶店，但可能需要排除）
- 数量正确累加

---

### 2.2 果盘商品识别 - 名称匹配（含复杂名称）

**用例编号：TC-LOGIC-FRUIT-001**
**优先级：P0**
**测试重点：验证商品名称含"果盘"的识别，包括复杂名称**

```bash
# P0 - 果盘商品名称匹配测试

# ❗ 关键测试：复杂名称"六宫格果盘（不可选择水果搭配）"必须识别为果盘

# 1. 创建订单，包含果盘商品（含复杂名称）
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "至尊果盘", "quantity": 1, "price": 38},
      {"name": "六宫格果盘", "quantity": 2, "price": 58},
      {"name": "六宫格果盘（不可选择水果搭配）", "quantity": 1, "price": 58}
    ],
    "total_price": 212,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

# 2. 验证任务进度（果盘应增加4个：1+2+1）
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 4, display = "4/5"
```

**验证点：**
- ❗ **商品名包含"果盘"的商品计入果盘任务**
- ❗ **边界："六宫格果盘（不可选择水果搭配）"必须识别为果盘**（名称含括号、含额外说明）
- ❗ 边界："单份水果"不计入果盘（属于水果但不是果盘，单独折算逻辑）
- ❗ 边界：名称大小写不敏感匹配
- 数量正确累加

---

### 2.3 单份水果折算 - 进度显示

**用例编号：TC-LOGIC-FRUIT-002**
**优先级：P0**
**测试重点：验证3个单份水果=1个果盘任务的计算逻辑，进度格式如"1.33/5"**

```bash
# P0 - 单份水果折算测试

# ❗ 关键测试：进度格式应为 "X.XX/5"（带小数，显示折算进度）

# 场景A：4个单份水果 → 4÷3=1.33个果盘任务
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 4, "price": 10}],
    "total_price": 40,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：
# {
#   "target": 5,
#   "current": 1.33,      ← ❗小数显示
#   "display": "1.33/5",  ← ❗进度格式
#   "rawFruitCount": 4,   ← 原始单份水果数量
#   "completed": false
# }
```

```bash
# 场景B：7个单份水果 → 7÷3=2.33个果盘任务
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 7, "price": 10}],
    "total_price": 70,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 2.33, display = "2.33/5"
```

```bash
# 场景C：3个单份水果 → 3÷3=1个果盘任务（整数）
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 3, "price": 10}],
    "total_price": 30,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 1, display = "1/5" ← ❗无小数
```

**验证点：**
- ❗ **单份水果商品识别（名称="单份水果"）**
- ❗ **3个单份水果=1个果盘任务的折算逻辑**
- ❗ **进度显示格式："X.XX/5"（带小数）或"X/5"（整数）**
- ❗ 边界：1个单份水果 → 0.33个果盘任务
- ❗ 边界：2个单份水果 → 0.67个果盘任务
- ❗ 边界：15个单份水果 → 5个果盘任务（任务完成）
- ❗ 边界：16个单份水果 → 5.33个果盘任务（超过目标仍显示真实进度）

---

### 2.4 任务进度显示 - 奶茶30杯/月

**用例编号：TC-LOGIC-TEA-002**
**优先级：P0**
**测试重点：验证奶茶任务进度格式"X/30"**

```bash
# P0 - 奶茶任务进度显示测试

# 场景A：5杯奶茶 → "5/30"
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "珍珠奶茶", "quantity": 5, "price": 10}],
    "total_price": 50,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.teaTask'
# 预期：
# {
#   "target": 30,
#   "current": 5,
#   "display": "5/30",  ← ❗进度格式
#   "completed": false
# }
```

```bash
# 场景B：30杯奶茶 → 任务完成
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "珍珠奶茶", "quantity": 30, "price": 10}],
    "total_price": 300,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.teaTask'
# 预期：
# {
#   "target": 30,
#   "current": 30,
#   "display": "30/30",
#   "completed": true  ← ❗任务完成标识
# }
```

```bash
# 场景C：35杯奶茶 → 超过目标仍显示真实进度
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "珍珠奶茶", "quantity": 35, "price": 10}],
    "total_price": 350,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.teaTask'
# 预期：current = 35, display = "35/30" ← ❗超过目标仍显示真实进度
```

**验证点：**
- ❗ **奶茶任务目标：30杯/月**
- ❗ **进度格式："X/30"**
- ❗ 边界：完成时"30/30"，completed=true
- ❗ 边界：超过目标显示真实进度"35/30"

---

### 2.5 果盘任务进度显示 - 5个/月

**用例编号：TC-LOGIC-FRUIT-003**
**优先级：P0**
**测试重点：验证果盘任务进度格式"X/5"，包括小数显示**

```bash
# P0 - 果盘任务进度显示测试

# 场景A：3个果盘 → "3/5"
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "至尊果盘", "quantity": 3, "price": 38}],
    "total_price": 114,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 3, display = "3/5"
```

```bash
# 场景B：5个果盘 → 任务完成
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "六宫格果盘", "quantity": 5, "price": 58}],
    "total_price": 290,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 5, display = "5/5", completed = true
```

```bash
# 场景C：果盘+单份水果组合 → 1个果盘+4个单份水果=2.33个果盘任务
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "至尊果盘", "quantity": 1, "price": 38},
      {"name": "单份水果", "quantity": 4, "price": 10}
    ],
    "total_price": 78,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：
# {
#   "target": 5,
#   "current": 2.33,      ← 1 + 4÷3 = 2.33
#   "display": "2.33/5",
#   "rawFruitCount": 4,   ← 单份水果数量
#   "realFruitPlate": 1   ← 实际果盘数量
# }
```

**验证点：**
- ❗ **果盘任务目标：5个/月**
- ❗ **进度格式："X/5"或"X.XX/5"（含小数）**
- ❗ **果盘任务进度 = 实际果盘数 + (单份水果数÷3)**
- ❗ 边界：完成时"5/5"，completed=true

---

## 三、商品识别边界测试（P0）

### 3.1 奶茶店分类边界 - 美式是否计入

**用例编号：TC-EDGE-TEA-001**
**优先级：P0**
**测试重点：验证"美式"（纯咖啡，分类=奶茶店）是否计入奶茶任务**

```bash
# P0 - 美式是否计入奶茶任务

# 美式属于奶茶店分类，但不是奶茶
# 需确认业务规则：是否计入奶茶任务？

curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "美式", "quantity": 5, "price": 15}],
    "total_price": 75,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.teaTask'

# 预期：需确认业务规则
# 选项A：计入奶茶任务（current=5）
# 选项B：不计入（current=0）
# ❗ 建议与业务确认：美式、柠c美式、橙c美式、椰青美式是否计入奶茶任务
```

---

### 3.2 果盘名称边界 - 括号和特殊字符

**用例编号：TC-EDGE-FRUIT-001**
**优先级：P0**
**测试重点：验证含括号的果盘名称识别"六宫格果盘（不可选择水果搭配）"**

```bash
# P0 - 复杂果盘名称识别

curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "六宫格果盘（不可选择水果搭配）", "quantity": 3, "price": 58}],
    "total_price": 174,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'

# 预期：
# {
#   "target": 5,
#   "current": 3,        ← ❗必须识别为果盘
#   "display": "3/5",
#   "completed": false
# }
```

**验证点：**
- ❗ **名称含"果盘"即识别，不考虑括号、特殊字符**
- ❗ 边界："六宫格果盘（不可选择水果搭配）"必须识别
- ❗ 边界：名称大小写不敏感

---

### 3.3 单份水果边界 - 非3倍数

**用例编号：TC-EDGE-FRUIT-002**
**优先级：P0**
**测试重点：验证单份水果数量非3倍数的折算**

```bash
# P0 - 单份水果边界数量

# 场景A：1个单份水果 → 0.33个果盘任务
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 1, "price": 10}],
    "total_price": 10,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 0.33, display = "0.33/5"
```

```bash
# 场景B：2个单份水果 → 0.67个果盘任务
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 2, "price": 10}],
    "total_price": 20,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 0.67, display = "0.67/5"
```

**验证点：**
- ❗ **1个单份水果=0.33个果盘任务**
- ❗ **2个单份水果=0.67个果盘任务**
- ❗ 进度显示精确到小数点后2位

---

### 3.4 单份水果边界 - 达到任务目标

**用例编号：TC-EDGE-FRUIT-003**
**优先级：P0**
**测试重点：验证单份水果达到果盘任务目标时的计算**

```bash
# P0 - 15个单份水果 = 5个果盘任务（完成）
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 15, "price": 10}],
    "total_price": 150,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 5, display = "5/5", completed = true ← ❗任务完成
```

```bash
# P0 - 16个单份水果 = 5.33个果盘任务（超过目标）
curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"name": "单份水果", "quantity": 16, "price": 10}],
    "total_price": 160,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data.fruitTask'
# 预期：current = 5.33, display = "5.33/5" ← ❗超过目标仍显示真实进度
```

**验证点：**
- ❗ **15个单份水果=5个果盘任务，任务完成**
- ❗ **超过目标仍显示真实进度"5.33/5"**

---

## 四、混合商品计算测试

### 4.1 奶茶+果盘+单份水果+其他商品

**用例编号：TC-LOGIC-MIX-001**
**优先级：P0**

```bash
# P0 - 混合商品计算测试

curl -s -X POST "http://127.0.0.1:8088/api/order" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"name": "珍珠奶茶", "quantity": 5, "price": 10},
      {"name": "至尊果盘", "quantity": 2, "price": 38},
      {"name": "单份水果", "quantity": 4, "price": 10},
      {"name": "可乐", "quantity": 3, "price": 5}
    ],
    "total_price": 176,
    "device_fingerprint": "test-device-001",
    "coach_no": 10002
  }'

curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" | jq '.data'

# 预期：
# {
#   "teaTask": {"target": 30, "current": 5, "display": "5/30"},
#   "fruitTask": {
#     "target": 5,
#     "current": 3.33,      ← 2个果盘 + 4÷3 = 3.33
#     "display": "3.33/5",
#     "rawFruitCount": 4,
#     "realFruitPlate": 2
#   }
# }
```

**验证点：**
- ❗ **奶茶分类商品正确识别：category="奶茶店"**
- ❗ **果盘名称商品正确识别：name含"果盘"**
- ❗ **单份水果折算：4÷3=1.33**
- ❗ **果盘进度=实际果盘+折算果盘**（如2+1.33=3.33）
- ❗ 边界：可乐不计入任何任务（category="饮料"）

---

## 五、助教任务查询API

### 5.1 助教端 - 当月任务进度查询

**用例编号：TC-COACH-TEA-001**
**优先级：P0**
**接口：** `GET /api/coach/tea-fruit-task/progress`

```bash
# P0 - 助教查询当月任务进度（需登录）
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" | jq

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "month": "2026-05",
#     "teaTask": { "target": 30, "current": 0, "display": "0/30", "completed": false },
#     "fruitTask": { "target": 5, "current": 0, "display": "0/5", "completed": false, "rawFruitCount": 0, "realFruitPlate": 0 },
#     "teaOrders": [],
#     "fruitOrders": []
#   }
# }
```

---

### 5.2 助教端 - 指定月份查询

**用例编号：TC-COACH-TEA-002**
**优先级：P0**

```bash
# P0 - 助教查询指定月份任务进度
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress?month=2026-04" \
  -H "Authorization: Bearer {token}" | jq
```

---

### 5.3 助教端 - 订单明细查询

**用例编号：TC-COACH-TEA-003**
**优先级：P0**
**接口：** `GET /api/coach/tea-fruit-task/orders`

```bash
# P0 - 助教查询奶茶/果盘订单明细
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/orders?month=2026-05&type=tea" \
  -H "Authorization: Bearer {token}" | jq

# type参数：tea（奶茶）| fruit（果盘）
```

---

## 六、管理员统计API

### 6.1 管理员 - 所有助教任务进度统计

**用例编号：TC-ADMIN-TEA-001**
**优先级：P0**
**接口：** `GET /api/admin/tea-fruit-task/stats`

```bash
# P0 - 管理员查询所有助教任务进度（需管理员权限）
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats?month=2026-05" \
  -H "Authorization: Bearer {admin_token}" | jq

# 预期响应：
# {
#   "success": true,
#   "data": {
#     "month": "2026-05",
#     "coaches": [
#       {
#         "coach_no": 10002,
#         "employee_id": "2",
#         "stage_name": "陆飞",
#         "teaTask": { "target": 30, "current": 15, "display": "15/30", "completed": false },
#         "fruitTask": { "target": 5, "current": 2.33, "display": "2.33/5", "completed": false },
#         "status": "进行中"
#       }
#     ]
#   }
# }
```

---

### 6.2 管理员 - 指定助教订单明细

**用例编号：TC-ADMIN-TEA-002**
**优先级：P0**

```bash
# P0 - 管理员查询指定助教的订单明细
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats/10002/orders?month=2026-05&type=tea" \
  -H "Authorization: Bearer {admin_token}" | jq
```

---

## 七、权限测试

### 7.1 助教权限验证

**用例编号：TC-PERM-001**
**优先级：P0**

```bash
# P0 - 助教只能查看自己的任务数据
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress" \
  -H "Authorization: Bearer {coach_a_token}" | jq
# 预期：只返回该助教的数据
```

---

### 7.2 管理员权限验证

**用例编号：TC-PERM-002**
**优先级：P0**

```bash
# P0 - 管理员接口需要管理员权限

# 1. 无token访问
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats" | jq
# 预期：401 Unauthorized

# 2. 使用普通助教token访问
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats" \
  -H "Authorization: Bearer {coach_token}" | jq
# 预期：403 Forbidden

# 3. 使用管理员token访问
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats" \
  -H "Authorization: Bearer {admin_token}" | jq
# 预期：200 OK
```

---

## 八、数据修复功能测试

**⚠️ 需求变更：设备指纹写入 members 表，而非 coaches 表**

### 8.1 设备指纹写入会员表

**用例编号：TC-FIX-001**
**优先级：P1**

```bash
# P1 - 触发数据修复（设备指纹写入会员表）
# 修复逻辑：通过 coaches.phone 找 members 表对应会员，把订单的 device_fingerprint 写入 members.device_fingerprint
curl -s -X POST "http://127.0.0.1:8088/api/admin/tea-fruit-task/fix-data" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"fixType": "device_fingerprint"}'

# 验证数据库：
node -e "const{dbAll}=require('/TG/tgservice/backend/db/index');dbAll('SELECT m.member_no, m.phone, m.device_fingerprint FROM members m JOIN coaches c ON m.phone = c.phone WHERE m.device_fingerprint IS NOT NULL LIMIT 5').then(r=>console.log(r))"

# 预期：会员表中有 phone 和 device_fingerprint 的关联数据
```

**验证点：**
- ❗ **设备指纹写入 members.device_fingerprint**
- ❗ **通过 coaches.phone 找到 members 表对应会员**
- ❗ **订单 device_fingerprint → members.device_fingerprint → members.phone → coaches.phone 关联正确**

---

### 8.2 会员设备指纹补全

**用例编号：TC-FIX-002**
**优先级：P1**

```bash
# P1 - 补全会员设备指纹
# 场景：助教有手机号，但对应会员没有 device_fingerprint
# 修复逻辑：通过 coaches.phone 找 members 表对应会员，把订单的 device_fingerprint 写入 members.device_fingerprint
curl -s -X POST "http://127.0.0.1:8088/api/admin/tea-fruit-task/fix-data" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" 
  -d '{"fixType": "phone"}'
```

---

### 8.3 全量数据修复

**用例编号：TC-FIX-003**
**优先级：P1**

```bash
# P1 - 触发全量数据修复
curl -s -X POST "http://127.0.0.1:8088/api/admin/tea-fruit-task/fix-data" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"fixType": "all"}'
```

---

## 九、异常测试

### 9.1 无效月份格式

**用例编号：TC-ERR-001**
**优先级：P2**

```bash
# P2 - 无效月份格式
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/progress?month=2026-13" \
  -H "Authorization: Bearer {token}" | jq
# 预期：400 Bad Request 或返回错误信息
```

---

### 9.2 无效coachNo

**用例编号：TC-ERR-002**
**优先级：P2**

```bash
# P2 - 管理员查询不存在的助教
curl -s -X GET "http://127.0.0.1:8088/api/admin/tea-fruit-task/stats/99999/orders?month=2026-05" \
  -H "Authorization: Bearer {admin_token}" | jq
# 预期：返回空数据或404
```

---

### 9.3 无效type参数

**用例编号：TC-ERR-003**
**优先级：P2**

```bash
# P2 - 无效type参数
curl -s -X GET "http://127.0.0.1:8088/api/coach/tea-fruit-task/orders?month=2026-05&type=invalid" \
  -H "Authorization: Bearer {token}" | jq
# 预期：400 Bad Request 或返回错误信息
```

---

## 十、测试执行顺序

### P0用例（核心功能，必须先执行）：
1. TC-LOGIC-TEA-001 ~ 002 - 奶茶商品识别和进度显示
2. TC-LOGIC-FRUIT-001 ~ 003 - 果盘商品识别和进度显示
3. TC-LOGIC-FRUIT-002 - 单份水果折算
4. TC-EDGE-TEA-001 - 奶茶店分类边界（美式）
5. TC-EDGE-FRUIT-001 ~ 003 - 果盘名称和单份水果边界
6. TC-LOGIC-MIX-001 - 混合商品计算
7. TC-COACH-TEA-001 ~ 003 - 助教查询API
8. TC-ADMIN-TEA-001 ~ 002 - 管理员统计API
9. TC-PERM-001 ~ 002 - 权限验证

### P1用例（重要功能）：
1. TC-FIX-001 ~ 003 - 数据修复功能

### P2用例（边界和异常）：
1. TC-ERR-001 ~ 003 - 异常测试

---

## 十一、接口清单（待开发确认）

| 接口 | 方法 | 说明 | 权限 |
|------|------|------|------|
| `/api/coach/tea-fruit-task/progress` | GET | 助教任务进度 | 助教 |
| `/api/coach/tea-fruit-task/orders` | GET | 助教订单明细 | 助教 |
| `/api/admin/tea-fruit-task/stats` | GET | 管理员统计 | 管理员 |
| `/api/admin/tea-fruit-task/stats/:coachNo/orders` | GET | 指定助教明细 | 管理员 |
| `/api/admin/tea-fruit-task/fix-data` | POST | 数据修复 | 管理员 |

---

## 十二、进度格式规范

### 奶茶任务：
- 目标：30杯/月
- 格式：`"X/30"`（整数）
- 示例：`"5/30"`、`"30/30"`、`"35/30"`

### 果盘任务：
- 目标：5个/月
- 格式：`"X/5"`或`"X.XX/5"`（含小数）
- 计算公式：`果盘进度 = 实际果盘数 + (单份水果数 ÷ 3)`
- 示例：`"0/5"`、`"3/5"`、`"1.33/5"`、`"2.67/5"`、`"5.33/5"`

---

**测试用例编写完成**
**状态：待API实现后执行测试**
**重点：任务商品识别和进度计算的边界情况**
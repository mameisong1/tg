你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 后台Admin奖罚统计页面改造 - API测试用例

> 编写人：测试员B  
> 日期：2026-04-18  
> 后端API：http://127.0.0.1:8088  
> 数据库：/TG/tgservice/db/tgservice.db  

## 前置说明

### 认证Token
所有API请求需要携带JWT token。测试用token生成命令：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
```

### 现有数据库数据（用于测试验证）
```sql
-- 当前 reward_penalties 表数据：
-- id=29: 服务日奖 2026-04-18 13800000002 小李 50.0 未执行
-- id=30: 服务日奖 2026-04-17 13800000003 小张 10.0 未执行
-- id=31: 服务日奖 2026-04-17 13800000002 小李 20.0 未执行
-- id=32: 服务日奖 2026-04-18 13800000003 小张 33.0 未执行
-- id=34: 助教日常 2026-04-16 16675852676 余莉桦 -10.0 未执行
-- id=35: 助教日常 2026-04-16 18775703862 陆飞凤 -40.0 未执行
-- id=36: 助教日常 2026-04-18 18775703862 陆飞凤 -50.0 未执行
```

---

## 一、统计查询性能优化（需求1）

### TC-001 | 统计查询只返回汇总数据，不含明细 | **P0**

**目的**：验证改造后 `/api/reward-penalty/stats` 接口只返回按人员分组的统计结果，不再一次性返回所有明细记录。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 每条人员数据包含：`phone`、`name`、`personTotal`、`recordCount`（记录条数）、`totalBonus`（奖金合计）、`totalPenalty`（罚金合计）、`pendingCount`（未执行数）、`executedCount`（已执行数）
- **不包含** `records` 数组（明细列表），或 `records` 为空数组
- 返回数据量显著小于改造前（仅人员数条 vs 人员数×记录数条）

---

### TC-002 | 统计查询 - 按月份过滤 | **P0**

**目的**：验证月份过滤参数正常工作。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 只返回 `confirm_date` 以 `2026-04` 开头的记录对应的统计数据
- 当前数据应返回 4 条人员统计（小李、小张、余莉桦、陆飞凤）

---

### TC-003 | 统计查询 - 按类型过滤 | **P1**

**目的**：验证按奖罚类型过滤。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04&type=服务日奖" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 只返回类型为「服务日奖」的人员统计
- 应返回 2 人（小李 personTotal=70，小张 personTotal=43）

---

### TC-004 | 统计查询 - 按执行状态过滤 | **P1**

**目的**：验证按执行状态过滤。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04&execStatus=未执行" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 只返回执行状态为「未执行」的记录对应的统计数据

---

### TC-005 | 统计查询 - 无数据月份 | **P2**

**目的**：验证查询无数据的月份时返回正确结果。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2025-01" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- `data` 为空数组 `[]`

---

### TC-006 | 统计查询 - 默认本月 | **P2**

**目的**：验证不传 month 参数时默认查询当月数据。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 查询的是当月（2026-04）数据
- 结果与传入 `?month=2026-04` 一致

---

## 二、查看明细弹框功能（需求2）

### TC-010 | 查看人员明细 - 正常查询 | **P0**

**目的**：验证新接口能按人员查询明细列表（在弹框中显示）。

> **注意**：此接口为新增接口，预期路径为 `GET /api/reward-penalty/stats/details`

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=13800000002&month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 返回小李（13800000002）在2026-04的所有明细记录
- 每条明细包含：`id`、`type`、`confirm_date`、`amount`、`exec_status`、`exec_date`、`remark`
- 应返回 2 条记录（id=29 amount=50 和 id=31 amount=20）

---

### TC-011 | 查看人员明细 - 筛选未执行 | **P1**

**目的**：验证明细查询支持按执行状态过滤。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=18775703862&month=2026-04&execStatus=未执行" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- 只返回陆飞凤未执行的明细记录
- 当前数据应返回 2 条（id=35 和 id=36）

---

### TC-012 | 查看人员明细 - 人员不存在 | **P2**

**目的**：验证查询不存在的人员时返回正确结果。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=99999999999&month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 `success: true`
- `data` 为空数组 `[]`

---

### TC-013 | 查看人员明细 - 缺少phone参数 | **P2**

**目的**：验证缺少必要参数时的错误处理。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 400 错误或缺少参数的错误信息

---

## 三、明细金额修改联动统计（需求3）

### TC-020 | 修改明细金额为0 | **P0**

**目的**：验证能将明细金额修改为0（代替删除功能）。

> **注意**：此接口为新增接口，预期路径为 `PUT /api/reward-penalty/detail/:id` 或类似

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/29" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}'
```

**预期结果**：
- 返回 `success: true`
- 数据库中 id=29 的 amount 更新为 0
- 验证：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, amount FROM reward_penalties WHERE id=29;"
```
- 预期输出：`29|0.0`

---

### TC-021 | 修改明细金额后统计联动更新 | **P0**

**目的**：验证修改明细金额后，该人员的统计结果自动更新。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")

# 步骤1: 修改小李 id=29 金额为 0
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/29" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}'

# 步骤2: 重新查询统计，验证小李的 personTotal 从 70 变为 20
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 统计接口返回中小李的 `personTotal` 从 70 变为 20（只剩 id=31 的 20 元）
- 小李的 `recordCount` 仍为 2（记录条数不变）

---

### TC-022 | 修改明细金额为非0值 | **P1**

**目的**：验证能将明细金额修改为任意数值。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/30" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

**预期结果**：
- 返回 `success: true`
- 验证数据库：
```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, amount FROM reward_penalties WHERE id=30;"
```
- 预期输出：`30|100.0`

---

### TC-023 | 不允许删除明细数据 | **P0**

**目的**：验证系统不允许直接删除明细记录（只能将金额设为0）。

**操作步骤**：
```bash
# 尝试通过DELETE请求删除记录（应该被拒绝）
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X DELETE "http://127.0.0.1:8088/api/reward-penalty/detail/29" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 405（Method Not Allowed）或 403（Forbidden）或明确错误提示
- 数据库中记录仍然存在

---

### TC-024 | 金额修改后的负数处理 | **P1**

**目的**：验证修改金额为负数的场景。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/32" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": -20}'
```

**预期结果**：
- 返回 `success: true`
- 小张的 personTotal 从 43 变为 33 + (-20) = 13

---

## 四、执行完毕功能（需求4）

### TC-030 | 执行完毕 - 单条统计数据全部设为已执行 | **P0**

**目的**：验证点击「执行完毕」按钮后，该人员下所有明细都设为已执行。

> **注意**：此接口为新增接口，预期路径为 `POST /api/reward-penalty/stats/execute-all/:phone`

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")

# 执行小李所有明细
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/stats/execute-all/13800000002" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-04"}'

# 验证：查询小李明细，全部应为已执行
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=13800000002&month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 执行接口返回 `success: true`，并返回更新的记录数
- 明细查询结果中，每条记录的 `exec_status` 均为「已执行」
- `exec_date` 均被设置为当天日期

---

### TC-031 | 执行完毕 - 已执行的记录不受影响 | **P1**

**目的**：验证部分记录已执行时，再次点击执行完毕不会出错。

**操作步骤**：
```bash
# 先将小李的 id=29 设为已执行
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/execute/29" \
  -H "Authorization: Bearer $TOKEN"

# 再执行小李全部
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/stats/execute-all/13800000002" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-04"}'
```

**预期结果**：
- 返回 `success: true`
- id=29 保持已执行状态不变
- id=31（未执行）被设为已执行
- 无报错

---

### TC-032 | 执行完毕 - 全部已执行时提示 | **P2**

**目的**：验证该人员所有记录都已执行时，再次点击执行完毕的返回。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
# 假设该人员所有记录都已执行
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/stats/execute-all/13800000002" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-04"}'
```

**预期结果**：
- 返回 `success: true`
- `updated` 为 0（没有更新的记录）
- 或返回提示信息表明已全部执行

---

### TC-033 | 执行完毕 - 不存在的人员 | **P2**

**目的**：验证对不存在的人员执行完毕的处理。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/stats/execute-all/99999999999" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-04"}'
```

**预期结果**：
- 返回错误提示或 `updated: 0`

---

## 五、完整业务流程集成测试

### TC-040 | 完整流程：查询统计 → 查看明细 → 修改金额 → 重新统计 → 执行完毕 | **P0**

**目的**：验证完整业务流程的端到端交互。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")

echo "=== 步骤1: 查询统计（只返回汇总） ==="
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 步骤2: 查看小张明细 ==="
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=13800000003&month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 步骤3: 修改小张 id=30 金额为 0 ==="
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/30" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}' | python3 -m json.tool

echo "=== 步骤4: 重新查询统计，验证小张 personTotal 变化 ==="
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "=== 步骤5: 执行小张所有明细 ==="
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/stats/execute-all/13800000003" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month": "2026-04"}' | python3 -m json.tool

echo "=== 步骤6: 验证小张明细全部已执行 ==="
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=13800000003&month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**：
1. 步骤1返回人员统计汇总，不含明细
2. 步骤2返回小张 2 条明细（id=30 amount=10, id=32 amount=33），personTotal=43
3. 步骤3返回成功，id=30 amount 变为 0
4. 步骤4返回的小张 personTotal 从 43 变为 33
5. 步骤5返回成功，更新记录数 >= 1
6. 步骤6中小张所有明细的 exec_status 均为「已执行」

---

### TC-041 | 性能对比：改造前后数据量 | **P1**

**目的**：验证改造后统计接口返回的数据量明显减少。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'admin',role:'管理员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")

# 获取统计接口响应大小
STATS_SIZE=$(curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | wc -c)
echo "统计接口响应大小: ${STATS_SIZE} bytes"

# 获取明细接口响应大小（单个人员）
DETAIL_SIZE=$(curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/details?phone=13800000002&month=2026-04" \
  -H "Authorization: Bearer $TOKEN" | wc -c)
echo "明细接口响应大小(单人): ${DETAIL_SIZE} bytes"

echo "改造前总数据量（统计含所有明细）应 >> 改造后统计接口数据量"
```

**预期结果**：
- 改造后的 stats 接口响应大小应远小于改造前（不含 records 数组）
- 明细接口只在点击时才加载，总体减少了不必要的数据传输

---

## 六、权限与异常测试

### TC-050 | 无token访问统计接口 | **P1**

**操作步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04"
```

**预期结果**：
- 返回 401 状态码
- 返回错误信息 `未登录`

---

### TC-051 | 无效token访问统计接口 | **P1**

**操作步骤**：
```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer invalid_token_here"
```

**预期结果**：
- 返回 401 状态码
- 返回错误信息 `token无效`

---

### TC-052 | 无权限用户访问统计接口 | **P1**

**目的**：验证无 coachManagement 权限的用户无法访问（stats 接口需要此权限）。

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'cashier1',role:'服务员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=2026-04" \
  -H "Authorization: Bearer $TOKEN"
```

**预期结果**：
- 返回 403 状态码或无权限错误

---

### TC-053 | 修改金额 - 无权限 | **P1**

**操作步骤**：
```bash
TOKEN=$(cd /TG/tgservice/backend && node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({username:'cashier1',role:'服务员'},'tgservice_jwt_secret_key_2026',{expiresIn:'7d'}))")
curl -s -X PUT "http://127.0.0.1:8088/api/reward-penalty/detail/29" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 0}'
```

**预期结果**：
- 返回 403 或无权限错误

---

## 测试用例汇总

| 编号 | 测试项 | 优先级 | 状态 |
|------|--------|--------|------|
| TC-001 | 统计查询只返回汇总数据 | P0 | ⬜ |
| TC-002 | 统计查询-按月份过滤 | P0 | ⬜ |
| TC-003 | 统计查询-按类型过滤 | P1 | ⬜ |
| TC-004 | 统计查询-按执行状态过滤 | P1 | ⬜ |
| TC-005 | 统计查询-无数据月份 | P2 | ⬜ |
| TC-006 | 统计查询-默认本月 | P2 | ⬜ |
| TC-010 | 查看人员明细-正常查询 | P0 | ⬜ |
| TC-011 | 查看人员明细-筛选未执行 | P1 | ⬜ |
| TC-012 | 查看人员明细-人员不存在 | P2 | ⬜ |
| TC-013 | 查看人员明细-缺少phone参数 | P2 | ⬜ |
| TC-020 | 修改明细金额为0 | P0 | ⬜ |
| TC-021 | 修改金额后统计联动更新 | P0 | ⬜ |
| TC-022 | 修改明细金额为非0值 | P1 | ⬜ |
| TC-023 | 不允许删除明细数据 | P0 | ⬜ |
| TC-024 | 金额修改-负数处理 | P1 | ⬜ |
| TC-030 | 执行完毕-全部设为已执行 | P0 | ⬜ |
| TC-031 | 执行完毕-已执行记录不受影响 | P1 | ⬜ |
| TC-032 | 执行完毕-全部已执行提示 | P2 | ⬜ |
| TC-033 | 执行完毕-不存在人员 | P2 | ⬜ |
| TC-040 | 完整流程端到端测试 | P0 | ⬜ |
| TC-041 | 性能对比-数据量减少 | P1 | ⬜ |
| TC-050 | 无token访问 | P1 | ⬜ |
| TC-051 | 无效token访问 | P1 | ⬜ |
| TC-052 | 无权限用户访问统计 | P1 | ⬜ |
| TC-053 | 无权限用户修改金额 | P1 | ⬜ |

**总计：24 个测试用例（P0: 9个, P1: 11个, P2: 4个）**

---

## 新增API接口说明（需求推导）

根据需求，以下接口为改造新增（需后端开发实现）：

1. **`GET /api/reward-penalty/stats`（改造）**
   - 改造前：返回每人汇总 + 全部明细 records 数组
   - 改造后：只返回每人汇总统计（personTotal、recordCount、pendingCount、executedCount 等），不含明细

2. **`GET /api/reward-penalty/stats/details`（新增）**
   - 参数：`phone`（必填）、`month`（可选）、`execStatus`（可选）
   - 返回：指定人员的所有明细记录列表

3. **`PUT /api/reward-penalty/detail/:id`（新增）**
   - 请求体：`{ "amount": 0 }`
   - 功能：修改明细金额（只能改金额，不能删除记录）

4. **`POST /api/reward-penalty/stats/execute-all/:phone`（新增）**
   - 请求体：`{ "month": "2026-04" }`
   - 功能：将指定人员某月份下所有明细设为已执行

```

## 测试策略
- **只用 API/curl 测试，不需要浏览器测试**
- 核心测试：通过 curl 调用后端API，验证接口逻辑
- 测试数据：先用 sqlite3 查数据库找现成数据，没有就直接 INSERT 创建
- 不要反复调 API 找数据，直接操作数据库更快

## curl 测试示例
```bash
# 查询
curl -s http://127.0.0.1:8088/api/xxx?param=value

# 提交
curl -s -X POST http://127.0.0.1:8088/api/xxx \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## 验证要点
- 状态码是否符合预期（200/400/404）
- 响应体中的 success 字段
- 数据库中的数据是否正确写入

## 验收重点
统计查询性能优化、明细弹框交互、金额修改联动统计更新、执行完毕功能

## 输出要求
- 测试结果写入：/TG/temp/QA-20260418-02/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过
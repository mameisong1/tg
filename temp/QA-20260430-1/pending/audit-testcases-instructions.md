你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 订单管理测试用例

## 测试范围

后台Admin前厅菜单下新增订单管理页面，实现订单表的CRUD（增删改查）。

### 功能点覆盖

| 功能 | API | 状态 |
|------|-----|------|
| 订单列表展示 | GET /api/admin/orders | ✅ 已有 |
| 订单统计 | GET /api/admin/orders/stats | ✅ 已有 |
| 订单详情查看 | GET /api/admin/orders/:id | ❌ 待开发 |
| 订单状态修改（完成） | POST /api/admin/orders/:id/complete | ✅ 已有 |
| 订单状态修改（取消） | POST /api/admin/orders/:id/cancel | ✅ 已有 |
| 订单删除 | DELETE /api/admin/orders/:id | ❌ 待开发 |
| 列表分页筛选 | GET /api/admin/orders (query params) | ✅ 已有 |

---

## 测试地址

| 服务 | 地址 |
|------|------|
| 后端API | http://127.0.0.1:8088 |

**严禁使用 8081 和 8083 端口！**

---

## 前置条件

### 登录获取Token

```bash
# 登录后台管理，获取Token
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mayining633"}'
```

**预期结果**：返回 `{ "success": true, "token": "xxx", "role": "管理员" }`

**注意**：将返回的token值用于后续测试请求的 Authorization header。

---

## P0 核心测试用例

### TC-P0-001: 获取订单列表

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 订单列表展示 |
| API | GET /api/admin/orders |

**操作步骤**：

```bash
# 获取订单列表（默认24小时内，排除已取消）
curl -X GET "http://127.0.0.1:8088/api/admin/orders" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回订单数组，每个订单包含：id, order_no, table_no, items, total_price, status, created_at
- items 为 JSON 数组，包含商品详情（name, price, quantity, subtotal）
- 默认排除已取消订单
- 默认限制24小时内数据

---

### TC-P0-002: 订单列表按状态筛选

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 列表筛选 |
| API | GET /api/admin/orders?status=待处理 |

**操作步骤**：

```bash
# 筛选待处理订单
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=待处理" \
  -H "Authorization: Bearer <TOKEN>"

# 筛选已完成订单
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=已完成" \
  -H "Authorization: Bearer <TOKEN>"

# 筛选已取消订单
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=已取消" \
  -H "Authorization: Bearer <TOKEN>"

# 全部状态（需确认API是否支持）
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=全部" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 各状态筛选返回对应状态的订单列表
- 状态值为：待处理、已完成、已取消
- status=全部 时返回所有订单（包括已取消）

---

### TC-P0-003: 订单列表按日期筛选

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 列表筛选 |
| API | GET /api/admin/orders?date=YYYY-MM-DD |

**操作步骤**：

```bash
# 按单日筛选（使用北京时间日期）
curl -X GET "http://127.0.0.1:8088/api/admin/orders?date=2026-04-30" \
  -H "Authorization: Bearer <TOKEN>"

# 按日期范围筛选
curl -X GET "http://127.0.0.1:8088/api/admin/orders?date_start=2026-04-01&date_end=2026-04-30" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 按日期筛选返回指定日期的订单
- 日期格式为 YYYY-MM-DD（北京时间）
- 日期范围筛选返回范围内的订单

---

### TC-P0-004: 完成订单

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 订单状态修改 |
| API | POST /api/admin/orders/:id/complete |

**前置条件**：需先获取一个待处理状态的订单ID

**操作步骤**：

```bash
# 先查询待处理订单
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=待处理" \
  -H "Authorization: Bearer <TOKEN>"

# 完成订单（替换<ID>为实际订单ID）
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<ID>/complete" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true }`
- 订单状态变更为"已完成"
- updated_at 时间更新

**验证命令**：

```bash
# 验证订单状态已变更
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=已完成" \
  -H "Authorization: Bearer <TOKEN>"
# 查看该订单ID是否在已完成列表中
```

---

### TC-P0-005: 取消订单

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 订单状态修改 |
| API | POST /api/admin/orders/:id/cancel |

**前置条件**：需先获取一个待处理状态的订单ID

**操作步骤**：

```bash
# 取消订单（替换<ID>为实际订单ID）
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<ID>/cancel" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true }`
- 订单状态变更为"已取消"
- updated_at 时间更新

---

### TC-P0-006: 订单统计

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 订单统计 |
| API | GET /api/admin/orders/stats |

**操作步骤**：

```bash
# 获取今日订单统计
curl -X GET "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-30" \
  -H "Authorization: Bearer <TOKEN>"

# 获取指定状态统计
curl -X GET "http://127.0.0.1:8088/api/admin/orders/stats?status=已完成" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true, "data": { "count": 数量, "totalRevenue": 销售额 } }`

---

## P1 重要测试用例

### TC-P1-001: 取消订单中的单个商品

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 订单商品管理 |
| API | POST /api/admin/orders/:id/cancel-item |

**前置条件**：需有包含多个商品的待处理订单

**操作步骤**：

```bash
# 取消订单中的单个商品（部分数量）
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<ID>/cancel-item" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"itemName":"商品名称","cancelQuantity":1}'
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true, "orderEmpty": false, "order": {...} }`
- 订单商品数量减少
- total_price 重新计算

---

### TC-P1-002: 取消订单全部商品（订单自动取消）

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 订单商品管理 |
| API | POST /api/admin/orders/:id/cancel-item |

**操作步骤**：

```bash
# 取消订单中所有商品数量，触发订单自动取消
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<ID>/cancel-item" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"itemName":"商品名称","cancelQuantity":<全部数量>}'
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true, "orderEmpty": true, "message": "订单已无商品,自动取消" }`
- 订单状态自动变为"已取消"
- total_price 变为 0

---

### TC-P1-003: 无权限访问订单接口

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 权限验证 |
| API | GET /api/admin/orders |

**操作步骤**：

```bash
# 不带Token访问
curl -X GET "http://127.0.0.1:8088/api/admin/orders"

# 使用无权限角色的Token（如教练角色）
curl -X GET "http://127.0.0.1:8088/api/admin/orders" \
  -H "Authorization: Bearer <教练TOKEN>"
```

**预期结果**：
- 状态码 401 或 403
- 返回权限错误信息

---

### TC-P1-004: 无效订单ID操作

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 异常处理 |
| API | POST /api/admin/orders/:id/complete |

**操作步骤**：

```bash
# 使用不存在的订单ID
curl -X POST "http://127.0.0.1:8088/api/admin/orders/99999/complete" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 500 或 404
- 返回错误信息

---

### TC-P1-005: 对非待处理订单执行取消商品操作

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 业务规则验证 |
| API | POST /api/admin/orders/:id/cancel-item |

**前置条件**：获取一个已完成或已取消状态的订单ID

**操作步骤**：

```bash
# 对已完成订单尝试取消商品
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<已完成ID>/cancel-item" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"itemName":"商品名称","cancelQuantity":1}'
```

**预期结果**：
- 状态码 400
- 返回 `{ "error": "只能取消待处理订单中的商品" }`

---

### TC-P1-006: 取消商品数量超过实际数量

| 项目 | 内容 |
|------|------|
| 优先级 | P1 |
| 功能 | 参数验证 |
| API | POST /api/admin/orders/:id/cancel-item |

**操作步骤**：

```bash
# 取消数量超过商品实际数量
curl -X POST "http://127.0.0.1:8088/api/admin/orders/<ID>/cancel-item" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"itemName":"商品名称","cancelQuantity":999}'
```

**预期结果**：
- 状态码 400
- 返回 `{ "error": "取消数量超过商品数量(当前X)" }`

---

## P2 次要测试用例

### TC-P2-001: 订单详情查看（待开发）

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 订单详情查看 |
| API | GET /api/admin/orders/:id |
| 状态 | ❌ 待开发 |

**操作步骤**：

```bash
# 获取单个订单详情
curl -X GET "http://127.0.0.1:8088/api/admin/orders/<ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回完整订单信息
- 包含订单商品详情（含图片和类别）

---

### TC-P2-002: 删除订单（待开发）

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 订单删除 |
| API | DELETE /api/admin/orders/:id |
| 状态 | ❌ 待开发 |

**操作步骤**：

```bash
# 删除订单
curl -X DELETE "http://127.0.0.1:8088/api/admin/orders/<ID>" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 状态码 200
- 返回 `{ "success": true }`
- 订单从数据库中删除

**注意**：删除操作应有业务规则限制（如只能删除已取消订单）

---

### TC-P2-003: 订单列表分页验证

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 分页验证 |
| API | GET /api/admin/orders |

**说明**：当前API非待处理查询默认 LIMIT 50，验证返回数据量限制。

**操作步骤**：

```bash
# 验证非待处理查询返回不超过50条
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=已完成" \
  -H "Authorization: Bearer <TOKEN>"
# 检查返回数组长度 <= 50
```

**预期结果**：
- 非待处理状态查询返回不超过50条记录
- 待处理状态无限制

---

### TC-P2-004: 订单商品显示图片和类别

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 商品详情增强 |
| API | GET /api/admin/orders |

**验证点**：订单列表返回的商品是否包含 image_url 和 category 字段。

**操作步骤**：

```bash
curl -X GET "http://127.0.0.1:8088/api/admin/orders" \
  -H "Authorization: Bearer <TOKEN>"
# 检查 items 数组中每个商品是否包含 image_url 和 category
```

**预期结果**：
- 每个商品项包含 image_url（可能为空字符串）
- 每个商品项包含 category（默认为"其他"）

---

### TC-P2-005: 订单列表按日期范围筛选（边界验证）

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 边界测试 |
| API | GET /api/admin/orders |

**操作步骤**：

```bash
# 跨月筛选
curl -X GET "http://127.0.0.1:8088/api/admin/orders?date_start=2026-03-01&date_end=2026-04-30" \
  -H "Authorization: Bearer <TOKEN>"

# 无效日期格式
curl -X GET "http://127.0.0.1:8088/api/admin/orders?date=invalid-date" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 跨月筛选正常返回数据
- 无效日期格式返回错误或空结果

---

### TC-P2-006: 订单统计多条件组合

| 项目 | 内容 |
|------|------|
| 优先级 | P2 |
| 功能 | 统计组合筛选 |
| API | GET /api/admin/orders/stats |

**操作步骤**：

```bash
# 日期 + 状态组合
curl -X GET "http://127.0.0.1:8088/api/admin/orders/stats?date=2026-04-30&status=已完成" \
  -H "Authorization: Bearer <TOKEN>"

# 日期范围组合
curl -X GET "http://127.0.0.1:8088/api/admin/orders/stats?date_start=2026-04-01&date_end=2026-04-30&status=已完成" \
  -H "Authorization: Bearer <TOKEN>"
```

**预期结果**：
- 组合条件正确过滤统计结果

---

## 编码规范验证

### TC-CODE-001: 时间处理使用 TimeUtil

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 编码规范验证 |
| 验证点 | 时间字段使用 TimeUtil.nowDB() / offsetDB() |

**验证方式**：检查API返回的 created_at、updated_at 时间格式是否为北京时间 YYYY-MM-DD HH:mm:ss。

---

### TC-CODE-002: DB操作使用 db/index.js

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 编码规范验证 |
| 验证点 | 所有数据库操作通过 db/index.js |

**验证方式**：API正常返回数据，无数据库连接错误。

---

### TC-CODE-003: DB写入使用 writeQueue

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 编码规范验证 |
| 验证点 | 写入操作使用 enqueueRun() |

**验证方式**：完成/取消订单操作正常，无并发冲突错误。

---

### TC-CODE-004: 不显示 coach_no

| 项目 | 内容 |
|------|------|
| 优先级 | P0 |
| 功能 | 编码规范验证 |
| 验证点 | 订单数据不包含 coach_no 字段 |

**验证方式**：检查订单列表返回数据，确认无 coach_no 字段。

---

## 测试数据准备

### 方案A：使用现有数据

```bash
# 查询现有待处理订单
curl -X GET "http://127.0.0.1:8088/api/admin/orders?status=待处理" \
  -H "Authorization: Bearer <TOKEN>"
# 使用返回的订单ID进行测试
```

### 方案B：创建测试订单（前端创建）

如需创建测试数据，可通过前端下单流程创建订单，或直接使用现有数据。

---

## 测试报告模板

```markdown
# 测试报告

## 执行时间
- 开始时间：YYYY-MM-DD HH:mm:ss
- 结束时间：YYYY-MM-DD HH:mm:ss
- 执行人：测试员B

## 测试结果汇总

| 用例ID | 测试项 | 优先级 | 操作步骤 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|----------|------|
| TC-P0-001 | 获取订单列表 | P0 | curl GET | 返回订单数组 | xxx | ✅通过 |
| TC-P0-002 | 按状态筛选 | P0 | curl GET status=待处理 | 返回待处理订单 | xxx | ✅通过 |
| TC-P0-003 | 按日期筛选 | P0 | curl GET date=2026-04-30 | 返回指定日期订单 | xxx | ✅通过 |
| TC-P0-004 | 完成订单 | P0 | curl POST complete | success:true | xxx | ✅通过 |
| TC-P0-005 | 取消订单 | P0 | curl POST cancel | success:true | xxx | ✅通过 |
| TC-P0-006 | 订单统计 | P0 | curl GET stats | count + totalRevenue | xxx | ✅通过 |

## 通过率统计
- P0用例：X/Y 通过
- P1用例：X/Y 通过
- P2用例：X/Y 通过
- 总通过率：X%

## 问题记录
| 问题ID | 严重程度 | 描述 | 影响范围 | 建议方案 |
|--------|----------|------|----------|----------|
| BUG-001 | 高 | xxx | xxx | xxx |
```

---

## 备注

1. 所有API需携带 Authorization header（Bearer Token）
2. 时间筛选使用北京时间日期格式 YYYY-MM-DD
3. 订单状态值：待处理、已完成、已取消
4. 测试环境验证码：888888（登录时）
5. 测试数据通过API查询获取，不直接操作数据库

---

_测试用例编写完成，等待API开发完成后执行测试验证。_
```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 2/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题
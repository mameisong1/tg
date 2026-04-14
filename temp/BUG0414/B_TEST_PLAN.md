# BUG-0414 测试用例设计文档

## 1. 测试目标

验证 SQLite 事务嵌套冲突 bug 的修复效果：
- 所有数据库写入操作通过 `writeQueue` 串行化
- 不再出现 `SQLITE_ERROR: cannot start a transaction within a transaction`
- 各路由的写操作在修复后正常工作

## 2. 测试环境

- **后端地址**: `http://127.0.0.1:8088`
- **测试环境**: PM2 开发环境 (`TGSERVICE_ENV=test`)
- **数据库**: `/TG/tgservice/db/tgservice.db`
- **认证方式**: 管理员账号登录获取 JWT token

## 3. 测试分类

### 3.1 单元测试 (Unit Tests)

测试 `db/index.js` 中新增的函数：

| 用例ID | 测试名称 | 测试内容 | 预期结果 |
|--------|----------|----------|----------|
| U01 | runInTransaction-commit | 正常提交事务 | 数据写入成功，返回正确结果 |
| U02 | runInTransaction-rollback | 回调抛出异常时自动回滚 | 数据未写入，无异常抛出 |
| U03 | runInTransaction-nested-conflict | 在回调中尝试再次 BEGIN 不会冲突 | 通过写队列串行化 |
| U04 | enqueueRun | 单个写操作排队执行 | 数据写入成功 |
| U05 | enqueueRun-concurrent | 多个 enqueueRun 并发调用 | 按顺序执行，无冲突 |
| U06 | dbTx-recovery | 残留事务时 dbTx 自动恢复 | 写入成功，不报 "cannot start" 错误 |

### 3.2 API 集成测试 (API Integration Tests)

#### 3.2.1 购物车 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| C01 | /api/cart | POST | 添加新商品到购物车 | 无 |
| C02 | /api/cart | POST | 添加已存在商品（数量累加） | 购物车已有该商品 |
| C03 | /api/cart | PUT | 更新商品数量 | 购物车有商品 |
| C04 | /api/cart | PUT | 数量为 0 时删除商品 | 购物车有商品 |
| C05 | /api/cart | DELETE | 删除指定商品 | 购物车有商品 |
| C06 | /api/cart/:sessionId | DELETE | 清空购物车 | 购物车有商品 |
| C07 | /api/cart/table | PUT | 更新购物车台桌号 | 购物车有商品，台桌存在 |

#### 3.2.2 订单 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| O01 | /api/order | POST | 正常下单 | 购物车有商品，有台桌号 |
| O02 | /api/order | POST | 购物车为空 | 购物车无商品 |

#### 3.2.3 服务订单 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| S01 | /api/service-orders | POST | 创建服务单 | 有台桌号和需求 |
| S02 | /api/service-orders | GET | 获取服务单列表 | 已有服务单 |
| S03 | /api/service-orders/:id | GET | 获取单个服务单 | 已有服务单 |
| S04 | /api/service-orders/:id/status | PUT | 更新服务单状态 | 已有服务单 |

#### 3.2.4 教练管理 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| CO01 | /api/coaches/:coach_no/clock-in | POST | 助教上班 | 助教存在，状态允许 |
| CO02 | /api/coaches/:coach_no/clock-out | POST | 助教下班 | 助教已上班 |
| CO03 | /api/coaches/:coach_no/shift | PUT | 修改班次 | 助教存在 |
| CO04 | /api/coaches/batch-shift | PUT | 批量修改班次 | 多个助教存在 |

#### 3.2.5 申请 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| A01 | /api/applications | POST | 提交乐捐报备 | 有手机号和类型 |
| A02 | /api/applications | GET | 获取申请列表 | 已有申请 |
| A03 | /api/applications/:id/approve | PUT | 审批申请 | 有待审批申请 |

#### 3.2.6 邀请 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| G01 | /api/guest-invitations | POST | 提交约客记录 | 助教存在，时间允许 |
| G02 | /api/guest-invitations | GET | 获取约客列表 | 已有记录 |
| G03 | /api/guest-invitations/:id/review | PUT | 审查约客记录 | 有待审查记录 |
| G04 | /api/guest-invitations/check-lock | GET | 检查锁定状态 | 无 |

#### 3.2.7 水牌 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| W01 | /api/water-boards | GET | 获取水牌列表 | 有助教数据 |
| W02 | /api/water-boards/:coach_no/status | PUT | 更新水牌状态 | 助教存在 |

#### 3.2.8 台桌操作订单 API

| 用例ID | 路由 | 方法 | 测试内容 | 前置条件 |
|--------|------|------|----------|----------|
| T01 | /api/table-action-orders | POST | 提交上桌单 | 助教空闲，台桌存在 |
| T02 | /api/table-action-orders | GET | 获取列表 | 已有记录 |
| T03 | /api/table-action-orders/:id/status | PUT | 更新状态 | 已有记录 |

### 3.3 并发测试 (Concurrency Tests)

| 用例ID | 测试名称 | 测试内容 | 预期结果 |
|--------|----------|----------|----------|
| P01 | 并发添加购物车 | 同时发送 5 个 POST /api/cart 请求 | 全部成功，无 "cannot start" 错误 |
| P02 | 并发购物车+订单 | 同时发送购物车操作和订单请求 | 全部成功 |
| P03 | 混合并发写入 | 购物车、教练上班、水牌更新、服务单同时操作 | 全部成功，无事务嵌套错误 |

### 3.4 回归测试 (Regression Tests)

| 用例ID | 测试名称 | 测试内容 | 预期结果 |
|--------|----------|----------|----------|
| R01 | 事务恢复 | 先触发 beginTransaction，再触发购物车操作 | 购物车操作不因残留事务失败 |
| R02 | dbTx 稳定性 | 连续多次 dbTx 调用 | 每次都能正常执行 |

## 4. 测试执行流程

```
1. 登录获取 admin token
2. 执行单元测试
3. 执行 API 集成测试（按模块分组）
4. 执行并发测试
5. 执行回归测试
6. 输出汇总报告
```

## 5. 通过标准

- 所有测试用例 PASS
- 无 `SQLITE_ERROR: cannot start a transaction within a transaction` 错误
- 无 `SQLITE_BUSY` 超时错误
- 数据库数据一致性正确

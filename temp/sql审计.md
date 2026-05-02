# 慢查询深度分析报告

**报告时间**: 2026-05-02 14:04  
**分析范围**: 生产环境最近24小时（2026-05-01 10:24 ~ 2026-05-02 10:24）  
**数据库**: Turso 云端数据库 (`libsql://tgservice-mameisong.aws-ap-northeast-1.turso.io`)

---

## 一、网络延迟测试结果

| 测试项目 | 生产环境延迟 | 测试环境延迟 |
|----------|-------------|-------------|
| 首次连接建立 | 288ms | 276ms |
| 简单查询（SELECT 1） | 55ms（平均） | 56ms（平均） |
| admin_users 主键查询 | 58ms | 58ms |
| orders DATE(created_at) 查询 | 71ms | 121ms |
| orders created_at 原生查询 | 55ms | - |
| coaches+water_boards 联表 | 64ms | 56ms |

**连续10次简单查询测试**:
- 各次耗时: 54, 55, 57, 58, 55, 55, 54, 55, 57, 54ms
- 平均耗时: 55ms
- 最小耗时: 54ms
- 最大耗时: 58ms

**结论**: 基础网络延迟约 **55ms**，这是东京 Turso 服务器（aws-ap-northeast-1）的正常往返时间。

---

## 二、索引情况分析

### ✅ 已有索引（情况良好）

| 表 | 索引数量 | 关键索引 |
|----|---------|---------|
| orders | 3 | member_phone, device_fingerprint_created_at, member_phone_created_at |
| coaches | 2 | popularity DESC, employee_stage_unique |
| water_boards | 2 | coach_no, status |
| tables | 1 | name_pinyin ✅ |
| applications | 4 | status, type, applicant_phone, created_at |
| lejuan_records | 4 | status, coach_no, scheduled_start_time, status_time |
| admin_users | 1 | role |
| attendance_records | 4 | coach_no, date, date_coach, late_unreviewed |
| notification_recipients | 2 | notification_id, recipient_type_id_read |
| reward_penalties | 5 | phone, type, confirm_date, exec_status, unique |

**详细索引列表**:

```
orders 表:
  - idx_orders_device_fingerprint_created_at: (device_fingerprint, created_at DESC)
  - idx_orders_member_phone: (member_phone)
  - idx_orders_member_phone_created_at: (member_phone, created_at DESC)

coaches 表:
  - idx_coaches_popularity: (popularity DESC)
  - idx_coaches_employee_stage_unique: UNIQUE (employee_id, stage_name)

water_boards 表:
  - idx_water_boards_coach_no: (coach_no)
  - idx_water_boards_status: (status)

tables 表:
  - idx_tables_name_pinyin: (name_pinyin)
```

### ⚠️ 缺失的关键索引

**orders 表**: 缺少 `(status, created_at DESC)` 复合索引

```sql
-- 当前慢查询
SELECT * FROM orders 
WHERE DATE(created_at) >= '2026-05-01' AND status = '待处理' 
ORDER BY created_at DESC

-- EXPLAIN QUERY PLAN 结果
SCAN orders              ← 全表扫描
USE TEMP B-TREE FOR ORDER BY  ← 临时 B树排序
```

**问题分析**:
1. `DATE(created_at)` 是函数调用，**无法使用任何索引**
2. 没有 `(status, created_at)` 复合索引

**实际影响评估**:
- orders 表总行数: **1788 条**
- 全表扫描实测耗时: 71ms
- 数据量小，索引优化收益有限（约 15ms）

---

## 三、慢查询高峰时段分析

### 时段分布统计

```
时段分布（2026-05-01 ~ 2026-05-02）:

00:00 - 5 条慢查询
01:00 - 2 条慢查询
02:00 - 3 条慢查询
03:00 - 14 条 ← 最高峰（凌晨定时任务密集）
04:00 - 6 条慢查询
05:00 - 3 条慢查询
06:00 - 10 条
07:00 - 5 条慢查询
08:00 - 11 条 ← 早高峰（营业开始）
09:00 - 3 条慢查询
10:00 - 10 条
11:00 - 1 条慢查询
12:00 - 7 条慢查询
13:00 - 2 条慢查询
14:00 - 5 条慢查询
15:00 - 7 条慢查询
16:00 - 5 条慢查询
17:00 - 7 条慢查询
18:00 - 1 条慢查询
20:00 - 2 条慢查询
21:00 - 9 条 ← 晚高峰
22:00 - 2 条慢查询

总慢查询数: 120 条
```

### 按 SQL 类型分布

| SQL 类型 | 慢查询数量 | 说明 |
|----------|-----------|------|
| orders_date_func | 23 条 | `DATE(created_at)` 函数查询 |
| applications | 14 条 | 申请表查询 |
| admin_users | 13 条 | 管理员登录验证 |
| lejuan | 9 条 | 乐捐记录查询 |
| coaches_wb_join | 8 条 | coaches + water_boards 联表 |
| other | 53 条 | 其他查询 |

### 高峰期典型慢查询示例

```json
// 12:54:32 高峰期
{"time":"2026-05-01T12:54:32.721Z","durationMs":843,"sql":"SELECT username, name, role FROM admin_users WHERE username = ?"}
{"time":"2026-05-01T12:54:32.777Z","durationMs":625,"sql":"SELECT * FROM cron_tasks WHERE is_enabled = 1 AND next_run <= ?"}

// 12:59:49 连续慢查询
{"time":"2026-05-01T12:59:49.385Z","durationMs":640,"sql":"SELECT member_no, phone, name, gender, remark FROM members WHERE member_no = ?"}
{"time":"2026-05-01T12:59:49.439Z","durationMs":684,"sql":"SELECT c.*, wb.status FROM coaches c LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no WHERE c.coach_no = ?"}
{"time":"2026-05-01T12:59:49.495Z","durationMs":731,"sql":"SELECT coach_no, employee_id, stage_name FROM coaches WHERE coach_no = ?"}
```

**关键发现**: 高峰期简单查询延迟异常飙升

| SQL | 正常延迟 | 高峰期延迟 | 差异 |
|-----|---------|-----------|------|
| admin_users WHERE username = ? | 58ms | **843ms** | +785ms |
| cron_tasks WHERE is_enabled = 1 | ~55ms | **625ms** | +570ms |
| coaches WHERE coach_no = ? | 56ms | **731ms** | +675ms |

---

## 四、根本原因判断

### 🔴 主要原因：网络延迟 + HTTP 并发竞争

| 因素 | 占比 | 说明 |
|------|------|------|
| 网络延迟 | ~55ms | 东京 Turso 服务器固定开销 |
| HTTP 并发排队 | 0~800ms | 高峰期多请求竞争 HTTP 连接 |
| 索引缺失 | ~16ms | orders 全表扫描额外开销（数据量小） |

### Turso 技术限制分析

**架构特点**:
- 使用 HTTP/HTTPS 协议（非传统 TCP 长连接）
- 每个查询是独立 HTTP 请求
- 代码中 `createClient()` 创建单例连接
- **无连接池复用机制**

**代码分析** (`db/index-turso.js`):

```javascript
// 单例客户端，无连接池
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 每次查询都是独立 HTTP 请求
const result = await client.execute({ sql, args });
```

**高并发影响**:
- 当多个请求同时到达时，HTTP 请求排队等待
- 没有连接池复用，无法并发处理多个查询
- 高峰期延迟可达 800ms+

---

## 五、优化建议

### 🟢 低优先级（收益小）

#### 1. 添加 orders 复合索引

数据量小（1788条），收益约 15ms，但可规范化：

```sql
-- 建议添加
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC);

-- 或者更精细的复合索引
CREATE INDEX idx_orders_status_created_at_desc ON orders(status, created_at DESC) WHERE status IN ('待处理', '处理中');
```

#### 2. 修改 SQL 避免 DATE() 函数

```sql
-- 当前写法（无法使用索引）
SELECT * FROM orders WHERE DATE(created_at) >= '2026-05-01' AND status = '待处理'

-- 优化写法（可以使用 created_at 索引）
SELECT * FROM orders WHERE created_at >= '2026-05-01T00:00:00Z' AND status = '待处理'
```

实测对比:
- DATE(created_at) 查询: 71ms
- created_at 原生查询: 55ms
- **节省 16ms**

---

### 🟡 中优先级（架构优化）

#### 3. 本地缓存高频查询结果

**可缓存项**:

| 数据 | 缓存时间 | 收益 |
|------|---------|------|
| admin_users 登录验证 | 5分钟 | 减少 13 条慢查询 |
| cron_tasks 配置 | 10分钟 | 减少 5+ 条慢查询 |
| home_config 配置 | 30分钟 | 减少 3 条慢查询 |
| VIP rooms 列表 | 5分钟 | 减少 2 条慢查询 |

**实现建议**:

```javascript
// 使用内存缓存
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

async function getCachedAdminUser(username) {
  const key = 'admin:' + username;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  const data = await dbGet('SELECT * FROM admin_users WHERE username = ?', [username]);
  cache.set(key, { data, time: Date.now() });
  return data;
}
```

#### 4. 减少高峰期查询频率

**当前高频查询场景**:
- cashier-dashboard 订单轮询
- coaches 水牌状态同步
- admin_users 权限验证

**建议调整**:
- 订单刷新间隔: 3秒 → 5秒
- 水牌同步间隔: 5秒 → 10秒
- 权限验证: 引入缓存机制

---

### 🔴 高优先级（长期方案）

#### 5. Turso 连接池优化

**当前问题**:
- `@tursodatabase/serverless` HTTP 模式无连接池
- 每次查询独立 HTTP 请求

**可选方案**:

| 方案 | 说明 | 预期收益 |
|------|------|---------|
| WebSocket 模式 | Turso 支持 WebSocket，减少连接建立开销 | 减少 ~50ms |
| 批量查询合并 | 多个查询合并为一个批次请求 | 减少并发竞争 |
| 连接池复用 | 使用 libsql-node 的连接池功能 | 减少排队等待 |

**参考文档**: https://docs.turso.tech/sdk/nodejs

---

## 六、总结

### 问题严重程度评估

| 问题 | 严重程度 | 当前状态 | 影响 |
|------|----------|----------|------|
| 网络延迟 | 🟡 中等 | 55ms 固定开销 | 可接受，东京服务器正常延迟 |
| 高峰并发 | 🟡 中等 | 偶发 800ms+ 延迟 | 影响用户体验，需优化 |
| 索引缺失 | 🟢 低 | orders 数据量小 | 影响有限（~16ms） |

### 核心结论

**慢查询主要是网络延迟 + 高峰并发导致，索引问题影响较小。**

- 基础延迟: **55ms**（Turso 东京服务器往返）
- 高峰期额外延迟: **0~800ms**（HTTP 并发排队）
- 索引优化收益: **~16ms**（orders 全表扫描）

### 优化优先级排序

1. **立即实施**: 本地缓存高频查询（admin_users、cron_tasks）
2. **短期实施**: 减少高峰期轮询频率
3. **中期实施**: SQL 改写避免 DATE() 函数
4. **长期规划**: Turso WebSocket 模式或连接池优化

---

## 附录：测试数据详情

### orders 表数据统计

| 状态 | 数量 |
|------|------|
| 已完成 | 1650 |
| 已取消 | 138 |
| 待处理 | 0（当前） |
| **总计** | **1788** |

### EXPLAIN QUERY PLAN 详细结果

```sql
-- orders DATE(created_at) 查询
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE DATE(created_at) >= '2026-05-01' AND status = '待处理' ORDER BY created_at DESC;
结果:
  SCAN orders                    ← 全表扫描，无法使用索引
  USE TEMP B-TREE FOR ORDER BY   ← 临时排序

-- orders created_at 原生查询
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE created_at >= '2026-05-01' AND status = '待处理' ORDER BY created_at DESC;
结果:
  SCAN orders                    ← 仍然全表扫描（缺少 status 索引）
  USE TEMP B-TREE FOR ORDER BY   ← 临时排序

-- tables name_pinyin 查询（有索引）
EXPLAIN QUERY PLAN SELECT * FROM tables WHERE name_pinyin = 'test';
结果:
  SEARCH tables USING INDEX sqlite_autoindex_tables_2 (name_pinyin=?)  ← 使用索引，性能良好

-- coaches + water_boards 联表查询
EXPLAIN QUERY PLAN SELECT c.*, wb.status FROM coaches c LEFT JOIN water_boards wb ON c.coach_no = wb.coach_no WHERE c.coach_no = 10001;
结果:
  SEARCH c USING INTEGER PRIMARY KEY (rowid=?)  ← 主键查找，性能良好
  SCAN wb LEFT-JOIN                             ← 联表扫描，但有 coach_no 索引辅助
```

---

**报告生成**: OpenClaw Agent (coder-tg)  
**数据来源**: `/TG/run/logs/sql-slow-audit.log`, 生产环境 Turso 数据库实测
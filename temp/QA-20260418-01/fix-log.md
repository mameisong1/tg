# 奖罚管理功能 Bug 修复日志

**日期**: 2026-04-18
**修复人**: 程序员A
**Git Commit**: 713cfe0

---

## Bug #1 [严重] `/api/reward-penalty/list` 未按用户过滤

- **问题**: 助教登录后返回所有用户的奖罚记录
- **修复**: 在 list 端点中增加用户身份检测，教练用户（userType === 'coach'）自动通过 coachNo 查询 phone，添加 `AND phone = ?` 过滤条件
- **代码位置**: server.js 第 5101 行起
- **影响范围**: `/api/reward-penalty/list` 和 `/api/reward-penalty/stats/summary`

## Bug #2 [严重] 筛选参数触发 SQLITE_RANGE 错误

- **问题**: sumSql 复用 params 数组但 `WHERE 1=1` 没有占位符，导致 SQLite 参数绑定失败
- **修复**: sumSql 现在独立构建 WHERE 条件和 params 数组，与主查询完全镜像
- **代码位置**: server.js 第 5101 行起（list 端点内）
- **根因分析**: 原代码 `const sumParams = [...params]` 复制了主查询的参数，但 sumSql 没有对应的 `?` 占位符

## Bug #3 [中等] 非法 JSON 返回 500 而非 400

- **问题**: 发送非法 JSON 到 PUT/POST 端点返回 500
- **修复**: 
  1. 添加 Express 级错误处理中间件，拦截 `SyntaxError`（status 400）返回 400 JSON 响应
  2. upsert 和 batch-set 端点内添加 `typeof req.body !== 'object'` 校验
- **代码位置**: server.js 第 5556 行（Express 中间件）、第 5034 行（upsert）、第 5331 行（batch-set）

## Bug #4 [中等] 未验证奖罚类型是否在系统配置中

- **问题**: 可以写入任意 type 值到 reward_penalties 表
- **修复**: 
  1. upsert 端点：写入前从 system_config 读取 reward_penalty_types，校验 type 是否在有效列表中
  2. batch-set 端点：同样校验每条记录的 type
- **代码位置**: server.js 第 5034 行（upsert）、第 5331 行（batch-set）

## Bug #5 [中等] 未验证日期格式

- **问题**: confirmDate 可传入任意字符串
- **修复**: 使用正则 `/^\d{4}-\d{2}(-\d{2})?$/` 校验 confirmDate，只接受 YYYY-MM-DD 或 YYYY-MM 格式
- **代码位置**: server.js 第 5034 行（upsert）、第 5331 行（batch-set）

## Bug #6 [中等] 缺少 4 个端点

### 6.1 `GET /api/reward-penalty/my-types`
- **功能**: 获取当前用户可用的奖罚类型
- **权限**: 仅需登录（authMiddleware）
- **实现**: 从 system_config 读取 reward_penalty_types 返回

### 6.2 `POST /api/reward-penalty/batch-set`
- **功能**: 批量设定奖金
- **权限**: coachManagement
- **实现**: 接收 records 数组，逐条 upsert，支持 amount=0 删除。包含 type 验证、日期格式验证
- **返回**: `{ success: true, created, updated, total }`

### 6.3 `POST /api/reward-penalty/unexecute/:id`
- **功能**: 撤销执行
- **权限**: coachManagement
- **实现**: 检查记录存在且状态为"已执行"，将 exec_status 重置为"未执行"，exec_date 置 NULL
- **返回**: `{ success: true }` 或 404/400 错误

### 6.4 `GET /api/reward-penalty/stats/summary`
- **功能**: 金额汇总统计
- **权限**: 仅需登录（教练用户自动按 phone 过滤）
- **返回**: 
  - `total`: 总金额和总条数
  - `breakdown`: 按类型分组统计
  - `byStatus`: 按执行状态分组统计
- **支持筛选参数**: month, type, phone

---

## 编码规范遵守情况

| 规范 | 状态 | 说明 |
|------|------|------|
| 时间处理使用 TimeUtil | ✅ | 所有新增代码使用 `TimeUtil.nowDB()` |
| 数据库连接复用 db/index.js | ✅ | 使用 `dbGet`、`dbAll`、`enqueueRun` |
| 数据库写入使用 enqueueRun | ✅ | 所有写操作使用 `enqueueRun()` |
| 页面禁止显示 coach_no | ✅ | 新增端点未涉及页面显示 |

## 修改文件清单

1. `/TG/tgservice/backend/server.js` — 主文件，包含所有修复

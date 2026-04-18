# 奖罚管理功能 - API 测试结果

> **QA编号**: QA-20260418-01  
> **测试日期**: 2026-04-18  
> **测试员**: B (自动化测试)  
> **后端地址**: http://127.0.0.1:8088 (PM2: tgservice-dev)  
> **数据库**: `/TG/tgservice/db/tgservice.db`

---

## 测试环境说明

- **Admin Token**: tgadmin (管理员角色)
- **Coach Token**: 歪歪 (coachNo=10001, phone=16675852676)
- **实际 API 路径**与测试用例有差异，已按实际代码调整测试
- **实际 DB 列名**: `id` (非 `reward_penalty_no`), `type` (非 `reward_penalty_type`)

---

## 测试结果汇总

| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|------|
| TC-001 | 获取奖罚类型配置 | P0 | 200, 返回3个类型 | 200, 返回3个类型 (`{success:true, types:[...]}`) | ✅通过 |
| TC-002 | 保存奖罚类型配置 | P0 | 200, `{success:true}`, DB正确 | 200, 数据库验证正确 | ✅通过 |
| TC-003 | 唯一键存储验证 | P0 | key=`reward_penalty_types` 存在 | key存在, value为合法JSON | ✅通过 |
| TC-004 | 修改配置后验证 | P1 | 读取返回4个类型 | 4个类型包含"迟到罚金" | ✅通过 |
| TC-005 | 空数组处理 | P1 | 200或400 | 200, `{success:true}` | ✅通过 |
| TC-006 | 非法JSON拒绝 | P2 | 400 | **500** (服务器内部错误) | ❌失败 |
| TC-007 | 无权限访问 | P2 | 401 | 401 `{"error":"未登录"}` | ✅通过 |
| TC-008 | 恢复初始值 | P1 | 200 | 200, 恢复成功 | ✅通过 |
| TC-009 | 奖罚表结构验证 | P0 | 表存在, 字段正确, 唯一索引 | 表存在, 列名`id`/`type`(非测试用例的`reward_penalty_no`/`reward_penalty_type`), 唯一索引正确 | ⚠️通过(列名不同) |
| TC-010 | 唯一约束生效 | P0 | 重复插入失败 | UNIQUE constraint failed 正确触发 | ✅通过 |
| TC-011 | 不同日期可重复 | P0 | 插入成功 | exit code 0 | ✅通过 |
| TC-012 | 不同类型可重复 | P0 | 插入成功 | exit code 0 | ✅通过 |
| TC-013 | 金额可为负数 | P1 | 返回负数 | -20.0 | ✅通过 |
| TC-014 | admin_users 在职字段 | P1 | 存在 employment_status 字段 | 存在, TEXT, 默认'在职' | ✅通过 |
| TC-015 | 默认值验证 | P1 | 现有用户默认'在职' | 所有用户 employment_status='在职' | ✅通过 |
| TC-016 | 修改为离职 | P1 | API成功, DB更新 | 200, DB验证='离职' | ✅通过 |
| TC-017 | 恢复为在职 | P1 | API成功, DB更新 | 200, DB验证='在职' | ✅通过 |
| TC-018 | coaches 表状态字段 | P1 | 存在 status 字段 | 存在 status 字段(默认'全职') | ✅通过 |
| TC-019 | 获取服务员列表 | P0 | 返回服务员列表 | 200, 返回空数组(无服务员用户) | ⚠️通过(无数据) |
| TC-020 | 获取助教列表 | P0 | 返回助教列表 | 200, 返回48个助教 | ✅通过 |
| TC-021 | 写入新记录 | P0 | 200, `{success:true}`, DB验证 | 200, DB验证 amount=50, exec_status='未执行' | ✅通过 |
| TC-022 | 更新已有记录 | P0 | 只一条记录, amount=100 | 200, DB验证 amount=100 (upsert生效) | ✅通过 |
| TC-023 | 输入0元删除 | P0 | 记录被删除 | `{"success":true,"action":"deleted","changes":1}`, COUNT=0 | ✅通过 |
| TC-024 | 罚金(负数金额) | P0 | amount=-30 | -30.0 | ✅通过 |
| TC-025 | 批量设定 | P1 | 两条记录写入成功 | **端点不存在** (`/api/reward-penalty/batch-set` 404) | ❌失败 |
| TC-026 | 缺少必填字段 | P1 | 400 | 400 `{"error":"缺少必要参数"}` | ✅通过 |
| TC-027 | 无效奖罚类型 | P2 | 400 | **200** (未验证类型是否在系统配置中) | ❌失败 |
| TC-028 | 查看自己记录 | P0 | 只返回该助教记录 | **返回所有记录**, 未按用户过滤 | ❌失败(安全漏洞) |
| TC-029 | 按类型筛选 | P0 | 只返回该类型记录 | **500 服务器错误** (`SQLITE_RANGE: column index out of range`) | ❌失败 |
| TC-030 | 按月份筛选(本月) | P0 | 返回本月记录 | **500 服务器错误** (`SQLITE_RANGE: column index out of range`) | ❌失败 |
| TC-031 | 按月份筛选(上月) | P0 | 返回上月记录 | **500 服务器错误** (`SQLITE_RANGE: column index out of range`) | ❌失败 |
| TC-032 | 合计金额统计 | P0 | 包含 total/sumAmount 字段 | `sumAmount: -45, total: 6` (但返回所有用户数据) | ⚠️部分通过 |
| TC-033 | 按角色筛选类型 | P1 | 返回助教相关类型 | **端点不存在** (`/api/reward-penalty/my-types` 404) | ❌失败 |
| TC-034 | 无记录 | P2 | 返回空数组, total=0 | 返回所有用户记录(安全漏洞) | ❌失败 |
| TC-035 | 无token拒绝 | P2 | 401 | 401 `{"error":"未登录"}` | ✅通过 |
| TC-036 | 获取统计列表 | P0 | 返回所有奖罚记录 | 200, 返回分组数据 | ✅通过 |
| TC-037 | 按月筛选(本月) | P0 | 只返回本月记录 | 200, 返回本月记录 | ✅通过 |
| TC-038 | 按月筛选(上月) | P0 | 只返回上月记录 | 200, 返回上月记录 | ✅通过 |
| TC-039 | 按类型筛选 | P0 | 只返回该类型记录 | 200, 只返回"服务日奖" | ✅通过 |
| TC-040 | 按执行状态筛选 | P0 | 只返回"未执行"记录 | 200 (URL编码后) | ✅通过 |
| TC-041 | 单条执行 | P0 | exec_status='已执行' | 200, DB验证='已执行' | ✅通过 |
| TC-042 | 批量执行 | P0 | 所有记录已执行 | 200, 2条记录均='已执行' | ✅通过 |
| TC-043 | 按人员筛选 | P1 | 只返回该手机号记录 | 返回该手机号记录(端点实际不支持phone参数, 碰巧匹配) | ⚠️部分通过 |
| TC-044 | 撤销执行 | P1 | exec_status变回'未执行' | **端点不存在** (`/api/reward-penalty/unexecute/:id` 404) | ❌失败 |
| TC-045 | 金额汇总 | P2 | 返回汇总数据 | **端点不存在** (`/api/reward-penalty/stats/summary` 404) | ❌失败 |
| TC-046 | 完整流程端到端 | P1 | 设奖→查看→执行 全流程成功 | 全流程成功 | ✅通过 |
| TC-047 | 配置变更不影响已有数据 | P1 | 已存在记录不受影响 | 配置变更后记录数不变 | ✅通过 |
| TC-048 | 日期格式验证 | P2 | 400 | **200** (未验证日期格式) | ❌失败 |
| TC-049 | 金额过大值 | P2 | 400或200 | 200 (无上限校验) | ⚠️通过(无校验) |
| TC-050 | 并发写入 | P2 | 只有一条记录 | 只有一条记录(upsert+唯一约束生效) | ✅通过 |

---

## 统计

| 优先级 | 总数 | ✅通过 | ⚠️部分通过 | ❌失败 |
|--------|------|--------|-----------|--------|
| P0 核心 | 26 | 18 | 3 | 5 |
| P1 重要 | 16 | 11 | 1 | 4 |
| P2 次要 | 8 | 3 | 1 | 4 |
| **总计** | **50** | **32** | **5** | **13** |

**通过率**: 32/50 = **64%** (不含⚠️) / 37/50 = **74%** (含⚠️)

---

## 🐛 发现的 Bug 清单

### Bug #1 [严重] `/api/reward-penalty/list` 未按用户过滤 (影响 TC-028, TC-034)
- **问题**: 助教登录后，`/api/reward-penalty/list` 返回**所有**奖罚记录，而非仅该助教的记录
- **代码位置**: `server.js` 第5074行，`list` 端点没有根据 `req.user` 过滤 `phone`
- **安全风险**: 助教可以看到其他所有助教的奖罚信息

### Bug #2 [严重] `/api/reward-penalty/list` 筛选参数导致 SQLITE_RANGE 错误 (影响 TC-029, TC-030, TC-031)
- **问题**: 当传入 `type` 或 `confirmDate` 参数时，报 `SQLITE_RANGE: column index out of range`
- **根因**: `sumSql` 复用 `params` 数组但 `WHERE 1=1` 没有占位符，而 `params` 数组有元素
- **代码位置**: `server.js` 第5102行: `let sumSql = 'SELECT SUM(amount) as sumAmount, COUNT(*) as total FROM reward_penalties WHERE 1=1';` + `const sumParams = [...params];`
- **修复建议**: sumSql 应该有自己的条件拼接，或者 sumParams 应为空数组

### Bug #3 [中等] 非法 JSON 返回 500 而非 400 (影响 TC-006)
- **问题**: 发送非法 JSON body 到 PUT `/api/admin/reward-penalty/types` 返回 500
- **原因**: Express body parser 解析失败后未捕获，进入全局错误处理器
- **预期**: 应该返回 400 Bad Request

### Bug #4 [中等] 未验证奖罚类型是否在系统配置中 (影响 TC-027)
- **问题**: 可以写入任意 `type` 值（如"不存在的类型"），不校验是否在系统配置中
- **代码位置**: `server.js` 第5034行 `upsert` 端点，没有类型校验逻辑

### Bug #5 [中等] 未验证日期格式 (影响 TC-048)
- **问题**: 可以传入任意字符串作为 `confirmDate`（如 "invalid-date"），服务端不校验
- **代码位置**: `server.js` 第5034行 `upsert` 端点，没有日期格式校验

### Bug #6 [中等] 缺少多个端点 (影响 TC-025, TC-033, TC-044, TC-045)
- **缺失端点**:
  - `POST /api/reward-penalty/batch-set` (批量设定奖金)
  - `GET /api/reward-penalty/my-types` (获取当前用户可用的奖罚类型)
  - `POST /api/reward-penalty/unexecute/:id` (撤销执行)
  - `GET /api/reward-penalty/stats/summary` (金额汇总)

### Bug #7 [轻微] `/api/admin/users/:username` PUT 端点路径不同 (影响 TC-016, TC-017)
- **测试用例路径**: `PUT /api/admin/users/13078656656`
- **实际路径**: `PUT /api/admin/users/:username/status`
- **测试用例参数**: `{employment_status: "离职"}`
- **实际参数**: `{employmentStatus: "离职"}` (camelCase)

---

## API 路径/参数差异对照表

| 测试用例 | 实际代码 |
|----------|----------|
| `GET /api/system-config/reward-penalty-types` | `GET /api/admin/reward-penalty/types` (返回 `{types:[...]}`) |
| `PUT /api/system-config/reward-penalty-types` (body: 数组) | `PUT /api/admin/reward-penalty/types` (body: `{types:[...]}`) |
| `POST /api/reward-penalty/set` (body: `reward_penalty_type`, `confirm_date`) | `POST /api/reward-penalty/upsert` (body: `type`, `confirmDate`) |
| `GET /api/reward-penalty/my-records` | `GET /api/reward-penalty/list` (query: `type`, `confirmDate`, `phone`, `execStatus`) |
| `POST /api/reward-penalty/:id/execute` | `POST /api/reward-penalty/execute/:id` |
| `GET /api/reward-penalty/targets?reward_type=xxx` | `GET /api/reward-penalty/targets?role=服务员/助教` |
| `PUT /api/admin/users/:username` | `PUT /api/admin/users/:username/status` |

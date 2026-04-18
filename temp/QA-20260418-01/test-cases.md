# 奖罚管理功能 - API 测试用例

> **QA编号**: QA-20260418-01  
> **测试日期**: 2026-04-18  
> **测试策略**: 纯 API/curl 测试，直接操作 SQLite 数据库准备数据  
> **后端地址**: http://127.0.0.1:8088  
> **数据库**: `/TG/tgservice/db/tgservice.db`

---

## 0. 测试准备

### 0.1 获取 Admin Token（店长角色）

```bash
# 用店长角色登录（店长有全部权限，可测试所有功能）
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"18680174119","password":""}' | jq -r '.token')

echo "Admin Token: $ADMIN_TOKEN"
```

> **注**: 如果密码为空无法登录，需要先通过 sqlite3 查看/设置密码：
> ```bash
> sqlite3 /TG/tgservice/db/tgservice.db "SELECT username, role, substr(password,1,10) FROM admin_users WHERE username='18680174119';"
> ```

### 0.2 获取 Coach Token（助教/服务员角色）

```bash
# 助教登录（employee_id=1, stage_name=歪歪, id_card_last6=201345）
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","stageName":"歪歪","idCardLast6":"201345"}' | jq -r '.token')

echo "Coach Token: $COACH_TOKEN"
```

### 0.3 准备测试数据

```bash
# 查看现有教练数据
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, employee_id, stage_name, real_name, phone, status FROM coaches LIMIT 10;"

# 确认 system_config 表结构
sqlite3 /TG/tgservice/db/tgservice.db ".schema system_config"

# 如果有 member 手机号，也查一下
sqlite3 /TG/tgservice/db/tgservice.db "SELECT member_no, phone, name FROM members LIMIT 5;"
```

---

## 1. 系统配置 - 奖罚类型设定 (P0)

**需求**: 系统配置页面新增奖罚类型设定，以 JSON 存储在 system_config 表。

**初始值**: `[{"奖罚类型":"服务日奖", "对象":"服务员"}, {"奖罚类型":"未约客罚金", "对象":"助教"}, {"奖罚类型":"漏单罚金", "对象":"助教"}]`

### TC-001 [P0] 获取系统奖罚类型配置

**目的**: 验证可以读取奖罚类型配置

```bash
curl -s http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 返回 JSON 数组，包含三个奖罚类型
- ✅ 每个对象包含 `奖罚类型` 和 `对象` 字段

### TC-002 [P0] 保存奖罚类型配置

**目的**: 验证可以写入奖罚类型配置到 system_config 表

```bash
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]' | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 返回 `{"success": true}`
- ✅ 数据库验证：`sqlite3 /TG/tgservice/db/tgservice.db "SELECT value FROM system_config WHERE key='reward_penalty_types';"` 返回正确 JSON

### TC-003 [P0] 奖罚类型配置 - 唯一键存储验证

**目的**: 验证配置正确存储在 system_config 表中，key 为 `reward_penalty_types`

```bash
# 先写入配置
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"}]' | jq .

# 直接查数据库验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT key, value FROM system_config WHERE key='reward_penalty_types';"
```

**预期结果**:
- ✅ system_config 表中 key=`reward_penalty_types` 的记录存在
- ✅ value 字段存储为合法的 JSON 字符串

### TC-004 [P1] 奖罚类型配置 - 修改后验证

**目的**: 验证修改配置后能正确更新

```bash
# 修改配置（增加一个类型）
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"},{"奖罚类型":"迟到罚金","对象":"助教"}]' | jq .

# 读取验证
curl -s http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 读取返回 4 个奖罚类型
- ✅ 新增的 "迟到罚金" 出现在返回列表中

### TC-005 [P1] 奖罚类型配置 - 空数组

**目的**: 验证清空配置的处理

```bash
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[]' | jq .
```

**预期结果**:
- ✅ 状态码 200 或 400（取决于是否允许空配置）
- ✅ 如果允许，数据库 value 应为 `[]`

### TC-006 [P2] 奖罚类型配置 - 非法 JSON 格式

**目的**: 验证非法 JSON 被拒绝

```bash
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d 'not json' | jq .
```

**预期结果**:
- ✅ 状态码 400
- ✅ 返回错误信息

### TC-007 [P2] 奖罚类型配置 - 无权限访问

**目的**: 验证未登录用户无法修改配置

```bash
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Content-Type: application/json" \
  -d '[]' | jq .
```

**预期结果**:
- ✅ 状态码 401

### TC-008 [P1] 奖罚类型配置 - 恢复初始值

**目的**: 恢复初始配置供后续测试使用

```bash
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]' | jq .
```

---

## 2. 数据库 - 奖罚表 (P0)

**需求**: 新增奖罚表，字段包含：奖罚No(自增主键)、奖罚类型、确定日期、手机号、姓名、金额、备注、执行状态、执行日期。唯一约束：确定日期+奖罚类型+手机号。

### TC-009 [P0] 奖罚表结构验证

**目的**: 验证 reward_penalties 表创建成功，结构正确

```bash
sqlite3 /TG/tgservice/db/tgservice.db ".schema reward_penalties"
```

**预期结果**:
- ✅ 表存在
- ✅ 包含字段：reward_penalty_no (INTEGER PRIMARY KEY AUTOINCREMENT), reward_penalty_type (TEXT), confirm_date (TEXT), phone (TEXT), name (TEXT), amount (REAL), remark (TEXT), exec_status (TEXT DEFAULT '未执行'), exec_date (TEXT)
- ✅ 存在唯一约束: `UNIQUE(confirm_date, reward_penalty_type, phone)`

### TC-010 [P0] 奖罚表 - 唯一约束生效测试

**目的**: 验证唯一约束 (确定日期 + 奖罚类型 + 手机号) 生效

```bash
# 插入第一条
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('服务日奖', '2026-04-18', '16675852676', '歪歪', 50, '未执行');"

# 插入重复记录（应失败）
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('服务日奖', '2026-04-18', '16675852676', '歪歪', 100, '未执行');" 2>&1
```

**预期结果**:
- ✅ 第一条插入成功
- ✅ 第二条插入失败，报 `UNIQUE constraint failed` 错误

### TC-011 [P0] 奖罚表 - 不同日期可重复

**目的**: 同一人同类型不同日期可以存在

```bash
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('服务日奖', '2026-04-17', '16675852676', '歪歪', 30, '未执行');"
echo "exit code: $?"
```

**预期结果**:
- ✅ 插入成功（exit code 0）

### TC-012 [P0] 奖罚表 - 不同类型可重复

**目的**: 同一人同日期不同类型可以存在

```bash
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('未约客罚金', '2026-04-18', '16675852676', '歪歪', -20, '未执行');"
echo "exit code: $?"
```

**预期结果**:
- ✅ 插入成功（exit code 0）

### TC-013 [P1] 奖罚表 - 金额可为负数（罚金）

**目的**: 验证罚金金额为负数

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT amount FROM reward_penalties WHERE reward_penalty_type='未约客罚金';"
```

**预期结果**:
- ✅ 返回值为负数（如 -20）

---

## 3. 后台用户表 - 在职状态 (P1)

**需求**: admin_users 表新增在职状态字段（在职/离职），默认在职。

### TC-014 [P1] admin_users 表在职状态字段验证

**目的**: 验证字段添加成功

```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(admin_users);"
```

**预期结果**:
- ✅ 存在 `employment_status` 或类似名称的字段
- ✅ 类型为 TEXT
- ✅ 默认值为 '在职'

### TC-015 [P1] 在职状态 - 默认值验证

**目的**: 验证现有用户默认为在职

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT username, role, employment_status FROM admin_users WHERE employment_status IS NOT NULL LIMIT 5;"
```

**预期结果**:
- ✅ 返回的用户 employment_status 为 '在职'

### TC-016 [P1] 在职状态 - 修改为离职

**目的**: 验证可通过 API 修改在职状态

```bash
# 注意：用测试用户，不要用 tgadmin！
curl -s -X PUT http://127.0.0.1:8088/api/admin/users/13078656656 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employment_status":"离职"}' | jq .

# 数据库验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT username, employment_status FROM admin_users WHERE username='13078656656';"
```

**预期结果**:
- ✅ API 返回 success
- ✅ 数据库中该用户 employment_status = '离职'

### TC-017 [P1] 在职状态 - 恢复为在职

```bash
curl -s -X PUT http://127.0.0.1:8088/api/admin/users/13078656656 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employment_status":"在职"}' | jq .
```

### TC-018 [P1] coaches 表在职状态字段验证

**目的**: 教练/服务员表也需要在职状态（奖金设定页面要排除离职人员）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "PRAGMA table_info(coaches);" | grep -i "status\|employ"
```

**预期结果**:
- ✅ coaches 表已有 status 字段（当前使用：全职/其他）
- ✅ 或者新增了 employment_status 字段（在职/离职）

> **注意**: 根据需求，教练表已存在 `status` 字段，需确认是否复用此字段或新增 `employment_status`。需求中说的是"后台用户表新增在职状态"，可能指的是 admin_users 表。

---

## 4. 奖金设定 - 店长给服务员设日奖 (P0)

**需求**: 店长可给服务员设定每日奖金。页面参数：奖罚类型=服务日奖。卡片快捷按钮 10/20/50 元，也可自定义输入。输入 0 元即删除。所有操作无需确认直接执行。

### TC-019 [P0] 获取奖罚对象列表（服务员）

**目的**: 根据系统配置中"服务日奖"的对象=服务员，列出所有在职服务员

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/targets?reward_type=服务日奖" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 返回服务员列表（从 coaches 或 members 表中筛选对象=服务员的用户）
- ✅ 排除已离职的用户

### TC-020 [P0] 获取奖罚对象列表（助教）

**目的**: 根据系统配置中"未约客罚金"的对象=助教，列出所有在职助教

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/targets?reward_type=未约客罚金" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回助教列表（coaches 表中 status != '离职' 的记录）

### TC-021 [P0] 设定奖金 - 写入新记录

**目的**: 店长为服务员设定今日奖金 50 元

```bash
# 先清理测试数据
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone='16675852676' AND confirm_date=date('now','+8 hours') AND reward_penalty_type='服务日奖';"

curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "服务日奖",
    "confirm_date": "'"$(date -u -d '+8 hours' '+%Y-%m-%d')"'",
    "phone": "16675852676",
    "name": "歪歪",
    "amount": 50,
    "remark": "表现优秀"
  }' | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 返回 `{"success": true}`
- ✅ 数据库验证：`sqlite3 /TG/tgservice/db/tgservice.db "SELECT * FROM reward_penalties WHERE phone='16675852676' AND reward_penalty_type='服务日奖' ORDER BY rowid DESC LIMIT 1;"`
- ✅ 返回记录 amount=50, exec_status='未执行'

### TC-022 [P0] 设定奖金 - 更新已有记录

**目的**: 同一人同日同类型的奖金应更新而非新增

```bash
# 重复设定（金额改为 100）
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "服务日奖",
    "confirm_date": "'"$(date -u -d '+8 hours' '+%Y-%m-%d')"'",
    "phone": "16675852676",
    "name": "歪歪",
    "amount": 100
  }' | jq .

# 验证：应只有一条记录，金额更新为 100
sqlite3 /TG/tgservice/db/tgservice.db "SELECT amount, remark FROM reward_penalties WHERE phone='16675852676' AND reward_penalty_type='服务日奖' ORDER BY rowid DESC LIMIT 1;"
```

**预期结果**:
- ✅ 只有一条记录
- ✅ amount = 100（更新了金额）

### TC-023 [P0] 设定奖金 - 输入 0 元删除记录

**目的**: 输入 0 元应删除对应的奖罚记录

```bash
# 输入 0 元
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "服务日奖",
    "confirm_date": "'"$(date -u -d '+8 hours' '+%Y-%m-%d')"'",
    "phone": "16675852676",
    "name": "歪歪",
    "amount": 0
  }' | jq .

# 验证：记录应被删除
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM reward_penalties WHERE phone='16675852676' AND reward_penalty_type='服务日奖' AND confirm_date='$(date -u -d '+8 hours' '+%Y-%m-%d')';"
```

**预期结果**:
- ✅ 状态码 200
- ✅ 数据库 COUNT(*) = 0（记录已删除）

### TC-024 [P0] 设定奖金 - 罚金（负数金额）

**目的**: 助教罚金金额为负数

```bash
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')

# 先清理
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone='18775703862' AND confirm_date='$TODAY';"

curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "未约客罚金",
    "confirm_date": "'$TODAY'",
    "phone": "18775703862",
    "name": "陆飞",
    "amount": -30,
    "remark": "未约客"
  }' | jq .

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT amount FROM reward_penalties WHERE phone='18775703862' AND reward_penalty_type='未约客罚金' AND confirm_date='$TODAY';"
```

**预期结果**:
- ✅ amount = -30

### TC-025 [P1] 设定奖金 - 批量设定

**目的**: 可一次性为多个服务员设定奖金

```bash
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/batch-set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "服务日奖",
    "confirm_date": "'"$(date -u -d '+8 hours' '+%Y-%m-%d')"'",
    "records": [
      {"phone": "16675852676", "name": "歪歪", "amount": 20},
      {"phone": "18775703862", "name": "陆飞", "amount": 30}
    ]
  }' | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 两条记录都写入成功

### TC-026 [P1] 设定奖金 - 缺少必填字段

**目的**: 验证必填字段校验

```bash
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type": "服务日奖"}' | jq .
```

**预期结果**:
- ✅ 状态码 400
- ✅ 返回错误信息，提示缺少必填字段

### TC-027 [P2] 设定奖金 - 无效的奖罚类型

**目的**: 验证奖罚类型必须在系统配置中

```bash
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reward_penalty_type": "不存在的类型",
    "confirm_date": "'"$(date -u -d '+8 hours' '+%Y-%m-%d')"'",
    "phone": "16675852676",
    "name": "歪歪",
    "amount": 10
  }' | jq .
```

**预期结果**:
- ✅ 状态码 400
- ✅ 返回错误信息

---

## 5. 奖金查看 - 服务员/助教查看自己奖罚明细 (P0)

**需求**: 服务员和助教可查看自己奖罚情况。筛选：本月/上月、奖罚类型。显示奖罚明细和合计金额。按角色筛选奖罚类型。

### TC-028 [P0] 查看自己的奖罚明细（助教视角）

**目的**: 助教登录后只能看到自己的奖罚记录

```bash
# 先准备数据
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('未约客罚金', '$TODAY', '18775703862', '陆飞', -30, '未执行');"

# 用助教 token 查询自己的奖罚
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回该助教的奖罚记录列表
- ✅ 包含刚才插入的 -30 元记录
- ✅ 不包含其他助教的记录

### TC-029 [P0] 查看奖罚明细 - 按奖罚类型筛选

**目的**: 可按奖罚类型筛选

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records?reward_type=未约客罚金" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回"未约客罚金"类型的记录

### TC-030 [P0] 查看奖罚明细 - 按日期筛选（本月）

**目的**: 筛选本月记录

```bash
THIS_MONTH=$(date -u -d '+8 hours' '+%Y-%m')
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records?month=$THIS_MONTH" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回本月记录
- ✅ 不包含上月记录

### TC-031 [P0] 查看奖罚明细 - 按日期筛选（上月）

```bash
LAST_MONTH=$(date -u -d '+8 hours -1 month' '+%Y-%m')
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records?month=$LAST_MONTH" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回上月记录（如果有）
- ✅ 不包含本月记录

### TC-032 [P0] 查看奖罚明细 - 统计合计金额

**目的**: 返回的记录包含合计金额

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回数据中包含 `total_amount` 字段
- ✅ total_amount = 所有记录 amount 之和（正数奖金 + 负数罚金）

### TC-033 [P1] 查看奖罚明细 - 按角色筛选奖罚类型

**目的**: 助教只能看到助教的奖罚类型（未约客罚金、漏单罚金），服务员只能看到服务员的奖罚类型（服务日奖）

```bash
# 助教登录后获取可用的奖罚类型
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-types" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回 ["未约客罚金", "漏单罚金"]（助教相关的类型）
- ✅ 不包含 "服务日奖"

### TC-034 [P2] 查看奖罚明细 - 无记录

**目的**: 用户没有奖罚记录时返回空列表

```bash
# 用一个没有奖罚记录的助教登录
NO_RECORD_COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"3","stageName":"六六","idCardLast6":"251429"}' | jq -r '.token')

curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records" \
  -H "Authorization: Bearer $NO_RECORD_COACH_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回空数组 `[]`
- ✅ total_amount = 0

### TC-035 [P2] 查看奖罚明细 - 无 token

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records" | jq .
```

**预期结果**:
- ✅ 状态码 401

---

## 6. 奖罚统计 - 后台 admin 人事目录 (P0)

**需求**: 后台 admin 左侧菜单新增人事目录，内设奖罚管理页面。筛选：本月/上月、奖罚类型。可对每条数据设置已执行，也可批量执行。

### TC-036 [P0] 获取奖罚统计列表

**目的**: 人事可查看奖罚统计数据

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 状态码 200
- ✅ 返回所有奖罚记录列表
- ✅ 每条记录包含：姓名、手机号、奖罚类型、确定日期、金额、执行状态、执行日期

### TC-037 [P0] 奖罚统计 - 按月份筛选（本月）

```bash
THIS_MONTH=$(date -u -d '+8 hours' '+%Y-%m')
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=$THIS_MONTH" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回本月记录

### TC-038 [P0] 奖罚统计 - 按月份筛选（上月）

```bash
LAST_MONTH=$(date -u -d '+8 hours -1 month' '+%Y-%m')
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=$LAST_MONTH" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回上月记录

### TC-039 [P0] 奖罚统计 - 按奖罚类型筛选

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?reward_type=服务日奖" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回"服务日奖"类型的记录

### TC-040 [P0] 奖罚统计 - 按执行状态筛选

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?exec_status=未执行" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回"未执行"的记录

### TC-041 [P0] 执行单条奖罚（标记为已执行）

**目的**: 人事可逐条标记奖罚为已执行

```bash
# 先准备一条未执行的数据
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone='16675852676' AND reward_penalty_type='服务日奖' AND confirm_date='$TODAY';"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('服务日奖', '$TODAY', '16675852676', '歪歪', 50, '未执行');"
REWARD_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT reward_penalty_no FROM reward_penalties WHERE phone='16675852676' AND reward_penalty_type='服务日奖' AND confirm_date='$TODAY';")

# 标记为已执行
EXEC_DATE=$(date -u -d '+8 hours' '+%Y-%m-%d %H:%M:%S')
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/$REWARD_NO/execute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exec_date": "'$EXEC_DATE'"}' | jq .

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT exec_status, exec_date FROM reward_penalties WHERE reward_penalty_no=$REWARD_NO;"
```

**预期结果**:
- ✅ API 返回 success
- ✅ 数据库 exec_status = '已执行'
- ✅ exec_date = 执行日期

### TC-042 [P0] 批量执行奖罚

**目的**: 勾选多条记录批量标记为已执行

```bash
# 准备多条未执行数据
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE confirm_date='$TODAY' AND reward_penalty_type='服务日奖';"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES 
  ('服务日奖', '$TODAY', '16675852676', '歪歪', 20, '未执行'),
  ('服务日奖', '$TODAY', '18775703862', '陆飞', 30, '未执行');"

# 获取 reward_penalty_no
IDS=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT GROUP_CONCAT(reward_penalty_no) FROM reward_penalties WHERE confirm_date='$TODAY' AND reward_penalty_type='服务日奖';")

# 批量执行
EXEC_DATE=$(date -u -d '+8 hours' '+%Y-%m-%d %H:%M:%S')
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/batch-execute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ['"$IDS"'], "exec_date": "'$EXEC_DATE'"}' | jq .

# 验证：所有记录都变为已执行
sqlite3 /TG/tgservice/db/tgservice.db "SELECT reward_penalty_no, exec_status, exec_date FROM reward_penalties WHERE confirm_date='$TODAY' AND reward_penalty_type='服务日奖';"
```

**预期结果**:
- ✅ 所有记录 exec_status = '已执行'
- ✅ 所有记录 exec_date = 执行日期

### TC-043 [P1] 奖罚统计 - 按人员筛选

**目的**: 可按姓名或手机号筛选特定人员的奖罚

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?phone=16675852676" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 只返回该手机号的记录

### TC-044 [P1] 撤销执行（已执行 → 未执行）

**目的**: 可撤销已执行的奖罚

```bash
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
REWARD_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT reward_penalty_no FROM reward_penalties WHERE confirm_date='$TODAY' AND reward_penalty_type='服务日奖' LIMIT 1;")

curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/$REWARD_NO/unexecute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT exec_status FROM reward_penalties WHERE reward_penalty_no=$REWARD_NO;"
```

**预期结果**:
- ✅ exec_status 变回 '未执行'

### TC-045 [P2] 奖罚统计 - 金额汇总

**目的**: 统计页面应显示汇总金额

```bash
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats/summary?month=$(date -u -d '+8 hours' '+%Y-%m')" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

**预期结果**:
- ✅ 返回汇总数据，包含：总奖金、总罚金、净奖罚金额
- ✅ 可按奖罚类型分组统计

---

## 7. 综合集成测试 (P1)

### TC-046 [P1] 完整流程：店长设奖 → 服务员查看 → 人事执行

**目的**: 端到端验证完整业务流程

```bash
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
PHONE="16675852676"
NAME="歪歪"

# Step 1: 确保系统配置正确
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]' > /dev/null

# Step 2: 清理旧数据
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone='$PHONE' AND confirm_date='$TODAY' AND reward_penalty_type='服务日奖';"

# Step 3: 店长设定奖金
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type":"服务日奖","confirm_date":"'$TODAY'","phone":"'$PHONE'","name":"'$NAME'","amount":50}' > /dev/null

# Step 4: 服务员查看自己的奖罚
curl -s "http://127.0.0.1:8088/api/reward-penalty/my-records?month=$(echo $TODAY | cut -c1-7)" \
  -H "Authorization: Bearer $COACH_TOKEN" | jq '.records[] | select(.reward_penalty_type=="服务日奖")'

# Step 5: 人事查看统计
curl -s "http://127.0.0.1:8088/api/reward-penalty/stats?month=$(echo $TODAY | cut -c1-7)&reward_type=服务日奖" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.records[] | select(.phone=="'$PHONE'")'

# Step 6: 人事执行奖罚
REWARD_NO=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT reward_penalty_no FROM reward_penalties WHERE phone='$PHONE' AND confirm_date='$TODAY' AND reward_penalty_type='服务日奖';")
curl -s -X POST "http://127.0.0.1:8088/api/reward-penalty/$REWARD_NO/execute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exec_date":"'$TODAY'"}' > /dev/null

# Step 7: 验证执行状态
sqlite3 /TG/tgservice/db/tgservice.db "SELECT exec_status FROM reward_penalties WHERE reward_penalty_no=$REWARD_NO;"
echo "✅ 应返回: 已执行"
```

### TC-047 [P1] 奖罚类型变更后的影响

**目的**: 修改系统配置中的奖罚类型后，查看已存在的奖罚记录不受影响

```bash
# 先写入一条记录
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO reward_penalties (reward_penalty_type, confirm_date, phone, name, amount, exec_status) VALUES ('服务日奖', '$TODAY', '16675852676', '歪歪', 50, '未执行');"

# 修改系统配置（删除服务日奖）
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]' > /dev/null

# 查看该记录是否还存在
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM reward_penalties WHERE reward_penalty_type='服务日奖' AND confirm_date='$TODAY';"
echo "✅ 应返回: 1（已存在的记录不受配置变更影响）"

# 恢复配置
curl -s -X PUT http://127.0.0.1:8088/api/system-config/reward-penalty-types \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"奖罚类型":"服务日奖","对象":"服务员"},{"奖罚类型":"未约客罚金","对象":"助教"},{"奖罚类型":"漏单罚金","对象":"助教"}]' > /dev/null
```

---

## 8. 边界/异常测试 (P2)

### TC-048 [P2] 日期格式验证

```bash
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type":"服务日奖","confirm_date":"invalid-date","phone":"16675852676","name":"歪歪","amount":50}' | jq .
```

**预期结果**:
- ✅ 状态码 400

### TC-049 [P2] 金额过大值

```bash
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type":"服务日奖","confirm_date":"2026-04-18","phone":"16675852676","name":"歪歪","amount":999999999}' | jq .
```

**预期结果**:
- ✅ 状态码 400 或 200（取决于是否有上限校验）

### TC-050 [P2] 并发写入测试

**目的**: 同一人同日同类型并发写入，验证唯一约束

```bash
TODAY=$(date -u -d '+8 hours' '+%Y-%m-%d')
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone='16675852676' AND confirm_date='$TODAY' AND reward_penalty_type='服务日奖';"

# 并发发送两个请求
curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type":"服务日奖","confirm_date":"'$TODAY'","phone":"16675852676","name":"歪歪","amount":50}' &

curl -s -X POST http://127.0.0.1:8088/api/reward-penalty/set \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reward_penalty_type":"服务日奖","confirm_date":"'$TODAY'","phone":"16675852676","name":"歪歪","amount":100}' &

wait

# 验证：只有一条记录
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*), amount FROM reward_penalties WHERE phone='16675852676' AND confirm_date='$TODAY' AND reward_penalty_type='服务日奖' GROUP BY reward_penalty_no;"
```

**预期结果**:
- ✅ 只有一条记录（另一个请求因唯一约束失败或被更新覆盖）

---

## 测试数据清理脚本

```bash
# 测试完成后清理所有测试数据
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM reward_penalties WHERE phone IN ('16675852676', '18775703862', '19814455887');"

# 恢复 admin_users 在职状态
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE admin_users SET employment_status='在职' WHERE username='13078656656';"

# 恢复系统配置
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE system_config SET value='[{\"奖罚类型\":\"服务日奖\",\"对象\":\"服务员\"},{\"奖罚类型\":\"未约客罚金\",\"对象\":\"助教\"},{\"奖罚类型\":\"漏单罚金\",\"对象\":\"助教\"}]' WHERE key='reward_penalty_types';"
```

---

## 测试用例汇总表

| 编号 | 优先级 | 功能模块 | 测试点 | 状态 |
|------|--------|----------|--------|------|
| TC-001 | P0 | 系统配置 | 获取奖罚类型配置 | ⬜ |
| TC-002 | P0 | 系统配置 | 保存奖罚类型配置 | ⬜ |
| TC-003 | P0 | 系统配置 | JSON 存储验证 | ⬜ |
| TC-004 | P1 | 系统配置 | 修改配置后验证 | ⬜ |
| TC-005 | P1 | 系统配置 | 空数组处理 | ⬜ |
| TC-006 | P2 | 系统配置 | 非法 JSON 拒绝 | ⬜ |
| TC-007 | P2 | 系统配置 | 无权限拒绝 | ⬜ |
| TC-008 | P1 | 系统配置 | 恢复初始值 | ⬜ |
| TC-009 | P0 | 数据库表 | 表结构验证 | ⬜ |
| TC-010 | P0 | 数据库表 | 唯一约束生效 | ⬜ |
| TC-011 | P0 | 数据库表 | 不同日期可重复 | ⬜ |
| TC-012 | P0 | 数据库表 | 不同类型可重复 | ⬜ |
| TC-013 | P1 | 数据库表 | 金额可为负数 | ⬜ |
| TC-014 | P1 | 在职状态 | admin_users 字段验证 | ⬜ |
| TC-015 | P1 | 在职状态 | 默认值验证 | ⬜ |
| TC-016 | P1 | 在职状态 | 修改为离职 | ⬜ |
| TC-017 | P1 | 在职状态 | 恢复为在职 | ⬜ |
| TC-018 | P1 | 在职状态 | coaches 表字段验证 | ⬜ |
| TC-019 | P0 | 奖金设定 | 获取服务员列表 | ⬜ |
| TC-020 | P0 | 奖金设定 | 获取助教列表 | ⬜ |
| TC-021 | P0 | 奖金设定 | 写入新记录 | ⬜ |
| TC-022 | P0 | 奖金设定 | 更新已有记录 | ⬜ |
| TC-023 | P0 | 奖金设定 | 输入0元删除 | ⬜ |
| TC-024 | P0 | 奖金设定 | 罚金（负数金额） | ⬜ |
| TC-025 | P1 | 奖金设定 | 批量设定 | ⬜ |
| TC-026 | P1 | 奖金设定 | 缺少必填字段 | ⬜ |
| TC-027 | P2 | 奖金设定 | 无效奖罚类型 | ⬜ |
| TC-028 | P0 | 奖金查看 | 查看自己记录 | ⬜ |
| TC-029 | P0 | 奖金查看 | 按类型筛选 | ⬜ |
| TC-030 | P0 | 奖金查看 | 按月份筛选（本月） | ⬜ |
| TC-031 | P0 | 奖金查看 | 按月份筛选（上月） | ⬜ |
| TC-032 | P0 | 奖金查看 | 合计金额统计 | ⬜ |
| TC-033 | P1 | 奖金查看 | 按角色筛选类型 | ⬜ |
| TC-034 | P2 | 奖金查看 | 无记录 | ⬜ |
| TC-035 | P2 | 奖金查看 | 无 token 拒绝 | ⬜ |
| TC-036 | P0 | 奖罚统计 | 获取统计列表 | ⬜ |
| TC-037 | P0 | 奖罚统计 | 按月筛选（本月） | ⬜ |
| TC-038 | P0 | 奖罚统计 | 按月筛选（上月） | ⬜ |
| TC-039 | P0 | 奖罚统计 | 按类型筛选 | ⬜ |
| TC-040 | P0 | 奖罚统计 | 按执行状态筛选 | ⬜ |
| TC-041 | P0 | 奖罚统计 | 单条执行 | ⬜ |
| TC-042 | P0 | 奖罚统计 | 批量执行 | ⬜ |
| TC-043 | P1 | 奖罚统计 | 按人员筛选 | ⬜ |
| TC-044 | P1 | 奖罚统计 | 撤销执行 | ⬜ |
| TC-045 | P2 | 奖罚统计 | 金额汇总 | ⬜ |
| TC-046 | P1 | 集成测试 | 完整流程端到端 | ⬜ |
| TC-047 | P1 | 集成测试 | 配置变更不影响已有数据 | ⬜ |
| TC-048 | P2 | 异常测试 | 日期格式验证 | ⬜ |
| TC-049 | P2 | 异常测试 | 金额过大值 | ⬜ |
| TC-050 | P2 | 异常测试 | 并发写入 | ⬜ |

**总计**: 50 条测试用例
- P0 核心: 26 条
- P1 重要: 16 条
- P2 次要: 8 条

---

## 验收重点映射

| 验收重点 | 覆盖用例 |
|----------|----------|
| 1. 系统配置正确存储奖罚类型JSON | TC-001 ~ TC-008 |
| 2. 奖罚表唯一约束生效 | TC-009 ~ TC-013 |
| 3. 奖金设定写入/更新/删除正确 | TC-019 ~ TC-027 |
| 4. 奖金查看页面按角色筛选正确 | TC-028 ~ TC-035 |
| 5. 奖罚统计页面筛选和执行状态正确 | TC-036 ~ TC-045 |
| 端到端验证 | TC-046 ~ TC-047 |
| 边界/异常 | TC-048 ~ TC-050 |

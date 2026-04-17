# QA-20260417-10 测试用例：会员管理-同步助教功能

> **编写人**: 测试员B  
> **日期**: 2026-04-17  
> **测试环境**: 后端 API `http://127.0.0.1:8088`  
> **测试策略**: 纯 API/curl 测试，无浏览器测试  
> **前置条件**: 需先获取 admin token，以下 curl 中的 `$TOKEN` 需替换为实际 token

---

## 0. 测试数据准备

### 0.1 获取 Admin Token

```bash
# 登录获取 token
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | python3 -m json.tool

# 记录返回的 token，后续所有请求用此 token
```

### 0.2 数据库现有数据确认（参考用，无需修改）

**Coaches 表中 phone 不为空的助教（部分）**：

| coach_no | employee_id | stage_name | phone |
|----------|-------------|------------|-------|
| 1 | 歪歪 | 歪歪 | 16675852676 |
| 2 | 陆飞 | 陆飞 | 18775703862 |
| 60 | 诗雨 | 诗雨 | 17573411899 |
| 17 | 静香 | 静香 | 19928028091 |
| 999 | 豆豆 | 豆豆 | 18680174119 |

**Members 表中部分数据**：

| member_no | phone | name | gender | remark |
|-----------|-------|------|--------|--------|
| 1 | 18680174119 | 马美嵩 | 男 | (空) |
| 3 | 18420285039 | (空) | (空) | (空) |
| 6 | 17573411899 | 诗雨 | (空) | (空) |
| 9 | 19928028091 | 静香 | 女 | (空) |

### 0.3 创建专项测试数据（执行一次）

```bash
# ① member_no=101: phone=16675852676，name 为空，gender 为空，remark 为空
# 匹配 coach_no=1（歪歪），期望：姓名→歪歪，性别→女，备注→[助教]工号:歪歪 艺名:歪歪
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (101, '16675852676', '', '', '');"

# ② member_no=102: phone=18775703862，name 已有值，gender 已有值，remark 为空
# 匹配 coach_no=2（陆飞），期望：姓名不变，性别不变，备注→[助教]工号:陆飞 艺名:陆飞
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (102, '18775703862', '张三', '男', '');"

# ③ member_no=103: phone=13800000000，匹配不到任何助教
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (103, '13800000000', '王五', '男', '已有备注');"

# ④ member_no=104: phone=15907641078，name 为 NULL，gender 为 NULL，remark 已有值
# 匹配 coach_no=8（小雨），期望：姓名→小雨，性别→女，备注追加
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (104, '15907641078', NULL, NULL, 'VIP会员');"

# ⑤ member_no=105: phone=15382776509，name 为空字符串，gender 为 "女"（已有值）
# 匹配 coach_no=16（雪梨），期望：姓名→雪梨，性别不变
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (105, '15382776509', '', '女', '');"
```

### 0.4 验证测试数据已就绪

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT member_no, phone, name, gender, remark FROM members WHERE member_no IN (101,102,103,104,105);"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE phone IN ('16675852676','18775703862','13800000000','15907641078','15382776509');"
```

---

## 1. 新增 API 接口定义（预期实现）

根据需求，后端需新增以下 API：

### 1.1 预览匹配清单

| 项目 | 值 |
|------|------|
| **方法** | `GET` |
| **路径** | `/api/admin/members/sync-coaches/preview` |
| **鉴权** | 是（admin token） |
| **权限** | coachManagement |
| **返回** | 匹配的会员-助教列表，包含 member_no, phone, name, gender, remark, employee_id, stage_name |

### 1.2 执行同步

| 项目 | 值 |
|------|------|
| **方法** | `POST` |
| **路径** | `/api/admin/members/sync-coaches` |
| **鉴权** | 是（admin token） |
| **权限** | coachManagement |
| **请求体** | `{ "memberNos": [101, 102, 104] }`（勾选的会员号数组） |
| **返回** | 同步结果统计：成功数、失败数、详情列表 |

### 同步规则（代码逻辑）

对每个选中的会员：
1. 根据 `members.phone = coaches.phone` 匹配助教
2. **备注**：追加 `[助教]工号:{employee_id} 艺名:{stage_name}`（remark 已有内容时追加，空值时直接填入）
3. **性别**：仅当 `gender IS NULL OR gender = ''` 时，设为 `"女"`
4. **姓名**：仅当 `name IS NULL OR name = ''` 时，设为 `stage_name`

---

## 2. 测试用例

### TC-001: 预览接口 - 返回所有匹配的会员-助教对

**优先级**: P0 核心  
**前置条件**: 测试数据 101~105 已就绪  

```bash
curl -s http://127.0.0.1:8088/api/admin/members/sync-coaches/preview \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**预期结果**:
- HTTP 200
- 返回数组包含至少 4 条匹配记录（member_no 101、102、104、105）
- member_no=103 不在结果中（手机号 13800000000 无匹配助教）
- 每条记录包含：`member_no`, `phone`, `name`, `gender`, `remark`, `employee_id`, `stage_name`
- member_no=101 → employee_id="歪歪", stage_name="歪歪"
- member_no=102 → employee_id="陆飞", stage_name="陆飞"
- member_no=104 → employee_id="小雨", stage_name="小雨"
- member_no=105 → employee_id="雪梨", stage_name="雪梨"

---

### TC-002: 预览接口 - 无匹配时返回空数组

**优先级**: P1 重要  
**前置条件**: 无  

```bash
# 先确认现有会员中无匹配的情况
sqlite3 /TG/tgservice/db/tgservice.db "SELECT COUNT(*) FROM members m INNER JOIN coaches c ON m.phone = c.phone;"
```

如果返回 0（理论上不会，因为已有匹配数据），则此用例通过。

**预期结果**:
- 如果数据库中无任何匹配的会员-助教对，预览接口返回空数组 `[]`
- HTTP 200

---

### TC-003: 预览接口 - 未授权访问（无 token）

**优先级**: P1 重要  

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/api/admin/members/sync-coaches/preview
```

**预期结果**:
- HTTP 401

---

### TC-004: 预览接口 - 错误 token

**优先级**: P1 重要  

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/api/admin/members/sync-coaches/preview \
  -H "Authorization: Bearer invalid_token_12345"
```

**预期结果**:
- HTTP 401 或 403

---

### TC-005: 同步接口 - 正常同步单个会员（空姓名+空性别+空备注）

**优先级**: P0 核心  
**前置条件**: TC-001 已确认 member_no=101 匹配助教"歪歪"  

**Step 1 - 同步前状态确认**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 101;"
# 期望: ||  （三个字段均为空）
```

**Step 2 - 执行同步**：

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}' | python3 -m json.tool
```

**Step 3 - 验证同步结果**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 101;"
```

**预期结果**:
- HTTP 200，返回 `{ "success": true, "synced": 1, "details": [...] }` 或类似成功响应
- `name` = `"歪歪"`（助教 stage_name 填入）
- `gender` = `"女"`（自动设为女）
- `remark` = `"[助教]工号:歪歪 艺名:歪歪"`（格式必须严格一致）

---

### TC-006: 同步接口 - 同步单个会员（姓名和性别已有值，不应被覆盖）

**优先级**: P0 核心  
**前置条件**: member_no=102（name="张三", gender="男", remark=""）  

**Step 1 - 同步前状态**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 102;"
# 期望: 张三|男|
```

**Step 2 - 执行同步**：

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[102]}' | python3 -m json.tool
```

**Step 3 - 验证结果**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 102;"
```

**预期结果**:
- `name` 仍为 `"张三"`（已有值，不被覆盖）
- `gender` 仍为 `"男"`（已有值，不被覆盖）
- `remark` = `"[助教]工号:陆飞 艺名:陆飞"`（备注为空时直接填入）

---

### TC-007: 同步接口 - 同步单个会员（remark 已有值，应追加而非覆盖）

**优先级**: P0 核心  
**前置条件**: member_no=104（name=NULL, gender=NULL, remark="VIP会员"）  

**Step 1 - 同步前状态**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 104;"
# 期望: ||VIP会员
```

**Step 2 - 执行同步**：

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[104]}' | python3 -m json.tool
```

**Step 3 - 验证结果**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 104;"
```

**预期结果**:
- `name` = `"小雨"`（NULL → 填入助教艺名）
- `gender` = `"女"`（NULL → 设为女）
- `remark` = `"VIP会员 [助教]工号:小雨 艺名:小雨"`（已有备注后追加，中间有空格分隔）

---

### TC-008: 同步接口 - 同步单个会员（性别已有值，name 为空字符串）

**优先级**: P1 重要  
**前置条件**: member_no=105（name="", gender="女", remark=""）  

```bash
# Step 1 - 确认状态
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 105;"

# Step 2 - 执行同步
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[105]}' | python3 -m json.tool

# Step 3 - 验证结果
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 105;"
```

**预期结果**:
- `name` = `"雪梨"`（空字符串 → 填入助教艺名）
- `gender` 仍为 `"女"`（已有值不变）
- `remark` = `"[助教]工号:雪梨 艺名:雪梨"`

---

### TC-009: 同步接口 - 批量同步多个会员

**优先级**: P0 核心  
**前置条件**: 测试数据已重置（或准备新的测试数据）  

**准备数据**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no IN (201,202,203);"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (201, '16675852676', '', '', ''); "
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (202, '18775703862', '', '', ''); "
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (203, '19928028091', '', '', ''); "
```

**执行同步**：

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[201,202,203]}' | python3 -m json.tool
```

**验证结果**：

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT member_no, name, gender, remark FROM members WHERE member_no IN (201,202,203) ORDER BY member_no;"
```

**预期结果**:
- HTTP 200，返回成功数 `synced: 3`
- member_no=201: name="歪歪", gender="女", remark="[助教]工号:歪歪 艺名:歪歪"
- member_no=202: name="陆飞", gender="女", remark="[助教]工号:陆飞 艺名:陆飞"
- member_no=203: name="静香", gender="女", remark="[助教]工号:静香 艺名:静香"

---

### TC-010: 同步接口 - 同步不存在的会员号

**优先级**: P1 重要  

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[999999]}' | python3 -m json.tool
```

**预期结果**:
- HTTP 200（或 400），返回失败信息
- `synced: 0`，details 中说明 member_no=999999 不存在
- 数据库无变更

---

### TC-011: 同步接口 - 同步无匹配助教的会员

**优先级**: P1 重要  
**前置条件**: member_no=103（phone=13800000000，无匹配助教）  

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[103]}' | python3 -m json.tool
```

**预期结果**:
- HTTP 200（或 400），返回失败或部分成功信息
- member_no=103 未被修改（name、gender、remark 保持原值）
- details 中说明 member_no=103 无匹配助教

---

### TC-012: 同步接口 - 空请求体（无 memberNos）

**优先级**: P1 重要  

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[]}'

curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[]}' | python3 -m json.tool
```

**预期结果**:
- HTTP 400 或 200
- 返回错误提示如 "请选择要同步的会员" 或返回 `{ "synced": 0 }`
- 数据库无变更

---

### TC-013: 同步接口 - memberNos 为非数组类型

**优先级**: P2 次要  

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":"101"}' | python3 -m json.tool
```

**预期结果**:
- HTTP 400，返回参数类型错误提示

---

### TC-014: 同步接口 - 未授权访问

**优先级**: P1 重要  

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}'
```

**预期结果**:
- HTTP 401

---

### TC-015: 手机号匹配逻辑 - 精确匹配

**优先级**: P0 核心  

```bash
# 验证：phone 必须完全匹配，前缀匹配不应命中
# 插入一个前缀相同但不同的测试会员
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no = 301;"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (301, '16675852677', '', '', '');"
# 注意：phone=16675852677 与教练 16675852676 仅差最后一位

# 执行预览
curl -s http://127.0.0.1:8088/api/admin/members/sync-coaches/preview \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
matched = [m for m in data if m['member_no'] == 301]
print('member_no=301 在预览结果中:', len(matched) > 0)
"
```

**预期结果**:
- member_no=301 不在预览结果中（手机号不完全匹配）

---

### TC-016: 手机号匹配逻辑 - 同一手机号有多个助教

**优先级**: P1 重要  

```bash
# 确认：coaches 表中是否有一对多的情况
sqlite3 /TG/tgservice/db/tgservice.db "SELECT phone, COUNT(*) as cnt FROM coaches WHERE phone IS NOT NULL AND phone != '' GROUP BY phone HAVING cnt > 1;"
```

如果有结果（例如 phone=X 对应多个助教），则：
- 预览接口应返回多条记录（该会员对应多个助教），或
- 预览接口只返回第一条匹配，或
- 预览接口返回错误/提示

**预期结果**:
- 接口行为应一致且合理（需根据实际实现确认）
- 不能导致数据错乱

---

### TC-017: 备注字段格式验证 - 格式一致性

**优先级**: P0 核心  

```bash
# 同步 member_no=101
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}' > /dev/null

# 验证备注格式
REMARK=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT remark FROM members WHERE member_no = 101;")
echo "备注内容: [$REMARK]"

# 正则检查：应匹配 [助教]工号:XXX 艺名:XXX
if echo "$REMARK" | grep -qP '^\[助教\]工号:.+ 艺名:.+$'; then
  echo "✅ 备注格式正确"
else
  echo "❌ 备注格式不正确"
fi
```

**预期结果**:
- 备注格式严格为 `[助教]工号:{employee_id} 艺名:{stage_name}`
- 无多余空格、换行或其他字符

---

### TC-018: 备注字段格式验证 - 追加时的分隔符

**优先级**: P1 重要  
**前置条件**: member_no=104 已同步（TC-007）  

```bash
sqlite3 /TG/tgservice/db/tgservice.db "SELECT remark FROM members WHERE member_no = 104;"
```

**预期结果**:
- remark = `"VIP会员 [助教]工号:小雨 艺名:小雨"`
- 原有备注和新备注之间以单个空格分隔

---

### TC-019: 同步接口 - 性别空值判断（NULL vs 空字符串 vs 空格）

**优先级**: P1 重要  

```bash
# 准备：member_no=302，gender 为纯空格
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no = 302;"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (302, '13420329198', '', ' ', '');"

# 同步
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[302]}' > /dev/null

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender FROM members WHERE member_no = 302;"
```

**预期结果**:
- 如果代码将空格视为"已填写"，则 gender 保持 `" "`
- 如果代码使用 `TRIM` 后判断空值，则 gender = `"女"`
- **建议**：应使用 `TRIM` 判断，gender = `"女"`

---

### TC-020: 同步接口 - name 空值判断（NULL vs 空字符串 vs 空格）

**优先级**: P1 重要  

```bash
# 准备：member_no=303，name 为纯空格
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no = 303;"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (303, '15989148331', ' ', '', '');"

# 同步（phone=15989148331 → coach_no=21 球球）
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[303]}' > /dev/null

# 验证
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender FROM members WHERE member_no = 303;"
```

**预期结果**:
- 如果代码将空格视为"已填写"，则 name 保持 `" "`
- 如果代码使用 `TRIM` 后判断空值，则 name = `"球球"`
- **建议**：应使用 `TRIM` 判断，name = `"球球"`

---

### TC-021: 同步接口 - 重复同步（幂等性）

**优先级**: P2 次要  
**前置条件**: member_no=101 已完成一次同步  

```bash
# 第二次同步同一会员
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}' | python3 -m json.tool

# 验证结果
sqlite3 /TG/tgservice/db/tgservice.db "SELECT name, gender, remark FROM members WHERE member_no = 101;"
```

**预期结果**:
- 同步成功（或返回已同步提示）
- name = `"歪歪"`（不变）
- gender = `"女"`（不变）
- remark 可能被再次追加 → `"[助教]工号:歪歪 艺名:歪歪 [助教]工号:歪歪 艺名:歪歪"`  
  **注意**：如果代码不做去重判断，备注会被重复追加。建议在实现时增加去重逻辑（检查备注中是否已包含该助教信息）。

---

### TC-022: 同步接口 - 混合情况（部分成功部分失败）

**优先级**: P1 重要  

```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101, 999999, 103]}' | python3 -m json.tool
```

- 101: 匹配助教"歪歪"，应成功
- 999999: 会员不存在，应失败
- 103: 无匹配助教，应失败

**预期结果**:
- 返回部分成功信息：`synced: 1, failed: 2`
- details 中分别说明成功和失败原因
- member_no=101 已同步，999999 和 103 数据未变更

---

### TC-023: 预览接口 - 返回数据不包含敏感字段

**优先级**: P2 次要  

```bash
curl -s http://127.0.0.1:8088/api/admin/members/sync-coaches/preview \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if len(data) > 0:
  keys = set(data[0].keys())
  print('返回字段:', sorted(keys))
  # 不应包含 coach_no（内部编号）
  if 'coach_no' in keys:
    print('⚠️ 返回了 coach_no（内部编号）')
  else:
    print('✅ 未返回 coach_no')
"
```

**预期结果**:
- 返回字段中不包含 `coach_no`（助教内部编号不应暴露给前端）
- 可以包含：`member_no`, `phone`, `name`, `gender`, `remark`, `employee_id`, `stage_name`

---

### TC-024: 同步后 updated_at 字段更新

**优先级**: P2 次要  

```bash
# 同步前记录 updated_at
BEFORE=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT updated_at FROM members WHERE member_no = 105;")
echo "同步前 updated_at: $BEFORE"

sleep 1

# 执行同步
curl -s -X POST http://127.0.0.1:8088/api/admin/members/sync-coaches \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[105]}' > /dev/null

# 同步后检查 updated_at
AFTER=$(sqlite3 /TG/tgservice/db/tgservice.db "SELECT updated_at FROM members WHERE member_no = 105;")
echo "同步后 updated_at: $AFTER"

if [ "$BEFORE" != "$AFTER" ]; then
  echo "✅ updated_at 已更新"
else
  echo "❌ updated_at 未更新"
fi
```

**预期结果**:
- `updated_at` 字段在同步后被更新为当前时间

---

### TC-025: 前端页面 - 验证"同步助教"按钮存在

**优先级**: P0 核心  

```bash
# 检查 members.html 中是否有"同步助教"按钮
grep -n "同步助教\|syncCoaches\|sync-coaches" /TG/tgservice/admin/members.html
```

**预期结果**:
- HTML 中包含"同步助教"按钮（或类似文案）
- 按钮绑定点击事件，触发预览 API 调用

---

### TC-026: 前端页面 - 同步清单弹窗展示

**优先级**: P0 核心  

```bash
# 检查 members.html 中是否有同步清单弹窗（modal）
grep -n "syncModal\|sync.*modal\|sync.*dialog\|同步清单" /TG/tgservice/admin/members.html
```

**预期结果**:
- HTML 中包含同步清单弹窗结构
- 弹窗中包含：
  - 匹配列表（手机号、会员姓名、助教工号、助教艺名）
  - 每条记录前的勾选框（checkbox）
  - 全选/取消全选功能
  - "确认同步"按钮
  - "取消"按钮

---

### TC-027: 前端页面 - 勾选后同步 API 调用

**优先级**: P0 核心  

通过浏览器控制台或抓包验证：
1. 点击"同步助教"按钮 → 调用预览 API
2. 勾选部分会员 → 点击"确认同步"
3. 前端调用同步 API，传递勾选的 memberNos 数组

**预期结果**:
- 同步 API 被正确调用
- 仅传递勾选的会员号
- 同步成功后弹窗关闭并刷新会员列表

---

### TC-028: 前端页面 - 未勾选任何会员点击同步

**优先级**: P1 重要  

**预期结果**:
- 前端应提示"请至少选择一条记录"
- 不发起 API 请求

---

### TC-029: 同步接口 - 离职助教不应匹配

**优先级**: P1 重要  

```bash
# 查找离职状态的助教
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, employee_id, stage_name, phone, status FROM coaches WHERE status = '离职' AND phone IS NOT NULL AND phone != '';"
```

如果有结果（例如某离职助教的 phone=XXX），则创建对应会员并验证：

```bash
# 假设 phone=13900000000 的助教已离职
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no = 310;"
sqlite3 /TG/tgservice/db/tgservice.db "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (310, '13900000000', '', '', '');"

# 执行预览
curl -s http://127.0.0.1:8088/api/admin/members/sync-coaches/preview \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
matched = [m for m in data if m['member_no'] == 310]
print('member_no=310 在预览结果中:', len(matched) > 0)
"
```

**预期结果**:
- member_no=310 不在预览结果中（离职助教不应出现在同步清单中）
- 或者：接口不过滤 status，前端/业务层面处理（需根据实现确认）

---

### TC-030: 同步接口 - 会员 phone 为空或 NULL

**优先级**: P2 次要  

```bash
# 查找 phone 为空的会员
sqlite3 /TG/tgservice/db/tgservice.db "SELECT member_no, phone FROM members WHERE phone IS NULL OR phone = '';"
```

**预期结果**:
- phone 为空的会员不会出现在预览结果中
- 不会产生错误

---

## 3. 测试执行检查清单

| 用例编号 | 描述 | 优先级 | 状态 | 备注 |
|----------|------|--------|------|------|
| TC-001 | 预览接口-返回匹配清单 | P0 | ⬜ | |
| TC-002 | 预览接口-无匹配返回空数组 | P1 | ⬜ | |
| TC-003 | 预览接口-无 token | P1 | ⬜ | |
| TC-004 | 预览接口-错误 token | P1 | ⬜ | |
| TC-005 | 同步-空姓名+空性别+空备注 | P0 | ⬜ | |
| TC-006 | 同步-姓名和性别已有值不覆盖 | P0 | ⬜ | |
| TC-007 | 同步-备注追加（非覆盖） | P0 | ⬜ | |
| TC-008 | 同步-性别已有值+name 空字符串 | P1 | ⬜ | |
| TC-009 | 同步-批量同步多个会员 | P0 | ⬜ | |
| TC-010 | 同步-不存在的会员号 | P1 | ⬜ | |
| TC-011 | 同步-无匹配助教 | P1 | ⬜ | |
| TC-012 | 同步-空请求体 | P1 | ⬜ | |
| TC-013 | 同步-memberNos 非数组 | P2 | ⬜ | |
| TC-014 | 同步-未授权访问 | P1 | ⬜ | |
| TC-015 | 手机号精确匹配 | P0 | ⬜ | |
| TC-016 | 一对多匹配处理 | P1 | ⬜ | |
| TC-017 | 备注格式一致性 | P0 | ⬜ | |
| TC-018 | 备注追加分隔符 | P1 | ⬜ | |
| TC-019 | 性别空格值判断 | P1 | ⬜ | |
| TC-020 | 姓名空格值判断 | P1 | ⬜ | |
| TC-021 | 重复同步幂等性 | P2 | ⬜ | |
| TC-022 | 部分成功部分失败 | P1 | ⬜ | |
| TC-023 | 返回数据无敏感字段 | P2 | ⬜ | |
| TC-024 | updated_at 更新 | P2 | ⬜ | |
| TC-025 | 前端同步助教按钮 | P0 | ⬜ | |
| TC-026 | 前端同步清单弹窗 | P0 | ⬜ | |
| TC-027 | 前端勾选后调用同步 API | P0 | ⬜ | |
| TC-028 | 前端未勾选提示 | P1 | ⬜ | |
| TC-029 | 离职助教过滤 | P1 | ⬜ | |
| TC-030 | 会员 phone 为空 | P2 | ⬜ | |

---

## 4. 测试数据清理脚本（测试完成后执行）

```bash
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM members WHERE member_no IN (101,102,103,104,105,201,202,203,301,302,303,310);"
```

---

## 5. 风险提示

1. **备注追加重复**：TC-021 发现重复同步会导致备注重复追加，建议实现时增加去重检查。
2. **空格值处理**：TC-019 和 TC-020 涉及 NULL vs 空字符串 vs 空格的边界情况，需与开发确认判断逻辑。
3. **离职助教**：TC-029 涉及是否过滤离职状态助教，需确认业务规则。
4. **一对多匹配**：TC-016 涉及同一手机号对应多个助教的情况，需确认处理方式。

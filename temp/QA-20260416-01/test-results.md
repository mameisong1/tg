# 测试结果：申请提交接口 Bug 修复验证

**QA编号**: QA-20260416-01  
**Bug描述**: `/TG/tgservice/backend/routes/applications.js` 中 `status` 变量未定义导致 `ReferenceError: status is not defined`  
**修复方式**: 在 INSERT 语句前添加 `const status = 0;` 定义变量  
**测试环境**: `http://127.0.0.1:8088` (PM2: tgservice-dev)  
**测试时间**: 2026-04-16 06:20 CST  
**测试人**: 测试员B  

---

## 修复前状态（Bug 确认）

**Docker 生产环境日志**：
```
提交申请失败: ReferenceError: status is not defined
    at /app/tgservice/backend/routes/applications.js:64:7
```

**Bug 原因分析**：  
在 `POST /api/applications` 处理函数中，`status` 变量被用于 INSERT 语句和 operation log 创建，但从未在函数作用域内定义，导致每次提交申请都会抛出 `ReferenceError`，触发 500 错误响应。

**修复前 API 响应**：
```json
{"success":false,"error":"提交申请失败"}
```

---

## 修复后测试结果

### 修复前 Bug 确认测试

| 测试编号 | 测试名称 | 修复前结果 | 修复后结果 | 状态 |
|----------|----------|-----------|-----------|------|
| BUG-01 | 提交晚加班申请 | ❌ 500 ReferenceError | ✅ success:true, status:0 | **已修复** |

---

### 正常流程测试

#### TC-01: 提交「晚加班申请」 ✅ PASS

```bash
$ curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"applicant_phone":"18775703862","application_type":"晚加班申请","remark":"QA测试-晚加班2小时","extra_data":{"hours":2}}'

# 返回: {"success":true,"data":{"id":40,"status":0}}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| HTTP 状态 | 200 | 200 | ✅ |
| success | true | true | ✅ |
| status | 0 | 0 | ✅ |
| 数据库记录 | 新增，status=0 | id=40, status=0 | ✅ |

---

#### TC-02: 提交「早加班申请」 ✅ PASS

```bash
$ curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"applicant_phone":"19814455887","application_type":"早加班申请","remark":"QA测试-早加班1小时","extra_data":{"hours":1}}'

# 返回: {"success":true,"data":{"id":41,"status":0}}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| HTTP 状态 | 200 | 200 | ✅ |
| success | true | true | ✅ |
| status | 0 | 0 | ✅ |
| 数据库记录 | 新增，status=0 | id=41, status=0 | ✅ |

---

#### TC-03: 提交「公休申请」 ✅ PASS

```bash
$ curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"applicant_phone":"17520240130","application_type":"公休申请","remark":"QA测试-公休1天"}'

# 返回: {"success":true,"data":{"id":42,"status":0}}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| HTTP 状态 | 200 | 200 | ✅ |
| success | true | true | ✅ |
| status | 0 | 0 | ✅ |
| 数据库记录 | 新增，status=0 | id=42, status=0 | ✅ |

---

#### TC-04: 提交「约客记录」 ✅ PASS

```bash
$ curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"applicant_phone":"13420329198","application_type":"约客记录","remark":"QA测试-约客5人","extra_data":{"guest_count":5}}'

# 返回: {"success":true,"data":{"id":43,"status":0}}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| HTTP 状态 | 200 | 200 | ✅ |
| success | true | true | ✅ |
| status | 0 | 0 | ✅ |
| 数据库记录 | 新增，status=0 | id=43, status=0 | ✅ |

---

#### TC-05: 助教身份提交申请 ✅ PASS

```bash
$ COACH_TOKEN=$(echo -n "10002:$(date +%s)" | base64)
$ curl -s -X POST http://127.0.0.1:8088/api/applications \
  -H "Authorization: Bearer $COACH_TOKEN" \
  -d '{"applicant_phone":"18775703862","application_type":"晚加班申请","remark":"QA测试-助教身份提交","extra_data":{"hours":3}}'

# 返回: {"success":true,"data":{"id":44,"status":0}}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| HTTP 状态 | 200 | 200 | ✅ |
| success | true | true | ✅ |
| status | 0 | 0 | ✅ |
| 数据库记录 | 新增，status=0 | id=44, status=0 | ✅ |

---

### 异常流程测试

#### TC-06: 缺少 applicant_phone ✅ PASS

```json
{"success":false,"error":"缺少必填字段"}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| error | "缺少必填字段" | "缺少必填字段" | ✅ |

#### TC-07: 缺少 application_type ✅ PASS

```json
{"success":false,"error":"缺少必填字段"}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| error | "缺少必填字段" | "缺少必填字段" | ✅ |

#### TC-08: 无效的申请类型 ✅ PASS

```json
{"success":false,"error":"无效的申请类型"}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| error | "无效的申请类型" | "无效的申请类型" | ✅ |

#### TC-09: 无认证 Token ✅ PASS

```json
{"success":false,"error":"未授权访问"}
```

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|------|
| error | "未授权访问" | "未授权访问" | ✅ |

---

### 数据库状态验证

#### TC-10: 验证所有新记录 status = 0 ✅ PASS

```sql
sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, applicant_phone, application_type, status FROM applications WHERE id >= 40 ORDER BY id;"
```

| id | applicant_phone | application_type | status | 预期 | 结果 |
|----|----------------|------------------|--------|------|------|
| 40 | 18775703862 | 晚加班申请 | 0 | 0 | ✅ |
| 41 | 19814455887 | 早加班申请 | 0 | 0 | ✅ |
| 42 | 17520240130 | 公休申请 | 0 | 0 | ✅ |
| 43 | 13420329198 | 约客记录 | 0 | 0 | ✅ |
| 44 | 18775703862 | 晚加班申请 | 0 | 0 | ✅ |

---

## 测试总结

| 类别 | 用例数 | 通过 | 失败 | 跳过 |
|------|--------|------|------|------|
| 正常流程 | 5 | 5 | 0 | 0 |
| 异常流程 | 4 | 4 | 0 | 0 |
| 数据库验证 | 1 | 1 | 0 | 0 |
| **合计** | **10** | **10** | **0** | **0** |

### 结论

✅ **Bug 修复验证通过**。所有测试用例全部通过：
1. 四种申请类型（晚加班、早加班、公休、约客记录）均可正常提交
2. 所有新记录 `status` 字段正确初始化为 `0`（待处理）
3. 助教身份也能正常提交申请
4. 异常输入（缺少必填字段、无效类型、无认证）均返回正确错误信息

### 备注

- 浏览器截图：由于测试环境无法启动浏览器（root 用户运行 Chrome 需要 `--no-sandbox` 配置），截图已省略，所有验证通过 API 和数据库直接完成
- Git 提交：`f825d5f fix: 恢复 applications.js 中 status 变量定义，修复 ReferenceError`
- 生产环境尚未部署，需要用户确认后执行 `docker restart tgservice`

# 测试用例：申请提交接口 Bug 修复验证

**QA编号**: QA-20260416-01  
**Bug描述**: `applications.js` 中 `status` 变量未定义导致 `ReferenceError`  
**修复方式**: 在 INSERT 前添加 `const status = 0;`  
**测试环境**: `http://127.0.0.1:8088`  
**测试时间**: 2026-04-16  
**测试人**: 测试员B  

---

## 1. 正常流程测试

### TC-01: 提交「晚加班申请」 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P0** |
| 接口 | `POST /api/applications` |
| 认证 | Admin JWT Token |
| 请求体 | `{"applicant_phone":"18775703862","application_type":"晚加班申请","remark":"QA测试-晚加班2小时","extra_data":{"hours":2}}` |
| 预期结果 | `{"success":true,"data":{"id":N,"status":0}}` |
| DB验证 | `applications` 表新增记录，`status=0`，`application_type="晚加班申请"` |

### TC-02: 提交「早加班申请」 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P0** |
| 接口 | `POST /api/applications` |
| 认证 | Admin JWT Token |
| 请求体 | `{"applicant_phone":"19814455887","application_type":"早加班申请","remark":"QA测试-早加班1小时","extra_data":{"hours":1}}` |
| 预期结果 | `{"success":true,"data":{"id":N,"status":0}}` |
| DB验证 | `applications` 表新增记录，`status=0`，`application_type="早加班申请"` |

### TC-03: 提交「公休申请」 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P0** |
| 接口 | `POST /api/applications` |
| 认证 | Admin JWT Token |
| 请求体 | `{"applicant_phone":"17520240130","application_type":"公休申请","remark":"QA测试-公休1天"}` |
| 预期结果 | `{"success":true,"data":{"id":N,"status":0}}` |
| DB验证 | `applications` 表新增记录，`status=0`，`application_type="公休申请"` |

### TC-04: 提交「约客记录」 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P0** |
| 接口 | `POST /api/applications` |
| 认证 | Admin JWT Token |
| 请求体 | `{"applicant_phone":"13420329198","application_type":"约客记录","remark":"QA测试-约客5人","extra_data":{"guest_count":5}}` |
| 预期结果 | `{"success":true,"data":{"id":N,"status":0}}` |
| DB验证 | `applications` 表新增记录，`status=0`，`application_type="约客记录"` |

### TC-05: 助教身份提交申请 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P1** |
| 接口 | `POST /api/applications` |
| 认证 | 助教 Base64 Token (coach_no=10002) |
| 请求体 | `{"applicant_phone":"18775703862","application_type":"晚加班申请","remark":"QA测试-助教身份提交","extra_data":{"hours":3}}` |
| 预期结果 | `{"success":true,"data":{"id":N,"status":0}}` |
| DB验证 | `applications` 表新增记录，`status=0` |

---

## 2. 异常流程测试

### TC-06: 缺少必填字段 applicant_phone ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P1** |
| 接口 | `POST /api/applications` |
| 请求体 | `{"application_type":"晚加班申请","remark":"测试"}` |
| 预期结果 | `{"success":false,"error":"缺少必填字段"}` (HTTP 400) |

### TC-07: 缺少必填字段 application_type ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P1** |
| 接口 | `POST /api/applications` |
| 请求体 | `{"applicant_phone":"18775703862","remark":"测试"}` |
| 预期结果 | `{"success":false,"error":"缺少必填字段"}` (HTTP 400) |

### TC-08: 无效的申请类型 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P1** |
| 接口 | `POST /api/applications` |
| 请求体 | `{"applicant_phone":"18775703862","application_type":"病假申请","remark":"测试"}` |
| 预期结果 | `{"success":false,"error":"无效的申请类型"}` (HTTP 400) |

### TC-09: 无认证 Token ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P1** |
| 接口 | `POST /api/applications` |
| 请求体 | `{"applicant_phone":"18775703862","application_type":"晚加班申请"}` |
| Header | 无 Authorization |
| 预期结果 | `{"success":false,"error":"未授权访问"}` (HTTP 401) |

---

## 3. 数据库状态验证

### TC-10: 验证所有新记录的 status = 0 ✅

| 项目 | 内容 |
|------|------|
| 优先级 | **P0** |
| 验证方法 | `sqlite3 /TG/tgservice/db/tgservice.db "SELECT id, application_type, status FROM applications WHERE id >= 40 ORDER BY id;"` |
| 预期结果 | 所有测试创建的记录 `status` 均为 `0`（待处理） |

---

## 测试覆盖度总结

| 类别 | 用例数 | 通过 | 失败 |
|------|--------|------|------|
| 正常流程 | 5 | 5 | 0 |
| 异常流程 | 4 | 4 | 0 |
| 数据库验证 | 1 | 1 | 0 |
| **合计** | **10** | **10** | **0** |

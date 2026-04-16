你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 乐捐报备预约时间选择范围 - API 测试用例

> QA编号: QA-20260417-1
> 创建日期: 2026-04-17
> 测试人: 测试员B
> 后端API: http://127.0.0.1:8088（测试环境 PM2: tgservice-dev）
> 数据库: /TG/tgservice/db/tgservice.db（开发环境）

---

## 测试数据准备

### 助教测试数据

| employee_id | stage_name | coach_no |
|-------------|-----------|----------|
| 5 | 芝芝 | 10005 |

### 认证方式

通过 `/api/admin/login` 获取 JWT token：
```bash
curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "tgadmin", "password": "mms633268"}'
```

---

## 时间范围规则说明

根据需求，预约时间是一个连续的13小时窗口：**当日14:00 ~ 次日02:00**（14/15/16/17/18/19/20/21/22/23/00/01/02，共13个整点）。

**不能选过去时间，只能选当前小时或未来小时。**

| 当前时间 | 可选小时 | 选项数 | 说明 |
|---------|---------|--------|------|
| 00:30 | 00, 01, 02 | 3 | 窗口末尾 |
| 02:00 | 02 | 1 | 最后一个窗口时段 |
| **03:00 ~ 13:59** | 14, 15, ..., 23, 0, 1, 2 | 13 | 窗口未到，**允许提前预约** |
| 14:00 | 14, 15, ..., 23, 0, 1, 2 | 13 | 窗口开始 |
| 18:30 | 18, 19, ..., 23, 0, 1, 2 | 9 | 过滤过去小时 |
| 23:01 | 23, 0, 1, 2 | 4 | 跨天 |

**后端校验规则**：
- 小时必须在窗口内 (14~23 或 0~2)，否则拒绝
- 小时 14~23 的日期必须是当天
- 小时 0~2 的日期必须是次日
- 不能早于当前时间（允许当前小时）

---

## 测试结果汇总

| 用例ID | 测试项 | 优先级 | 状态 | 说明 |
|--------|--------|--------|------|------|
| TC-P0-03 | 当前小时预约（立即生效） | P0 | ✅ PASS | immediate=true |
| TC-P0-03-B | 未来小时预约（待出发） | P0 | ✅ PASS | immediate=false |
| TC-P0-05-A | 预约次日00:00 | P0 | ✅ PASS | pending |
| TC-P0-05-B | 预约次日01:00 | P0 | ✅ PASS | pending |
| TC-P0-05-C | 预约次日02:00 | P0 | ✅ PASS | pending |
| TC-P1-01 | 次日03:00应被拒绝 | P1 | ⚠️ FAIL | 后端尚未实现上限校验 |
| TC-P1-02 | 过去时间应被拒绝 | P1 | ✅ PASS | 已有校验正常工作 |
| TC-P2-01 | 非整点时间应被拒绝 | P2 | ✅ PASS | 已有校验正常工作 |
| TC-P2-02 | 时间格式错误应被拒绝 | P2 | ✅ PASS | 已有校验正常工作 |
| TC-P1-03 | 后天00:00应被拒绝 | P1 | ⚠️ FAIL | 后端尚未实现上限校验 |

**8/10 通过，2/10 失败（均为预期的"待实现"项）**

---

## 详细测试用例

### TC-P0-03: 当前小时预约（立即生效）

**优先级**: P0

**步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"employee_id": 5, "scheduled_start_time": "2026-04-17 06:00:00", "extra_hours": 1}'
```

**实际结果**: HTTP 200, `{"success":true,"data":{"id":23,"scheduled_start_time":"2026-04-17 06:00:00","lejuan_status":"active","immediate":true}}`

**结论**: ✅ PASS — 当前小时预约成功，immediate=true（立即生效）

---

### TC-P0-03-B: 未来小时预约（待出发）

**优先级**: P0

**步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"employee_id": 5, "scheduled_start_time": "2026-04-17 07:00:00", "extra_hours": 1}'
```

**实际结果**: HTTP 200, `{"success":true,"data":{"id":24,"scheduled_start_time":"2026-04-17 07:00:00","lejuan_status":"pending","immediate":false}}`

**结论**: ✅ PASS — 未来小时预约成功，immediate=false（待出发）

---

### TC-P0-05-A/B/C: 预约次日00:00/01:00/02:00

**优先级**: P0

**步骤**: 分别预约次日 00:00、01:00、02:00

**实际结果**:
- 00:00 → HTTP 200, `pending` ✅
- 01:00 → HTTP 200, `pending` ✅
- 02:00 → HTTP 200, `pending` ✅

**结论**: ✅ PASS — 次日00:00~02:00均被后端接受

---

### TC-P1-01: 次日03:00应被拒绝

**优先级**: P1

**步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"employee_id": 5, "scheduled_start_time": "2026-04-18 03:00:00", "extra_hours": 1}'
```

**实际结果**: HTTP 200, `pending` ⚠️

**结论**: ⚠️ FAIL — 次日03:00未被拒绝。后端尚未实现"最大不超过次日02:00"的校验。
**需要修改**: 在 `lejuan-records.js` 中新增上限校验逻辑。

---

### TC-P1-02: 过去时间应被拒绝

**优先级**: P1

**步骤**:
```bash
curl -s -X POST http://127.0.0.1:8088/api/lejuan-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"employee_id": 5, "scheduled_start_time": "2026-04-16 23:00:00", "extra_hours": 1}'
```

**实际结果**: HTTP 400, `{"error":"预约时间必须在未来或为当前小时"}`

**结论**: ✅ PASS — 已有校验正常工作

---

### TC-P2-01: 非整点时间应被拒绝

**优先级**: P2

**实际结果**: HTTP 400, `{"error":"预约时间必须是整点（分钟=00）"}`

**结论**: ✅ PASS

---

### TC-P2-02: 时间格式错误应被拒绝

**优先级**: P2

**实际结果**: HTTP 400, `{"error":"时间格式错误，必须是 YYYY-MM-DD HH:MM:SS"}`

**结论**: ✅ PASS

---

### TC-P1-03: 后天00:00应被拒绝

**优先级**: P1

**实际结果**: HTTP 200, `pending` ⚠️

**结论**: ⚠️ FAIL — 后天00:00未被拒绝。需要修改后端实现上限校验。

---

## 后端代码分析

### 现有校验（lejuan-records.js）

| 校验项 | 状态 | 代码行 |
|--------|------|--------|
| 时间格式 YYYY-MM-DD HH:MM:SS | ✅ 已有 | ~line 34 |
| 整点校验（分钟=00） | ✅ 已有 | ~line 37 |
| 必须在未来或当前小时 | ✅ 已有 | ~line 42 |
| 助教不能有重复pending/active记录 | ✅ 已有 | ~line 52 |
| **最大不超过次日02:00** | ❌ 缺失 | 需要新增 |

### 需要新增的后端校验

```javascript
// 在 lejuan-records.js 的时间校验部分新增：
// 计算最大可预约时间 = 次日 02:00
const maxDate = new Date(TimeUtil.nowDB() + '+08:00');
maxDate.setDate(maxDate.getDate() + 1);
maxDate.setHours(2, 0, 0, 0);
const maxTimeStr = maxDate.getFullYear() + '-' +
    String(maxDate.getMonth()+1).padStart(2,'0') + '-' +
    String(maxDate.getDate()).padStart(2,'0') + ' 02:00:00';

if (scheduled_start_time > maxTimeStr) {
    return res.status(400).json({ error: '预约时间不能超过次日02:00' });
}
```

---

## 测试脚本

自动化测试脚本位于: `/TG/temp/QA-20260417-1/run-tests.sh`

运行方式:
```bash
bash /TG/temp/QA-20260417-1/run-tests.sh
```

脚本功能:
1. 自动登录获取 token
2. 依次执行所有测试用例
3. 每个用例之间自动清理测试数据
4. 输出彩色测试结果
5. 测试完成后自动清理数据

```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 1/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题
# QA5 复测报告：后台admin助教管理-水牌联动

## 测试信息
- **测试日期**: 2026-04-15
- **测试环境**: 生产环境 Docker (localhost:8081)
- **测试工具**: curl + SQLite 直接查询验证
- **测试人员**: B5（复测）

## 复测结果汇总

| 用例 | 描述 | 初测 | 复测 | 详情 |
|------|------|------|------|------|
| TC-01 | 删除离职助教 | ❌ FAIL | ❌ FAIL | coaches已删除，water_boards未删除（BUG-1未修复） |
| TC-02 | 全职改离职 | ❌ FAIL | ❌ FAIL | water_boards未删除（BUG-2未修复） |
| TC-03 | 离职改全职 | ⏭️ SKIP | ✅ PASS | 水牌自动创建成功，status=下班 |
| TC-04 | 离职改兼职 | ⏭️ SKIP | ✅ PASS | 水牌自动创建成功，status=下班 |
| TC-05 | 修改班次 早→晚 | ❌ FAIL | ❌ FAIL | 水牌状态未映射（早班空闲→早班空闲，预期晚班空闲） |
| TC-06 | 修改班次 晚→早 | ❌ FAIL | ❌ FAIL | 水牌状态未映射（晚班空闲→晚班空闲，预期早班空闲） |
| TC-07 | 添加新助教 | ✅ PASS | ✅ PASS | 水牌自动创建成功，status=下班 |
| TC-08 | 删除非离职 | ✅ PASS | ✅ PASS | 正确拒绝，返回"只能删除离职助教" |

**复测统计**: PASS=4, FAIL=4, SKIP=0, Total=8
**初测统计**: PASS=2, FAIL=4, SKIP=2, Total=8

**结论: A5声称修复的4个Bug均未生效，Docker容器仍运行旧代码。**

---

## 详细测试结果

### TC-01: 删除离职助教 (BUG-1) ❌ FAIL

**测试步骤**:
1. 创建离职教练 10109（stage_name=删除测试QA5R）
2. 确认 coaches=1, water_boards=1（手动创建水牌模拟）
3. 调用 DELETE /api/admin/coaches/10109
4. API 返回 {"success": true}

**验证结果**:
- coaches=0 ✅ (已删除)
- water_boards=1 ❌ (**未删除**)

**数据库验证**:
```sql
SELECT COUNT(*) FROM water_boards WHERE coach_no = 10109;
-- 结果: 1 (仍然存在!)
```

**代码确认**: 容器内 `runInTransaction` 调用次数 = 2（旧代码），源码 = 5（修复后）。
**Docker未重建，修复未部署。**

---

### TC-02: 全职改离职 (BUG-2) ❌ FAIL

**测试步骤**:
1. 创建全职教练 10110
2. 确认水牌 status=下班
3. PUT /api/admin/coaches/10110 修改为离职
4. API 返回 {"success": true}

**验证结果**:
- coaches.status = 离职 ✅
- water_boards 记录 = 1 ❌ (**未删除**)

---

### TC-03: 离职改全职 ✅ PASS

**测试步骤**:
1. 创建离职教练 10111
2. PUT /api/admin/coaches/10111 修改为全职
3. API 返回 {"success": true}

**验证结果**:
- coaches.status = 全职 ✅
- water_boards 新增记录 ✅（status=下班）

---

### TC-04: 离职改兼职 ✅ PASS

**测试步骤**:
1. 创建离职教练 10112
2. PUT /api/admin/coaches/10112 修改为兼职
3. API 返回 {"success": true}

**验证结果**:
- coaches.status = 兼职 ✅
- water_boards 新增记录 ✅（status=下班）

---

### TC-05: 修改班次 早班→晚班 (BUG-3) ❌ FAIL

**测试步骤**:
1. 创建教练 10113（shift=早班）
2. 手动设置 water_board.status = '早班空闲'
3. PUT /api/admin/coaches/10113/shift {"shift": "晚班"}
4. API 返回 {"success":true, "old_shift":"早班", "new_shift":"晚班"}

**验证结果**:
- coaches.shift: 早班 → 晚班 ✅
- water_boards.status: 早班空闲 → 早班空闲 ❌ (**未映射**)

---

### TC-06: 修改班次 晚班→早班 (BUG-3) ❌ FAIL

**测试步骤**:
1. 创建教练 10114（shift=晚班）
2. 手动设置 water_board.status = '晚班空闲'
3. PUT /api/admin/coaches/10114/shift {"shift": "早班"}

**验证结果**:
- coaches.shift: 晚班 → 早班 ✅
- water_boards.status: 晚班空闲 → 晚班空闲 ❌ (**未映射**)

---

### TC-07: 添加新助教 ✅ PASS

**验证结果**:
- 新教练创建成功 ✅
- 水牌自动创建 ✅（status=下班）

**注意**: BUG-4（新水牌初始状态为"下班"而非基于班次的"早班空闲"/"晚班空闲"）仍然存在。

---

### TC-08: 删除非离职助教 ✅ PASS

**验证结果**:
- API 返回 {"error": "只能删除离职助教"} ✅

---

## 根因分析

### 修复代码已提交但Docker未重建

**Git提交记录**:
```
f3124ac fix: 修复助教水牌联动4个Bug
```

**代码对比**:

| 指标 | Docker容器内 | 源码 (git HEAD) |
|------|-------------|----------------|
| runInTransaction 调用次数 | 2 | 5 |
| 删除助教逻辑 | enqueueRun | runInTransaction + water_boards删除 |
| 更新助教逻辑 | enqueueRun | runInTransaction + 水牌联动 |
| 班次修改逻辑 | enqueueRun | runInTransaction + statusMap映射 |

**结论**: A5的修复代码已正确提交到仓库，但Docker镜像未重新构建和部署。生产环境运行的仍然是旧版本代码。

---

## 复测建议

1. **重建Docker镜像**: `docker build -t mameisong/tgservice:latest /TG`
2. **重启容器**: `docker restart tgservice`
3. **重新执行本复测**，验证4个Bug是否修复

---

## BUG修复状态汇总

| Bug | 描述 | 代码修复 | Docker部署 | 验证状态 |
|-----|------|---------|-----------|---------|
| BUG-1 | 删除助教时水牌未删除 | ✅ 已提交 | ❌ 未部署 | ❌ 未修复 |
| BUG-2 | 助教改离职时水牌未删除 | ✅ 已提交 | ❌ 未部署 | ❌ 未修复 |
| BUG-3 | 修改班次时水牌状态未映射 | ✅ 已提交 | ❌ 未部署 | ❌ 未修复 |
| BUG-4 | 新助教水牌初始状态为"下班" | ⚠️ 部分修复 | ❌ 未部署 | ⚠️ 部分修复 |

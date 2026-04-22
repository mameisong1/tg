你是测试员B。请执行API接口测试。

## 测试地址
- 后端API：http://127.0.0.1:8088
- **严禁使用 8081 和 8083 端口！**

## 测试用例
```
# 测试用例 - API 文件合并（api.js + api-v2.js）

## QA需求
合并 api.js 和 api-v2.js，删除 api-v2.js。

## 测试范围
- 编译验证
- 文件检查
- Import 检查

---

## 1. 编译测试

### 测试用例 1.1: H5 开发版本编译

**测试目的**：验证合并后代码能正常编译

**前置条件**：
- 已合并 api.js 和 api-v2.js
- 已修改所有引用 api-v2.js 的页面

**测试步骤**：
```bash
cd /TG/tgservice-uniapp
npm run build:h5:dev
```

**预期结果**：
- 编译成功，无错误
- 输出目录 `dist/build/h5/` 存在
- 无 module not found 错误
- 无 syntax error

**测试命令**：
```bash
# 执行编译
cd /TG/tgservice-uniapp && npm run build:h5:dev 2>&1 | tee /TG/temp/QA-20260422-04/build.log

# 检查编译结果
echo "=== 编译结果检查 ==="
if grep -q "error" /TG/temp/QA-20260422-04/build.log; then
  echo "❌ 编译失败，发现错误"
  grep -i "error" /TG/temp/QA-20260422-04/build.log
  exit 1
else
  echo "✅ 编译成功"
fi

# 检查输出目录
if [ -d "/TG/tgservice-uniapp/dist/build/h5" ]; then
  echo "✅ 输出目录存在"
else
  echo "❌ 输出目录不存在"
  exit 1
fi
```

---

## 2. 文件检查

### 测试用例 2.1: api-v2.js 文件删除验证

**测试目的**：确认 api-v2.js 已从源代码目录删除

**测试步骤**：
```bash
# 检查源代码目录
ls -la /TG/tgservice-uniapp/src/utils/api-v2.js
```

**预期结果**：
- 文件不存在（返回 No such file or directory）

**测试命令**：
```bash
echo "=== api-v2.js 文件检查 ==="
if [ -f "/TG/tgservice-uniapp/src/utils/api-v2.js" ]; then
  echo "❌ api-v2.js 仍然存在"
  ls -la /TG/tgservice-uniapp/src/utils/api-v2.js
  exit 1
else
  echo "✅ api-v2.js 已删除"
fi
```

### 测试用例 2.2: 编译产物中无 api-v2 引用

**测试目的**：确认编译后的产物中没有 api-v2 的残留

**测试步骤**：
```bash
# 检查编译产物
find /TG/tgservice-uniapp/dist -name "*api-v2*" 2>/dev/null
```

**预期结果**：
- 无输出（表示没有 api-v2 相关文件）

**测试命令**：
```bash
echo "=== 编译产物检查 ==="
api_v2_files=$(find /TG/tgservice-uniapp/dist -name "*api-v2*" 2>/dev/null)
if [ -n "$api_v2_files" ]; then
  echo "❌ 编译产物中存在 api-v2 相关文件："
  echo "$api_v2_files"
  exit 1
else
  echo "✅ 编译产物中无 api-v2 残留"
fi
```

---

## 3. Import 检查

### 测试用例 3.1: 源代码中无 api-v2 引用

**测试目的**：确认所有页面已修改为引用 api.js

**测试步骤**：
```bash
# 在源代码目录搜索 api-v2 引用
grep -r "api-v2" --include="*.js" --include="*.vue" /TG/tgservice-uniapp/src/
```

**预期结果**：
- 无输出（表示没有页面引用 api-v2.js）

**测试命令**：
```bash
echo "=== 源代码 Import 检查 ==="
api_v2_imports=$(grep -r "api-v2" --include="*.js" --include="*.vue" /TG/tgservice-uniapp/src/ 2>/dev/null)
if [ -n "$api_v2_imports" ]; then
  echo "❌ 发现 api-v2 引用："
  echo "$api_v2_imports"
  echo ""
  echo "受影响的文件数量："
  echo "$api_v2_imports" | wc -l
  exit 1
else
  echo "✅ 无 api-v2 引用"
fi
```

### 测试用例 3.2: api.js 包含合并的功能

**测试目的**：验证 api.js 已包含 api-v2.js 的所有导出

**前置条件**：
- api-v2.js 中的所有模块已迁移到 api.js

**测试步骤**：
```bash
# 检查 api.js 是否包含关键模块
grep -E "(waterBoards|serviceOrders|tableActionOrders|applications|guestInvitations|coachesV2|lejuanRecords|leaveCalendar|attendanceReview|guestRankings)" /TG/tgservice-uniapp/src/utils/api.js
```

**预期结果**：
- 所有模块名都能找到

**测试命令**：
```bash
echo "=== api.js 功能完整性检查 ==="
modules=("waterBoards" "serviceOrders" "tableActionOrders" "applications" "guestInvitations" "coachesV2" "lejuanRecords" "leaveCalendar" "attendanceReview" "guestRankings")

missing_modules=()
for module in "${modules[@]}"; do
  if ! grep -q "$module" /TG/tgservice-uniapp/src/utils/api.js; then
    missing_modules+=("$module")
  fi
done

if [ ${#missing_modules[@]} -gt 0 ]; then
  echo "❌ 缺少以下模块："
  for module in "${missing_modules[@]}"; do
    echo "  - $module"
  done
  exit 1
else
  echo "✅ 所有模块已合并到 api.js"
fi
```

---

## 4. 执行测试脚本

### 一键测试脚本

```bash
#!/bin/bash
# 文件: /TG/temp/QA-20260422-04/run-tests.sh

set -e

LOG_DIR="/TG/temp/QA-20260422-04"
echo "========================================"
echo "API 文件合并测试 - $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试函数
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo ""
  echo "--- $test_name ---"
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  if eval "$test_command"; then
    echo "✅ 通过"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo "❌ 失败"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
}

# 测试 1: api-v2.js 文件已删除
test_file_deleted() {
  if [ -f "/TG/tgservice-uniapp/src/utils/api-v2.js" ]; then
    echo "api-v2.js 仍然存在"
    return 1
  fi
  return 0
}
run_test "文件删除检查" "test_file_deleted"

# 测试 2: 源代码中无 api-v2 引用
test_no_imports() {
  local imports=$(grep -r "api-v2" --include="*.js" --include="*.vue" /TG/tgservice-uniapp/src/ 2>/dev/null || true)
  if [ -n "$imports" ]; then
    echo "发现引用："
    echo "$imports"
    return 1
  fi
  return 0
}
run_test "Import 检查" "test_no_imports"

# 测试 3: 编译测试
test_build() {
  cd /TG/tgservice-uniapp
  if npm run build:h5:dev > "$LOG_DIR/build.log" 2>&1; then
    if grep -q "error" "$LOG_DIR/build.log"; then
      echo "编译日志中发现错误"
      grep -i "error" "$LOG_DIR/build.log"
      return 1
    fi
    return 0
  else
    echo "编译失败，查看日志："
    tail -50 "$LOG_DIR/build.log"
    return 1
  fi
}
run_test "H5 编译测试" "test_build"

# 测试 4: api.js 功能完整性
test_api_completeness() {
  modules=("waterBoards" "serviceOrders" "tableActionOrders" "applications" "guestInvitations" "coachesV2" "lejuanRecords" "leaveCalendar" "attendanceReview" "guestRankings")
  
  for module in "${modules[@]}"; do
    if ! grep -q "$module" /TG/tgservice-uniapp/src/utils/api.js; then
      echo "缺少模块: $module"
      return 1
    fi
  done
  return 0
}
run_test "api.js 功能完整性" "test_api_completeness"

# 测试 5: 编译产物无 api-v2 残留
test_dist_clean() {
  local files=$(find /TG/tgservice-uniapp/dist -name "*api-v2*" 2>/dev/null || true)
  if [ -n "$files" ]; then
    echo "编译产物中发现 api-v2 文件："
    echo "$files"
    return 1
  fi
  return 0
}
run_test "编译产物检查" "test_dist_clean"

# 输出结果
echo ""
echo "========================================"
echo "测试结果汇总"
echo "========================================"
echo "总测试数: $TOTAL_TESTS"
echo "通过: $PASSED_TESTS"
echo "失败: $FAILED_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo "🎉 所有测试通过！"
  exit 0
else
  echo "⚠️  有 $FAILED_TESTS 个测试失败"
  exit 1
fi
```

---

## 5. 受影响的文件清单

### 当前引用 api-v2.js 的页面（需要修改）

```
src/pages/internal/table-action.vue
src/pages/internal/guest-invitation-stats.vue
src/pages/internal/clock.vue
src/pages/internal/rest-approval.vue
src/pages/internal/service-order.vue
src/pages/internal/lejuan.vue
src/pages/internal/leave-request-apply.vue
src/pages/internal/overtime-apply.vue
src/pages/internal/shift-change-approval.vue
src/pages/internal/invitation-upload.vue
src/pages/internal/leave-approval.vue
src/pages/internal/shift-change-apply.vue
src/pages/internal/missing-table-out-stats.vue
src/pages/internal/leave-calendar.vue
src/pages/internal/lejuan-list.vue
src/pages/internal/attendance-review.vue
src/pages/internal/rest-apply.vue
src/pages/internal/leave-request-approval.vue
src/pages/internal/leave-apply.vue
src/pages/internal/lejuan-proof.vue
src/pages/internal/water-board.vue
src/pages/internal/water-board-view.vue
src/pages/internal/overtime-approval.vue
src/pages/internal/cashier-dashboard.vue
src/pages/internal/invitation-review.vue
src/pages/member/member.vue
```

**共计：26 个文件**

### 修改方式

所有 `import ... from '@/utils/api-v2.js'` 应改为 `import ... from '@/utils/api.js'`

---

## 6. 验收标准

| 测试项 | 验收标准 |
|--------|----------|
| 编译测试 | `npm run build:h5:dev` 成功，无错误 |
| 文件删除 | `src/utils/api-v2.js` 不存在 |
| Import 检查 | `grep -r "api-v2" src/` 无结果 |
| 功能完整性 | api.js 包含所有 V2 模块 |
| 编译产物 | dist 目录无 api-v2 相关文件 |

---

**测试环境**：http://127.0.0.1:8088

**文档生成时间**：2026-04-22 22:00
```

## 测试策略
- **只用 API/curl 测试，不需要浏览器测试**
- 核心测试：通过 curl 调用后端API，验证接口逻辑
- 测试数据：先用 sqlite3 查数据库找现成数据，没有就直接 INSERT 创建
- 不要反复调 API 找数据，直接操作数据库更快

## curl 测试示例
```bash
# 查询
curl -s http://127.0.0.1:8088/api/xxx?param=value

# 提交
curl -s -X POST http://127.0.0.1:8088/api/xxx \
  -H 'Content-Type: application/json' \
  -d '{"key":"value"}'
```

## 验证要点
- 状态码是否符合预期（200/400/404）
- 响应体中的 success 字段
- 数据库中的数据是否正确写入

## 验收重点
1. 编译无错误（npm run build:h5:dev）
2. 所有内部页面功能正常（水牌、服务单、打卡、申请、审批等）
3. api-v2.js 已删除
4. 无运行时错误

## 输出要求
- 测试结果写入：/TG/temp/QA-20260422-04/test-results.md
- 格式：表格（用例ID、测试项、优先级、预期结果、实际结果、状态）
- 状态：✅通过 / ❌失败 / ⏭️跳过
#!/bin/bash
# API 文件合并测试脚本
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
    ls -la /TG/tgservice-uniapp/src/utils/api-v2.js
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
  echo "开始编译 H5 开发版本..."
  if npm run build:h5:dev > "$LOG_DIR/build.log" 2>&1; then
    if grep -qi "error" "$LOG_DIR/build.log"; then
      echo "编译日志中发现错误"
      grep -i "error" "$LOG_DIR/build.log" | head -20
      return 1
    fi
    echo "编译成功"
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
  
  missing=()
  for module in "${modules[@]}"; do
    if ! grep -q "$module" /TG/tgservice-uniapp/src/utils/api.js; then
      missing+=("$module")
    fi
  done
  
  if [ ${#missing[@]} -gt 0 ]; then
    echo "缺少模块："
    for m in "${missing[@]}"; do
      echo "  - $m"
    done
    return 1
  fi
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
  echo ""
  echo "合并成功，可以提交代码了。"
  exit 0
else
  echo "⚠️  有 $FAILED_TESTS 个测试失败"
  echo ""
  echo "请检查失败的测试项，修复后再运行测试。"
  exit 1
fi
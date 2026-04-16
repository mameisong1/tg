#!/bin/bash
# 乐捐报备预约时间范围调整 - API 接口测试 (v2)
# 修复: 每个用例之间重启PM2清理内存状态

set -euo pipefail

API="http://127.0.0.1:8088"
DB="/TG/tgservice/backend/db/tgservice.db"
COACH_NO=10005
EMPLOYEE_ID=5
RESULTS_FILE="/TG/temp/QA-20260417-1/test-results-v2.md"

# 获取token
get_token() {
  curl -s -X POST ${API}/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"tgadmin","password":"mms633268"}' \
    | grep -o '"token":"[^"]*"' | cut -d'"' -f4
}

# 清理函数: 直接DELETE记录 (不重启PM2，减少等待)
cleanup_records() {
  sqlite3 "$DB" "DELETE FROM lejuan_records WHERE coach_no = ${COACH_NO} AND lejuan_status IN ('pending', 'active');" 2>/dev/null
}

# 获取当前北京时间
CURRENT_DATE=$(TZ=Asia/Shanghai date +%Y-%m-%d)
CURRENT_HOUR=$(TZ=Asia/Shanghai date +%H)
CURRENT_TIME=$(TZ=Asia/Shanghai date +"%Y-%m-%d %H:%M:%S")
TOMORROW=$(TZ=Asia/Shanghai date -d "+1 day" +%Y-%m-%d)
DAY_AFTER=$(TZ=Asia/Shanghai date -d "+2 days" +%Y-%m-%d)
YESTERDAY=$(TZ=Asia/Shanghai date -d "-1 day" +%Y-%m-%d)

echo "当前时间: ${CURRENT_TIME}"
echo "明天: ${TOMORROW}, 后天: ${DAY_AFTER}, 昨天: ${YESTERDAY}"

# 先清理初始状态
cleanup_records
echo "初始清理完成"

# 重启PM2确保内存干净
pm2 restart tgservice-dev --silent 2>/dev/null || true
sleep 3

PASS=0
FAIL=0
DETAILS=""

run_test() {
  local tc_id="$1"
  local tc_name="$2"
  local priority="$3"
  local expect_http="$4"
  local body="$5"
  local expect_desc="$6"
  
  echo ""
  echo "--- ${tc_id}: ${tc_name} [${priority}] ---"
  
  # 获取新token
  local TOKEN=$(get_token)
  
  # 清理冲突记录
  cleanup_records
  
  # 发送请求
  local tmpfile=$(mktemp)
  local http_code
  http_code=$(curl -s -w "%{http_code}" -o "$tmpfile" \
    -X POST "${API}/api/lejuan-records" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "${body}")
  
  local response=$(cat "$tmpfile")
  rm -f "$tmpfile"
  
  echo "  HTTP: ${http_code}"
  echo "  Response: ${response:0:150}"
  
  # 判断
  local status="❌失败"
  local actual="${http_code}"
  
  if [ "$http_code" = "$expect_http" ]; then
    if [ "$expect_http" = "200" ] && echo "$response" | grep -q '"success"'; then
      status="✅通过"
      PASS=$((PASS + 1))
    elif [ "$expect_http" = "400" ] && echo "$response" | grep -q '"error"'; then
      status="✅通过"
      PASS=$((PASS + 1))
    fi
  fi
  
  if [ "$status" = "❌失败" ]; then
    FAIL=$((FAIL + 1))
  fi
  
  actual="${http_code} | $(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,ensure_ascii=False))" 2>/dev/null || echo "$response")"
  
  echo "  结果: ${status}"
  
  DETAILS="${DETAILS}
| ${tc_id} | ${tc_name} | ${priority} | HTTP ${expect_http} | ${actual} | ${status} |
| | | | | 预期: ${expect_desc} | |"
}

echo "=========================================="
echo "开始执行测试"
echo "=========================================="

# ============================================
# P0 核心用例
# ============================================

run_test \
  "TC-P0-01" \
  "当前小时预约（窗口未到预约14:00）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:00\",\"remark\":\"TC-P0-01\"}" \
  "HTTP 200, pending（03~13预约当天14:00）"

# Restart PM2 to clear timer memory
pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P0-02" \
  "未来小时预约（待出发）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 15:00:00\",\"remark\":\"TC-P0-02\"}" \
  "HTTP 200, lejuan_status=pending"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P0-03" \
  "预约次日00:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 00:00:00\",\"remark\":\"TC-P0-03\"}" \
  "HTTP 200, pending（次日00:00在窗口内）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P0-04" \
  "预约次日01:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 01:00:00\",\"remark\":\"TC-P0-04\"}" \
  "HTTP 200, pending（次日01:00在窗口内）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P0-05" \
  "预约次日02:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 02:00:00\",\"remark\":\"TC-P0-05\"}" \
  "HTTP 200, pending（窗口最后一个时段）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P0-06" \
  "窗口未到提前预约（03~13范围预约14:00）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:00\",\"remark\":\"TC-P0-06\"}" \
  "HTTP 200, pending（方案B核心用例）"

# ============================================
# P1 重要用例
# ============================================

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P1-01" \
  "次日03:00应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 03:00:00\",\"remark\":\"TC-P1-01\"}" \
  "HTTP 400, error（小时03不在窗口内）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P1-02" \
  "窗口外小时09:00应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 09:00:00\",\"remark\":\"TC-P1-02\"}" \
  "HTTP 400, error（小时09不在窗口内）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P1-03" \
  "过去时间应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${YESTERDAY} 20:00:00\",\"remark\":\"TC-P1-03\"}" \
  "HTTP 400, error（过去时间）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P1-04" \
  "后天00:00应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${DAY_AFTER} 00:00:00\",\"remark\":\"TC-P1-04\"}" \
  "HTTP 400, error（超出日期范围）"

# ============================================
# P2 次要用例
# ============================================

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P2-01" \
  "非整点时间应被拒绝" \
  "P2" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:30:00\",\"remark\":\"TC-P2-01\"}" \
  "HTTP 400, error（非整点）"

pm2 restart tgservice-dev --silent 2>/dev/null; sleep 2

run_test \
  "TC-P2-02" \
  "时间格式错误应被拒绝" \
  "P2" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"2026/04/17 14:00\",\"remark\":\"TC-P2-02\"}" \
  "HTTP 400, error（格式错误）"

# ============================================
# 写入结果
# ============================================

echo ""
echo "=========================================="
echo "测试完成: ✅通过 ${PASS} / ❌失败 ${FAIL} (共 $((PASS+FAIL)))"
echo "=========================================="

cat > "$RESULTS_FILE" << EOF
# 乐捐报备预约时间选择范围调整 - 测试结果

**测试时间**: $(TZ=Asia/Shanghai date '+%Y-%m-%d %H:%M:%S')
**测试地址**: ${API}
**测试数据**: employee_id=${EMPLOYEE_ID} (芝芝, coach_no=${COACH_NO})

## 测试概况
- 总计: $((PASS+FAIL)) 个用例
- 通过: ${PASS} ✅
- 失败: ${FAIL} ❌

## 测试结果

| 用例ID | 测试项 | 优先级 | 预期 | 实际 | 状态 |
|--------|--------|--------|------|------|------|
${DETAILS}
EOF

echo "结果已写入: ${RESULTS_FILE}"
echo ""
cat "$RESULTS_FILE"

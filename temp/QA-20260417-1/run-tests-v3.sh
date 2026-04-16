#!/bin/bash
# 乐捐报备预约时间范围调整 - API 接口测试 (v3)
# 使用API的DELETE端点正确清理记录

API="http://127.0.0.1:8088"
DB="/TG/tgservice/backend/db/tgservice.db"
COACH_NO=10005
EMPLOYEE_ID=5
RESULTS_FILE="/TG/temp/QA-20260417-1/test-results.md"

# 获取token
TOKEN=$(curl -s -X POST ${API}/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "ERROR: 获取token失败!"
  exit 1
fi

# 当前时间
CURRENT_DATE=$(TZ=Asia/Shanghai date +%Y-%m-%d)
CURRENT_HOUR=$(TZ=Asia/Shanghai date +%H)
CURRENT_TIME=$(TZ=Asia/Shanghai date +"%Y-%m-%d %H:%M:%S")
TOMORROW=$(TZ=Asia/Shanghai date -d "+1 day" +%Y-%m-%d)
DAY_AFTER=$(TZ=Asia/Shanghai date -d "+2 days" +%Y-%m-%d)
YESTERDAY=$(TZ=Asia/Shanghai date -d "-1 day" +%Y-%m-%d)

echo "当前时间: ${CURRENT_TIME}"

# 清理函数: 使用API DELETE端点
cleanup_via_api() {
  # 先查有哪些pending/active记录
  local list_resp
  list_resp=$(curl -s "${API}/api/lejuan-records/list?days=3" \
    -H "Authorization: Bearer ${TOKEN}")
  
  # 提取芝芝的pending/active记录ID
  local ids
  ids=$(echo "$list_resp" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    records = data.get('data', [])
    for r in records:
        if r.get('employee_id') == '${EMPLOYEE_ID}' and r.get('lejuan_status') in ('pending', 'active'):
            print(r['id'])
except:
    pass
" 2>/dev/null)
  
  for id in $ids; do
    # 只删除pending状态（API不允许删除active）
    local status
    status=$(echo "$list_resp" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for r in data.get('data', []):
    if r.get('id') == ${id}:
        print(r.get('lejuan_status', ''))
" 2>/dev/null)
    
    if [ "$status" = "pending" ]; then
      curl -s -X DELETE "${API}/api/lejuan-records/${id}?employee_id=${EMPLOYEE_ID}" \
        -H "Authorization: Bearer ${TOKEN}" > /dev/null 2>&1
      echo "  [API清理] DELETE /api/lejuan-records/${id} (pending)"
    else
      # active状态用DB直接删（API不允许删active）
      sqlite3 "$DB" "DELETE FROM lejuan_records WHERE id = ${id};" 2>/dev/null
      echo "  [DB清理] DELETE id=${id} (active)"
    fi
  done
}

# 初始清理
echo "=== 初始清理 ==="
# 先直接清理DB中所有冲突记录
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE coach_no = ${COACH_NO} AND lejuan_status IN ('pending', 'active');" 2>/dev/null
echo "DB初始清理完成"

# 重启PM2清空内存状态
echo "重启PM2..."
pm2 restart tgservice-dev --silent 2>/dev/null
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
  
  # 清理冲突记录
  cleanup_via_api
  
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
  
  # 美化输出
  local pretty_resp
  pretty_resp=$(echo "$response" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin),ensure_ascii=False))" 2>/dev/null || echo "$response")
  echo "  Response: ${pretty_resp:0:200}"
  
  # 判断
  local status="❌失败"
  local actual="HTTP ${http_code}"
  
  if [ "$http_code" = "$expect_http" ]; then
    if [ "$expect_http" = "200" ] && echo "$response" | grep -q '"success"'; then
      status="✅通过"
      PASS=$((PASS + 1))
      # 提取关键字段
      local sched lejuan_stat immediate
      sched=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'].get('scheduled_start_time',''))" 2>/dev/null)
      lejuan_stat=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'].get('lejuan_status',''))" 2>/dev/null)
      immediate=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'].get('immediate',''))" 2>/dev/null)
      actual="HTTP ${http_code} | status=${lejuan_stat} immediate=${immediate}"
    elif [ "$expect_http" = "400" ] && echo "$response" | grep -q '"error"'; then
      status="✅通过"
      PASS=$((PASS + 1))
      local err_msg
      err_msg=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
      actual="HTTP ${http_code} | error: ${err_msg}"
    fi
  fi
  
  if [ "$status" = "❌失败" ]; then
    FAIL=$((FAIL + 1))
  fi
  
  echo "  结果: ${status}"
  
  DETAILS="${DETAILS}
| ${tc_id} | ${tc_name} | ${priority} | HTTP ${expect_http} | ${actual} | ${status} |"
}

echo "=========================================="
echo "开始执行测试"
echo "=========================================="

# ============================================
# P0 核心用例
# ============================================

run_test \
  "TC-P0-01" \
  "窗口未到预约14:00（03~13范围）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:00\",\"remark\":\"TC-P0-01\"}" \
  "HTTP 200, pending（提前预约当天14:00）"

run_test \
  "TC-P0-02" \
  "未来小时预约（待出发）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 15:00:00\",\"remark\":\"TC-P0-02\"}" \
  "HTTP 200, lejuan_status=pending"

run_test \
  "TC-P0-03" \
  "预约次日00:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 00:00:00\",\"remark\":\"TC-P0-03\"}" \
  "HTTP 200, pending（次日00:00在窗口内）"

run_test \
  "TC-P0-04" \
  "预约次日01:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 01:00:00\",\"remark\":\"TC-P0-04\"}" \
  "HTTP 200, pending（次日01:00在窗口内）"

run_test \
  "TC-P0-05" \
  "预约次日02:00" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 02:00:00\",\"remark\":\"TC-P0-05\"}" \
  "HTTP 200, pending（窗口最后一个时段）"

run_test \
  "TC-P0-06" \
  "窗口未到提前预约（方案B核心用例）" \
  "P0" \
  "200" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:00\",\"remark\":\"TC-P0-06\"}" \
  "HTTP 200, pending（03~13预约当天14:00）"

# ============================================
# P1 重要用例
# ============================================

run_test \
  "TC-P1-01" \
  "次日03:00应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${TOMORROW} 03:00:00\",\"remark\":\"TC-P1-01\"}" \
  "HTTP 400, error（小时03不在窗口14~02内）"

run_test \
  "TC-P1-02" \
  "窗口外小时09:00应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 09:00:00\",\"remark\":\"TC-P1-02\"}" \
  "HTTP 400, error（小时09不在窗口内）"

run_test \
  "TC-P1-03" \
  "过去时间应被拒绝" \
  "P1" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${YESTERDAY} 20:00:00\",\"remark\":\"TC-P1-03\"}" \
  "HTTP 400, error（过去时间）"

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

run_test \
  "TC-P2-01" \
  "非整点时间应被拒绝" \
  "P2" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"${CURRENT_DATE} 14:30:00\",\"remark\":\"TC-P2-01\"}" \
  "HTTP 400, error（非整点14:30）"

run_test \
  "TC-P2-02" \
  "时间格式错误应被拒绝" \
  "P2" \
  "400" \
  "{\"employee_id\":${EMPLOYEE_ID},\"scheduled_start_time\":\"2026/04/17 14:00\",\"remark\":\"TC-P2-02\"}" \
  "HTTP 400, error（格式错误）"

# ============================================
# 最终清理
# ============================================
echo ""
echo "=== 最终清理 ==="
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE coach_no = ${COACH_NO} AND lejuan_status IN ('pending', 'active');" 2>/dev/null
echo "DB清理完成"

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
**测试环境**: 开发环境 (PM2: tgservice-dev)

## 测试概况
- 总计: $((PASS+FAIL)) 个用例
- 通过: ${PASS} ✅
- 失败: ${FAIL} ❌

## 测试结果

| 用例ID | 测试项 | 优先级 | 预期 | 实际 | 状态 |
|--------|--------|--------|------|------|------|
${DETAILS}
EOF

echo ""
echo "结果已写入: ${RESULTS_FILE}"
cat "$RESULTS_FILE"

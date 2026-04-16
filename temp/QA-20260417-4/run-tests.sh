#!/bin/bash
# QA-20260417-4 Test Runner - Tester B
# 当前时段: 02:00~13:59 (北京时间 ~07:21)

API="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"
RESULTS="/TG/temp/QA-20260417-4/test-results.md"
CURRENT_DATE=$(TZ='Asia/Shanghai' date +%Y-%m-%d)
NEXT_DATE=$(TZ='Asia/Shanghai' date -d 'tomorrow' +%Y-%m-%d)
CURRENT_HOUR=$(TZ='Asia/Shanghai' date +%-H)
NOW=$(TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M:%S')

# Results file
> "$RESULTS"

log_result() {
    echo "$1" >> "$RESULTS"
}

echo "=========================================="
echo "QA-20260417-4 API Test Runner"
echo "Time: $NOW (Beijing)"
echo "Current Hour: $CURRENT_HOUR"
echo "=========================================="

# ---- Step 1: Login ----
echo ""
echo ">>> Login..."
LOGIN_RESP=$(curl -s -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
echo "Login: $LOGIN_RESP"

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('token', d.get('data',{}).get('token','')))
except: print('')
" 2>/dev/null)
echo "Token: ${TOKEN:0:20}..."

# ============================
# TC-001 ~ TC-007: SKIP
# ============================
echo ">>> TC-001~TC-007: SKIPPED (time window mismatch, current=${CURRENT_HOUR}:00)"

# ============================
# TC-008 [P1] 提前预约14:00
# ============================
echo ""
echo ">>> TC-008: 提前预约14:00..."
TC008=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:00\",\"remark\":\"QA测试-提前预约14:00\"}")
TC008_BODY=$(echo "$TC008" | sed '/HTTP_CODE:/d')
TC008_CODE=$(echo "$TC008" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC008_CODE Body=${TC008_BODY}"

# ============================
# TC-009 [P0] 选择过去时间
# ============================
echo ">>> TC-009: 选择过去时间..."
PAST_HOUR=$(( CURRENT_HOUR - 2 ))
if [ $PAST_HOUR -lt 0 ]; then PAST_HOUR=$(( PAST_HOUR + 24 )); fi
PAST_PAD=$(printf "%02d" $PAST_HOUR)
TC009=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${CURRENT_DATE} ${PAST_PAD}:00:00\",\"remark\":\"QA测试-过去时间\"}")
TC009_BODY=$(echo "$TC009" | sed '/HTTP_CODE:/d')
TC009_CODE=$(echo "$TC009" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC009_CODE Body=${TC009_BODY}"

# ============================
# TC-010 [P0] 窗口关闭时段 (02/10/13:00)
# ============================
echo ">>> TC-010: 窗口关闭时段..."
TC010A=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${NEXT_DATE} 02:00:00\",\"remark\":\"QA-02:00\"}")
TC010A_CODE=$(echo "$TC010A" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')

TC010B=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${NEXT_DATE} 10:00:00\",\"remark\":\"QA-10:00\"}")
TC010B_CODE=$(echo "$TC010B" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')

TC010C=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${NEXT_DATE} 13:00:00\",\"remark\":\"QA-13:00\"}")
TC010C_CODE=$(echo "$TC010C" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  02:00=$TC010A_CODE, 10:00=$TC010B_CODE, 13:00=$TC010C_CODE"

# ============================
# TC-011 [P0] 非整点时间
# ============================
echo ">>> TC-011: 非整点时间..."
TC011A=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${CURRENT_DATE} 14:30:00\",\"remark\":\"QA-非整点\"}")
TC011A_CODE=$(echo "$TC011A" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')

TC011B=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${CURRENT_DATE} 14:00:30\",\"remark\":\"QA-秒非00\"}")
TC011B_CODE=$(echo "$TC011B" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  14:30:00=$TC011A_CODE, 14:00:30=$TC011B_CODE"

# ============================
# TC-012 [P1] 当天日期+00:00
# ============================
echo ">>> TC-012: 当天日期+00:00..."
TC012=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${CURRENT_DATE} 00:00:00\",\"remark\":\"QA-当天+00:00\"}")
TC012_BODY=$(echo "$TC012" | sed '/HTTP_CODE:/d')
TC012_CODE=$(echo "$TC012" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC012_CODE Body=${TC012_BODY}"

# ============================
# TC-013 [P1] SKIP (need 0~1 point window)
# ============================
echo ">>> TC-013: SKIPPED (need 00:00~01:59 window)"

# ============================
# TC-014 [P0] 缺少必填字段
# ============================
echo ">>> TC-014: 缺少必填字段..."
TC014A=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"scheduled_start_time":"2026-04-17 15:00:00","remark":"测试"}')
TC014A_CODE=$(echo "$TC014A" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
TC014A_BODY=$(echo "$TC014A" | sed '/HTTP_CODE:/d')

TC014B=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"employee_id":"1","remark":"测试"}')
TC014B_CODE=$(echo "$TC014B" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
TC014B_BODY=$(echo "$TC014B" | sed '/HTTP_CODE:/d')
echo "  no_emp=$TC014A_CODE, no_time=$TC014B_CODE"

# ============================
# TC-015 [P1] 助教不存在
# ============================
echo ">>> TC-015: 助教不存在..."
TC015=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"999999\",\"scheduled_start_time\":\"${NEXT_DATE} 14:00:00\",\"remark\":\"QA-不存在\"}")
TC015_BODY=$(echo "$TC015" | sed '/HTTP_CODE:/d')
TC015_CODE=$(echo "$TC015" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC015_CODE Body=${TC015_BODY}"

# ============================
# TC-016 [P1] 重复提交
# ============================
echo ">>> TC-016: 重复提交..."
sqlite3 "$DB" "INSERT INTO lejuan_records (coach_no, employee_id, stage_name, scheduled_start_time, lejuan_status, created_at, updated_at) VALUES ('10125', '10125', '测试小A', '${NEXT_DATE} 14:00:00', 'pending', datetime('now'), datetime('now'));"

TC016=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"10125\",\"scheduled_start_time\":\"${NEXT_DATE} 15:00:00\",\"remark\":\"QA-重复\"}")
TC016_BODY=$(echo "$TC016" | sed '/HTTP_CODE:/d')
TC016_CODE=$(echo "$TC016" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC016_CODE Body=${TC016_BODY}"

sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id='10125' AND stage_name='测试小A';"

# ============================
# TC-017 [P1] 前端代码审查
# ============================
echo ">>> TC-017: 前端代码审查..."
LEJUAN="/TG/tgservice-uniapp/src/pages/internal/lejuan.vue"
HAS_COMPUTED=$(grep -c "hourOptions" "$LEJUAN" 2>/dev/null || echo 0)
HAS_0=$(grep -c "h === 0" "$LEJUAN" 2>/dev/null || echo 0)
HAS_1=$(grep -c "h === 1" "$LEJUAN" 2>/dev/null || echo 0)
HAS_2_14=$(grep -c "h >= 2 && h < 14" "$LEJUAN" 2>/dev/null || echo 0)
echo "  hourOptions=$HAS_COMPUTED, h===0=$HAS_0, h===1=$HAS_1, h>=2&&h<14=$HAS_2_14"

# ============================
# TC-018 [P0] 后端02:00校验 (BUG-001已修复)
# ============================
echo ">>> TC-018: 后端02:00校验..."
TC018=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API/api/lejuan-records" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"employee_id\":\"1\",\"scheduled_start_time\":\"${NEXT_DATE} 02:00:00\",\"remark\":\"QA-02:00\"}")
TC018_BODY=$(echo "$TC018" | sed '/HTTP_CODE:/d')
TC018_CODE=$(echo "$TC018" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC018_CODE Body=${TC018_BODY}"

# ============================
# TC-019 [P1] 我的乐捐记录
# ============================
echo ">>> TC-019: 我的乐捐记录..."
TC019=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API/api/lejuan-records/my?employee_id=1" \
  -H "Authorization: Bearer ${TOKEN}")
TC019_BODY=$(echo "$TC019" | sed '/HTTP_CODE:/d')
TC019_CODE=$(echo "$TC019" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC019_CODE"

# ============================
# TC-020 [P2] 乐捐一览
# ============================
echo ">>> TC-020: 乐捐一览..."
TC020=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API/api/lejuan-records/list?status=all&days=3" \
  -H "Authorization: Bearer ${TOKEN}")
TC020_BODY=$(echo "$TC020" | sed '/HTTP_CODE:/d')
TC020_CODE=$(echo "$TC020" | grep 'HTTP_CODE:' | sed 's/HTTP_CODE://')
echo "  HTTP=$TC020_CODE"

# ============================
# Clean up TC-008 record
# ============================
echo ""
echo ">>> Cleaning up TC-008 test data..."
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE remark='QA测试-提前预约14:00';"

# ============================
# Build Results Markdown
# ============================
echo ""
echo ">>> Building results markdown..."

# Helper: evaluate status
eval_status() {
    local code="$1" expected="$2"
    if [ "$code" = "$expected" ]; then echo "✅"
    else echo "❌"
    fi
}

# TC-008
S=$(echo "$TC008_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('lejuan_status',''))" 2>/dev/null)
if [ "$TC008_CODE" = "200" ] && [ "$S" = "pending" ]; then TC008_STATUS="✅"; else TC008_STATUS="❌"; fi

# TC-009
if [ "$TC009_CODE" = "400" ]; then TC009_STATUS="✅"; else TC009_STATUS="❌"; fi

# TC-010
if [ "$TC010A_CODE" = "400" ] && [ "$TC010B_CODE" = "400" ] && [ "$TC010C_CODE" = "400" ]; then TC010_STATUS="✅"; else TC010_STATUS="❌"; fi

# TC-011
if [ "$TC011A_CODE" = "400" ] && [ "$TC011B_CODE" = "400" ]; then TC011_STATUS="✅"; else TC011_STATUS="❌"; fi

# TC-012
if [ "$TC012_CODE" = "400" ]; then TC012_STATUS="✅"; else TC012_STATUS="❌"; fi

# TC-014
if [ "$TC014A_CODE" = "400" ] && [ "$TC014B_CODE" = "400" ]; then TC014_STATUS="✅"; else TC014_STATUS="❌"; fi

# TC-015
if [ "$TC015_CODE" = "404" ] || [ "$TC015_CODE" = "400" ]; then TC015_STATUS="✅"; else TC015_STATUS="❌"; fi

# TC-016
if [ "$TC016_CODE" = "400" ]; then TC016_STATUS="✅"; else TC016_STATUS="❌"; fi

# TC-017
if [ "$HAS_COMPUTED" -gt 0 ] && [ "$HAS_0" -gt 0 ] && [ "$HAS_1" -gt 0 ] && [ "$HAS_2_14" -gt 0 ]; then TC017_STATUS="✅"; else TC017_STATUS="❌"; fi

# TC-018
if [ "$TC018_CODE" = "400" ]; then TC018_STATUS="✅"; else TC018_STATUS="❌"; fi

# TC-019
if [ "$TC019_CODE" = "200" ]; then TC019_STATUS="✅"; else TC019_STATUS="❌"; fi

# TC-020
if [ "$TC020_CODE" = "200" ]; then TC020_STATUS="✅"; else TC020_STATUS="❌"; fi

cat >> "$RESULTS" << 'HEADER'
# QA-20260417-4 测试结果

> 乐捐报备时间选择范围 QA 测试
> 测试环境：http://127.0.0.1:8088
> 测试时间：
HEADER

echo "$NOW (北京时间)" >> "$RESULTS"
echo "" >> "$RESULTS"
echo "## 测试执行摘要" >> "$RESULTS"
echo "" >> "$RESULTS"
echo "| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |" >> "$RESULTS"
echo "|--------|--------|--------|----------|----------|------|" >> "$RESULTS"
echo "| TC-001 | 创建乐捐报备—当前小时（14~23点） | P0 | 200, immediate=true | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-002 | 创建乐捐报备—预约未来小时（14~23点） | P0 | 200, immediate=false | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-003 | 创建乐捐报备—次日00:00（23点时段） | P0 | 200, pending | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-004 | 创建乐捐报备—次日01:00（23点时段） | P0 | 200, pending | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-005 | 创建乐捐报备—00:00时段选00:00 | P1 | 200, immediate=true | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-006 | 创建乐捐报备—00:00时段选01:00 | P1 | 200, pending | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-007 | 创建乐捐报备—01:00时段选01:00 | P0 | 200, immediate=true | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-008 | 创建乐捐报备—提前预约14:00 | P1 | 200, pending | HTTP $TC008_CODE, status=$S | $TC008_STATUS |" >> "$RESULTS"
echo "| TC-009 | 创建乐捐报备—选择过去时间 | P0 | 400 | HTTP $TC009_CODE | $TC009_STATUS |" >> "$RESULTS"
echo "| TC-010 | 创建乐捐报备—窗口关闭时段(02/10/13:00) | P0 | 400 x3 | HTTP $TC010A_CODE/$TC010B_CODE/$TC010C_CODE | $TC010_STATUS |" >> "$RESULTS"
echo "| TC-011 | 创建乐捐报备—非整点时间 | P0 | 400 x2 | HTTP $TC011A_CODE/$TC011B_CODE | $TC011_STATUS |" >> "$RESULTS"
echo "| TC-012 | 创建乐捐报备—当天日期+00:00 | P1 | 400 | HTTP $TC012_CODE | $TC012_STATUS |" >> "$RESULTS"
echo "| TC-013 | 创建乐捐报备—凌晨选当天14点 | P1 | 400 | 时段不匹配(当前${CURRENT_HOUR}点) | ⏭️ |" >> "$RESULTS"
echo "| TC-014 | 创建乐捐报备—缺少必填字段 | P0 | 400 x2 | HTTP $TC014A_CODE/$TC014B_CODE | $TC014_STATUS |" >> "$RESULTS"
echo "| TC-015 | 创建乐捐报备—助教不存在 | P1 | 404或400 | HTTP $TC015_CODE | $TC015_STATUS |" >> "$RESULTS"
echo "| TC-016 | 创建乐捐报备—已有pending记录 | P1 | 400 | HTTP $TC016_CODE | $TC016_STATUS |" >> "$RESULTS"
echo "| TC-017 | 前端hourOptions代码审查 | P1 | 逻辑正确 | 代码检查: [0][$HAS_0],[1][$HAS_1],[2~13][$HAS_2_14] | $TC017_STATUS |" >> "$RESULTS"
echo "| TC-018 | 创建乐捐报备—02:00应被拒绝(BU
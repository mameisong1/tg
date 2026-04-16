#!/bin/bash
BASE="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass_count=0
fail_count=0

log_pass() { echo -e "${GREEN}[✅ PASS]${NC} $1"; ((pass_count++)); }
log_fail() { echo -e "${RED}[❌ FAIL]${NC} $1"; ((fail_count++)); }

# Get token
TOKEN=$(curl -s -X POST "$BASE/api/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"tgadmin","password":"mms633268"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN:0:20}..."

# ============================================================
# TC-005: 审批通过公休申请 - table_no 必须清除 (P0)
# ============================================================
echo ""
echo "=========================================="
echo "TC-005: 审批通过公休申请 - table_no 必须清除 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

# 插入公休申请 (无 apply_date 字段)
APP_ID=$(sqlite3 "$DB" "INSERT INTO applications (applicant_phone, application_type, status) VALUES ('10999', '公休申请', 0); SELECT last_insert_rowid();")
echo "创建公休申请 ID=$APP_ID"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/applications/$APP_ID/approve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"approveStatus":1}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "公休" ] && [ -z "$TABLE_NO" ]; then
    log_pass "TC-005: 审批公休后 table_no 已清除"
else
    log_fail "TC-005: 期望 status=公休, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-006: 批量修改班次 - table_no 应保留 (P1)
# ============================================================
echo ""
echo "=========================================="
echo "TC-006: 批量修改班次 - table_no 应保留 (P1)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/coaches/v2/batch-shift" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"coach_no_list":["10999"],"shift":"晚班"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "晚班上桌" ] && [ "$TABLE_NO" = "QA台1" ]; then
    log_pass "TC-006: 批量修改班次后 table_no 保留"
else
    log_fail "TC-006: 期望 status=晚班上桌, table_no=QA台1, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-010 (补充): 操作日志记录
# ============================================================
echo ""
echo "=========================================="
echo "TC-010: 操作日志记录 (P1)"
echo "=========================================="

LOG=$(sqlite3 "$DB" "SELECT operation_type, old_value, new_value FROM operation_logs WHERE target_type='water_board' ORDER BY id DESC LIMIT 3;")
echo "Recent logs:"
echo "$LOG"

if echo "$LOG" | grep -q "table_no"; then
    log_pass "TC-010: 操作日志包含 table_no 信息"
else
    log_fail "TC-010: 操作日志缺少 table_no 信息"
fi

# ============================================================
# TC-013: 晚班空闲→休息 (P0) - 验证非工作状态也清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-013: 晚班空闲→休息 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='晚班空闲', table_no='QA台2' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='晚班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"休息"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "休息" ] && [ -z "$TABLE_NO" ]; then
    log_pass "TC-013: 晚班空闲→休息, table_no 已清除"
else
    log_fail "TC-013: 期望 status=休息, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-014: 乐捐→休息 (P1) - 验证乐捐状态也清除table_no
# ============================================================
echo ""
echo "=========================================="
echo "TC-014: 乐捐→休息 (P1)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='乐捐', table_no='QA台3' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"休息"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "休息" ] && [ -z "$TABLE_NO" ]; then
    log_pass "TC-014: 乐捐→休息, table_no 已清除"
else
    log_fail "TC-014: 期望 status=休息, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

echo ""
echo "=========================================="
echo "📊 补充测试结果汇总"
echo "=========================================="
echo -e "✅ 通过: $pass_count"
echo -e "❌ 失败: $fail_count"
echo "=========================================="

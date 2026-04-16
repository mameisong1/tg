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

TOKEN=$(curl -s -X POST "$BASE/api/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"tgadmin","password":"mms633268"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# ============================================================
# TC-005 (fix): 审批通过公休申请 - 用 status 字段
# ============================================================
echo ""
echo "=========================================="
echo "TC-005: 审批通过公休申请 - table_no 必须清除 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

# 先清理旧的申请记录
sqlite3 "$DB" "DELETE FROM applications WHERE applicant_phone='10999' AND status=0;"

APP_ID=$(sqlite3 "$DB" "INSERT INTO applications (applicant_phone, application_type, status) VALUES ('10999', '公休申请', 0); SELECT last_insert_rowid();")
echo "创建公休申请 ID=$APP_ID"

# 用 status 而不是 approveStatus
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/applications/$APP_ID/approve" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":1}')

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
# TC-010: 操作日志检查
# ============================================================
echo ""
echo "=========================================="
echo "TC-010: 操作日志记录 (P1)"
echo "=========================================="

# Check if water_board logs exist at all
WB_LOGS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM operation_logs WHERE target_type='water_board';")
echo "Total water_board logs: $WB_LOGS"

# Check recent logs
sqlite3 "$DB" "SELECT id, operation_type, target_type, substr(remark,1,60) FROM operation_logs ORDER BY id DESC LIMIT 5;"

# Check if the water-boards status change logs exist
WB_CHANGE_LOGS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM operation_logs WHERE operation_type='水牌状态变更';")
echo "水牌状态变更 logs: $WB_CHANGE_LOGS"

if [ "$WB_CHANGE_LOGS" -gt 0 ]; then
    log_pass "TC-010: 存在水牌状态变更操作日志"
else
    log_fail "TC-010: 缺少水牌状态变更操作日志"
fi

# ============================================================
# TC-015: 水牌状态改为加班 - table_no 应保留（工作状态）
# ============================================================
echo ""
echo "=========================================="
echo "TC-015: 早班空闲→早加班 - table_no 应保留 (P1)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"早加班"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP: $HTTP_CODE"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
echo "DB status=$STATUS, table_no='$TABLE_NO'"

# 加班是工作状态，table_no 应保留
if [ "$STATUS" = "早加班" ] && [ "$TABLE_NO" = "QA台1" ]; then
    log_pass "TC-015: 早班空闲→早加班, table_no 保留"
else
    log_fail "TC-015: 期望 status=早加班, table_no=QA台1, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# 汇总
# ============================================================
echo ""
echo "=========================================="
echo "📊 补充测试结果汇总"
echo "=========================================="
echo -e "✅ 通过: $pass_count"
echo -e "❌ 失败: $fail_count"
echo "=========================================="

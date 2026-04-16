#!/bin/bash
BASE="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

TOKEN=$(curl -s -X POST "$BASE/api/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"tgadmin","password":"mms633268"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "=========================================="
echo "TC-005 (retest): 审批通过公休申请"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班', phone='13900001999', employee_id='10999' WHERE coach_no='10999';"

# 清理旧申请
sqlite3 "$DB" "DELETE FROM applications WHERE applicant_phone='10999';"

APP_ID=$(sqlite3 "$DB" "INSERT INTO applications (applicant_phone, application_type, status) VALUES ('10999', '公休申请', 0); SELECT last_insert_rowid();")
echo "创建公休申请 ID=$APP_ID"

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
    echo -e "${GREEN}[✅ PASS]${NC} TC-005: 审批公休后 table_no 已清除"
else
    echo -e "${RED}[❌ FAIL]${NC} TC-005: 期望 status=公休, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

#!/bin/bash
# QA-20260417-10 API Test Runner
# 会员管理-同步助教功能

set -e

API="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"

echo "=========================================="
echo " Step 0.1: Get Admin Token"
echo "=========================================="
TOKEN_RAW=$(curl -s -X POST "$API/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
echo "Login response: $TOKEN_RAW"

TOKEN=$(echo "$TOKEN_RAW" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('token', d.get('data',{}).get('token','')))" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  TOKEN=$(echo "$TOKEN_RAW" | python3 -c "
import json,sys
d=json.load(sys.stdin)
# try various paths
for path in [d, d.get('data',{})]:
  t = path.get('token') if isinstance(path,dict) else None
  if t: print(t); sys.exit()
# fallback: just print the raw json
print(json.dumps(d))
" 2>/dev/null)
fi
echo "TOKEN: ${TOKEN:0:30}..."

echo ""
echo "=========================================="
echo " Step 0.3: Create Test Data"
echo "=========================================="

sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (101, '16675852676', '', '', '');"
sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (102, '18775703862', '张三', '男', '');"
sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (103, '13800000000', '王五', '男', '已有备注');"
sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (104, '15907641078', NULL, NULL, 'VIP会员');"
sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (105, '15382776509', '', '女', '');"

echo "Test data inserted."
echo ""
echo "Verify members:"
sqlite3 "$DB" "SELECT member_no, phone, name, gender, remark FROM members WHERE member_no IN (101,102,103,104,105);"
echo ""
echo "Verify coaches:"
sqlite3 "$DB" "SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE phone IN ('16675852676','18775703862','13800000000','15907641078','15382776509');"

echo ""
echo "=========================================="
echo " TC-001: Preview API - Return matching list"
echo "=========================================="
TC001_RESP=$(curl -s -w "\n%{http_code}" "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN")
TC001_CODE=$(echo "$TC001_RESP" | tail -1)
TC001_BODY=$(echo "$TC001_RESP" | sed '$d')
echo "HTTP $TC001_CODE"
echo "Body: $TC001_BODY" | head -c 2000
echo ""

echo "=========================================="
echo " TC-002: Preview - No match scenario"
echo "=========================================="
TC002_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM members m INNER JOIN coaches c ON m.phone = c.phone;")
echo "Match count in DB: $TC002_COUNT"
echo "(If > 0, this test verifies the logic works with data)"

echo "=========================================="
echo " TC-003: Preview - No token"
echo "=========================================="
TC003_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/admin/members/sync-coaches/preview")
echo "HTTP $TC003_CODE (expected: 401)"

echo "=========================================="
echo " TC-004: Preview - Invalid token"
echo "=========================================="
TC004_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer invalid_token_12345")
echo "HTTP $TC004_CODE (expected: 401 or 403)"

echo "=========================================="
echo " TC-005: Sync - Empty name+gender+remark"
echo "=========================================="
echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 101;"

TC005_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}')
TC005_CODE=$(echo "$TC005_RESP" | tail -1)
TC005_BODY=$(echo "$TC005_RESP" | sed '$d')
echo "HTTP $TC005_CODE"
echo "Body: $TC005_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 101;"

echo "=========================================="
echo " TC-006: Sync - Name and gender preserved"
echo "=========================================="
echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 102;"

TC006_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[102]}')
TC006_CODE=$(echo "$TC006_RESP" | tail -1)
TC006_BODY=$(echo "$TC006_RESP" | sed '$d')
echo "HTTP $TC006_CODE"
echo "Body: $TC006_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 102;"

echo "=========================================="
echo " TC-007: Sync - Remark append"
echo "=========================================="
echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 104;"

TC007_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[104]}')
TC007_CODE=$(echo "$TC007_RESP" | tail -1)
TC007_BODY=$(echo "$TC007_RESP" | sed '$d')
echo "HTTP $TC007_CODE"
echo "Body: $TC007_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 104;"

echo "=========================================="
echo " TC-008: Sync - Gender preserved, name empty"
echo "=========================================="
echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 105;"

TC008_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[105]}')
TC008_CODE=$(echo "$TC008_RESP" | tail -1)
TC008_BODY=$(echo "$TC008_RESP" | sed '$d')
echo "HTTP $TC008_CODE"
echo "Body: $TC008_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 105;"

echo "=========================================="
echo " TC-009: Batch sync multiple members"
echo "=========================================="
sqlite3 "$DB" "DELETE FROM members WHERE member_no IN (201,202,203);"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (201, '16675852676', '', '', '');"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (202, '18775703862', '', '', '');"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (203, '19928028091', '', '', '');"

TC009_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[201,202,203]}')
TC009_CODE=$(echo "$TC009_RESP" | tail -1)
TC009_BODY=$(echo "$TC009_RESP" | sed '$d')
echo "HTTP $TC009_CODE"
echo "Body: $TC009_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no IN (201,202,203) ORDER BY member_no;"

echo "=========================================="
echo " TC-010: Sync - Non-existent member"
echo "=========================================="
TC010_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[999999]}')
TC010_CODE=$(echo "$TC010_RESP" | tail -1)
TC010_BODY=$(echo "$TC010_RESP" | sed '$d')
echo "HTTP $TC010_CODE"
echo "Body: $TC010_BODY"

echo "=========================================="
echo " TC-011: Sync - No matching coach"
echo "=========================================="
TC011_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[103]}')
TC011_CODE=$(echo "$TC011_RESP" | tail -1)
TC011_BODY=$(echo "$TC011_RESP" | sed '$d')
echo "HTTP $TC011_CODE"
echo "Body: $TC011_BODY"

echo "Verify no change:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 103;"

echo "=========================================="
echo " TC-012: Sync - Empty memberNos"
echo "=========================================="
TC012_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[]}')
TC012_CODE=$(echo "$TC012_RESP" | tail -1)
TC012_BODY=$(echo "$TC012_RESP" | sed '$d')
echo "HTTP $TC012_CODE"
echo "Body: $TC012_BODY"

echo "=========================================="
echo " TC-013: Sync - memberNos as string"
echo "=========================================="
TC013_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":"101"}')
TC013_CODE=$(echo "$TC013_RESP" | tail -1)
TC013_BODY=$(echo "$TC013_RESP" | sed '$d')
echo "HTTP $TC013_CODE"
echo "Body: $TC013_BODY"

echo "=========================================="
echo " TC-014: Sync - No auth"
echo "=========================================="
TC014_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}')
echo "HTTP $TC014_CODE (expected: 401)"

echo "=========================================="
echo " TC-015: Phone exact match"
echo "=========================================="
sqlite3 "$DB" "DELETE FROM members WHERE member_no = 301;"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (301, '16675852677', '', '', '');"

TC015_RESP=$(curl -s "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN")
TC015_MATCH=$(echo "$TC015_RESP" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, list):
    matched = [m for m in data if m.get('member_no') == 301]
    print('member_no=301 in preview:', len(matched) > 0)
elif isinstance(data, dict):
    items = data.get('data', data.get('items', data.get('list', [])))
    if isinstance(items, list):
        matched = [m for m in items if m.get('member_no') == 301]
        print('member_no=301 in preview:', len(matched) > 0)
    else:
        print('Unexpected dict response:', json.dumps(data)[:200])
else:
    print('Unexpected response type')
" 2>/dev/null)
echo "$TC015_MATCH"

echo "=========================================="
echo " TC-016: One-to-many phone match"
echo "=========================================="
TC016_DUP=$(sqlite3 "$DB" "SELECT phone, COUNT(*) as cnt FROM coaches WHERE phone IS NOT NULL AND phone != '' GROUP BY phone HAVING cnt > 1;")
echo "Duplicate phones in coaches: [$TC016_DUP]"
if [ -z "$TC016_DUP" ]; then
  echo "No duplicate phones found - test skipped (no one-to-many scenario exists)"
fi

echo "=========================================="
echo " TC-017: Remark format verification"
echo "=========================================="
# TC-017 depends on TC-005 already run (member_no=101 synced)
REMARK101=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = 101;")
echo "Remark for 101: [$REMARK101]"
if echo "$REMARK101" | grep -qP '^\[助教\]工号:.+ 艺名:.+$'; then
  echo "✅ Remark format correct"
else
  echo "❌ Remark format incorrect"
fi

echo "=========================================="
echo " TC-018: Remark append separator"
echo "=========================================="
REMARK104=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = 104;")
echo "Remark for 104: [$REMARK104]"
if echo "$REMARK104" | grep -qP '^VIP会员 \[助教\]工号:.+ 艺名:.+$'; then
  echo "✅ Remark append format correct"
else
  echo "❌ Remark append format incorrect"
fi

echo "=========================================="
echo " TC-019: Gender space handling"
echo "=========================================="
sqlite3 "$DB" "DELETE FROM members WHERE member_no = 302;"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (302, '13420329198', '', ' ', '');"

TC019_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[302]}')
TC019_CODE=$(echo "$TC019_RESP" | tail -1)
TC019_BODY=$(echo "$TC019_RESP" | sed '$d')
echo "HTTP $TC019_CODE"
echo "Body: $TC019_BODY"

sqlite3 "$DB" "SELECT name, gender FROM members WHERE member_no = 302;"

echo "=========================================="
echo " TC-020: Name space handling"
echo "=========================================="
sqlite3 "$DB" "DELETE FROM members WHERE member_no = 303;"
sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (303, '15989148331', ' ', '', '');"

TC020_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[303]}')
TC020_CODE=$(echo "$TC020_RESP" | tail -1)
TC020_BODY=$(echo "$TC020_RESP" | sed '$d')
echo "HTTP $TC020_CODE"
echo "Body: $TC020_BODY"

sqlite3 "$DB" "SELECT name, gender FROM members WHERE member_no = 303;"

echo "=========================================="
echo " TC-021: Idempotency - Repeat sync"
echo "=========================================="
TC021_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}')
TC021_CODE=$(echo "$TC021_RESP" | tail -1)
TC021_BODY=$(echo "$TC021_RESP" | sed '$d')
echo "HTTP $TC021_CODE"
echo "Body: $TC021_BODY"

sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 101;"

echo "=========================================="
echo " TC-022: Mixed success/failure"
echo "=========================================="
# Need fresh 101 data - reset it first
sqlite3 "$DB" "UPDATE members SET name='', gender='', remark='[助教]工号:歪歪 艺名:歪歪' WHERE member_no = 101;"

TC022_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101, 999999, 103]}')
TC022_CODE=$(echo "$TC022_RESP" | tail -1)
TC022_BODY=$(echo "$TC022_RESP" | sed '$d')
echo "HTTP $TC022_CODE"
echo "Body: $TC022_BODY"

echo "=========================================="
echo " TC-023: No sensitive fields in preview"
echo "=========================================="
TC023_RESP=$(curl -s "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN")
echo "$TC023_RESP" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if isinstance(data, list) and len(data) > 0:
    keys = set(data[0].keys())
    print('Fields:', sorted(keys))
    if 'coach_no' in keys:
        print('⚠️ Returned coach_no')
    else:
        print('✅ No coach_no')
elif isinstance(data, dict):
    items = data.get('data', data.get('items', data.get('list', [])))
    if isinstance(items, list) and len(items) > 0:
        keys = set(items[0].keys())
        print('Fields:', sorted(keys))
        if 'coach_no' in keys:
            print('⚠️ Returned coach_no')
        else:
            print('✅ No coach_no')
    else:
        print('No items in dict response')
else:
    print('Unexpected response')
" 2>/dev/null

echo "=========================================="
echo " TC-024: updated_at updated after sync"
echo "=========================================="
BEFORE=$(sqlite3 "$DB" "SELECT updated_at FROM members WHERE member_no = 105;")
echo "Before updated_at: $BEFORE"
sleep 1

TC024_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/admin/members/sync-coaches" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[105]}')
TC024_CODE=$(echo "$TC024_RESP" | tail -1)
TC024_BODY=$(echo "$TC024_RESP" | sed '$d')
echo "HTTP $TC024_CODE"

AFTER=$(sqlite3 "$DB" "SELECT updated_at FROM members WHERE member_no = 105;")
echo "After updated_at: $AFTER"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "✅ updated_at changed"
else
  echo "❌ updated_at not changed"
fi

echo "=========================================="
echo " TC-025: Frontend sync button"
echo "=========================================="
TC025_RESULT=$(grep -c "同步助教\|syncCoaches\|sync-coaches" /TG/tgservice/admin/members.html 2>/dev/null || echo "0")
echo "Found $TC025_RESULT matches for sync button in members.html"
if [ "$TC025_RESULT" -gt "0" ]; then
  grep -n "同步助教\|syncCoaches\|sync-coaches" /TG/tgservice/admin/members.html
else
  echo "No sync button found"
fi

echo "=========================================="
echo " TC-026: Frontend sync modal"
echo "=========================================="
TC026_RESULT=$(grep -c "syncModal\|sync.*modal\|sync.*dialog\|同步清单" /TG/tgservice/admin/members.html 2>/dev/null || echo "0")
echo "Found $TC026_RESULT matches for sync modal in members.html"
if [ "$TC026_RESULT" -gt "0" ]; then
  grep -n "syncModal\|sync.*modal\|sync.*dialog\|同步清单" /TG/tgservice/admin/members.html
else
  echo "No sync modal found"
fi

echo "=========================================="
echo " TC-029: Resigned coach filter"
echo "=========================================="
RESIGNED=$(sqlite3 "$DB" "SELECT coach_no, employee_id, stage_name, phone, status FROM coaches WHERE status = '离职' AND phone IS NOT NULL AND phone != '';")
echo "Resigned coaches with phone: [$RESIGNED]"
if [ -z "$RESIGNED" ]; then
  echo "No resigned coaches with phone found - test skipped"
fi

echo "=========================================="
echo " TC-030: Member with empty phone"
echo "=========================================="
sqlite3 "$DB" "SELECT member_no, phone FROM members WHERE phone IS NULL OR phone = '' LIMIT 5;"
TC030_RESP=$(curl -s "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN")
echo "Preview response (first 500 chars):"
echo "$TC030_RESP" | head -c 500

echo ""
echo "=========================================="
echo " ALL TESTS COMPLETE"
echo "=========================================="

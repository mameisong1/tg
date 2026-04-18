#!/bin/bash
# QA-20260417-10 API Test Runner v2
# 会员管理-同步助教功能 - 基于实际 API 实现

API="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"
RESULTS_FILE="/TG/temp/QA-20260417-10/test-results.md"

# Results array
declare -A TC_STATUS
declare -A TC_RESULT
declare -A TC_ACTUAL

# Get admin token
echo "=== Step 0.1: Get Token ==="
LOGIN_RESP=$(curl -s -X POST "$API/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
echo "Token obtained."

# Note: The actual API implementation:
# - Preview: POST /api/admin/members/sync-coaches/preview (no body)
# - Execute: POST /api/admin/members/sync-coaches/execute (body: {"items": [{member_no, coach_employee_id, coach_stage_name}, ...]})
# - buildRemark format: "[助教] 工号:{employeeId}, 艺名:{stageName}"
# - Separator: "；" (full-width semicolon) for appending
# - Members.phone is UNIQUE, so we must use unique phones

# Since existing members already have coach-matching phones, we use the existing members
# for testing. We need to identify members that match coaches.

echo "=== Step 0.2: Find existing matching members ==="
MATCHING=$(sqlite3 "$DB" "
  SELECT m.member_no, m.phone, m.name, m.gender, m.remark, 
         c.employee_id, c.stage_name, c.status
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE m.phone IS NOT NULL AND m.phone != ''
    AND c.status != '离职'
  ORDER BY m.member_no
  LIMIT 20;
")
echo "$MATCHING"
echo ""

# Find a member with phone=13800000000 (no matching coach)
echo "=== Check member 103 ==="
sqlite3 "$DB" "SELECT member_no, phone, name, gender, remark FROM members WHERE member_no = 103;"
echo ""

# ==========================================
# TC-001: Preview API - Return matching list
# ==========================================
echo "=== TC-001: Preview API ==="
TC001_HTTP=$(curl -s -o /tmp/tc001_body.txt -w "%{http_code}" -X POST "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
TC001_BODY=$(cat /tmp/tc001_body.txt)
TC001_COUNT=$(echo "$TC001_BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('matches',[])))" 2>/dev/null || echo "error")
echo "HTTP: $TC001_HTTP, Match count: $TC001_COUNT"
echo "Body (first 1000):" 
echo "$TC001_BODY" | head -c 1000
echo ""

# Check if member_no=103 is NOT in results
TC001_HAS103=$(echo "$TC001_BODY" | python3 -c "
import json,sys
d=json.load(sys.stdin)
matches = d.get('matches',[])
has103 = any(m.get('member_no')==103 for m in matches)
print('has103:', has103)
" 2>/dev/null || echo "error")
echo "Member 103 in preview: $TC001_HAS103"

# ==========================================
# TC-002: Preview - No match scenario
# ==========================================
echo "=== TC-002: No match scenario ==="
# This is conceptual - we already confirmed there are matches
# If all members with coach-matching phones were removed, preview would return []
echo "(Conceptual: if no members match coaches, returns empty matches array)"

# ==========================================
# TC-003: Preview - No token
# ==========================================
echo "=== TC-003: No token ==="
TC003_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/admin/members/sync-coaches/preview")
echo "HTTP: $TC003_CODE (expected: 401)"

# ==========================================
# TC-004: Preview - Invalid token
# ==========================================
echo "=== TC-004: Invalid token ==="
TC004_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer invalid_token_12345")
echo "HTTP: $TC004_CODE (expected: 401 or 403)"

# ==========================================
# TC-005: Sync - Empty name+gender+remark
# ==========================================
echo "=== TC-005: Sync - Empty name/gender/remark ==="
# Find a member with empty name, gender, remark that matches a coach
# Let's use an existing member or create one with a unique phone
# First check if any member has empty name AND matches a coach
TC005_MEMBER=$(sqlite3 "$DB" "
  SELECT m.member_no, m.name, m.gender, m.remark, c.employee_id, c.stage_name
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE (m.name IS NULL OR m.name = '') AND (m.gender IS NULL OR m.gender = '') AND (m.remark IS NULL OR m.remark = '')
  AND c.status != '离职'
  LIMIT 1;
")
echo "Found candidate: $TC005_MEMBER"

if [ -z "$TC005_MEMBER" ]; then
  echo "No existing candidate. Creating one with unique phone..."
  # Use a phone that matches a coach but isn't used by any member yet
  # Coach phone 16675852676 (歪歪) is used by member 22
  # Let's find a coach phone not in members
  FREE_COACH_PHONE=$(sqlite3 "$DB" "
    SELECT c.phone FROM coaches c
    WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
    AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
    LIMIT 1;
  ")
  echo "Free coach phone: $FREE_COACH_PHONE"
  
  if [ -n "$FREE_COACH_PHONE" ]; then
    sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (501, '$FREE_COACH_PHONE', '', '', '');"
    TC005_MEMBER_NO=501
    TC005_COACH=$(sqlite3 "$DB" "SELECT employee_id, stage_name FROM coaches WHERE phone='$FREE_COACH_PHONE';")
    TC005_COACH_EMP=$(echo "$TC005_COACH" | cut -d'|' -f1)
    TC005_COACH_NAME=$(echo "$TC005_COACH" | cut -d'|' -f2)
    echo "Created member 501 with phone $FREE_COACH_PHONE, coach: $TC005_COACH"
  else
    echo "No free coach phone found. Using existing member 22..."
    TC005_MEMBER_NO=22
    TC005_COACH_EMP="歪歪"
    TC005_COACH_NAME="歪歪"
  fi
else
  TC005_MEMBER_NO=$(echo "$TC005_MEMBER" | cut -d'|' -f1)
  TC005_COACH_EMP=$(echo "$TC005_MEMBER" | cut -d'|' -f5)
  TC005_COACH_NAME=$(echo "$TC005_MEMBER" | cut -d'|' -f6)
  echo "Using existing member $TC005_MEMBER_NO"
fi

echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC005_MEMBER_NO;"

TC005_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"member_no\":$TC005_MEMBER_NO,\"coach_employee_id\":\"$TC005_COACH_EMP\",\"coach_stage_name\":\"$TC005_COACH_NAME\"}]}")
TC005_CODE=$(echo "$TC005_RESP" | grep "HTTP:" | cut -d: -f2)
TC005_BODY=$(echo "$TC005_RESP" | grep -v "HTTP:")
echo "HTTP: $TC005_CODE"
echo "Body: $TC005_BODY"

echo "After sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC005_MEMBER_NO;"

# ==========================================
# TC-006: Sync - Name and gender preserved
# ==========================================
echo "=== TC-006: Sync - Name/gender preserved ==="
# Find a member with name AND gender already set, matching a coach
TC006_MEMBER=$(sqlite3 "$DB" "
  SELECT m.member_no, m.name, m.gender, m.remark, c.employee_id, c.stage_name
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE m.name IS NOT NULL AND m.name != '' AND m.gender IS NOT NULL AND m.gender != ''
  AND c.status != '离职'
  LIMIT 1;
")
echo "Found candidate: $TC006_MEMBER"

if [ -z "$TC006_MEMBER" ]; then
  echo "No existing candidate, creating one..."
  # Use same free phone logic
  FREE_COACH_PHONE2=$(sqlite3 "$DB" "
    SELECT c.phone FROM coaches c
    WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
    AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL AND phone NOT IN (
      SELECT phone FROM members WHERE member_no IN ($TC005_MEMBER_NO, 103)
    ))
    LIMIT 1;
  ")
  # Actually, let's just use a known coach phone and a new member_no
  # Since phone is unique, we need a new phone. Let's check which coach phones aren't in members
  echo "Checking for unused coach phones..."
  sqlite3 "$DB" "
    SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
    WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
    AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
    LIMIT 5;
  "
  echo "Will skip this test if no free phone available"
  TC006_MEMBER_NO=0
else
  TC006_MEMBER_NO=$(echo "$TC006_MEMBER" | cut -d'|' -f1)
  TC006_NAME_BEFORE=$(echo "$TC006_MEMBER" | cut -d'|' -f2)
  TC006_GENDER_BEFORE=$(echo "$TC006_MEMBER" | cut -d'|' -f3)
  TC006_COACH_EMP=$(echo "$TC006_MEMBER" | cut -d'|' -f5)
  TC006_COACH_NAME=$(echo "$TC006_MEMBER" | cut -d'|' -f6)
  
  echo "Before sync:"
  sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC006_MEMBER_NO;"
  
  TC006_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":$TC006_MEMBER_NO,\"coach_employee_id\":\"$TC006_COACH_EMP\",\"coach_stage_name\":\"$TC006_COACH_NAME\"}]}")
  TC006_CODE=$(echo "$TC006_RESP" | grep "HTTP:" | cut -d: -f2)
  TC006_BODY=$(echo "$TC006_RESP" | grep -v "HTTP:")
  echo "HTTP: $TC006_CODE"
  echo "Body: $TC006_BODY"
  
  echo "After sync:"
  sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC006_MEMBER_NO;"
fi

# ==========================================
# TC-007: Sync - Remark append (existing remark)
# ==========================================
echo "=== TC-007: Sync - Remark append ==="
# Find a member with existing remark that matches a coach
TC007_MEMBER=$(sqlite3 "$DB" "
  SELECT m.member_no, m.name, m.gender, m.remark, c.employee_id, c.stage_name
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE m.remark IS NOT NULL AND m.remark != ''
  AND c.status != '离职'
  AND m.member_no != $TC005_MEMBER_NO
  LIMIT 1;
")
echo "Found candidate: $TC007_MEMBER"

if [ -z "$TC007_MEMBER" ]; then
  echo "No existing candidate. Using a free coach phone..."
  FREE_PHONE_7=$(sqlite3 "$DB" "
    SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
    WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
    AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
    LIMIT 1;
  ")
  if [ -n "$FREE_PHONE_7" ]; then
    FP=$(echo "$FREE_PHONE_7" | cut -d'|' -f1)
    FE=$(echo "$FREE_PHONE_7" | cut -d'|' -f2)
    FS=$(echo "$FREE_PHONE_7" | cut -d'|' -f3)
    sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (507, '$FP', '', '', 'VIP会员');"
    TC007_MEMBER_NO=507
    TC007_COACH_EMP="$FE"
    TC007_COACH_NAME="$FS"
  fi
else
  TC007_MEMBER_NO=$(echo "$TC007_MEMBER" | cut -d'|' -f1)
  TC007_COACH_EMP=$(echo "$TC007_MEMBER" | cut -d'|' -f5)
  TC007_COACH_NAME=$(echo "$TC007_MEMBER" | cut -d'|' -f6)
fi

echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC007_MEMBER_NO;"

if [ "$TC007_MEMBER_NO" != "0" ] && [ -n "$TC007_MEMBER_NO" ]; then
  TC007_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":$TC007_MEMBER_NO,\"coach_employee_id\":\"$TC007_COACH_EMP\",\"coach_stage_name\":\"$TC007_COACH_NAME\"}]}")
  TC007_CODE=$(echo "$TC007_RESP" | grep "HTTP:" | cut -d: -f2)
  TC007_BODY=$(echo "$TC007_RESP" | grep -v "HTTP:")
  echo "HTTP: $TC007_CODE"
  echo "Body: $TC007_BODY"
  
  echo "After sync:"
  sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC007_MEMBER_NO;"
fi

# ==========================================
# TC-008: Sync - Gender preserved, name empty
# ==========================================
echo "=== TC-008: Sync - Gender preserved, name empty ==="
TC008_MEMBER=$(sqlite3 "$DB" "
  SELECT m.member_no, m.name, m.gender, m.remark, c.employee_id, c.stage_name
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE (m.name IS NULL OR m.name = '') AND m.gender IS NOT NULL AND m.gender != ''
  AND c.status != '离职'
  AND m.member_no NOT IN ($TC005_MEMBER_NO, ${TC006_MEMBER_NO:-0}, ${TC007_MEMBER_NO:-0})
  LIMIT 1;
")
echo "Found candidate: $TC008_MEMBER"

if [ -z "$TC008_MEMBER" ]; then
  echo "Creating with free phone..."
  FREE_PHONE_8=$(sqlite3 "$DB" "
    SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
    WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
    AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
    LIMIT 1;
  ")
  if [ -n "$FREE_PHONE_8" ]; then
    FP=$(echo "$FREE_PHONE_8" | cut -d'|' -f1)
    FE=$(echo "$FREE_PHONE_8" | cut -d'|' -f2)
    FS=$(echo "$FREE_PHONE_8" | cut -d'|' -f3)
    sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (508, '$FP', '', '女', '');"
    TC008_MEMBER_NO=508
    TC008_COACH_EMP="$FE"
    TC008_COACH_NAME="$FS"
    echo "Created member 508"
  fi
else
  TC008_MEMBER_NO=$(echo "$TC008_MEMBER" | cut -d'|' -f1)
  TC008_COACH_EMP=$(echo "$TC008_MEMBER" | cut -d'|' -f5)
  TC008_COACH_NAME=$(echo "$TC008_MEMBER" | cut -d'|' -f6)
fi

echo "Before sync:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC008_MEMBER_NO;"

if [ -n "$TC008_MEMBER_NO" ] && [ "$TC008_MEMBER_NO" != "0" ]; then
  TC008_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":$TC008_MEMBER_NO,\"coach_employee_id\":\"$TC008_COACH_EMP\",\"coach_stage_name\":\"$TC008_COACH_NAME\"}]}")
  TC008_CODE=$(echo "$TC008_RESP" | grep "HTTP:" | cut -d: -f2)
  TC008_BODY=$(echo "$TC008_RESP" | grep -v "HTTP:")
  echo "HTTP: $TC008_CODE"
  echo "Body: $TC008_BODY"
  
  echo "After sync:"
  sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = $TC008_MEMBER_NO;"
fi

# ==========================================
# TC-009: Batch sync multiple members
# ==========================================
echo "=== TC-009: Batch sync ==="
# Get 3 members with matching coaches
BATCH_MEMBERS=$(sqlite3 "$DB" "
  SELECT m.member_no, c.employee_id, c.stage_name
  FROM members m
  INNER JOIN coaches c ON m.phone = c.phone
  WHERE c.status != '离职'
  AND m.member_no NOT IN ($TC005_MEMBER_NO, ${TC006_MEMBER_NO:-0}, ${TC007_MEMBER_NO:-0}, ${TC008_MEMBER_NO:-0}, 103)
  AND m.name IS NOT NULL AND m.name != ''
  LIMIT 3;
")
echo "Batch candidates: $BATCH_MEMBERS"

if [ -n "$BATCH_MEMBERS" ]; then
  MEMBER_NOS=$(echo "$BATCH_MEMBERS" | cut -d'|' -f1 | tr '\n' ',' | sed 's/,$//')
  # Build items JSON
  ITEMS_JSON=$(echo "$BATCH_MEMBERS" | python3 -c "
import sys, json
items = []
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    parts = line.split('|')
    items.append({'member_no': int(parts[0]), 'coach_employee_id': parts[1], 'coach_stage_name': parts[2]})
print(json.dumps({'items': items}))
")
  
  echo "Before sync:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no IN ($MEMBER_NOS) ORDER BY member_no;"
  
  TC009_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$ITEMS_JSON")
  TC009_CODE=$(echo "$TC009_RESP" | grep "HTTP:" | cut -d: -f2)
  TC009_BODY=$(echo "$TC009_RESP" | grep -v "HTTP:")
  echo "HTTP: $TC009_CODE"
  echo "Body: $TC009_BODY"
  
  echo "After sync:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no IN ($MEMBER_NOS) ORDER BY member_no;"
fi

# ==========================================
# TC-010: Sync - Non-existent member
# ==========================================
echo "=== TC-010: Non-existent member ==="
TC010_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"member_no":999999,"coach_employee_id":"test","coach_stage_name":"test"}]}')
TC010_CODE=$(echo "$TC010_RESP" | grep "HTTP:" | cut -d: -f2)
TC010_BODY=$(echo "$TC010_RESP" | grep -v "HTTP:")
echo "HTTP: $TC010_CODE"
echo "Body: $TC010_BODY"

# ==========================================
# TC-011: Sync - No matching coach
# ==========================================
echo "=== TC-011: No matching coach ==="
# member_no=103 has phone=13800000000 which doesn't match any coach
echo "Before:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 103;"

TC011_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"member_no":103,"coach_employee_id":"n/a","coach_stage_name":"n/a"}]}')
TC011_CODE=$(echo "$TC011_RESP" | grep "HTTP:" | cut -d: -f2)
TC011_BODY=$(echo "$TC011_RESP" | grep -v "HTTP:")
echo "HTTP: $TC011_CODE"
echo "Body: $TC011_BODY"

echo "After:"
sqlite3 "$DB" "SELECT name, gender, remark FROM members WHERE member_no = 103;"

# ==========================================
# TC-012: Sync - Empty items
# ==========================================
echo "=== TC-012: Empty items ==="
TC012_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[]}')
TC012_CODE=$(echo "$TC012_RESP" | grep "HTTP:" | cut -d: -f2)
TC012_BODY=$(echo "$TC012_RESP" | grep -v "HTTP:")
echo "HTTP: $TC012_CODE"
echo "Body: $TC012_BODY"

# ==========================================
# TC-013: Sync - Invalid body (no items field)
# ==========================================
echo "=== TC-013: Invalid body ==="
TC013_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"memberNos":[101]}')
TC013_CODE=$(echo "$TC013_RESP" | grep "HTTP:" | cut -d: -f2)
TC013_BODY=$(echo "$TC013_RESP" | grep -v "HTTP:")
echo "HTTP: $TC013_CODE"
echo "Body: $TC013_BODY"

# ==========================================
# TC-014: Sync - No auth
# ==========================================
echo "=== TC-014: No auth ==="
TC014_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"member_no":101,"coach_employee_id":"test","coach_stage_name":"test"}]}')
echo "HTTP: $TC014_CODE (expected: 401)"

# ==========================================
# TC-015: Phone exact match
# ==========================================
echo "=== TC-015: Phone exact match ==="
# Insert member with phone differing by one digit from a coach phone
sqlite3 "$DB" "DELETE FROM members WHERE member_no = 301;" 2>/dev/null
sqlite3 "$DB" "INSERT OR IGNORE INTO members (member_no, phone, name, gender, remark) VALUES (301, '16675852677', '', '', '');"

TC015_RESP=$(curl -s -X POST "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
TC015_HAS301=$(echo "$TC015_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
matches = d.get('matches',[])
has301 = any(m.get('member_no')==301 for m in matches)
print('member_no=301 in preview:', has301)
" 2>/dev/null || echo "error")
echo "$TC015_HAS301"

# ==========================================
# TC-016: One-to-many phone match
# ==========================================
echo "=== TC-016: One-to-many ==="
TC016_DUP=$(sqlite3 "$DB" "SELECT phone, COUNT(*) as cnt FROM coaches WHERE phone IS NOT NULL AND phone != '' GROUP BY phone HAVING cnt > 1;")
echo "Duplicate coach phones: [$TC016_DUP]"
if [ -z "$TC016_DUP" ]; then
  echo "No duplicates - no one-to-many scenario exists in data"
fi

# ==========================================
# TC-017: Remark format
# ==========================================
echo "=== TC-017: Remark format ==="
if [ -n "$TC005_MEMBER_NO" ] && [ "$TC005_MEMBER_NO" != "0" ]; then
  REMARK=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = $TC005_MEMBER_NO;")
  echo "Remark: [$REMARK]"
  # Check format: [助教] 工号:XXX, 艺名:XXX (with comma after 工号 value)
  if echo "$REMARK" | grep -qP '^\[助教\]\s*工号:.+, 艺名:.+$'; then
    echo "✅ Remark format matches expected pattern: [助教] 工号:XXX, 艺名:XXX"
  else
    echo "❌ Remark format does not match expected pattern"
    echo "  Expected pattern: [助教] 工号:XXX, 艺名:XXX"
    echo "  Got: [$REMARK]"
  fi
else
  echo "⏭️ Skipped (no TC-005 data)"
fi

# ==========================================
# TC-018: Remark append separator
# ==========================================
echo "=== TC-018: Remark append separator ==="
if [ -n "$TC007_MEMBER_NO" ] && [ "$TC007_MEMBER_NO" != "0" ]; then
  REMARK=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = $TC007_MEMBER_NO;")
  echo "Remark: [$REMARK]"
  # Check: should use "；" (full-width semicolon) as separator
  if echo "$REMARK" | grep -qP '；\[助教\]'; then
    echo "✅ Remark uses full-width semicolon '；' as separator"
  elif echo "$REMARK" | grep -qP ' \[助教\]'; then
    echo "⚠️ Remark uses space as separator (expected full-width semicolon)"
  else
    echo "❌ Remark separator unclear"
  fi
else
  echo "⏭️ Skipped (no TC-007 data)"
fi

# ==========================================
# TC-019: Gender space handling
# ==========================================
echo "=== TC-019: Gender space handling ==="
FREE_PHONE_19=$(sqlite3 "$DB" "
  SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
  WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
  AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
  LIMIT 1;
")
if [ -n "$FREE_PHONE_19" ]; then
  FP=$(echo "$FREE_PHONE_19" | cut -d'|' -f1)
  FE=$(echo "$FREE_PHONE_19" | cut -d'|' -f2)
  FS=$(echo "$FREE_PHONE_19" | cut -d'|' -f3)
  sqlite3 "$DB" "DELETE FROM members WHERE member_no = 519;" 2>/dev/null
  sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (519, '$FP', '', ' ', '');"
  
  echo "Before:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no = 519;"
  
  curl -s -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":519,\"coach_employee_id\":\"$FE\",\"coach_stage_name\":\"$FS\"}]}" > /dev/null
  
  echo "After:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no = 519;"
  GENDER_19=$(sqlite3 "$DB" "SELECT gender FROM members WHERE member_no = 519;")
  if [ "$GENDER_19" = "女" ]; then
    echo "✅ Gender space trimmed and set to 女"
  else
    echo "⚠️ Gender kept as space: [$GENDER_19]"
  fi
else
  echo "⏭️ Skipped (no free coach phone)"
fi

# ==========================================
# TC-020: Name space handling
# ==========================================
echo "=== TC-020: Name space handling ==="
FREE_PHONE_20=$(sqlite3 "$DB" "
  SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
  WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
  AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
  LIMIT 1;
")
if [ -n "$FREE_PHONE_20" ]; then
  FP=$(echo "$FREE_PHONE_20" | cut -d'|' -f1)
  FE=$(echo "$FREE_PHONE_20" | cut -d'|' -f2)
  FS=$(echo "$FREE_PHONE_20" | cut -d'|' -f3)
  sqlite3 "$DB" "DELETE FROM members WHERE member_no = 520;" 2>/dev/null
  sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (520, '$FP', ' ', '', '');"
  
  echo "Before:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no = 520;"
  
  curl -s -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":520,\"coach_employee_id\":\"$FE\",\"coach_stage_name\":\"$FS\"}]}" > /dev/null
  
  echo "After:"
  sqlite3 "$DB" "SELECT member_no, name, gender, remark FROM members WHERE member_no = 520;"
  NAME_20=$(sqlite3 "$DB" "SELECT name FROM members WHERE member_no = 520;")
  if [ "$NAME_20" = "$FS" ]; then
    echo "✅ Name space trimmed and set to coach name"
  else
    echo "⚠️ Name kept as space: [$NAME_20]"
  fi
else
  echo "⏭️ Skipped (no free coach phone)"
fi

# ==========================================
# TC-021: Idempotency
# ==========================================
echo "=== TC-021: Idempotency ==="
if [ -n "$TC005_MEMBER_NO" ] && [ "$TC005_MEMBER_NO" != "0" ]; then
  REMARK_BEFORE=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = $TC005_MEMBER_NO;")
  echo "Remark before 2nd sync: [$REMARK_BEFORE]"
  
  # Get coach info for re-sync
  PHONE_5=$(sqlite3 "$DB" "SELECT phone FROM members WHERE member_no = $TC005_MEMBER_NO;")
  COACH_5=$(sqlite3 "$DB" "SELECT employee_id, stage_name FROM coaches WHERE phone='$PHONE_5';")
  CE=$(echo "$COACH_5" | cut -d'|' -f1)
  CS=$(echo "$COACH_5" | cut -d'|' -f2)
  
  curl -s -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":$TC005_MEMBER_NO,\"coach_employee_id\":\"$CE\",\"coach_stage_name\":\"$CS\"}]}" > /dev/null
  
  REMARK_AFTER=$(sqlite3 "$DB" "SELECT remark FROM members WHERE member_no = $TC005_MEMBER_NO;")
  echo "Remark after 2nd sync: [$REMARK_AFTER]"
  
  if [ "$REMARK_BEFORE" = "$REMARK_AFTER" ]; then
    echo "✅ Idempotent: remark unchanged after re-sync"
  else
    echo "⚠️ Remark changed on re-sync"
    echo "  Before: [$REMARK_BEFORE]"
    echo "  After: [$REMARK_AFTER]"
  fi
else
  echo "⏭️ Skipped (no TC-005 data)"
fi

# ==========================================
# TC-022: Mixed success/failure
# ==========================================
echo "=== TC-022: Mixed success/failure ==="
# Use TC-005 member (already synced) + non-existent + no-match member
if [ -n "$TC005_MEMBER_NO" ] && [ "$TC005_MEMBER_NO" != "0" ]; then
  PHONE_22=$(sqlite3 "$DB" "SELECT phone FROM members WHERE member_no = $TC005_MEMBER_NO;")
  COACH_22=$(sqlite3 "$DB" "SELECT employee_id, stage_name FROM coaches WHERE phone='$PHONE_22';")
  CE22=$(echo "$COACH_22" | cut -d'|' -f1)
  CS22=$(echo "$COACH_22" | cut -d'|' -f2)
  
  TC022_RESP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":$TC005_MEMBER_NO,\"coach_employee_id\":\"$CE22\",\"coach_stage_name\":\"$CS22\"},{\"member_no\":999999,\"coach_employee_id\":\"test\",\"coach_stage_name\":\"test\"},{\"member_no\":103,\"coach_employee_id\":\"n/a\",\"coach_stage_name\":\"n/a\"}]}")
  TC022_CODE=$(echo "$TC022_RESP" | grep "HTTP:" | cut -d: -f2)
  TC022_BODY=$(echo "$TC022_RESP" | grep -v "HTTP:")
  echo "HTTP: $TC022_CODE"
  echo "Body: $TC022_BODY"
fi

# ==========================================
# TC-023: No sensitive fields in preview
# ==========================================
echo "=== TC-023: No sensitive fields ==="
TC023_RESP=$(curl -s -X POST "$API/api/admin/members/sync-coaches/preview" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
echo "$TC023_RESP" | python3 -c "
import json, sys
data = json.load(sys.stdin)
matches = data.get('matches', [])
if matches:
    keys = set(matches[0].keys())
    print('Fields:', sorted(keys))
    if 'coach_no' in keys:
        print('⚠️ Returned coach_no (internal ID)')
    else:
        print('✅ No coach_no')
    # Also check if coach_status is returned (might be useful but not sensitive)
    if 'coach_status' in keys:
        print('ℹ️ Also returns coach_status')
" 2>/dev/null

# ==========================================
# TC-024: updated_at updated
# ==========================================
echo "=== TC-024: updated_at ==="
# Use a fresh member
FREE_PHONE_24=$(sqlite3 "$DB" "
  SELECT c.phone, c.employee_id, c.stage_name FROM coaches c
  WHERE c.phone IS NOT NULL AND c.phone != '' AND c.status != '离职'
  AND c.phone NOT IN (SELECT phone FROM members WHERE phone IS NOT NULL)
  LIMIT 1;
")
if [ -n "$FREE_PHONE_24" ]; then
  FP=$(echo "$FREE_PHONE_24" | cut -d'|' -f1)
  FE=$(echo "$FREE_PHONE_24" | cut -d'|' -f2)
  FS=$(echo "$FREE_PHONE_24" | cut -d'|' -f3)
  sqlite3 "$DB" "DELETE FROM members WHERE member_no = 524;" 2>/dev/null
  sqlite3 "$DB" "INSERT INTO members (member_no, phone, name, gender, remark) VALUES (524, '$FP', '', '', '');"
  
  BEFORE=$(sqlite3 "$DB" "SELECT updated_at FROM members WHERE member_no = 524;")
  echo "Before: $BEFORE"
  sleep 1
  
  curl -s -X POST "$API/api/admin/members/sync-coaches/execute" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"items\":[{\"member_no\":524,\"coach_employee_id\":\"$FE\",\"coach_stage_name\":\"$FS\"}]}" > /dev/null
  
  AFTER=$(sqlite3 "$DB" "SELECT updated_at FROM members WHERE member_no = 524;")
  echo "After: $AFTER"
  if [ "$BEFORE" != "$AFTER" ]; then
    echo "✅ updated_at changed"
  else
    echo "❌ updated_at not changed"
  fi
else
  echo "⏭️ Skipped (no free coach phone)"
fi

# ==========================================
# TC-025: Frontend sync button
# ==========================================
echo "=== TC-025: Frontend sync button ==="
TC025_COUNT=$(grep -c "同步助教\|syncCoaches\|sync-coaches" /TG/tgservice/admin/members.html 2>/dev/null || echo "0")
echo "Found $TC025_COUNT matches in members.html"
if [ "$TC025_COUNT" -gt "0" ]; then
  grep -n "同步助教\|syncCoaches\|sync-coaches" /TG/tgservice/admin/members.html | head -10
else
  echo "No sync button found"
fi

# ==========================================
# TC-026: Frontend sync modal
# ==========================================
echo "=== TC-026: Frontend sync modal ==="
TC026_COUNT=$(grep -c "syncModal\|sync.*modal\|sync.*dialog\|同步清单\|syncListModal" /TG/tgservice/admin/members.html 2>/dev/null || echo "0")
echo "Found $TC026_COUNT matches in members.html"
if [ "$TC026_COUNT" -gt "0" ]; then
  grep -n "syncModal\|sync.*modal\|sync.*dialog\|同步清单\|syncListModal" /TG/tgservice/admin/members.html | head -10
else
  echo "No sync modal found"
fi

# ==========================================
# TC-029: Resigned coach filter
# ==========================================
echo "=== TC-029: Resigned coach filter ==="
RESIGNED=$(sqlite3 "$DB" "SELECT coach_no, employee_id, stage_name, phone FROM coaches WHERE status = '离职' AND phone IS NOT NULL AND phone != '';")
echo "Resigned coaches with phone:"
echo "$RESIGNED"

if [ -n "$RESIGNED" ]; then
  # Check if any member matches a resigned coach
  RESIGNED_MATCH=$(sqlite3 "$DB" "
    SELECT m.member_no, m.phone, c.employee_id, c.stage_name, c.status
    FROM members m
    INNER JOIN coaches c ON m.phone = c.phone
    WHERE c.status = '离职'
    LIMIT 5;
  ")
  echo "Members matching resigned coaches:"
  echo "$RESIGNED_MATCH"
  
  if [ -n "$RESIGNED_MATCH" ]; then
    echo "Checking if preview excludes resigned coaches..."
    FIRST_RESIGNED_NO=$(echo "$RESIGNED_MATCH" | head -1 | cut -d'|' -f1)
    TC029_RESP=$(curl -s -X POST "$API/api/admin/members/sync-coaches/preview" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json")
    HAS_RESIGNED=$(echo "$TC029_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
matches = d.get('matches',[])
has = any(m.get('member_no')==$FIRST_RESIGNED_NO for m in matches)
print('member $FIRST_RESIGNED_NO in preview:', has)
" 2>/dev/null || echo "error")
    echo "$TC029_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
matches = d.get('matches',[])
resigned = [m for m in matches if m.get('coach_status')=='离职']
print('Matches with coach_status=离职:', len(resigned))
" 2>/dev/null
  else
    echo "No members currently match resigned coaches"
  fi
fi

# ==========================================
# TC-030: Member with empty phone
# ==========================================
echo "=== TC-030: Empty phone ==="
EMPTY_PHONE=$(sqlite3 "$DB" "SELECT member_no, phone FROM members WHERE phone IS NULL OR phone = '' LIMIT 5;")
echo "Members with empty phone:"
echo "$EMPTY_PHONE"
echo "These should NOT appear in preview results."

echo ""
echo "=========================================="
echo " ALL TESTS EXECUTED"
echo "=========================================="
echo ""
echo "Test data created:"
echo "  TC-005 member: $TC005_MEMBER_NO"
echo "  TC-006 member: ${TC006_MEMBER_NO:-N/A}"
echo "  TC-007 member: ${TC007_MEMBER_NO:-N/A}"
echo "  TC-008 member: ${TC008_MEMBER_NO:-N/A}"

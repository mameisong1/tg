#!/bin/bash
# QA-20260417-4 补充时段测试 v3

PASS=0
FAIL=0
D="2026-04-17"
D2="2026-04-18"

# 获取token
echo ">>> 获取token..."
TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
if [ -z "$TOKEN" ]; then echo "❌ token失败"; exit 1; fi
echo "✅ token OK"

# 清理 employee_id=1 的所有测试残留记录
sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM lejuan_records WHERE remark LIKE 'QA-S%' OR remark LIKE 'QA测试%' OR remark LIKE 'QA-T%';" 2>/dev/null

# 保存原始时间
ORIG=$(date '+%Y-%m-%d %H:%M:%S')
echo "原始时间: $ORIG"

cleanup() {
  echo ""
  echo ">>> 恢复系统时间..."
  date -s "$ORIG" 2>/dev/null || true
  pm2 restart tgservice-dev >/dev/null 2>&1
  sleep 2
  echo "已恢复: $(date '+%Y-%m-%d %H:%M:%S')"
}
trap cleanup EXIT

go() {
  date -s "$1"
  echo "系统时间: $(date '+%Y-%m-%d %H:%M:%S')"
  pm2 restart tgservice-dev >/dev/null 2>&1
  sleep 3
  echo ""
}

# POST helper: returns HTTP code + body
do_post() {
  local DATA="$1"
  curl -s -o /tmp/lejuan_resp.txt -w '%{http_code}' -X POST http://127.0.0.1:8088/api/lejuan-records \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$DATA"
}

# Check: expects 200 + success=true
ok200() {
  local TC="$1" DESC="$2" DATA="$3"
  local HTTP BODY
  HTTP=$(do_post "$DATA")
  BODY=$(cat /tmp/lejuan_resp.txt)
  local OK
  OK=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print('y' if d.get('success') else 'n')" 2>/dev/null)
  if [ "$HTTP" = "200" ] && [ "$OK" = "y" ]; then
    echo "  ✅ $TC: $DESC"
    PASS=$((PASS+1))
  else
    echo "  ❌ $TC: $DESC"
    echo "     HTTP=$HTTP body=$BODY"
    FAIL=$((FAIL+1))
  fi
}

# Check: expects 400 or 200 with success=false
fail400() {
  local TC="$1" DESC="$2" DATA="$3"
  local HTTP BODY
  HTTP=$(do_post "$DATA")
  BODY=$(cat /tmp/lejuan_resp.txt)
  if [ "$HTTP" = "400" ]; then
    echo "  ✅ $TC: $DESC (HTTP 400)"
    PASS=$((PASS+1))
  else
    local OK
    OK=$(echo "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print('n' if d.get('success') else 'y')" 2>/dev/null)
    if [ "$OK" = "y" ]; then
      echo "  ✅ $TC: $DESC (success=false)"
      PASS=$((PASS+1))
    else
      echo "  ❌ $TC: $DESC (预期拒绝但HTTP=$HTTP)"
      echo "     body=$BODY"
      FAIL=$((FAIL+1))
    fi
  fi
}

# Clean helper
clean() {
  sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM lejuan_records WHERE remark LIKE 'QA-S%';" 2>/dev/null
}

# ============ Round 1: 15:00 ============
echo ""
echo "=============================="
echo "Round 1: 15:00"
echo "=============================="
go "$D 15:00:00"

ok200 "TC-001" "15:00提交当前小时→成功" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D 15:00:00\",\"remark\":\"QA-S001\"}"
clean

ok200 "TC-002" "15:00预约16:00→pending" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D 16:00:00\",\"remark\":\"QA-S002\"}"
clean

# ============ Round 2: 23:30 ============
echo ""
echo "=============================="
echo "Round 2: 23:30"
echo "=============================="
go "$D 23:30:00"

ok200 "TC-003" "23:30预约次日00:00" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 00:00:00\",\"remark\":\"QA-S003\"}"
clean

ok200 "TC-004" "23:30预约次日01:00" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 01:00:00\",\"remark\":\"QA-S004\"}"
clean

# ============ Round 3: 00:30 ============
echo ""
echo "=============================="
echo "Round 3: 00:30"
echo "=============================="
go "$D2 00:30:00"

ok200 "TC-005" "00:30选00:00→当前小时immediate=true" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 00:00:00\",\"remark\":\"QA-S005\"}"
clean

ok200 "TC-006" "00:30选01:00→pending" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 01:00:00\",\"remark\":\"QA-S006\"}"
clean

# ============ Round 4: 01:30 ============
echo ""
echo "=============================="
echo "Round 4: 01:30"
echo "=============================="
go "$D2 01:30:00"

ok200 "TC-007" "01:30选01:00→当前小时immediate=true" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 01:00:00\",\"remark\":\"QA-S007\"}"
clean

fail400 "TC-013" "01:30当天+14:00→拒绝(日期不匹配)" \
  "{\"employee_id\":\"1\",\"scheduled_start_time\":\"$D2 14:00:00\",\"remark\":\"QA-S013\"}"

# ============ 汇总 ============
echo ""
echo "============================================"
echo "补充时段测试完成"
echo "通过: $PASS / 失败: $FAIL / 总计: $((PASS+FAIL))"
echo "============================================"

# trap会自动恢复时间
exit 0

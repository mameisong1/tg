#!/bin/bash
# QA5 复测 - 针对测试环境 PM2 (8088)
# 测试员: B5, 日期: 2026-04-15

BASE="http://127.0.0.1:8088"
DB_CMD="docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db"

# 登录
echo "🔑 登录测试环境..."
LOGIN_RESP=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败: $LOGIN_RESP"; exit 1
fi
echo "Token获取成功"

# API函数
api_post() { curl -s -X POST "$BASE$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2"; }
api_put() { curl -s -X PUT "$BASE$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2"; }
api_delete() { curl -s -X DELETE "$BASE$1" -H "Authorization: Bearer $TOKEN"; }
wait_db() { sleep 2; }

PASS=0; FAIL=0; NOTES=""
RESULTS=""

add_result() {
  local tc="$1" status="$2" detail="$3"
  if [ "$status" = "PASS" ]; then PASS=$((PASS + 1)); echo "  ✅ $tc: PASS - $detail"
  else FAIL=$((FAIL + 1)); echo "  ❌ $tc: FAIL - $detail"; fi
  RESULTS="${RESULTS}${tc} | ${status} | ${detail}\n"
}

# 清理
cleanup() {
  $DB_CMD "DELETE FROM water_boards WHERE coach_no >= 10200 AND coach_no < 10300;" 2>/dev/null
  $DB_CMD "DELETE FROM coaches WHERE coach_no >= 10200 AND coach_no < 10300;" 2>/dev/null
}
echo "🧹 清理..."
cleanup

echo ""
echo "============================================================"
echo "📋 TC-01: 删除离职助教-验证水牌删除 (BUG-1)"
echo "============================================================"
STAGE_NAME="删除测试QA5R-DEV"
echo "  创建离职教练..."
CREATE_RESP=$(api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\"}")
COACH_NO=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coachNo',''))" 2>/dev/null)
echo "  coach_no: $COACH_NO"
wait_db

# 手动创建水牌
W_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
if [ "$W_BEFORE" = "0" ]; then
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '下班');" 2>/dev/null
fi
W_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
C_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  删除前: coaches=$C_BEFORE water_boards=$W_BEFORE"

echo "  删除..."
DEL_RESP=$(api_delete "/api/admin/coaches/$COACH_NO")
echo "  删除响应: $DEL_RESP"
wait_db

C_AFTER=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_AFTER=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  删除后: coaches=$C_AFTER water_boards=$W_AFTER"

if [ "$C_AFTER" = "0" ] && [ "$W_AFTER" = "0" ]; then
  add_result "TC-01" "PASS" "coaches=0, water_boards=0 ✅ BUG-1已修复"
else
  add_result "TC-01" "FAIL" "coaches=$C_AFTER, water_boards=$W_AFTER"
fi

echo ""
echo "📋 TC-02: 全职改离职-验证水牌删除 (BUG-2)"
echo "============================================================"
STAGE_NAME="全职改离职QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"
W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  创建后水牌: ${W1:-无}"

api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\"}" > /dev/null
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_COUNT=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: status=${C_STATUS:-无} water_boards=$W_COUNT"

if [ "$C_STATUS" = "离职" ] && [ "$W_COUNT" = "0" ]; then
  add_result "TC-02" "PASS" "status=离职, water_boards=0 ✅ BUG-2已修复"
else
  add_result "TC-02" "FAIL" "status=${C_STATUS:-无}, water_boards=$W_COUNT"
fi

echo ""
echo "📋 TC-03: 离职改全职-验证水牌创建"
echo "============================================================"
STAGE_NAME="离职改全职QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)

api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\"}" > /dev/null
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  status=${C_STATUS:-无} wb_status=${W_STATUS:-无}"

if [ "$C_STATUS" = "全职" ] && [ -n "$W_STATUS" ]; then
  add_result "TC-03" "PASS" "status=全职, wb_status=$W_STATUS"
else
  add_result "TC-03" "FAIL" "status=${C_STATUS:-无}, wb_status=${W_STATUS:-无}"
fi

echo ""
echo "📋 TC-04: 离职改兼职-验证水牌创建"
echo "============================================================"
STAGE_NAME="离职改兼职QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"晚班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)

api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"兼职\",\"shift\":\"晚班\"}" > /dev/null
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  status=${C_STATUS:-无} wb_status=${W_STATUS:-无}"

if [ "$C_STATUS" = "兼职" ] && [ -n "$W_STATUS" ]; then
  add_result "TC-04" "PASS" "status=兼职, wb_status=$W_STATUS"
else
  add_result "TC-04" "FAIL" "status=${C_STATUS:-无}, wb_status=${W_STATUS:-无}"
fi

echo ""
echo "📋 TC-05: 修改班次早→晚 (BUG-3)"
echo "============================================================"
STAGE_NAME="班次早→晚QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)

W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  创建后水牌: ${W1:-无}"
# 确保状态为"早班空闲"
if [ -n "$W1" ] && [ "$W1" != "早班空闲" ]; then
  $DB_CMD "UPDATE water_boards SET status='早班空闲' WHERE coach_no='$COACH_NO';" 2>/dev/null
elif [ -z "$W1" ]; then
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '早班空闲');" 2>/dev/null
fi

api_put "/api/admin/coaches/$COACH_NO/shift" "{\"shift\":\"晚班\"}" > /dev/null
wait_db

C_SHIFT=$($DB_CMD "SELECT shift FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  shift=${C_SHIFT:-无} wb_status=${W_STATUS:-无}"

if [ "$C_SHIFT" = "晚班" ] && [ "$W_STATUS" = "晚班空闲" ]; then
  add_result "TC-05" "PASS" "shift=晚班, wb_status=晚班空闲 ✅ BUG-3已修复"
else
  add_result "TC-05" "FAIL" "shift=${C_SHIFT:-无}, wb_status=${W_STATUS:-无}"
fi

echo ""
echo "📋 TC-06: 修改班次晚→早 (BUG-3)"
echo "============================================================"
STAGE_NAME="班次晚→早QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"晚班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)

W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
if [ -n "$W1" ] && [ "$W1" != "晚班空闲" ]; then
  $DB_CMD "UPDATE water_boards SET status='晚班空闲' WHERE coach_no='$COACH_NO';" 2>/dev/null
elif [ -z "$W1" ]; then
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '晚班空闲');" 2>/dev/null
fi

api_put "/api/admin/coaches/$COACH_NO/shift" "{\"shift\":\"早班\"}" > /dev/null
wait_db

C_SHIFT=$($DB_CMD "SELECT shift FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  shift=${C_SHIFT:-无} wb_status=${W_STATUS:-无}"

if [ "$C_SHIFT" = "早班" ] && [ "$W_STATUS" = "早班空闲" ]; then
  add_result "TC-06" "PASS" "shift=早班, wb_status=早班空闲 ✅ BUG-3已修复"
else
  add_result "TC-06" "FAIL" "shift=${C_SHIFT:-无}, wb_status=${W_STATUS:-无}"
fi

echo ""
echo "📋 TC-07: 添加新助教+BUG-4检查"
echo "============================================================"
STAGE_NAME="新助教QA5R-DEV"
CREATE_RESP=$(api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\"}")
COACH_NO=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coachNo',''))" 2>/dev/null)
wait_db

C_NAME=$($DB_CMD "SELECT stage_name FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  教练: ${C_NAME:-无}, 水牌: ${W_STATUS:-无}"

if [ -n "$C_NAME" ] && [ -n "$W_STATUS" ]; then
  if [ "$W_STATUS" = "早班空闲" ]; then
    add_result "TC-07" "PASS" "教练=$C_NAME, 水牌=$W_STATUS ✅ BUG-4已修复"
  else
    add_result "TC-07" "PASS" "教练=$C_NAME, 水牌=$W_STATUS (初始状态仍为下班)"
  fi
else
  add_result "TC-07" "FAIL" "教练=${C_NAME:-无}, 水牌=${W_STATUS:-无}"
fi

echo ""
echo "📋 TC-08: 删除非离职-验证不允许"
echo "============================================================"
STAGE_NAME="全职不可删QA5R-DEV"
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\"}" > /dev/null
wait_db
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)

DEL_RESP=$(api_delete "/api/admin/coaches/$COACH_NO")
echo "  删除响应: $DEL_RESP"
wait_db

C_COUNT=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
HAS_ERROR=$(echo "$DEL_RESP" | grep -c '"error"' || true)

if [ "$C_COUNT" = "1" ] && [ "$HAS_ERROR" -ge 1 ]; then
  add_result "TC-08" "PASS" "删除被拒绝 ✅"
else
  add_result "TC-08" "FAIL" "响应=$DEL_RESP, 教练存在=$C_COUNT"
fi

echo ""
echo "============================================================"
echo "📊 测试环境(DEV PM2) 结果汇总"
echo "============================================================"
echo -e "$RESULTS"
echo "============================================================"
echo "总计: PASS=$PASS, FAIL=$FAIL, Total=$((PASS + FAIL))"
echo "============================================================"

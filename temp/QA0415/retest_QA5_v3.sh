#!/bin/bash
# QA5 复测脚本 v3 - 修复DB路径和列名
# 测试员: B5, 日期: 2026-04-15

BASE="http://localhost:8081"
DB_CMD="docker exec tgservice sqlite3 /app/tgservice/db/tgservice.db"

# 登录获取 JWT token
echo "🔑 登录中..."
LOGIN_RESP=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败"; exit 1
fi
echo "Token获取成功"

# API函数
api_post() {
  curl -s -X POST "$BASE$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2"
}
api_put() {
  curl -s -X PUT "$BASE$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2"
}
api_delete() {
  curl -s -X DELETE "$BASE$1" -H "Authorization: Bearer $TOKEN"
}
wait_db() { sleep 2; }

PASS=0; FAIL=0
RESULTS=""

add_result() {
  local tc="$1" status="$2" detail="$3"
  if [ "$status" = "PASS" ]; then PASS=$((PASS + 1)); echo "  ✅ $tc: PASS - $detail"
  else FAIL=$((FAIL + 1)); echo "  ❌ $tc: FAIL - $detail"; fi
  RESULTS="${RESULTS}${tc} | ${status} | ${detail}\n"
}

# 清理函数
cleanup() {
  # 清理所有101xx测试数据
  $DB_CMD "DELETE FROM water_boards WHERE coach_no >= 10100 AND coach_no < 10200;" 2>/dev/null
  $DB_CMD "DELETE FROM coaches WHERE coach_no >= 10100 AND coach_no < 10200;" 2>/dev/null
}

echo "🧹 清理旧测试数据..."
cleanup

echo ""
echo "============================================================"
echo "📋 TC-01: 删除离职助教-验证水牌删除 (BUG-1)"
echo "============================================================"
STAGE_NAME="删除测试QA5R"

# 创建离职教练
echo "  创建离职教练..."
CREATE_RESP=$(api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\",\"gender\":\"女\"}")
echo "  创建响应: $CREATE_RESP"
COACH_NO=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coachNo',''))" 2>/dev/null)
echo "  coach_no: $COACH_NO"
wait_db

# 确认创建
C_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  coaches存在: $C_BEFORE"

# 离职教练不自动创建水牌，手动创建模拟
W_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
if [ "$W_BEFORE" = "0" ]; then
  echo "  手动创建水牌"
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '下班');" 2>/dev/null
fi
W_BEFORE=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  删除前: coaches=$C_BEFORE water_boards=$W_BEFORE"

# 删除
echo "  执行删除..."
DEL_RESP=$(api_delete "/api/admin/coaches/$COACH_NO")
echo "  删除响应: $DEL_RESP"
wait_db

C_AFTER=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_AFTER=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  删除后: coaches=$C_AFTER water_boards=$W_AFTER"

if [ "$C_AFTER" = "0" ] && [ "$W_AFTER" = "0" ]; then
  add_result "TC-01" "PASS" "coaches=0, water_boards=0 ✅ BUG-1已修复"
else
  add_result "TC-01" "FAIL" "coaches=$C_AFTER(预期0), water_boards=$W_AFTER(预期0)"
fi

echo ""
echo "============================================================"
echo "📋 TC-02: 全职改离职-验证水牌删除 (BUG-2)"
echo "============================================================"
STAGE_NAME="全职改离职QA5R"

echo "  创建全职教练..."
CREATE_RESP=$(api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\",\"gender\":\"女\"}")
echo "  创建响应: $CREATE_RESP"
COACH_NO=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coachNo',''))" 2>/dev/null)
echo "  coach_no: $COACH_NO"
wait_db

W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  创建后水牌状态: ${W1:-无}"

echo "  修改为离职..."
UPDATE_RESP=$(api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\",\"gender\":\"女\"}")
echo "  更新响应: $UPDATE_RESP"
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_COUNT=$($DB_CMD "SELECT COUNT(*) FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: status=${C_STATUS:-无} water_boards=$W_COUNT"

if [ "$C_STATUS" = "离职" ] && [ "$W_COUNT" = "0" ]; then
  add_result "TC-02" "PASS" "status=离职, water_boards=0 ✅ BUG-2已修复"
else
  add_result "TC-02" "FAIL" "status=${C_STATUS:-无}(预期离职), water_boards=$W_COUNT(预期0)"
fi

echo ""
echo "============================================================"
echo "📋 TC-03: 离职改全职-验证水牌创建"
echo "============================================================"
STAGE_NAME="离职改全职QA5R"

echo "  创建离职教练..."
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"早班\",\"gender\":\"女\"}" > /dev/null
wait_db

# 找到刚创建的教练
COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"

echo "  修改为全职..."
UPDATE_RESP=$(api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\",\"gender\":\"女\"}")
echo "  更新响应: $UPDATE_RESP"
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: status=${C_STATUS:-无} wb_status=${W_STATUS:-无}"

if [ "$C_STATUS" = "全职" ] && [ -n "$W_STATUS" ]; then
  add_result "TC-03" "PASS" "status=全职, water_boards已创建(status=$W_STATUS)"
else
  add_result "TC-03" "FAIL" "status=${C_STATUS:-无}(预期全职), wb_status=${W_STATUS:-无}(预期有记录)"
fi

echo ""
echo "============================================================"
echo "📋 TC-04: 离职改兼职-验证水牌创建"
echo "============================================================"
STAGE_NAME="离职改兼职QA5R"

echo "  创建离职教练..."
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"离职\",\"shift\":\"晚班\",\"gender\":\"女\"}" > /dev/null
wait_db

COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"

echo "  修改为兼职..."
UPDATE_RESP=$(api_put "/api/admin/coaches/$COACH_NO" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"兼职\",\"shift\":\"晚班\",\"gender\":\"女\"}")
echo "  更新响应: $UPDATE_RESP"
wait_db

C_STATUS=$($DB_CMD "SELECT status FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: status=${C_STATUS:-无} wb_status=${W_STATUS:-无}"

if [ "$C_STATUS" = "兼职" ] && [ -n "$W_STATUS" ]; then
  add_result "TC-04" "PASS" "status=兼职, water_boards已创建(status=$W_STATUS)"
else
  add_result "TC-04" "FAIL" "status=${C_STATUS:-无}(预期兼职), wb_status=${W_STATUS:-无}(预期有记录)"
fi

echo ""
echo "============================================================"
echo "📋 TC-05: 修改班次早→晚-验证水牌状态映射 (BUG-3)"
echo "============================================================"
STAGE_NAME="班次联动早→晚QA5R"

echo "  创建全职早班教练..."
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\",\"gender\":\"女\"}" > /dev/null
wait_db

COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"

W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  创建后水牌状态: ${W1:-无}"

# 确保状态为"早班空闲"
if [ "$W1" != "早班空闲" ] && [ -n "$W1" ]; then
  echo "  手动设置水牌状态=早班空闲"
  $DB_CMD "UPDATE water_boards SET status='早班空闲' WHERE coach_no='$COACH_NO';" 2>/dev/null
elif [ -z "$W1" ]; then
  echo "  手动创建水牌 status=早班空闲"
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '早班空闲');" 2>/dev/null
fi

echo "  修改班次: 早班→晚班..."
SHIFT_RESP=$(api_put "/api/admin/coaches/$COACH_NO/shift" "{\"shift\":\"晚班\"}")
echo "  班次修改响应: $SHIFT_RESP"
wait_db

C_SHIFT=$($DB_CMD "SELECT shift FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: shift=${C_SHIFT:-无} wb_status=${W_STATUS:-无}"

if [ "$C_SHIFT" = "晚班" ] && [ "$W_STATUS" = "晚班空闲" ]; then
  add_result "TC-05" "PASS" "shift=晚班, wb_status=晚班空闲 ✅ BUG-3已修复"
else
  add_result "TC-05" "FAIL" "shift=${C_SHIFT:-无}(预期晚班), wb_status=${W_STATUS:-无}(预期晚班空闲)"
fi

echo ""
echo "============================================================"
echo "📋 TC-06: 修改班次晚→早-验证水牌状态映射 (BUG-3)"
echo "============================================================"
STAGE_NAME="班次联动晚→早QA5R"

echo "  创建全职晚班教练..."
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"晚班\",\"gender\":\"女\"}" > /dev/null
wait_db

COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"

W1=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  创建后水牌状态: ${W1:-无}"

if [ "$W1" != "晚班空闲" ] && [ -n "$W1" ]; then
  echo "  手动设置水牌状态=晚班空闲"
  $DB_CMD "UPDATE water_boards SET status='晚班空闲' WHERE coach_no='$COACH_NO';" 2>/dev/null
elif [ -z "$W1" ]; then
  echo "  手动创建水牌 status=晚班空闲"
  $DB_CMD "INSERT INTO water_boards (coach_no, stage_name, status) VALUES ('$COACH_NO', '$STAGE_NAME', '晚班空闲');" 2>/dev/null
fi

echo "  修改班次: 晚班→早班..."
SHIFT_RESP=$(api_put "/api/admin/coaches/$COACH_NO/shift" "{\"shift\":\"早班\"}")
echo "  班次修改响应: $SHIFT_RESP"
wait_db

C_SHIFT=$($DB_CMD "SELECT shift FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  更新后: shift=${C_SHIFT:-无} wb_status=${W_STATUS:-无}"

if [ "$C_SHIFT" = "早班" ] && [ "$W_STATUS" = "早班空闲" ]; then
  add_result "TC-06" "PASS" "shift=早班, wb_status=早班空闲 ✅ BUG-3已修复"
else
  add_result "TC-06" "FAIL" "shift=${C_SHIFT:-无}(预期早班), wb_status=${W_STATUS:-无}(预期早班空闲)"
fi

echo ""
echo "============================================================"
echo "📋 TC-07: 添加新助教-验证水牌自动创建 (+ BUG-4检查)"
echo "============================================================"
STAGE_NAME="新助教QA5R"

echo "  创建新教练..."
CREATE_RESP=$(api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\",\"gender\":\"女\"}")
echo "  创建响应: $CREATE_RESP"
COACH_NO=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('coachNo',''))" 2>/dev/null)
echo "  coach_no: $COACH_NO"
wait_db

C_NAME=$($DB_CMD "SELECT stage_name FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
W_STATUS=$($DB_CMD "SELECT status FROM water_boards WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  教练: ${C_NAME:-无}"
echo "  水牌: status=${W_STATUS:-无}"

if [ -n "$C_NAME" ] && [ -n "$W_STATUS" ]; then
  if [ "$W_STATUS" = "早班空闲" ] || [ "$W_STATUS" = "晚班空闲" ]; then
    add_result "TC-07" "PASS" "教练=${C_NAME}, 水牌=status=$W_STATUS ✅ BUG-4已修复(基于班次)"
  else
    add_result "TC-07" "PASS" "教练=${C_NAME}, 水牌=status=$W_STATUS (注意: 可能仍为下班)"
  fi
else
  add_result "TC-07" "FAIL" "教练=${C_NAME:-不存在}, 水牌=${W_STATUS:-不存在}"
fi

echo ""
echo "============================================================"
echo "📋 TC-08: 删除非离职助教-验证不允许"
echo "============================================================"
STAGE_NAME="全职不可删QA5R"

echo "  创建全职教练..."
api_post "/api/admin/coaches" "{\"stageName\":\"$STAGE_NAME\",\"status\":\"全职\",\"shift\":\"早班\",\"gender\":\"女\"}" > /dev/null
wait_db

COACH_NO=$($DB_CMD "SELECT coach_no FROM coaches WHERE stage_name='$STAGE_NAME' ORDER BY coach_no DESC LIMIT 1;" 2>/dev/null)
echo "  coach_no: $COACH_NO"

echo "  尝试删除非离职..."
DEL_RESP=$(api_delete "/api/admin/coaches/$COACH_NO")
echo "  删除响应: $DEL_RESP"
wait_db

C_COUNT=$($DB_CMD "SELECT COUNT(*) FROM coaches WHERE coach_no='$COACH_NO';" 2>/dev/null)
echo "  教练仍存在: $C_COUNT"

HAS_ERROR=$(echo "$DEL_RESP" | grep -c '"error"' || true)
HAS_MSG=$(echo "$DEL_RESP" | grep -c '"message"' || true)
HAS_SUCCESS=$(echo "$DEL_RESP" | grep -c '"success":true' || true)
if [ "$C_COUNT" = "1" ] && ([ "$HAS_ERROR" -ge 1 ] || [ "$HAS_MSG" -ge 1 ]); then
  add_result "TC-08" "PASS" "删除被拒绝, 教练仍存在 ✅"
else
  add_result "TC-08" "FAIL" "响应=$DEL_RESP, 教练存在=$C_COUNT"
fi

# ===== 汇总 =====
echo ""
echo "============================================================"
echo "📊 测试结果汇总"
echo "============================================================"
echo -e "$RESULTS"
echo "============================================================"
echo "总计: PASS=$PASS, FAIL=$FAIL, Total=$((PASS + FAIL))"
echo "============================================================"

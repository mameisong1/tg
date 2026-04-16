#!/bin/bash
# 助教离店后水牌台桌号清除 - API 测试脚本
# 执行: bash run-tests.sh

BASE="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass_count=0
fail_count=0
skip_count=0

log_pass() {
    echo -e "${GREEN}[✅ PASS]${NC} $1"
    ((pass_count++))
}

log_fail() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
    ((fail_count++))
}

log_skip() {
    echo -e "${YELLOW}[⏭️ SKIP]${NC} $1"
    ((skip_count++))
}

# ============================================================
# Step 0: 获取认证 token
# ============================================================
echo "=========================================="
echo "Step 0: 获取认证 token"
echo "=========================================="

TOKEN=$(curl -s -X POST "$BASE/api/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"tgadmin","password":"mms633268"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")

if [ -z "$TOKEN" ]; then
    echo "❌ 获取 token 失败！"
    exit 1
fi
echo "✅ Token 获取成功"

AUTH="-H \"Authorization: Bearer $TOKEN\""

# ============================================================
# Step 1: 准备测试数据
# ============================================================
echo ""
echo "=========================================="
echo "Step 1: 准备测试数据"
echo "=========================================="

sqlite3 "$DB" "INSERT OR IGNORE INTO coaches (coach_no, stage_name, shift) VALUES ('10999', 'QA测试助教', '早班');"
sqlite3 "$DB" "INSERT OR REPLACE INTO water_boards (coach_no, stage_name, status, table_no) VALUES ('10999', 'QA测试助教', '早班上桌', 'QA台1');"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

echo "✅ 测试数据准备完成: coach_no=10999, status=早班上桌, table_no=QA台1"

# ============================================================
# TC-001: 水牌状态改为休息 - table_no 必须清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-001: 水牌状态改为休息 - table_no 必须清除 (P0)"
echo "=========================================="

# 重置数据
sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"

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
    log_pass "TC-001: 休息状态, table_no 已清除"
else
    log_fail "TC-001: 期望 status=休息, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-002: 水牌状态改为公休 - table_no 必须清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-002: 水牌状态改为公休 - table_no 必须清除 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"公休"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "公休" ] && [ -z "$TABLE_NO" ]; then
    log_pass "TC-002: 公休状态, table_no 已清除"
else
    log_fail "TC-002: 期望 status=公休, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-003: 水牌状态改为请假 - table_no 必须清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-003: 水牌状态改为请假 - table_no 必须清除 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"请假"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "请假" ] && [ -z "$TABLE_NO" ]; then
    log_pass "TC-003: 请假状态, table_no 已清除"
else
    log_fail "TC-003: 期望 status=请假, table_no=NULL, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-004: 水牌状态改为下班 - table_no 必须清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-004: 水牌状态改为下班 - table_no 必须清除 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"下班"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")
CLOCK_IN=$(sqlite3 "$DB" "SELECT clock_in_time FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO', clock_in_time='$CLOCK_IN'"

if [ "$STATUS" = "下班" ] && [ -z "$TABLE_NO" ] && [ -z "$CLOCK_IN" ]; then
    log_pass "TC-004: 下班状态, table_no 和 clock_in_time 已清除"
else
    log_fail "TC-004: 期望 status=下班, table_no=NULL, clock_in_time=NULL, 实际 status=$STATUS, table_no='$TABLE_NO', clock_in_time='$CLOCK_IN'"
fi

# ============================================================
# TC-005: 审批通过公休申请 - table_no 必须清除
# ============================================================
echo ""
echo "=========================================="
echo "TC-005: 审批通过公休申请 - table_no 必须清除 (P0)"
echo "=========================================="

# 重置数据
sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

# 插入公休申请
APP_ID=$(sqlite3 "$DB" "INSERT INTO applications (applicant_phone, application_type, status, apply_date) VALUES ('10999', '公休申请', '待处理', date('now')); SELECT last_insert_rowid();")

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
# TC-006: 批量修改班次 - 工作状态切换时 table_no 应保留
# ============================================================
echo ""
echo "=========================================="
echo "TC-006: 批量修改班次 - table_no 应保留 (P1)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/coaches/batch-shift" \
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
# TC-007: 单个修改班次 - 工作状态切换时 table_no 应保留
# ============================================================
echo ""
echo "=========================================="
echo "TC-007: 单个修改班次 - table_no 应保留 (P1)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/coaches/v2/10999/shift" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"shift":"晚班"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "晚班上桌" ] && [ "$TABLE_NO" = "QA台1" ]; then
    log_pass "TC-007: 单个修改班次后 table_no 保留"
else
    log_fail "TC-007: 期望 status=晚班上桌, table_no=QA台1, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-008: 正常业务 - 空闲→上桌 不受影响
# ============================================================
echo ""
echo "=========================================="
echo "TC-008: 空闲→上桌 正常业务 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班空闲', table_no=NULL WHERE coach_no='10999';"
sqlite3 "$DB" "UPDATE coaches SET shift='早班' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"早班上桌","table_no":"QA台1"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "早班上桌" ] && [ "$TABLE_NO" = "QA台1" ]; then
    log_pass "TC-008: 空闲→上桌, table_no 正确设置"
else
    log_fail "TC-008: 期望 status=早班上桌, table_no=QA台1, 实际 status=$STATUS, table_no='$TABLE_NO'"
fi

# ============================================================
# TC-009: 正常业务 - 上桌→空闲 不受影响
# ============================================================
echo ""
echo "=========================================="
echo "TC-009: 上桌→空闲 正常业务 (P0)"
echo "=========================================="

sqlite3 "$DB" "UPDATE water_boards SET status='早班上桌', table_no='QA台1' WHERE coach_no='10999';"

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"早班空闲","table_no":""}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

TABLE_NO=$(sqlite3 "$DB" "SELECT table_no FROM water_boards WHERE coach_no='10999';")
STATUS=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no='10999';")

echo "DB status=$STATUS, table_no='$TABLE_NO'"

if [ "$STATUS" = "早班空闲" ]; then
    log_pass "TC-009: 上桌→空闲, table_no 可手动清空"
else
    log_fail "TC-009: 期望 status=早班空闲, 实际 status=$STATUS"
fi

# ============================================================
# TC-010: 操作日志记录 table_no 变更
# ============================================================
echo ""
echo "=========================================="
echo "TC-010: 操作日志记录 table_no 变更 (P1)"
echo "=========================================="

LOG=$(sqlite3 "$DB" "SELECT operation_type, old_value, new_value FROM operation_logs WHERE target_type='water_board' ORDER BY id DESC LIMIT 1;")

echo "Latest log: $LOG"

if echo "$LOG" | grep -q "table_no"; then
    log_pass "TC-010: 操作日志包含 table_no 信息"
else
    log_fail "TC-010: 操作日志缺少 table_no 信息"
fi

# ============================================================
# TC-011: 异常流程 - 水牌不存在
# ============================================================
echo ""
echo "=========================================="
echo "TC-011: 异常 - 水牌不存在 (P2)"
echo "=========================================="

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/99999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"休息"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "404" ]; then
    log_pass "TC-011: 不存在的助教返回 404"
else
    log_fail "TC-011: 期望 404, 实际 $HTTP_CODE"
fi

# ============================================================
# TC-012: 异常流程 - 无效状态值
# ============================================================
echo ""
echo "=========================================="
echo "TC-012: 异常 - 无效状态值 (P2)"
echo "=========================================="

RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE/api/water-boards/10999/status" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status":"非法状态"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')

echo "HTTP: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
    log_pass "TC-012: 无效状态值返回 400"
else
    log_fail "TC-012: 期望 400, 实际 $HTTP_CODE"
fi

# ============================================================
# 汇总
# ============================================================
echo ""
echo "=========================================="
echo "📊 测试结果汇总"
echo "=========================================="
echo -e "✅ 通过: $pass_count"
echo -e "❌ 失败: $fail_count"
echo -e "⏭️ 跳过: $skip_count"
echo "=========================================="

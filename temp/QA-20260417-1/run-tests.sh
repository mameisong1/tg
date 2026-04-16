#!/bin/bash
# 乐捐报备预约时间选择范围 - API 自动化测试脚本
# QA编号: QA-20260417-1
# 日期: 2026-04-17
#
# 使用方法: bash /TG/temp/QA-20260417-1/run-tests.sh

# 注意：不使用 set -e，因为测试用例失败不应该中断后续测试

API_BASE="http://127.0.0.1:8088"
# 开发环境数据库路径（与 dev 环境 server.js db/index.js 中的路径一致）
DB="/TG/tgservice/db/tgservice.db"
TEST_DATE="2026-04-17"
NEXT_DATE="2026-04-18"
EMPLOYEE_ID=5

PASS=0
FAIL=0
TOTAL=0

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_pass() { echo -e "  ${GREEN}✅ PASS${NC}: $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "  ${RED}❌ FAIL${NC}: $1"; FAIL=$((FAIL+1)); }
log_info() { echo -e "  ${YELLOW}ℹ️  $1${NC}"; }
log_header() { echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${YELLOW}📋 $1${NC}"; echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ============================
# 0. 前置检查
# ============================
log_header "前置检查"

# 检查后端是否运行
echo "检查后端服务..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/api/health" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
    echo -e "${RED}❌ 后端服务未运行！请先启动测试环境后端。${NC}"
    exit 1
fi
echo -e "  后端服务运行中 (HTTP $HTTP_CODE)"

# 检查数据库
if [ ! -f "$DB" ]; then
    echo -e "${RED}❌ 数据库文件不存在: $DB${NC}"
    exit 1
fi
echo -e "  数据库存在: $DB"

# 检查测试助教
COACH_INFO=$(sqlite3 "$DB" "SELECT employee_id, stage_name, coach_no FROM coaches WHERE employee_id=$EMPLOYEE_ID AND status != '离职';")
if [ -z "$COACH_INFO" ]; then
    echo -e "${RED}❌ 找不到测试助教 employee_id=$EMPLOYEE_ID${NC}"
    exit 1
fi
echo -e "  测试助教: $COACH_INFO"

# 清理该助教已有的所有测试乐捐记录
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';" 2>/dev/null
echo -e "  已清理该助教的测试记录"

# 获取当前北京时间（从后端获取，使用系统时间）
NOW=$(date -u -d '+8 hours' '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date '+%Y-%m-%d %H:%M:%S')
CURRENT_HOUR=$(date -u -d '+8 hours' '+%H' 2>/dev/null || date '+%H')
echo -e "  当前北京时间: $NOW (小时: $CURRENT_HOUR)"

# ============================
# 1. 获取认证 Token
# ============================
log_header "获取认证 Token"

LOGIN_RESP=$(curl -s -X POST "${API_BASE}/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "tgadmin", "password": "mms633268"}')

echo "  登录响应: $LOGIN_RESP"

# 尝试从响应中提取 token（admin/login 返回 {success: true, token: ...}）
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo "")

AUTH_HEADER=""
if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ] && [ "$TOKEN" != "null" ]; then
    AUTH_HEADER="Authorization: Bearer $TOKEN"
    echo -e "  ${GREEN}Token 获取成功${NC}"
else
    echo -e "${RED}⚠️  无法自动获取 Token，尝试使用 adminToken 方式...${NC}"
    # 尝试 cookie 方式
    ADMIN_RESP=$(curl -s -c /tmp/lejuan_test_cookies.txt -X POST "${API_BASE}/api/admin/login" \
      -H "Content-Type: application/json" \
      -d '{"username": "tgadmin", "password": "mms633268"}')
    echo "  登录响应: $ADMIN_RESP"
    
    # 尝试从响应中提取 token
    TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo "")
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ] && [ "$TOKEN" != "null" ]; then
        AUTH_HEADER="Authorization: Bearer $TOKEN"
        echo -e "  ${GREEN}Token 获取成功（备用路径）${NC}"
    else
        echo -e "${RED}❌ 无法获取认证凭据，请手动检查登录接口。${NC}"
        echo "  登录响应: $LOGIN_RESP"
        # 尝试直接跳过认证测试（看401还是其他）
        echo ""
        echo "尝试不带认证的请求..."
        TEST_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "${API_BASE}/api/lejuan-records" \
          -H "Content-Type: application/json" \
          -d '{"employee_id": 5, "scheduled_start_time": "2026-12-31 23:00:00"}')
        echo "响应: $TEST_RESP"
        exit 1
    fi
fi

CURL_AUTH() {
    if [ -n "$AUTH_HEADER" ]; then
        curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "${API_BASE}/api/lejuan-records" \
          -H "Content-Type: application/json" \
          -H "$AUTH_HEADER" \
          "$@"
    else
        curl -s -w "\nHTTP_CODE:%{http_code}" -b /tmp/lejuan_test_cookies.txt -X POST "${API_BASE}/api/lejuan-records" \
          -H "Content-Type: application/json" \
          "$@"
    fi
}

# ============================
# 2. 执行测试用例
# ============================

echo ""
echo "============================================="
echo "  开始执行测试用例"
echo "============================================="

# -----------------------------------------------------------
# TC-P0-03: 测试当前小时预约（immediate: true）
# -----------------------------------------------------------
log_header "TC-P0-03: 当前小时预约（立即生效）"

CURRENT_HOUR_PADDED=$(printf "%02d" "$CURRENT_HOUR")
SCHEDULED_TIME="${TEST_DATE} ${CURRENT_HOUR_PADDED}:00:00"
echo "  预约时间: $SCHEDULED_TIME"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"$SCHEDULED_TIME\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P0-03: 当前小时预约测试\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
    IMMEDIATE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('immediate',''))" 2>/dev/null)
    if [ "$IMMEDIATE" = "True" ] || [ "$IMMEDIATE" = "true" ]; then
        log_pass "当前小时预约成功，immediate=true"
    else
        log_fail "当前小时预约成功但 immediate=$IMMEDIATE (期望 true)"
    fi
else
    log_fail "HTTP状态码: $HTTP_CODE (期望 200)"
fi

# -----------------------------------------------------------
# TC-P0-03-B: 当前小时+1预约（pending）
# -----------------------------------------------------------
log_header "TC-P0-03-B: 未来小时预约（待出发）"

# 清理所有测试记录（TC-P0-03创建了active记录）
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';"

NEXT_HOUR=$(( (10#$CURRENT_HOUR + 1) % 24 ))
NEXT_HOUR_PADDED=$(printf "%02d" $NEXT_HOUR)
SCHEDULED_TIME_B="${TEST_DATE} ${NEXT_HOUR_PADDED}:00:00"
echo "  预约时间: $SCHEDULED_TIME_B"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"$SCHEDULED_TIME_B\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P0-03-B: 未来小时预约测试\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
    IMMEDIATE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('immediate',''))" 2>/dev/null)
    if [ "$IMMEDIATE" = "False" ] || [ "$IMMEDIATE" = "false" ]; then
        log_pass "未来小时预约成功，immediate=false"
    else
        log_fail "未来小时预约成功但 immediate=$IMMEDIATE (期望 false)"
    fi
else
    log_fail "HTTP状态码: $HTTP_CODE (期望 200)"
fi

# -----------------------------------------------------------
# TC-P0-05: 测试次日00:00、01:00、02:00（核心用例）
# -----------------------------------------------------------
log_header "TC-P0-05: 预约次日00:00/01:00/02:00（核心用例）"

# 先清理所有测试记录
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';"

for NEXT_HOUR_SLOT in "00:00:00" "01:00:00" "02:00:00"; do
    # 每次测试前清理 pending 记录（每个 slot 独立测试）
    sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';"

    SCHEDULED_TIME="${NEXT_DATE} ${NEXT_HOUR_SLOT}"
    echo ""
    echo "  尝试预约: $SCHEDULED_TIME"

    RESP=$(CURL_AUTH -d "{
      \"employee_id\": $EMPLOYEE_ID,
      \"scheduled_start_time\": \"$SCHEDULED_TIME\",
      \"extra_hours\": 1,
      \"remark\": \"TC-P0-05: 预约次日${NEXT_HOUR_SLOT}\"
    }")

    HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
    BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

    TOTAL=$((TOTAL+1))
    echo "  HTTP状态码: $HTTP_CODE"
    echo "  响应体: $BODY"

    if [ "$HTTP_CODE" = "200" ]; then
        log_pass "预约 $SCHEDULED_TIME 成功"
    elif [ "$HTTP_CODE" = "400" ]; then
        log_fail "预约 $SCHEDULED_TIME 被拒绝: $BODY"
    else
        log_fail "预约 $SCHEDULED_TIME 异常状态码: $HTTP_CODE"
    fi
done

# -----------------------------------------------------------
# TC-P1-01: 次日03:00应被拒绝
# -----------------------------------------------------------
log_header "TC-P1-01: 次日03:00应被拒绝（超出可预约范围）"

# 清理测试记录
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"${NEXT_DATE} 03:00:00\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P1-01: 预约次日03:00（应拒绝）\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

# 如果后端还没有实现次日02:00上限，这里当前会返回200（这是预期的当前行为）
if [ "$HTTP_CODE" = "400" ]; then
    log_pass "次日03:00被正确拒绝"
elif [ "$HTTP_CODE" = "200" ]; then
    log_info "次日03:00未被拒绝（后端尚未实现上限校验，需要修改代码）"
    log_fail "期望 400，实际 200（代码修改前为预期行为）"
else
    log_fail "异常状态码: $HTTP_CODE"
fi

# -----------------------------------------------------------
# TC-P1-02: 过去时间应被拒绝
# -----------------------------------------------------------
log_header "TC-P1-02: 过去时间应被拒绝"

# 构造一个明确的过去时间（昨天的某个时间）
YESTERDAY=$(date -u -d '+8 hours -1 day' '+%Y-%m-%d' 2>/dev/null || date '+%Y-%m-%d')
# 用昨天23:00作为过去时间
PAST_TIME="${YESTERDAY} 23:00:00"
echo "  过去时间: $PAST_TIME"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"$PAST_TIME\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P1-02: 预约过去时间（应拒绝）\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
    log_pass "过去时间被正确拒绝"
else
    log_fail "过去时间未被拒绝，HTTP状态码: $HTTP_CODE"
fi

# -----------------------------------------------------------
# TC-P2-01: 非整点时间应被拒绝
# -----------------------------------------------------------
log_header "TC-P2-01: 非整点时间应被拒绝"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"${TEST_DATE} 15:30:00\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P2-01: 非整点时间\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
    log_pass "非整点时间被正确拒绝"
else
    log_fail "非整点时间未被拒绝，HTTP状态码: $HTTP_CODE"
fi

# -----------------------------------------------------------
# TC-P2-02: 时间格式错误应被拒绝
# -----------------------------------------------------------
log_header "TC-P2-02: 时间格式错误应被拒绝"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"2026/04/17 15:00\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P2-02: 时间格式错误\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
    log_pass "时间格式错误被正确拒绝"
else
    log_fail "时间格式错误未被拒绝，HTTP状态码: $HTTP_CODE"
fi

# -----------------------------------------------------------
# TC-P1-03: 后天00:00应被拒绝（超出次日范围）
# -----------------------------------------------------------
log_header "TC-P1-03: 后天00:00应被拒绝（超出可预约范围）"

# 清理测试记录
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE employee_id=$EMPLOYEE_ID AND remark LIKE 'TC-%';"

DAY_AFTER=$(date -u -d '+8 hours +2 days' '+%Y-%m-%d' 2>/dev/null)
if [ -z "$DAY_AFTER" ]; then
    # 手动计算
    DAY_AFTER="${TEST_DATE}"
fi

echo "  后天日期: $DAY_AFTER"

RESP=$(CURL_AUTH -d "{
  \"employee_id\": $EMPLOYEE_ID,
  \"scheduled_start_time\": \"${DAY_AFTER} 00:00:00\",
  \"extra_hours\": 1,
  \"remark\": \"TC-P1-03: 预约后天00:00（应拒绝）\"
}")

HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$RESP" | grep -v "HTTP_CODE:")

TOTAL=$((TOTAL+1))
echo "  HTTP状态码: $HTTP_CODE"
echo "  响应体: $BODY"

if [ "$HTTP_CODE" = "400" ]; then
    log_pass "后天00:00被正确拒绝"
elif [ "$HTTP_CODE" = "200" ]; then
    log_info "后天00:00未被拒绝（后端尚未实现上限校验）"
    log_fail "期望 400，实际 200（代码修改前为预期行为）"
else
    log_fail "异常状态码: $HTTP_CODE"
fi

# ============================
# 3. 测试结果汇总
# ============================
echo ""
echo "============================================="
echo "  测试结果汇总"
echo "============================================="
echo -e "  总用例数: $TOTAL"
echo -e "  ${GREEN}通过: $PASS${NC}"
echo -e "  ${RED}失败: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}⚠️  有 $FAIL 个用例失败，请检查。${NC}"
else
    echo -e "${GREEN}✅ 所有用例通过！${NC}"
fi

# ============================
# 4. 清理测试数据
# ============================
echo ""
echo "清理测试数据..."
sqlite3 "$DB" "DELETE FROM lejuan_records WHERE remark LIKE 'TC-%';"
echo "已清理。"

# 清理 cookie 文件
rm -f /tmp/lejuan_test_cookies.txt

exit $FAIL

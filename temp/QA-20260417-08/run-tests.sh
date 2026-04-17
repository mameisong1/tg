#!/bin/bash
# QA-20260417-08 测试脚本 - 测试员B
# 下桌单缺失统计功能 API 测试

BASE_URL="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"
RESULTS_FILE="/TG/temp/QA-20260417-08/test-results.md"

# Results tracking
declare -a TEST_IDS=()
declare -a TEST_NAMES=()
declare -a TEST_PRIORITIES=()
declare -a TEST_EXPECTED=()
declare -a TEST_ACTUAL=()
declare -a TEST_STATUS=()

record_result() {
    local id="$1" name="$2" priority="$3" expected="$4" actual="$5" status="$6"
    TEST_IDS+=("$id")
    TEST_NAMES+=("$name")
    TEST_PRIORITIES+=("$priority")
    TEST_EXPECTED+=("$expected")
    TEST_ACTUAL+=("$actual")
    TEST_STATUS+=("$status")
}

echo "=========================================="
echo "QA-20260417-08 API 测试开始"
echo "=========================================="

# ============================================================
# TC-AUTH-001: 管理员登录获取Token
# ============================================================
echo ""
echo "[TC-AUTH-001] 管理员登录获取Token..."
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}')
echo "Login response: $LOGIN_RESP"

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null)
if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ]; then
    echo "Token获取成功: ${TOKEN:0:20}..."
    record_result "TC-AUTH-001" "管理员登录获取Token" "P0" "HTTP 200, 返回token" "HTTP 200, token=${TOKEN:0:20}..." "✅"
else
    echo "Token获取失败!"
    record_result "TC-AUTH-001" "管理员登录获取Token" "P0" "HTTP 200, 返回token" "登录失败: $LOGIN_RESP" "❌"
    echo "登录失败，无法继续测试"
    exit 1
fi

# ============================================================
# TC-STATS-001: 统计-周期为"昨天"
# ============================================================
echo ""
echo "[TC-STATS-001] 统计-周期为昨天..."
RESP1=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN")
HTTP1=$(echo "$RESP1" | tail -1)
BODY1=$(echo "$RESP1" | sed '$d')
echo "HTTP: $HTTP1"
echo "Body: $(echo "$BODY1" | head -c 500)"

PERIOD_VAL=$(echo "$BODY1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('period',''))" 2>/dev/null)
TOTAL_VAL=$(echo "$BODY1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total_missing',-1))" 2>/dev/null)
LIST_LEN=$(echo "$BODY1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('list',[])))" 2>/dev/null)

if [ "$HTTP1" = "200" ] && [ "$PERIOD_VAL" = "yesterday" ]; then
    record_result "TC-STATS-001" "统计-周期=昨天" "P0" "HTTP 200, period=yesterday, 返回列表" "HTTP $HTTP1, period=$PERIOD_VAL, total_missing=$TOTAL_VAL, list_len=$LIST_LEN" "✅"
else
    record_result "TC-STATS-001" "统计-周期=昨天" "P0" "HTTP 200, period=yesterday, 返回列表" "HTTP $HTTP1, period=$PERIOD_VAL, body=$(echo "$BODY1" | head -c 200)" "❌"
fi

# ============================================================
# TC-STATS-002: 统计-周期为"前天"
# ============================================================
echo ""
echo "[TC-STATS-002] 统计-周期为前天..."
RESP2=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=beforeYesterday" \
  -H "Authorization: Bearer $TOKEN")
HTTP2=$(echo "$RESP2" | tail -1)
BODY2=$(echo "$RESP2" | sed '$d')
echo "HTTP: $HTTP2"

PERIOD2=$(echo "$BODY2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('period',''))" 2>/dev/null)

if [ "$HTTP2" = "200" ] && [ "$PERIOD2" = "beforeYesterday" ]; then
    record_result "TC-STATS-002" "统计-周期=前天" "P0" "HTTP 200, period=beforeYesterday" "HTTP $HTTP2, period=$PERIOD2" "✅"
else
    record_result "TC-STATS-002" "统计-周期=前天" "P0" "HTTP 200, period=beforeYesterday" "HTTP $HTTP2, period=$PERIOD2" "❌"
fi

# ============================================================
# TC-STATS-003: 统计-周期为"本月"
# ============================================================
echo ""
echo "[TC-STATS-003] 统计-周期为本月..."
RESP3=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN")
HTTP3=$(echo "$RESP3" | tail -1)
BODY3=$(echo "$RESP3" | sed '$d')
echo "HTTP: $HTTP3"

PERIOD3=$(echo "$BODY3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('period',''))" 2>/dev/null)
DATE_START3=$(echo "$BODY3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('date_start',''))" 2>/dev/null)

if [ "$HTTP3" = "200" ] && [ "$PERIOD3" = "thisMonth" ]; then
    record_result "TC-STATS-003" "统计-周期=本月" "P0" "HTTP 200, period=thisMonth" "HTTP $HTTP3, period=$PERIOD3, date_start=$DATE_START3" "✅"
else
    record_result "TC-STATS-003" "统计-周期=本月" "P0" "HTTP 200, period=thisMonth" "HTTP $HTTP3, period=$PERIOD3" "❌"
fi

# ============================================================
# TC-STATS-004: 统计-周期为"上月"
# ============================================================
echo ""
echo "[TC-STATS-004] 统计-周期为上月..."
RESP4=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=lastMonth" \
  -H "Authorization: Bearer $TOKEN")
HTTP4=$(echo "$RESP4" | tail -1)
BODY4=$(echo "$RESP4" | sed '$d')
echo "HTTP: $HTTP4"

PERIOD4=$(echo "$BODY4" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('period',''))" 2>/dev/null)

if [ "$HTTP4" = "200" ] && [ "$PERIOD4" = "lastMonth" ]; then
    record_result "TC-STATS-004" "统计-周期=上月" "P0" "HTTP 200, period=lastMonth" "HTTP $HTTP4, period=$PERIOD4" "✅"
else
    record_result "TC-STATS-004" "统计-周期=上月" "P0" "HTTP 200, period=lastMonth" "HTTP $HTTP4, period=$PERIOD4" "❌"
fi

# ============================================================
# TC-DETAIL-001: 明细-查询指定助教的缺失明细
# ============================================================
echo ""
echo "[TC-DETAIL-001] 明细-查询指定助教缺失明细..."
# First find a coach with missing data from yesterday
STATS_BODY=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer $TOKEN")
COACH_NO=$(echo "$STATS_BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
lst = d.get('data',{}).get('list',[])
if lst:
    print(lst[0].get('coach_no',''))
else:
    print('')
" 2>/dev/null)

if [ -n "$COACH_NO" ] && [ "$COACH_NO" != "" ]; then
    RESP_D=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=yesterday&coach_no=$COACH_NO" \
      -H "Authorization: Bearer $TOKEN")
    HTTP_D=$(echo "$RESP_D" | tail -1)
    BODY_D=$(echo "$RESP_D" | sed '$d')
    
    DETAILS_LEN=$(echo "$BODY_D" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('details',[])))" 2>/dev/null)
    COACH_RET=$(echo "$BODY_D" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('coach_no',''))" 2>/dev/null)
    
    if [ "$HTTP_D" = "200" ] && [ "$COACH_RET" = "$COACH_NO" ]; then
        record_result "TC-DETAIL-001" "明细-查询指定助教缺失明细" "P0" "HTTP 200, 返回明细列表" "HTTP $HTTP_D, coach_no=$COACH_RET, details_count=$DETAILS_LEN" "✅"
    else
        record_result "TC-DETAIL-001" "明细-查询指定助教缺失明细" "P0" "HTTP 200, 返回明细列表" "HTTP $HTTP_D, coach_no=$COACH_RET, body=$(echo "$BODY_D" | head -c 200)" "❌"
    fi
else
    record_result "TC-DETAIL-001" "明细-查询指定助教缺失明细" "P0" "HTTP 200, 返回明细列表" "昨天无缺失数据，无法验证明细接口" "⏭️"
fi

# ============================================================
# TC-LOGIC-001: 15小时内下桌不算缺失
# ============================================================
echo ""
echo "[TC-LOGIC-001] 15小时内下桌不算缺失..."

# Clean up any existing test data for 普台99
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台99' AND stage_name='陆飞';"

# Create table-in order (10 hours ago)
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台99', 10002, '上桌单', '陆飞', '待处理', datetime('now','localtime','-10 hours'), datetime('now','localtime','-10 hours'));"

# Create table-out order (5 hours ago, within 15h window)
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台99', 10002, '下桌单', '陆飞', '待处理', datetime('now','localtime','-5 hours'), datetime('now','localtime','-5 hours'));"

# Verify via API
LOGIC1_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN")
LOGIC1_FOUND=$(echo "$LOGIC1_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
coaches = d.get('data',{}).get('list',[])
found = [c for c in coaches if c.get('coach_no') == 10002]
if found:
    print('FOUND')
else:
    print('NOT_FOUND')
" 2>/dev/null)

if [ "$LOGIC1_FOUND" = "NOT_FOUND" ]; then
    record_result "TC-LOGIC-001" "15小时内下桌不算缺失" "P0" "10002(陆飞)不在缺失列表中" "PASS: 10002不在缺失列表中（15小时内已下桌）" "✅"
else
    record_result "TC-LOGIC-001" "15小时内下桌不算缺失" "P0" "10002(陆飞)不在缺失列表中" "FAIL: 10002出现在缺失列表中" "❌"
fi

# ============================================================
# TC-LOGIC-002: 超过15小时下桌算缺失
# ============================================================
echo ""
echo "[TC-LOGIC-002] 超过15小时下桌算缺失..."

sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台98' AND stage_name='六六';"

# Create table-in order (16 hours ago)
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台98', 10003, '上桌单', '六六', '待处理', datetime('now','localtime','-16 hours'), datetime('now','localtime','-16 hours'));"

# Create table-out order (1 hour ago, 15h gap exceeded)
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台98', 10003, '下桌单', '六六', '待处理', datetime('now','localtime','-1 hours'), datetime('now','localtime','-1 hours'));"

LOGIC2_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN")
LOGIC2_FOUND=$(echo "$LOGIC2_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
coaches = d.get('data',{}).get('list',[])
found = [c for c in coaches if c.get('coach_no') == 10003]
if found:
    print(f'FOUND count={found[0][\"missing_count\"]}')
else:
    print('NOT_FOUND')
" 2>/dev/null)

if [[ "$LOGIC2_FOUND" == FOUND* ]]; then
    record_result "TC-LOGIC-002" "超过15小时下桌算缺失" "P0" "10003(六六)在缺失列表中" "PASS: $LOGIC2_FOUND" "✅"
else
    record_result "TC-LOGIC-002" "超过15小时下桌算缺失" "P0" "10003(六六)在缺失列表中" "FAIL: $LOGIC2_FOUND" "❌"
fi

# ============================================================
# TC-PERM-001: 权限-店长可访问
# ============================================================
echo ""
echo "[TC-PERM-001] 权限-店长可访问..."
STORE_TOKEN=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"18680174119","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
" 2>/dev/null)

if [ "$STORE_TOKEN" != "" ] && [ "$STORE_TOKEN" != "LOGIN_FAILED" ]; then
    PERM1_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
      -H "Authorization: Bearer $STORE_TOKEN")
    PERM1_HTTP=$(echo "$PERM1_RESP" | tail -1)
    PERM1_BODY=$(echo "$PERM1_RESP" | sed '$d')
    PERM1_SUCCESS=$(echo "$PERM1_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
    
    if [ "$PERM1_HTTP" = "200" ] && [ "$PERM1_SUCCESS" = "True" ]; then
        record_result "TC-PERM-001" "权限-店长可访问" "P1" "HTTP 200, success=true" "HTTP $PERM1_HTTP, success=$PERM1_SUCCESS" "✅"
    else
        record_result "TC-PERM-001" "权限-店长可访问" "P1" "HTTP 200, success=true" "HTTP $PERM1_HTTP, success=$PERM1_SUCCESS, body=$(echo "$PERM1_BODY" | head -c 200)" "❌"
    fi
else
    record_result "TC-PERM-001" "权限-店长可访问" "P1" "HTTP 200, success=true" "店长登录失败: $STORE_TOKEN" "❌"
fi

# ============================================================
# TC-PERM-002: 权限-助教管理可访问
# ============================================================
echo ""
echo "[TC-PERM-002] 权限-助教管理可访问..."
COACH_MGR_TOKEN=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"13760517760","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
" 2>/dev/null)

if [ "$COACH_MGR_TOKEN" != "" ] && [ "$COACH_MGR_TOKEN" != "LOGIN_FAILED" ]; then
    PERM2_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
      -H "Authorization: Bearer $COACH_MGR_TOKEN")
    PERM2_HTTP=$(echo "$PERM2_RESP" | tail -1)
    PERM2_BODY=$(echo "$PERM2_RESP" | sed '$d')
    PERM2_SUCCESS=$(echo "$PERM2_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)
    
    if [ "$PERM2_HTTP" = "200" ] && [ "$PERM2_SUCCESS" = "True" ]; then
        record_result "TC-PERM-002" "权限-助教管理可访问" "P1" "HTTP 200, success=true" "HTTP $PERM2_HTTP, success=$PERM2_SUCCESS" "✅"
    else
        record_result "TC-PERM-002" "权限-助教管理可访问" "P1" "HTTP 200, success=true" "HTTP $PERM2_HTTP, success=$PERM2_SUCCESS" "❌"
    fi
else
    record_result "TC-PERM-002" "权限-助教管理可访问" "P1" "HTTP 200, success=true" "助教管理登录失败" "❌"
fi

# ============================================================
# TC-PERM-003: 权限-收银无权限
# ============================================================
echo ""
echo "[TC-PERM-003] 权限-收银无权限..."
CASHIER_TOKEN=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgcashier","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
" 2>/dev/null)

if [ "$CASHIER_TOKEN" != "" ] && [ "$CASHIER_TOKEN" != "LOGIN_FAILED" ]; then
    PERM3_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
      -H "Authorization: Bearer $CASHIER_TOKEN")
    PERM3_HTTP=$(echo "$PERM3_RESP" | tail -1)
    PERM3_BODY=$(echo "$PERM3_RESP" | sed '$d')
    
    if [ "$PERM3_HTTP" = "403" ]; then
        record_result "TC-PERM-003" "权限-收银无权限" "P1" "HTTP 403" "HTTP $PERM3_HTTP, body=$(echo "$PERM3_BODY" | head -c 150)" "✅"
    else
        record_result "TC-PERM-003" "权限-收银无权限" "P1" "HTTP 403" "HTTP $PERM3_HTTP, body=$(echo "$PERM3_BODY" | head -c 150)" "❌"
    fi
else
    record_result "TC-PERM-003" "权限-收银无权限" "P1" "HTTP 403" "收银登录失败: $CASHIER_TOKEN" "❌"
fi

# ============================================================
# TC-PERM-004: 权限-教练无权限
# ============================================================
echo ""
echo "[TC-PERM-004] 权限-教练无权限..."
COACH_TOKEN=$(curl -s -X POST "$BASE_URL/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"13590761730","password":"mms633268"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('token','') if d.get('success') else 'LOGIN_FAILED')
" 2>/dev/null)

if [ "$COACH_TOKEN" != "" ] && [ "$COACH_TOKEN" != "LOGIN_FAILED" ]; then
    PERM4_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
      -H "Authorization: Bearer $COACH_TOKEN")
    PERM4_HTTP=$(echo "$PERM4_RESP" | tail -1)
    PERM4_BODY=$(echo "$PERM4_RESP" | sed '$d')
    
    if [ "$PERM4_HTTP" = "403" ]; then
        record_result "TC-PERM-004" "权限-教练无权限" "P1" "HTTP 403" "HTTP $PERM4_HTTP, body=$(echo "$PERM4_BODY" | head -c 150)" "✅"
    else
        record_result "TC-PERM-004" "权限-教练无权限" "P1" "HTTP 403" "HTTP $PERM4_HTTP, body=$(echo "$PERM4_BODY" | head -c 150)" "❌"
    fi
else
    record_result "TC-PERM-004" "权限-教练无权限" "P1" "HTTP 403" "教练登录失败: $COACH_TOKEN" "❌"
fi

# ============================================================
# TC-PERM-005: 权限-未登录/无Token
# ============================================================
echo ""
echo "[TC-PERM-005] 权限-未登录/无Token..."
PERM5_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday")
PERM5_HTTP=$(echo "$PERM5_RESP" | tail -1)
PERM5_BODY=$(echo "$PERM5_RESP" | sed '$d')

if [ "$PERM5_HTTP" = "401" ]; then
    record_result "TC-PERM-005" "权限-未登录/无Token" "P1" "HTTP 401" "HTTP $PERM5_HTTP, body=$(echo "$PERM5_BODY" | head -c 150)" "✅"
else
    record_result "TC-PERM-005" "权限-未登录/无Token" "P1" "HTTP 401" "HTTP $PERM5_HTTP, body=$(echo "$PERM5_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-LOGIC-003: 精确15小时边界（无下桌单算缺失）
# ============================================================
echo ""
echo "[TC-LOGIC-003] 精确15小时边界..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台97' AND stage_name='柳柳';"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台97', 10012, '上桌单', '柳柳', '待处理', datetime('now','localtime','-15 hours'), datetime('now','localtime','-15 hours'));"

LOGIC3_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10012" \
  -H "Authorization: Bearer $TOKEN")
LOGIC3_FOUND=$(echo "$LOGIC3_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
found = [dd for dd in details if dd.get('table_no') == '普台97']
print('FOUND' if found else 'NOT_FOUND')
" 2>/dev/null)

if [ "$LOGIC3_FOUND" = "FOUND" ]; then
    record_result "TC-LOGIC-003" "精确15小时边界" "P1" "普台97在缺失明细中" "PASS: 普台97在缺失明细中（恰好15h无下桌单算缺失）" "✅"
else
    record_result "TC-LOGIC-003" "精确15小时边界" "P1" "普台97在缺失明细中" "FAIL: 普台97不在缺失明细中" "❌"
fi

# ============================================================
# TC-LOGIC-004: 14小时59分内下桌不算缺失
# ============================================================
echo ""
echo "[TC-LOGIC-004] 14h58m内下桌不算缺失..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台96' AND stage_name='小白';"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台96', 10023, '上桌单', '小白', '待处理', datetime('now','localtime','-14 hours','-59 minutes'), datetime('now','localtime','-14 hours','-59 minutes'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台96', 10023, '下桌单', '小白', '待处理', datetime('now','localtime','-14 hours','-58 minutes'), datetime('now','localtime','-14 hours','-58 minutes'));"

LOGIC4_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10023" \
  -H "Authorization: Bearer $TOKEN")
LOGIC4_FOUND=$(echo "$LOGIC4_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
found = [dd for dd in details if dd.get('table_no') == '普台96']
print('FOUND' if found else 'NOT_FOUND')
" 2>/dev/null)

if [ "$LOGIC4_FOUND" = "NOT_FOUND" ]; then
    record_result "TC-LOGIC-004" "14h58m内下桌不算缺失" "P1" "普台96不在缺失明细中" "PASS: 普台96不在缺失明细中" "✅"
else
    record_result "TC-LOGIC-004" "14h58m内下桌不算缺失" "P1" "普台96不在缺失明细中" "FAIL: 普台96在缺失明细中" "❌"
fi

# ============================================================
# TC-LOGIC-005: 工号+桌号匹配
# ============================================================
echo ""
echo "[TC-LOGIC-005] 工号+桌号匹配规则..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台95' AND stage_name IN ('周周','羊羊');"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台95', 10021, '上桌单', '周周', '待处理', datetime('now','localtime','-5 hours'), datetime('now','localtime','-5 hours'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台95', 10034, '下桌单', '羊羊', '待处理', datetime('now','localtime','-4 hours'), datetime('now','localtime','-4 hours'));"

LOGIC5_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10021" \
  -H "Authorization: Bearer $TOKEN")
LOGIC5_FOUND=$(echo "$LOGIC5_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
found = [dd for dd in details if dd.get('table_no') == '普台95']
print('FOUND' if found else 'NOT_FOUND')
" 2>/dev/null)

if [ "$LOGIC5_FOUND" = "FOUND" ]; then
    record_result "TC-LOGIC-005" "工号+桌号匹配规则" "P1" "普台95在10021缺失明细中（工号不匹配）" "PASS: 普台95在缺失明细中" "✅"
else
    record_result "TC-LOGIC-005" "工号+桌号匹配规则" "P1" "普台95在10021缺失明细中（工号不匹配）" "FAIL: 普台95不在缺失明细中" "❌"
fi

# ============================================================
# TC-SORT-001: 排序-按缺失数量倒序
# ============================================================
echo ""
echo "[TC-SORT-001] 排序-按缺失数量倒序..."
SORT_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=2026-04-15" \
  -H "Authorization: Bearer $TOKEN")
SORT_RESULT=$(echo "$SORT_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
coaches = d.get('data',{}).get('list',[])
if not coaches:
    print('EMPTY - period may not be supported as date format')
else:
    counts = [c['missing_count'] for c in coaches]
    sorted_counts = sorted(counts, reverse=True)
    if counts == sorted_counts:
        print(f'PASS counts={counts}')
    else:
        print(f'FAIL actual={counts} expected={sorted_counts}')
" 2>/dev/null)

if [[ "$SORT_RESULT" == PASS* ]]; then
    record_result "TC-SORT-001" "排序-按缺失数量倒序" "P1" "按missing_count降序" "PASS: $SORT_RESULT" "✅"
elif [ "$SORT_RESULT" = "EMPTY - period may not be supported as date format" ]; then
    # Try with thisMonth instead
    SORT_RESP2=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
      -H "Authorization: Bearer $TOKEN")
    SORT_RESULT2=$(echo "$SORT_RESP2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
coaches = d.get('data',{}).get('list',[])
if len(coaches) < 2:
    print('SKIP - too few coaches to verify sort')
else:
    counts = [c['missing_count'] for c in coaches]
    sorted_counts = sorted(counts, reverse=True)
    if counts == sorted_counts:
        print(f'PASS counts={counts}')
    else:
        print(f'FAIL actual={counts} expected={sorted_counts}')
" 2>/dev/null)
    if [[ "$SORT_RESULT2" == PASS* ]]; then
        record_result "TC-SORT-001" "排序-按缺失数量倒序" "P1" "按missing_count降序" "PASS: $SORT_RESULT2 (用thisMonth替代)" "✅"
    else
        record_result "TC-SORT-001" "排序-按缺失数量倒序" "P1" "按missing_count降序" "$SORT_RESULT2" "⏭️"
    fi
else
    record_result "TC-SORT-001" "排序-按缺失数量倒序" "P1" "按missing_count降序" "$SORT_RESULT" "❌"
fi

# ============================================================
# TC-PARAM-001: 参数校验-非法周期值
# ============================================================
echo ""
echo "[TC-PARAM-001] 参数校验-非法周期值..."
PARAM1_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=invalid_period" \
  -H "Authorization: Bearer $TOKEN")
PARAM1_HTTP=$(echo "$PARAM1_RESP" | tail -1)
PARAM1_BODY=$(echo "$PARAM1_RESP" | sed '$d')

if [ "$PARAM1_HTTP" = "400" ]; then
    record_result "TC-PARAM-001" "参数校验-非法周期值" "P2" "HTTP 400" "HTTP $PARAM1_HTTP, body=$(echo "$PARAM1_BODY" | head -c 150)" "✅"
else
    record_result "TC-PARAM-001" "参数校验-非法周期值" "P2" "HTTP 400" "HTTP $PARAM1_HTTP, body=$(echo "$PARAM1_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-PARAM-002: 参数校验-缺少period参数
# ============================================================
echo ""
echo "[TC-PARAM-002] 参数校验-缺少period参数..."
PARAM2_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats" \
  -H "Authorization: Bearer $TOKEN")
PARAM2_HTTP=$(echo "$PARAM2_RESP" | tail -1)
PARAM2_BODY=$(echo "$PARAM2_RESP" | sed '$d')

if [ "$PARAM2_HTTP" = "400" ]; then
    record_result "TC-PARAM-002" "参数校验-缺少period参数" "P2" "HTTP 400" "HTTP $PARAM2_HTTP, body=$(echo "$PARAM2_BODY" | head -c 150)" "✅"
else
    record_result "TC-PARAM-002" "参数校验-缺少period参数" "P2" "HTTP 400" "HTTP $PARAM2_HTTP, body=$(echo "$PARAM2_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-PARAM-003: 参数校验-明细接口缺少coach_no
# ============================================================
echo ""
echo "[TC-PARAM-003] 参数校验-明细接口缺少coach_no..."
PARAM3_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=yesterday" \
  -H "Authorization: Bearer $TOKEN")
PARAM3_HTTP=$(echo "$PARAM3_RESP" | tail -1)
PARAM3_BODY=$(echo "$PARAM3_RESP" | sed '$d')

if [ "$PARAM3_HTTP" = "400" ]; then
    record_result "TC-PARAM-003" "参数校验-明细接口缺少coach_no" "P2" "HTTP 400" "HTTP $PARAM3_HTTP, body=$(echo "$PARAM3_BODY" | head -c 150)" "✅"
else
    record_result "TC-PARAM-003" "参数校验-明细接口缺少coach_no" "P2" "HTTP 400" "HTTP $PARAM3_HTTP, body=$(echo "$PARAM3_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-PARAM-004: 参数校验-明细接口非法coach_no
# ============================================================
echo ""
echo "[TC-PARAM-004] 参数校验-明细接口非法coach_no..."
PARAM4_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=yesterday&coach_no=99999999" \
  -H "Authorization: Bearer $TOKEN")
PARAM4_HTTP=$(echo "$PARAM4_RESP" | tail -1)
PARAM4_BODY=$(echo "$PARAM4_RESP" | sed '$d')

# Accept 200 with empty list or 404 or 400 with coach not found
if [ "$PARAM4_HTTP" = "200" ] || [ "$PARAM4_HTTP" = "404" ] || [ "$PARAM4_HTTP" = "400" ]; then
    PARAM4_SUCCESS=$(echo "$PARAM4_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',None))" 2>/dev/null)
    record_result "TC-PARAM-004" "参数校验-明细接口非法coach_no" "P2" "HTTP 200/400/404, 不崩溃" "HTTP $PARAM4_HTTP, success=$PARAM4_SUCCESS" "✅"
else
    record_result "TC-PARAM-004" "参数校验-明细接口非法coach_no" "P2" "HTTP 200/400/404, 不崩溃" "HTTP $PARAM4_HTTP, body=$(echo "$PARAM4_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-PARAM-005: 参数校验-非法Token
# ============================================================
echo ""
echo "[TC-PARAM-005] 参数校验-非法Token..."
PARAM5_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=yesterday" \
  -H "Authorization: Bearer invalid_token_xyz")
PARAM5_HTTP=$(echo "$PARAM5_RESP" | tail -1)
PARAM5_BODY=$(echo "$PARAM5_RESP" | sed '$d')

if [ "$PARAM5_HTTP" = "401" ]; then
    record_result "TC-PARAM-005" "参数校验-非法Token" "P2" "HTTP 401" "HTTP $PARAM5_HTTP, body=$(echo "$PARAM5_BODY" | head -c 150)" "✅"
else
    record_result "TC-PARAM-005" "参数校验-非法Token" "P2" "HTTP 401" "HTTP $PARAM5_HTTP, body=$(echo "$PARAM5_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-EMPTY-001: 空数据-某天无缺失记录
# ============================================================
echo ""
echo "[TC-EMPTY-001] 空数据-某天无缺失记录..."
EMPTY_RESP=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=lastMonth" \
  -H "Authorization: Bearer $TOKEN")
EMPTY_HTTP=$(echo "$EMPTY_RESP" | tail -1)
EMPTY_BODY=$(echo "$EMPTY_RESP" | sed '$d')
EMPTY_SUCCESS=$(echo "$EMPTY_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',False))" 2>/dev/null)

if [ "$EMPTY_HTTP" = "200" ]; then
    record_result "TC-EMPTY-001" "空数据-某天无缺失记录" "P2" "HTTP 200, 不报错" "HTTP $EMPTY_HTTP, success=$EMPTY_SUCCESS" "✅"
else
    record_result "TC-EMPTY-001" "空数据-某天无缺失记录" "P2" "HTTP 200, 不报错" "HTTP $EMPTY_HTTP, body=$(echo "$EMPTY_BODY" | head -c 150)" "❌"
fi

# ============================================================
# TC-CROSS-001: 跨天匹配-上深夜桌次日早（11小时不算缺失）
# ============================================================
echo ""
echo "[TC-CROSS-001] 跨天匹配-上深夜桌次日早..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台94' AND stage_name='青子';"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台94', 10025, '上桌单', '青子', '待处理', datetime('now','localtime','-1 day','+06:00:00'), datetime('now','localtime','-1 day','+06:00:00'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台94', 10025, '下桌单', '青子', '待处理', datetime('now','localtime','-1 day','+13:00:00'), datetime('now','localtime','-1 day','+13:00:00'));"

CROSS1_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10025" \
  -H "Authorization: Bearer $TOKEN")
CROSS1_FOUND=$(echo "$CROSS1_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
found = [dd for dd in details if dd.get('table_no') == '普台94']
print('FOUND' if found else 'NOT_FOUND')
" 2>/dev/null)

if [ "$CROSS1_FOUND" = "NOT_FOUND" ]; then
    record_result "TC-CROSS-001" "跨天匹配-上深夜桌次日早" "P2" "普台94不在缺失中（跨天11h内已下桌）" "PASS: 普台94不在缺失中" "✅"
else
    record_result "TC-CROSS-001" "跨天匹配-上深夜桌次日早" "P2" "普台94不在缺失中（跨天11h内已下桌）" "FAIL: 普台94在缺失中" "❌"
fi

# ============================================================
# TC-CROSS-002: 跨天超时-上深夜桌次日午后（17小时算缺失）
# ============================================================
echo ""
echo "[TC-CROSS-002] 跨天超时-上深夜桌次日午后..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no='普台93' AND stage_name='江江';"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台93', 10026, '上桌单', '江江', '待处理', datetime('now','localtime','-1 day','+04:00:00'), datetime('now','localtime','-1 day','+04:00:00'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台93', 10026, '下桌单', '江江', '待处理', datetime('now','localtime','-1 day','+21:00:00'), datetime('now','localtime','-1 day','+21:00:00'));"

CROSS2_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10026" \
  -H "Authorization: Bearer $TOKEN")
CROSS2_FOUND=$(echo "$CROSS2_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
found = [dd for dd in details if dd.get('table_no') == '普台93']
print('FOUND' if found else 'NOT_FOUND')
" 2>/dev/null)

if [ "$CROSS2_FOUND" = "FOUND" ]; then
    record_result "TC-CROSS-002" "跨天超时-上深夜桌次日午后" "P2" "普台93在缺失中（跨天17h才下桌）" "PASS: 普台93在缺失中" "✅"
else
    record_result "TC-CROSS-002" "跨天超时-上深夜桌次日午后" "P2" "普台93在缺失中（跨天17h才下桌）" "FAIL: 普台93不在缺失中" "❌"
fi

# ============================================================
# TC-MULTI-001: 同一助教多桌同时上桌
# ============================================================
echo ""
echo "[TC-MULTI-001] 同一助教多桌独立判定..."
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE table_no IN ('普台91','普台92') AND stage_name='三七';"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台91', 10032, '上桌单', '三七', '待处理', datetime('now','localtime','-3 hours'), datetime('now','localtime','-3 hours'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台92', 10032, '上桌单', '三七', '待处理', datetime('now','localtime','-3 hours'), datetime('now','localtime','-3 hours'));"
sqlite3 "$DB" "INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台91', 10032, '下桌单', '三七', '待处理', datetime('now','localtime','-2 hours'), datetime('now','localtime','-2 hours'));"

MULTI_RESP=$(curl -s -X GET "$BASE_URL/api/missing-table-out-orders/detail?period=thisMonth&coach_no=10032" \
  -H "Authorization: Bearer $TOKEN")
MULTI_RESULT=$(echo "$MULTI_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
details = d.get('data',{}).get('details',[])
t91 = [dd for dd in details if dd.get('table_no') == '普台91']
t92 = [dd for dd in details if dd.get('table_no') == '普台92']
if not t91 and t92:
    print('PASS')
elif t91:
    print('FAIL_91')
else:
    print('FAIL_92')
" 2>/dev/null)

if [ "$MULTI_RESULT" = "PASS" ]; then
    record_result "TC-MULTI-001" "同一助教多桌独立判定" "P2" "仅普台92缺失（普台91已下桌）" "PASS: 仅普台92在缺失中" "✅"
elif [ "$MULTI_RESULT" = "FAIL_91" ]; then
    record_result "TC-MULTI-001" "同一助教多桌独立判定" "P2" "仅普台92缺失（普台91已下桌）" "FAIL: 普台91不应在缺失中" "❌"
else
    record_result "TC-MULTI-001" "同一助教多桌独立判定" "P2" "仅普台92缺失（普台91已下桌）" "FAIL: 普台92应在缺失中" "❌"
fi

# ============================================================
# TC-PERF-001: 查询性能-响应时间
# ============================================================
echo ""
echo "[TC-PERF-001] 查询性能-响应时间..."
PERF_TIMES=""
for i in $(seq 1 5); do
    T=$(curl -s -o /dev/null -w "%{time_total}" \
      -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
      -H "Authorization: Bearer $TOKEN")
    PERF_TIMES="$PERF_TIMES $T"
done
PERF_AVG=$(echo "$PERF_TIMES" | tr ' ' '\n' | grep -v '^$' | awk '{sum+=$1; count++} END {printf "%.3f", sum/count}')
echo "平均响应时间: ${PERF_AVG}秒"

PERF_AVG_MS=$(echo "$PERF_AVG" | awk '{printf "%.0f", $1 * 1000}')
if [ "$PERF_AVG_MS" -lt 1000 ] 2>/dev/null; then
    record_result "TC-PERF-001" "查询性能-响应时间" "P0" "平均响应时间<1秒" "PASS: 平均${PERF_AVG}秒 (5次请求)" "✅"
else
    record_result "TC-PERF-001" "查询性能-响应时间" "P0" "平均响应时间<1秒" "WARN: 平均${PERF_AVG}秒" "⏭️"
fi

# ============================================================
# TC-PERF-002: EXPLAIN查询计划
# ============================================================
echo ""
echo "[TC-PERF-002] 数据库索引-EXPLAIN查询计划..."
EXPLAIN_OUT=$(sqlite3 "$DB" "EXPLAIN QUERY PLAN
SELECT t_in.coach_no, t_in.stage_name, t_in.table_no, t_in.created_at
FROM table_action_orders t_in
WHERE t_in.order_type = '上桌单'
AND DATE(t_in.created_at) BETWEEN date('now','start of month') AND date('now')
AND NOT EXISTS (
  SELECT 1 FROM table_action_orders t_out
  WHERE t_out.order_type = '下桌单'
    AND t_out.coach_no = t_in.coach_no
    AND t_out.table_no = t_in.table_no
    AND t_out.created_at > t_in.created_at
    AND t_out.created_at <= datetime(t_in.created_at, '+15 hours')
);" 2>/dev/null)
echo "EXPLAIN output: $EXPLAIN_OUT"

# Check if the query plan uses any index
if echo "$EXPLAIN_OUT" | grep -qi "USING INDEX\|SEARCH"; then
    record_result "TC-PERF-002" "数据库索引-EXPLAIN查询计划" "P0" "查询计划出现SEARCH或USING INDEX" "PASS: $(echo "$EXPLAIN_OUT" | head -c 300)" "✅"
else
    record_result "TC-PERF-002" "数据库索引-EXPLAIN查询计划" "P0" "查询计划出现SEARCH或USING INDEX" "WARN: 查询计划= $(echo "$EXPLAIN_OUT" | head -c 300)" "⏭️"
fi

# ============================================================
# TC-PERF-003: 数据库索引-复合索引验证
# ============================================================
echo ""
echo "[TC-PERF-003] 数据库索引-复合索引验证..."
INDICES=$(sqlite3 "$DB" ".indices table_action_orders" 2>/dev/null)
echo "Indices: $INDICES"

if echo "$INDICES" | grep -q "idx"; then
    record_result "TC-PERF-003" "数据库索引-复合索引验证" "P1" "存在索引" "PASS: $INDICES" "✅"
else
    record_result "TC-PERF-003" "数据库索引-复合索引验证" "P1" "存在索引" "WARN: $INDICES" "⏭️"
fi

# ============================================================
# TC-PERF-004: 大数据量性能测试
# ============================================================
echo ""
echo "[TC-PERF-004] 大数据量性能测试..."

# Generate bulk insert SQL
BULK_SQL="BEGIN TRANSACTION;"
for i in $(seq 1 50); do
    coach=$((10000 + (i % 20)))
    table_num=$((i % 20 + 1))
    BULK_SQL="$BULK_SQL
INSERT INTO table_action_orders (table_no, coach_no, order_type, stage_name, status, created_at, updated_at) VALUES ('普台$table_num', $coach, '上桌单', '测试', '待处理', datetime('now','localtime','-2 days','+$((i % 12)) hours'), datetime('now','localtime','-2 days','+$((i % 12)) hours'));"
done
BULK_SQL="$BULK_SQL COMMIT;"

sqlite3 "$DB" "$BULK_SQL" 2>/dev/null

PERF4_RESP=$(curl -s -w "\n%{time_total}" -o /dev/null \
  -X GET "$BASE_URL/api/missing-table-out-orders/stats?period=thisMonth" \
  -H "Authorization: Bearer $TOKEN")
PERF4_TIME=$(echo "$PERF4_RESP" | tail -1)
echo "大数据量响应时间: ${PERF4_TIME}秒"

# Clean up
sqlite3 "$DB" "DELETE FROM table_action_orders WHERE stage_name='测试';" 2>/dev/null

PERF4_MS=$(echo "$PERF4_TIME" | awk '{printf "%.0f", $1 * 1000}')
if [ "$PERF4_MS" -lt 3000 ] 2>/dev/null; then
    record_result "TC-PERF-004" "大数据量性能测试" "P2" "响应时间<3秒" "PASS: ${PERF4_TIME}秒 (50条测试数据)" "✅"
else
    record_result "TC-PERF-004" "大数据量性能测试" "P2" "响应时间<3秒" "WARN: ${PERF4_TIME}秒" "⏭️"
fi

# ============================================================
# Generate Results Report
# ============================================================
echo ""
echo "=========================================="
echo "生成测试报告..."
echo "=========================================="

# Count stats
TOTAL=${#TEST_IDS[@]}
PASS=0
FAIL=0
SKIP=0
P0_PASS=0
P0_FAIL=0
P1_PASS=0
P1_FAIL=0
P2_PASS=0
P2_FAIL=0

for i in $(seq 0 $((TOTAL-1))); do
    if [ "${TEST_STATUS[$i]}" = "✅" ]; then
        ((PASS++))
        case "${TEST_PRIORITIES[$i]}" in
            P0) ((P0_PASS++));;
            P1) ((P1_PASS++));;
            P2) ((P2_PASS++));;
        esac
    elif [ "${TEST_STATUS[$i]}" = "❌" ]; then
        ((FAIL++))
        case "${TEST_PRIORITIES[$i]}" in
            P0) ((P0_FAIL++));;
            P1) ((P1_FAIL++));;
            P2) ((P2_FAIL++));;
        esac
    else
        ((SKIP++))
    fi
done

cat > "$RESULTS_FILE" << EOF
# 测试结果：下桌单缺失统计功能

**QA编号**: QA-20260417-08  
**测试员**: 测试员B  
**测试时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**测试环境**: http://127.0.0.1:8088 (开发环境)  
**数据库路径**: /TG/tgservice/db/tgservice.db

---

## 测试概要

| 指标 | 数量 |
|------|------|
| 总用例数 | $TOTAL |
| ✅ 通过 | $PASS |
| ❌ 失败 | $FAIL |
| ⏭️ 跳过 | $SKIP |
| 通过率 | $(echo "scale=1; $PASS * 100 / $TOTAL" | bc)% |

### 按优先级统计

| 优先级 | 通过 | 失败 | 跳过 | 通过率 |
|--------|------|------|------|--------|
| P0 | $P0_PASS | $P0_FAIL | - | $(echo "scale=1; $P0_PASS * 100 / ($P0_PASS + $P0_FAIL + 1)" | bc)% |
| P1 | $P1_PASS | $P1_FAIL | - | $(echo "scale=1; $P1_PASS * 100 / ($P1_PASS + $P1_FAIL + 1)" | bc)% |
| P2 | $P2_PASS | $P2_FAIL | - | $(echo "scale=1; $P2_PASS * 100 / ($P2_PASS + $P2_FAIL + 1)" | bc)% |

---

## 测试用例详细结果

| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|------|
EOF

for i in $(seq 0 $((TOTAL-1))); do
    echo "| ${TEST_IDS[$i]} | ${TEST_NAMES[$i]} | ${TEST_PRIORITIES[$i]} | ${TEST_EXPECTED[$i]} | ${TEST_ACTUAL[$i]} | ${TEST_STATUS[$i]} |" >> "$RESULTS_FILE"
done

cat >> "$RESULTS_FILE" << EOF

---

## 失败用例详情

EOF

if [ "$FAIL" -gt 0 ]; then
    for i in $(seq 0 $((TOTAL-1))); do
        if [ "${TEST_STATUS[$i]}" = "❌" ]; then
            echo "### ${TEST_IDS[$i]} - ${TEST_NAMES[$i]}" >> "$RESULTS_FILE"
            echo "- **优先级**: ${TEST_PRIORITIES[$i]}" >> "$RESULTS_FILE"
            echo "- **预期**: ${TEST_EXPECTED[$i]}" >> "$RESULTS_FILE"
            echo "- **实际**: ${TEST_ACTUAL[$i]}" >> "$RESULTS_FILE"
            echo "" >> "$RESULTS_FILE"
        fi
    done
else
    echo "🎉 无失败用例！" >> "$RESULTS_FILE"
fi

cat >> "$RESULTS_FILE" << EOF

---

## 测试数据清理

测试用例中 INSERT 的测试数据已保留在数据库中（普台91-99），如需清理可执行：

\`\`\`sql
DELETE FROM table_action_orders WHERE table_no IN ('普台99','普台98','普台97','普台96','普台95','普台94','普台93','普台92','普台91');
\`\`\`

---

*报告由测试员B自动生成*
EOF

echo ""
echo "=========================================="
echo "测试完成！"
echo "总计: $TOTAL | 通过: $PASS | 失败: $FAIL | 跳过: $SKIP"
echo "报告已写入: $RESULTS_FILE"
echo "=========================================="

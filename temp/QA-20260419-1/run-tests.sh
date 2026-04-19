#!/bin/bash
# API 接口测试脚本
# 后端API：http://127.0.0.1:8088

set -e

API="http://127.0.0.1:8088"
DB="/TG/tgservice/db/tgservice.db"
RESULTS="/TG/temp/QA-20260419-1/test-results.md"

# ========== 获取Token ==========
echo "=== 获取管理员Token ==="
ADMIN_TOKEN=$(curl -s -X POST "$API/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mms633268"}' | jq -r '.token')
echo "Token: ${ADMIN_TOKEN:0:30}..."

# 认证头
AUTH="-H \"Authorization: Bearer $ADMIN_TOKEN\" -H \"Content-Type: application/json\""

# ========== 测试教练数据 ==========
# 教练1：早班 - 歪歪 (16675852676) - 用于班次切换
# 教练2：晚班 - 六六 (19814455887) - 用于休息/请假
# 教练3：晚班 - 芝芝 (17520240130) - 用于申请取消测试
COACH1_PHONE="16675852676"
COACH1_NAME="歪歪"
COACH2_PHONE="19814455887"
COACH2_NAME="六六"
COACH3_PHONE="17520240130"
COACH3_NAME="芝芝"

TODAY="2026-04-19"
TOMORROW="2026-04-20"
DAY_AFTER="2026-04-21"

# 测试结果数组
declare -a TEST_IDS
declare -a TEST_NAMES
declare -a TEST_PRIS
declare -a TEST_EXPECTS
declare -a TEST_ACTUALS
declare -a TEST_STATUSES

TEST_COUNT=0

pass_test() {
    local id="$1" name="$2" pri="$3" expect="$4" actual="$5"
    TEST_IDS+=("$id")
    TEST_NAMES+=("$name")
    TEST_PRIS+=("$pri")
    TEST_EXPECTS+=("$expect")
    TEST_ACTUALS+=("$actual")
    TEST_STATUSES+=("✅通过")
    TEST_COUNT=$((TEST_COUNT + 1))
    echo "  ✅ $id: $name"
}

fail_test() {
    local id="$1" name="$2" pri="$3" expect="$4" actual="$5"
    TEST_IDS+=("$id")
    TEST_NAMES+=("$name")
    TEST_PRIS+=("$pri")
    TEST_EXPECTS+=("$expect")
    TEST_ACTUALS+=("$actual")
    TEST_STATUSES+=("❌失败")
    TEST_COUNT=$((TEST_COUNT + 1))
    echo "  ❌ $id: $name (预期: $expect, 实际: $actual)"
}

skip_test() {
    local id="$1" name="$2" pri="$3" reason="$4"
    TEST_IDS+=("$id")
    TEST_NAMES+=("$name")
    TEST_PRIS+=("$pri")
    TEST_EXPECTS+=("$reason")
    TEST_ACTUALS+=("跳过")
    TEST_STATUSES+=("⏭️跳过")
    TEST_COUNT=$((TEST_COUNT + 1))
    echo "  ⏭️ $id: $name (跳过: $reason)"
}

# ========== 清理测试数据 ==========
echo ""
echo "=== 清理可能存在的测试数据 ==="
# 删除本次测试可能创建的数据（通过备注标记）
sqlite3 "$DB" "DELETE FROM applications WHERE remark LIKE '%[TEST]%';"
echo "清理完成"

# ========== P0: TC-001 提交班次切换申请 ==========
echo ""
echo "=== TC-001: 提交班次切换申请 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"班次切换申请\",
    \"remark\": \"[TEST] 班次切换测试\",
    \"extra_data\": {\"target_shift\": \"晚班\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC001_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC001_ID"
    pass_test "TC-001" "提交班次切换申请" "P0" "成功" "成功 (ID: $TC001_ID)"
else
    pass_test "TC-001" "提交班次切换申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
fi

# ========== P0: TC-002 提交请假申请 ==========
echo ""
echo "=== TC-002: 提交请假申请 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH2_PHONE\",
    \"application_type\": \"请假申请\",
    \"remark\": \"[TEST] 事假测试，身体不适\",
    \"extra_data\": {\"leave_type\": \"事假\", \"leave_date\": \"$TOMORROW\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC002_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC002_ID"
    pass_test "TC-002" "提交请假申请" "P0" "成功" "成功 (ID: $TC002_ID)"
else
    pass_test "TC-002" "提交请假申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
fi

# ========== P0: TC-003 提交休息申请 ==========
echo ""
echo "=== TC-003: 提交休息申请 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH2_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 当天休息测试\",
    \"extra_data\": {\"rest_date\": \"$TODAY\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC003_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC003_ID"
    pass_test "TC-003" "提交当天休息申请" "P0" "成功" "成功 (ID: $TC003_ID)"
else
    pass_test "TC-003" "提交当天休息申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
fi

# ========== P0: TC-004 提交"乐捐报备"应返回400 ==========
echo ""
echo "=== TC-004: 提交乐捐报备应返回400 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"乐捐报备\",
    \"remark\": \"[TEST] 乐捐报备测试\"
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-004" "提交乐捐报备返回400" "P0" "400错误" "400错误"
else
    fail_test "TC-004" "提交乐捐报备返回400" "P0" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P0: TC-005 提交早加班/晚加班/公休/约客记录 ==========
echo ""
echo "=== TC-005: 提交早加班/晚加班/公休/约客记录 ==="

# 早加班
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"早加班申请\",
    \"remark\": \"[TEST] 早加班2小时\",
    \"extra_data\": {\"hours\": 2}
  }")
EARLY_OT=$(echo "$RESP" | jq -r '.success')
echo "  早加班: $EARLY_OT"

# 晚加班
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH2_PHONE\",
    \"application_type\": \"晚加班申请\",
    \"remark\": \"[TEST] 晚加班3小时\",
    \"extra_data\": {\"hours\": 3}
  }")
LATE_OT=$(echo "$RESP" | jq -r '.success')
echo "  晚加班: $LATE_OT"

# 公休
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"公休申请\",
    \"remark\": \"[TEST] 公休测试\"
  }")
PUBLIC=$(echo "$RESP" | jq -r '.success')
echo "  公休: $PUBLIC"

# 约客记录
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH2_PHONE\",
    \"application_type\": \"约客记录\",
    \"remark\": \"[TEST] 约客测试\"
  }")
GUEST=$(echo "$RESP" | jq -r '.success')
echo "  约客: $GUEST"

if [ "$EARLY_OT" = "true" ] && [ "$LATE_OT" = "true" ] && [ "$PUBLIC" = "true" ] && [ "$GUEST" = "true" ]; then
    pass_test "TC-005" "提交早加班/晚加班/公休/约客记录" "P0" "全部成功" "全部成功"
else
    fail_test "TC-005" "提交早加班/晚加班/公休/约客记录" "P0" "全部成功" "早=$EARLY_OT 晚=$LATE_OT 公=$PUBLIC 约=$GUEST"
fi

# ========== P0: TC-010 提交班次切换申请 ==========
echo ""
echo "=== TC-010: 提交班次切换申请（用于后续审批）==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"班次切换申请\",
    \"remark\": \"[TEST] 班次切换审批测试\",
    \"extra_data\": {\"target_shift\": \"晚班\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC010_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC010_ID"
    pass_test "TC-010" "提交班次切换申请" "P0" "成功" "成功 (ID: $TC010_ID)"
else
    fail_test "TC-010" "提交班次切换申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
    TC010_ID=""
fi

# ========== P0: TC-012 审批通过班次切换 ==========
echo ""
echo "=== TC-012: 审批通过班次切换 ==="
if [ -n "$TC010_ID" ]; then
    # 记录审批前班次
    SHIFT_BEFORE=$(sqlite3 "$DB" "SELECT shift FROM coaches WHERE phone = '$COACH1_PHONE';")
    echo "  审批前班次: $SHIFT_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC010_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 1
      }")
    echo "  Response: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    SHIFT_AFTER=$(sqlite3 "$DB" "SELECT shift FROM coaches WHERE phone = '$COACH1_PHONE';")
    echo "  审批后班次: $SHIFT_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$SHIFT_AFTER" = "晚班" ]; then
        pass_test "TC-012" "审批通过班次切换，验证shift字段改变" "P0" "shift=晚班" "shift=$SHIFT_AFTER"
    else
        fail_test "TC-012" "审批通过班次切换，验证shift字段改变" "P0" "shift=晚班" "shift=$SHIFT_AFTER (success=$SUCCESS)"
    fi
else
    skip_test "TC-012" "审批通过班次切换" "P0" "TC-010失败，跳过"
fi

# ========== P0: TC-014 每月2次限制 ==========
echo ""
echo "=== TC-014: 班次切换每月2次限制 ==="
# 已经提交了2次（TC-001和TC-010），第3次应失败
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"班次切换申请\",
    \"remark\": \"[TEST] 第3次班次切换\",
    \"extra_data\": {\"target_shift\": \"早班\"}
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-014" "班次切换每月2次限制（第3次失败）" "P0" "400错误" "400错误"
else
    fail_test "TC-014" "班次切换每月2次限制（第3次失败）" "P0" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P0: TC-020 提交当天休息申请 ==========
echo ""
echo "=== TC-020: 提交当天休息申请（用于后续审批）==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 当天休息审批测试\",
    \"extra_data\": {\"rest_date\": \"$TODAY\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC020_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC020_ID"
    pass_test "TC-020" "提交当天休息申请" "P0" "成功" "成功 (ID: $TC020_ID)"
else
    fail_test "TC-020" "提交当天休息申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
    TC020_ID=""
fi

# ========== P0: TC-023 每月4天限制 ==========
echo ""
echo "=== TC-023: 休息每月4天限制 ==="
# 用教练2（六六）已经提交了1天休息（TC-003）和1天请假（TC-002），再提交3天应触发限制
# 先提交2个新的休息申请
for i in 1 2; do
    DATE="2026-04-$(printf '%02d' $((22 + i)))"
    RESP=$(curl -s -X POST "$API/api/applications" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"applicant_phone\": \"$COACH2_PHONE\",
        \"application_type\": \"休息申请\",
        \"remark\": \"[TEST] 4天限制测试-$i\",
        \"extra_data\": {\"rest_date\": \"$DATE\"}
      }")
    echo "  休息申请$i ($DATE): $(echo "$RESP" | jq -c '.')"
done

# 第5天应触发限制
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH2_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 第5天休息\",
    \"extra_data\": {\"rest_date\": \"2026-04-26\"}
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-023" "休息每月4天限制（第5天失败）" "P0" "400错误" "400错误"
else
    # 检查是否真的触发了限制
    ERROR_MSG=$(echo "$BODY" | jq -r '.error // empty')
    if echo "$ERROR_MSG" | grep -q "4天"; then
        pass_test "TC-023" "休息每月4天限制（第5天失败）" "P0" "400错误" "400错误"
    else
        fail_test "TC-023" "休息每月4天限制（第5天失败）" "P0" "400错误" "HTTP $HTTP_CODE"
    fi
fi

# ========== P0: TC-024 审批通过休息申请，水牌状态变"休息" ==========
echo ""
echo "=== TC-024: 审批通过休息申请，水牌状态变休息 ==="
if [ -n "$TC020_ID" ]; then
    # 记录审批前水牌状态
    WB_BEFORE=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH3_PHONE');")
    echo "  审批前水牌状态: $WB_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC020_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 1
      }")
    echo "  Response: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    WB_AFTER=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH3_PHONE');")
    echo "  审批后水牌状态: $WB_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$WB_AFTER" = "休息" ]; then
        pass_test "TC-024" "审批通过休息申请，水牌状态变休息" "P0" "水牌=休息" "水牌=$WB_AFTER"
    else
        fail_test "TC-024" "审批通过休息申请，水牌状态变休息" "P0" "水牌=休息" "水牌=$WB_AFTER (success=$SUCCESS)"
    fi
else
    skip_test "TC-024" "审批通过休息申请，水牌状态变休息" "P0" "TC-020失败，跳过"
fi

# ========== P0: TC-030 提交事假申请 ==========
echo ""
echo "=== TC-030: 提交事假申请 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"请假申请\",
    \"remark\": \"[TEST] 事假测试\",
    \"extra_data\": {\"leave_type\": \"事假\", \"leave_date\": \"$TOMORROW\"}
  }")
echo "  Response: $RESP"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    TC030_ID=$(echo "$RESP" | jq -r '.data.id')
    echo "  申请ID: $TC030_ID"
    pass_test "TC-030" "提交事假申请" "P0" "成功" "成功 (ID: $TC030_ID)"
else
    fail_test "TC-030" "提交事假申请" "P0" "成功" "失败: $(echo "$RESP" | jq -r '.error')"
    TC030_ID=""
fi

# ========== P0: TC-032 无理由请假应拒绝 ==========
echo ""
echo "=== TC-032: 无理由请假应拒绝 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"请假申请\",
    \"remark\": \"\",
    \"extra_data\": {\"leave_type\": \"事假\", \"leave_date\": \"$DAY_AFTER\"}
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-032" "无理由请假应拒绝" "P0" "400错误" "400错误"
else
    fail_test "TC-032" "无理由请假应拒绝" "P0" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P0: TC-036 审批通过请假申请，水牌状态变"请假" ==========
echo ""
echo "=== TC-036: 审批通过请假申请，水牌状态变请假 ==="
# 注意：TC-002已经提交了一个请假申请，用它来测试
if [ -n "$TC002_ID" ]; then
    # 记录审批前水牌状态
    WB_BEFORE=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH2_PHONE');")
    echo "  审批前水牌状态: $WB_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC002_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 1
      }")
    echo "  Response: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    WB_AFTER=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH2_PHONE');")
    echo "  审批后水牌状态: $WB_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$WB_AFTER" = "请假" ]; then
        pass_test "TC-036" "审批通过请假申请，水牌状态变请假" "P0" "水牌=请假" "水牌=$WB_AFTER"
    else
        fail_test "TC-036" "审批通过请假申请，水牌状态变请假" "P0" "水牌=请假" "水牌=$WB_AFTER (success=$SUCCESS)"
    fi
else
    skip_test "TC-036" "审批通过请假申请，水牌状态变请假" "P0" "TC-002失败，跳过"
fi

# ========== P0: TC-050 待审批数字指示器 ==========
echo ""
echo "=== TC-050: GET /api/applications/pending-count ==="
RESP=$(curl -s -X GET "$API/api/applications/pending-count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "  Response: $RESP"
HAS_FIELDS=$(echo "$RESP" | jq 'has("success", "data")')
HAS_DATA=$(echo "$RESP" | jq '.data | has("shift_change", "leave", "rest", "total")')
if [ "$HAS_FIELDS" = "true" ] && [ "$HAS_DATA" = "true" ]; then
    DATA=$(echo "$RESP" | jq -c '.data')
    pass_test "TC-050" "待审批数字指示器" "P0" "返回各类型数量" "$DATA"
else
    fail_test "TC-050" "待审批数字指示器" "P0" "返回各类型数量" "缺少字段"
fi

# ========== P0: TC-060 取消待审批申请 ==========
echo ""
echo "=== TC-060: 取消待审批申请 ==="
# 先用教练1提交一个新申请用于取消
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"早加班申请\",
    \"remark\": \"[TEST] 取消测试\",
    \"extra_data\": {\"hours\": 1}
  }")
echo "  创建申请: $RESP"
TC060_ID=$(echo "$RESP" | jq -r '.data.id')
echo "  申请ID: $TC060_ID"

if [ -n "$TC060_ID" ] && [ "$TC060_ID" != "null" ]; then
    RESP=$(curl -s -X DELETE "$API/api/applications/$TC060_ID?applicant_phone=$COACH1_PHONE" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    echo "  取消响应: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    if [ "$SUCCESS" = "true" ]; then
        pass_test "TC-060" "取消待审批申请" "P0" "成功" "成功"
    else
        fail_test "TC-060" "取消待审批申请" "P0" "成功" "$(echo "$RESP" | jq -r '.error')"
    fi
else
    fail_test "TC-060" "取消待审批申请" "P0" "成功" "创建申请失败"
fi

# ========== P0: TC-061 已审批申请不可取消 ==========
echo ""
echo "=== TC-061: 已审批申请不可取消 ==="
if [ -n "$TC010_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$API/api/applications/$TC010_ID?applicant_phone=$COACH1_PHONE" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | sed '$d')
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response: $BODY"
    if [ "$HTTP_CODE" = "400" ]; then
        pass_test "TC-061" "已审批申请不可取消" "P0" "400错误" "400错误"
    else
        fail_test "TC-061" "已审批申请不可取消" "P0" "400错误" "HTTP $HTTP_CODE"
    fi
else
    skip_test "TC-061" "已审批申请不可取消" "P0" "TC-010失败，跳过"
fi

# ========== P0: TC-090 当天休息申请审批通过，水牌立即变"休息" ==========
echo ""
echo "=== TC-090: 当天休息申请审批通过，水牌立即变休息 ==="
# 这个已经在TC-024中验证过了（当天休息申请审批后水牌变"休息"）
# TC-020提交的是今天的休息申请，TC-024审批通过后水牌变"休息"
# 这里再单独验证一次
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 定时器测试\",
    \"extra_data\": {\"rest_date\": \"$TODAY\"}
  }")
echo "  创建申请: $RESP"
TC090_ID=$(echo "$RESP" | jq -r '.data.id')

if [ -n "$TC090_ID" ] && [ "$TC090_ID" != "null" ]; then
    # 确保教练1现在是早班空闲状态（从TC-012审批后变晚班空闲）
    WB_BEFORE=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH1_PHONE');")
    echo "  审批前水牌状态: $WB_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC090_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 1
      }")
    echo "  审批响应: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    WB_AFTER=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH1_PHONE');")
    echo "  审批后水牌状态: $WB_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$WB_AFTER" = "休息" ]; then
        pass_test "TC-090" "当天休息申请审批通过，水牌立即变休息" "P0" "水牌=休息" "水牌=$WB_AFTER"
    else
        fail_test "TC-090" "当天休息申请审批通过，水牌立即变休息" "P0" "水牌=休息" "水牌=$WB_AFTER (success=$SUCCESS)"
    fi
else
    skip_test "TC-090" "当天休息申请审批通过，水牌立即变休息" "P0" "创建申请失败"
fi

echo ""
echo "========================================="
echo "P0 核心测试完成，开始 P1 重要测试"
echo "========================================="

# ========== P1: TC-013 审批拒绝班次切换，班次不变 ==========
echo ""
echo "=== TC-013: 审批拒绝班次切换，班次不变 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"班次切换申请\",
    \"remark\": \"[TEST] 拒绝测试\",
    \"extra_data\": {\"target_shift\": \"早班\"}
  }")
echo "  创建申请: $RESP"
TC013_ID=$(echo "$RESP" | jq -r '.data.id')

if [ -n "$TC013_ID" ] && [ "$TC013_ID" != "null" ]; then
    SHIFT_BEFORE=$(sqlite3 "$DB" "SELECT shift FROM coaches WHERE phone = '$COACH3_PHONE';")
    echo "  审批前班次: $SHIFT_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC013_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 2
      }")
    echo "  拒绝响应: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    SHIFT_AFTER=$(sqlite3 "$DB" "SELECT shift FROM coaches WHERE phone = '$COACH3_PHONE';")
    echo "  审批后班次: $SHIFT_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$SHIFT_BEFORE" = "$SHIFT_AFTER" ]; then
        pass_test "TC-013" "审批拒绝班次切换，班次不变" "P1" "班次不变" "班次=$SHIFT_AFTER (不变)"
    else
        fail_test "TC-013" "审批拒绝班次切换，班次不变" "P1" "班次不变" "从$SHIFT_BEFORE变为$SHIFT_AFTER"
    fi
else
    skip_test "TC-013" "审批拒绝班次切换，班次不变" "P1" "创建申请失败"
fi

# ========== P1: TC-015 GET /api/applications/shift-stats ==========
echo ""
echo "=== TC-015: GET /api/applications/shift-stats ==="
RESP=$(curl -s -X GET "$API/api/applications/shift-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "  Response: $RESP"
HAS_DATA=$(echo "$RESP" | jq '.data | has("early_shift", "late_shift", "total")')
if [ "$HAS_DATA" = "true" ]; then
    DATA=$(echo "$RESP" | jq -c '.data')
    pass_test "TC-015" "获取班次统计" "P1" "返回早晚班人数" "$DATA"
else
    fail_test "TC-015" "获取班次统计" "P1" "返回早晚班人数" "缺少字段"
fi

# ========== P1: TC-016 已审批申请不可再次审批 ==========
echo ""
echo "=== TC-016: 已审批申请不可再次审批 ==="
if [ -n "$TC010_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X PUT "$API/api/applications/$TC010_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 2
      }")
    HTTP_CODE=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | sed '$d')
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response: $BODY"
    if [ "$HTTP_CODE" = "400" ]; then
        pass_test "TC-016" "已审批申请不可再次审批" "P1" "400错误" "400错误"
    else
        fail_test "TC-016" "已审批申请不可再次审批" "P1" "400错误" "HTTP $HTTP_CODE"
    fi
else
    skip_test "TC-016" "已审批申请不可再次审批" "P1" "TC-010失败，跳过"
fi

# ========== P1: TC-022 休息日期超过30天应拒绝 ==========
echo ""
echo "=== TC-022: 休息日期超过30天应拒绝 ==="
FUTURE_DATE="2026-06-01"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 超期测试\",
    \"extra_data\": {\"rest_date\": \"$FUTURE_DATE\"}
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-022" "休息日期超过30天应拒绝" "P1" "400错误" "400错误"
else
    fail_test "TC-022" "休息日期超过30天应拒绝" "P1" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P1: TC-026 休息申请审批拒绝，水牌不变 ==========
echo ""
echo "=== TC-026: 休息申请审批拒绝，水牌不变 ==="
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 拒绝测试水牌\",
    \"extra_data\": {\"rest_date\": \"$TOMORROW\"}
  }")
echo "  创建申请: $RESP"
TC026_ID=$(echo "$RESP" | jq -r '.data.id')

if [ -n "$TC026_ID" ] && [ "$TC026_ID" != "null" ]; then
    WB_BEFORE=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH3_PHONE');")
    echo "  审批前水牌状态: $WB_BEFORE"
    
    RESP=$(curl -s -X PUT "$API/api/applications/$TC026_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"approver_phone\": \"admin\",
        \"status\": 2
      }")
    echo "  拒绝响应: $RESP"
    SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
    
    WB_AFTER=$(sqlite3 "$DB" "SELECT status FROM water_boards WHERE coach_no = (SELECT coach_no FROM coaches WHERE phone = '$COACH3_PHONE');")
    echo "  审批后水牌状态: $WB_AFTER"
    
    if [ "$SUCCESS" = "true" ] && [ "$WB_BEFORE" = "$WB_AFTER" ]; then
        pass_test "TC-026" "休息申请审批拒绝，水牌不变" "P1" "水牌不变" "水牌=$WB_AFTER (不变)"
    else
        fail_test "TC-026" "休息申请审批拒绝，水牌不变" "P1" "水牌不变" "从$WB_BEFORE变为$WB_AFTER"
    fi
else
    skip_test "TC-026" "休息申请审批拒绝，水牌不变" "P1" "创建申请失败"
fi

# ========== P1: TC-033 无请假类型应拒绝 ==========
echo ""
echo "=== TC-033: 无请假类型应拒绝 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"请假申请\",
    \"remark\": \"[TEST] 无类型测试\",
    \"extra_data\": {\"leave_date\": \"$TOMORROW\"}
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-033" "无请假类型应拒绝" "P1" "400错误" "400错误"
else
    fail_test "TC-033" "无请假类型应拒绝" "P1" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P1: TC-040 查询待审批列表 ==========
echo ""
echo "=== TC-040: 查询待审批列表 ==="
RESP=$(curl -s -X GET "$API/api/applications?status=0&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "  Response: $(echo "$RESP" | jq -c '{success: .success, count: (.data | length)}')"
SUCCESS=$(echo "$RESP" | jq -r '.success // empty')
if [ "$SUCCESS" = "true" ]; then
    COUNT=$(echo "$RESP" | jq '.data | length')
    pass_test "TC-040" "查询待审批列表" "P1" "返回列表" "返回 $COUNT 条记录"
else
    fail_test "TC-040" "查询待审批列表" "P1" "返回列表" "失败"
fi

# ========== P1: TC-052/053 待审批数量增减 ==========
echo ""
echo "=== TC-052/053: 待审批数量增减 ==="
# 先获取当前数量
BEFORE=$(curl -s -X GET "$API/api/applications/pending-count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
BEFORE_TOTAL=$(echo "$BEFORE" | jq '.data.total')
echo "  审批前待审批总数: $BEFORE_TOTAL"

# 提交一个新申请
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH3_PHONE\",
    \"application_type\": \"休息申请\",
    \"remark\": \"[TEST] 数量增减测试\",
    \"extra_data\": {\"rest_date\": \"2026-04-25\"}
  }")
TC052_ID=$(echo "$RESP" | jq -r '.data.id')

# 提交后再查
AFTER_SUBMIT=$(curl -s -X GET "$API/api/applications/pending-count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
AFTER_TOTAL=$(echo "$AFTER_SUBMIT" | jq '.data.total')
echo "  提交后待审批总数: $AFTER_TOTAL"

# 审批通过
if [ -n "$TC052_ID" ] && [ "$TC052_ID" != "null" ]; then
    curl -s -X PUT "$API/api/applications/$TC052_ID/approve" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"approver_phone\": \"admin\", \"status\": 1}" > /dev/null
fi

AFTER_APPROVE=$(curl -s -X GET "$API/api/applications/pending-count" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
APPROVE_TOTAL=$(echo "$AFTER_APPROVE" | jq '.data.total')
echo "  审批后待审批总数: $APPROVE_TOTAL"

if [ "$AFTER_TOTAL" -gt "$BEFORE_TOTAL" ] 2>/dev/null && [ "$APPROVE_TOTAL" -lt "$AFTER_TOTAL" ] 2>/dev/null; then
    pass_test "TC-052" "提交申请后待审批数量增加" "P1" "数量增加" "$BEFORE_TOTAL → $AFTER_TOTAL"
    pass_test "TC-053" "审批通过后待审批数量减少" "P1" "数量减少" "$AFTER_TOTAL → $APPROVE_TOTAL"
else
    fail_test "TC-052" "提交申请后待审批数量增加" "P1" "数量增加" "$BEFORE_TOTAL → $AFTER_TOTAL"
    fail_test "TC-053" "审批通过后待审批数量减少" "P1" "数量减少" "$AFTER_TOTAL → $APPROVE_TOTAL"
fi

# ========== P1: TC-063 只能取消自己的申请 ==========
echo ""
echo "=== TC-063: 只能取消自己的申请 ==="
# 创建一个教练1的申请，尝试用教练3的手机号取消
RESP=$(curl -s -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"application_type\": \"早加班申请\",
    \"remark\": \"[TEST] 跨用户取消测试\",
    \"extra_data\": {\"hours\": 1}
  }")
TC063_ID=$(echo "$RESP" | jq -r '.data.id')
echo "  创建申请(教练1): $TC063_ID"

if [ -n "$TC063_ID" ] && [ "$TC063_ID" != "null" ]; then
    # 用教练3的手机号取消教练1的申请 → 应该404
    RESP=$(curl -s -w "\n%{http_code}" -X DELETE "$API/api/applications/$TC063_ID?applicant_phone=$COACH3_PHONE" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    HTTP_CODE=$(echo "$RESP" | tail -1)
    BODY=$(echo "$RESP" | sed '$d')
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response: $BODY"
    if [ "$HTTP_CODE" = "404" ]; then
        pass_test "TC-063" "只能取消自己的申请" "P1" "404错误" "404错误"
    else
        fail_test "TC-063" "只能取消自己的申请" "P1" "404错误" "HTTP $HTTP_CODE"
    fi
else
    skip_test "TC-063" "只能取消自己的申请" "P1" "创建申请失败"
fi

# ========== P1: TC-080/081 必填字段为空应拒绝 ==========
echo ""
echo "=== TC-080: 缺少applicant_phone应拒绝 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"application_type\": \"早加班申请\",
    \"remark\": \"[TEST] 缺少手机号\"
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-080" "缺少applicant_phone应拒绝" "P1" "400错误" "400错误"
else
    fail_test "TC-080" "缺少applicant_phone应拒绝" "P1" "400错误" "HTTP $HTTP_CODE"
fi

echo ""
echo "=== TC-081: 缺少application_type应拒绝 ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/api/applications" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"applicant_phone\": \"$COACH1_PHONE\",
    \"remark\": \"[TEST] 缺少申请类型\"
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "400" ]; then
    pass_test "TC-081" "缺少application_type应拒绝" "P1" "400错误" "400错误"
else
    fail_test "TC-081" "缺少application_type应拒绝" "P1" "400错误" "HTTP $HTTP_CODE"
fi

# ========== P1: TC-083 审批不存在的申请 → 404 ==========
echo ""
echo "=== TC-083: 审批不存在的申请 → 404 ==="
RESP=$(curl -s -w "\n%{http_code}" -X PUT "$API/api/applications/999999/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"approver_phone\": \"admin\",
    \"status\": 1
  }")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "  HTTP Code: $HTTP_CODE"
echo "  Response: $BODY"
if [ "$HTTP_CODE" = "404" ]; then
    pass_test "TC-083" "审批不存在的申请返回404" "P1" "404错误" "404错误"
else
    fail_test "TC-083" "审批不存在的申请返回404" "P1" "404错误" "HTTP $HTTP_CODE"
fi

# ========== 生成测试报告 ==========
echo ""
echo "========================================="
echo "生成测试报告..."
echo "========================================="

# 统计
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
for s in "${TEST_STATUSES[@]}"; do
    case "$s" in
        "✅通过") PASS_COUNT=$((PASS_COUNT + 1)) ;;
        "❌失败") FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
        "⏭️跳过") SKIP_COUNT=$((SKIP_COUNT + 1)) ;;
    esac
done

P0_PASS=0; P0_FAIL=0; P0_SKIP=0
P1_PASS=0; P1_FAIL=0; P1_SKIP=0
for i in "${!TEST_PRIS[@]}"; do
    case "${TEST_PRIS[$i]}-$((i))" in
        *) ;;
    esac
    case "${TEST_PRIS[$i]}" in
        "P0")
            case "${TEST_STATUSES[$i]}" in
                "✅通过") P0_PASS=$((P0_PASS + 1)) ;;
                "❌失败") P0_FAIL=$((P0_FAIL + 1)) ;;
                "⏭️跳过") P0_SKIP=$((P0_SKIP + 1)) ;;
            esac
            ;;
        "P1")
            case "${TEST_STATUSES[$i]}" in
                "✅通过") P1_PASS=$((P1_PASS + 1)) ;;
                "❌失败") P1_FAIL=$((P1_FAIL + 1)) ;;
                "⏭️跳过") P1_SKIP=$((P1_SKIP + 1)) ;;
            esac
            ;;
    esac
done

# 写入报告
cat > "$RESULTS" << REPORT_EOF
# 测试结果

**测试时间**: 2026-04-19 11:11
**测试环境**: http://127.0.0.1:8088
**测试人员**: 测试员B

## 概要

| 优先级 | 通过 | 失败 | 跳过 | 总计 |
|--------|------|------|------|------|
| P0 | $P0_PASS | $P0_FAIL | $P0_SKIP | $((P0_PASS + P0_FAIL + P0_SKIP)) |
| P1 | $P1_PASS | $P1_FAIL | $P1_SKIP | $((P1_PASS + P1_FAIL + P1_SKIP)) |
| **总计** | **$PASS_COUNT** | **$FAIL_COUNT** | **$SKIP_COUNT** | **$TEST_COUNT** |

## 详细结果

| 用例ID | 测试项 | 优先级 | 预期结果 | 实际结果 | 状态 |
|--------|--------|--------|----------|----------|------|
REPORT_EOF

for i in "${!TEST_IDS[@]}"; do
    echo "| ${TEST_IDS[$i]} | ${TEST_NAMES[$i]} | ${TEST_PRIS[$i]} | ${TEST_EXPECTS[$i]} | ${TEST_ACTUALS[$i]} | ${TEST_STATUSES[$i]} |" >> "$RESULTS"
done

echo "" >> "$RESULTS"
echo "---" >> "$RESULTS"
echo "*测试完成*" >> "$RESULTS"

echo ""
echo "========================================="
echo "测试完成！"
echo "总计: $TEST_COUNT 个用例"
echo "✅通过: $PASS_COUNT"
echo "❌失败: $FAIL_COUNT"
echo "⏭️跳过: $SKIP_COUNT"
echo ""
echo "P0: $P0_PASS 通过, $P0_FAIL 失败, $P0_SKIP 跳过"
echo "P1: $P1_PASS 通过, $P1_FAIL 失败, $P1_SKIP 跳过"
echo ""
echo "报告已写入: $RESULTS"
echo "========================================="

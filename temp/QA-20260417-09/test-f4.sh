#!/bin/bash
echo "=== F4: 助教单台桌自动选中测试 ==="

# 1. 设置助教上桌+单台桌
echo "1. 设置助教10011为晚班上桌，table_no=VIP3"
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='晚班上桌', table_no='VIP3' WHERE coach_no=10011;"
sqlite3 /TG/tgservice/db/tgservice.db "SELECT coach_no, status, table_no FROM water_boards WHERE coach_no=10011;"

# 2. 助教登录
echo "2. 助教登录..."
COACH_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/coach/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"12","stageName":"十七","idCardLast6":"171542"}' | jq -r '.token')
echo "Token: $([ -n \"$COACH_TOKEN\" ] && echo '成功' || echo '失败')"

# 3. 获取水牌状态
echo "3. 获取水牌状态..."
WATER_DATA=$(curl -s http://127.0.0.1:8088/api/water-boards/10011 \
  -H "Authorization: Bearer $COACH_TOKEN")
echo "$WATER_DATA" | jq '.data | {status, table_no, table_no_list}'

# 4. 检查条件
echo "4. 检查自动选中条件..."
STATUS=$(echo "$WATER_DATA" | jq -r '.data.status')
TABLE_NO=$(echo "$WATER_DATA" | jq -r '.data.table_no')
TABLE_LIST=$(echo "$WATER_DATA" | jq -r '.data.table_no_list | length')

echo "status: $STATUS"
echo "table_no: $TABLE_NO"
echo "table_no_list length: $TABLE_LIST"

IS_ON_TABLE="false"
if [ "$STATUS" = "早班上桌" ] || [ "$STATUS" = "晚班上桌" ]; then
  IS_ON_TABLE="true"
fi

echo "isOnTable: $IS_ON_TABLE"

if [ "$IS_ON_TABLE" = "true" ] && [ -n "$TABLE_NO" ] && [ "$TABLE_LIST" = "1" ]; then
  echo "✅ F4 结论: 条件满足，应自动选中 VIP3"
else
  echo "❌ F4 结论: 条件不满足"
fi

# 恢复助教状态
echo "5. 恢复助教状态..."
sqlite3 /TG/tgservice/db/tgservice.db "UPDATE water_boards SET status='晚班空闲', table_no='' WHERE coach_no=10011;"
echo "已恢复"

echo "=== 测试完成 ==="
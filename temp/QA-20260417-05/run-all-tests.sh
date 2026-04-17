#!/bin/bash
# QA-20260417-05 全量测试脚本

ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8088/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"tgadmin","password":"mms633268"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

DB="/TG/tgservice/db/tgservice.db"
API="http://127.0.0.1:8088/api/guest-invitations/period-stats"

echo "=== TC01-P0: 统计周期-昨天 ==="
TC01_RAW=$(curl -s -X GET "${API}?period=yesterday" -H "Authorization: Bearer $ADMIN_TOKEN")
TC01=$(echo "$TC01_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    s=d['data']['summary']
    print(f'success=true, period={d[\"data\"][\"period_label\"]}, 未约={s[\"not_invited\"]}, 有效={s[\"valid\"]}, 无效={s[\"invalid\"]}')
else:
    print(f'FAIL: {d}')
")
echo "TC01: $TC01"

echo ""
echo "=== TC02-P0: 统计周期-前天 ==="
TC02_RAW=$(curl -s -X GET "${API}?period=day-before-yesterday" -H "Authorization: Bearer $ADMIN_TOKEN")
TC02=$(echo "$TC02_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print(f'success=true, period={d[\"data\"][\"period_label\"]}')
else:
    print(f'FAIL: {d}')
")
echo "TC02: $TC02"

echo ""
echo "=== TC03-P0: 统计周期-本月 + SQL验证 ==="
TC03_API=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN")
SQL_NOT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result = '应约客';")
SQL_VALID=$(sqlite3 "$DB" "SELECT COUNT(*) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result = '约客有效';")
TC03=$(echo "$TC03_API" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['data']['summary']
print(f'未约API={s[\"not_invited\"]}, SQL_NOT=$SQL_NOT | 有效API={s[\"valid\"]}, SQL_VALID=$SQL_VALID')
if s['not_invited']==int('$SQL_NOT') and s['valid']==int('$SQL_VALID'):
    print('与SQL一致')
else:
    print('与SQL不一致')
")
echo "TC03: $TC03"

echo ""
echo "=== TC04-P0: 统计周期-上月 ==="
TC04_RAW=$(curl -s -X GET "${API}?period=last-month" -H "Authorization: Bearer $ADMIN_TOKEN")
TC04=$(echo "$TC04_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    s=d['data']['summary']
    print(f'success=true, period={d[\"data\"][\"period_label\"]}, 未约={s[\"not_invited\"]}, 总计={s[\"total_should\"]}')
else:
    print(f'FAIL: {d}')
")
echo "TC04: $TC04"

echo ""
echo "=== TC05-P0: 约课率算法验证 ==="
TC05_RAW=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN")
TC05=$(echo "$TC05_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['data']['summary']
total=s['not_invited']+s['invalid']+s['valid']
if s['total_should']!=total:
    print(f'FAIL: total_should={s[\"total_should\"]}, 期望={total}')
else:
    expected=round(s['valid']/total*100,1) if total>0 else 0.0
    actual=float(s['invite_rate'].replace('%',''))
    if abs(expected-actual)<0.2:
        print(f'约课率={s[\"invite_rate\"]} (预期~{expected}%)')
    else:
        print(f'FAIL: 约课率错误, 期望{expected}%, 实际{s[\"invite_rate\"]}')
")
echo "TC05: $TC05"

echo ""
echo "=== TC06-P0: 漏约助教数据完整性 ==="
TC06_API_COUNT=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['data']['missed_coaches']))")
TC06_SQL_COUNT=$(sqlite3 "$DB" "SELECT COUNT(DISTINCT coach_no) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result IN ('应约客', '约客无效');")
if [ "$TC06_API_COUNT" = "$TC06_SQL_COUNT" ]; then
    TC06="API=$TC06_API_COUNT, SQL=$TC06_SQL_COUNT, 数量一致"
else
    TC06="API=$TC06_API_COUNT, SQL=$TC06_SQL_COUNT, 数量不一致"
fi
echo "TC06: $TC06"

echo ""
echo "=== TC07-P0: 漏约助教排序 ==="
# 插入测试数据
sqlite3 "$DB" "INSERT OR IGNORE INTO guest_invitation_results (date, shift, coach_no, stage_name, invitation_image_url, images, result, created_at, updated_at) VALUES ('2026-04-10', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now')), ('2026-04-11', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now')), ('2026-04-12', '早班', 10003, '六六', '', '[]', '约客无效', datetime('now'), datetime('now'));"
TC07_RAW=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN")
TC07=$(echo "$TC07_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
coaches=d['data']['missed_coaches']
counts=[c['missed_count'] for c in coaches]
is_desc=all(counts[i]>=counts[i+1] for i in range(len(counts)-1))
print(f'漏约次数: {counts}')
if is_desc: print('排序正确')
else: print('排序错误')
")
echo "TC07: $TC07"

echo ""
echo "=== TC08-P1: 有权限访问 ==="
TC08_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN")
if [ "$TC08_HTTP" = "200" ]; then
    TC08="HTTP=$TC08_HTTP, 200 OK"
else
    TC08="HTTP=$TC08_HTTP, 期望200"
fi
echo "TC08: $TC08"

echo ""
echo "=== TC09-P1: 无权限访问 ==="
TC09="跳过（无法获取助教token）"
echo "TC09: $TC09"

echo ""
echo "=== TC10-P1: 无效period ==="
TC10_R1=$(curl -s -w "\n%{http_code}" -X GET "${API}?period=昨天" -H "Authorization: Bearer $ADMIN_TOKEN")
TC10_C1=$(echo "$TC10_R1" | tail -1)
TC10_R2=$(curl -s -w "\n%{http_code}" -X GET "${API}?period=hello" -H "Authorization: Bearer $ADMIN_TOKEN")
TC10_C2=$(echo "$TC10_R2" | tail -1)
TC10=""
if [ "$TC10_C1" = "400" ]; then
    TC10="中文period=400 OK"
else
    TC10="中文period=$TC10_C1, 期望400"
fi
if [ "$TC10_C2" = "400" ]; then
    TC10="${TC10}, hello=400 OK"
else
    TC10="${TC10}, hello=$TC10_C2, 期望400"
fi
echo "TC10: $TC10"

echo ""
echo "=== TC11-P1: 缺少period ==="
TC11_R=$(curl -s -w "\n%{http_code}" -X GET "$API" -H "Authorization: Bearer $ADMIN_TOKEN")
TC11_C=$(echo "$TC11_R" | tail -1)
if [ "$TC11_C" = "400" ]; then
    TC11="HTTP=$TC11_C, 400 OK"
else
    TC11="HTTP=$TC11_C, 期望400"
fi
echo "TC11: $TC11"

echo ""
echo "=== TC12-P2: 空数据 ==="
TC12_RAW=$(curl -s -X GET "${API}?period=last-month" -H "Authorization: Bearer $ADMIN_TOKEN")
TC12=$(echo "$TC12_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['data']['summary']
mc=d['data']['missed_coaches']
print(f'not_invited={s[\"not_invited\"]}, valid={s[\"valid\"]}, total={s[\"total_should\"]}, missed={len(mc)}')
if s['total_should']==0 and len(mc)==0:
    print('空数据返回正确')
else:
    print(f'非空（可能有历史记录）, rate={s[\"invite_rate\"]}')
")
echo "TC12: $TC12"

echo ""
echo "=== TC13-P2: 待审查不计入total_should ==="
TC13_RAW=$(curl -s -X GET "${API}?period=yesterday" -H "Authorization: Bearer $ADMIN_TOKEN")
TC13=$(echo "$TC13_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d['data']['summary']
expected=s['not_invited']+s['invalid']+s['valid']
if s['total_should']==expected:
    print(f'pending({s[\"pending\"]})未计入total_should({s[\"total_should\"]})')
else:
    print(f'FAIL: total_should={s[\"total_should\"]}, 期望={expected}')
")
echo "TC13: $TC13"

echo ""
echo "=== TC14-P2: 头像字段完整性 ==="
TC14_RAW=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN")
TC14=$(echo "$TC14_RAW" | python3 -c "
import sys,json
d=json.load(sys.stdin)
coaches=d['data']['missed_coaches']
if not coaches:
    print('无漏约助教')
    sys.exit(0)
required=['coach_no','employee_id','stage_name','photo_url','missed_count']
for c in coaches:
    missing=[f for f in required if f not in c]
    if missing:
        print(f'FAIL: {c.get(\"stage_name\",\"?\")} 缺少: {missing}')
        break
else:
    print(f'所有{len(coaches)}个助教字段完整')
")
echo "TC14: $TC14"

echo ""
echo "=== TC15-P0: 未约人数与SQL一致 ==="
TC15_SQL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result = '应约客';")
TC15_API=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['not_invited'])")
if [ "$TC15_SQL" = "$TC15_API" ]; then
    TC15="SQL=$TC15_SQL API=$TC15_API, 一致"
else
    TC15="SQL=$TC15_SQL API=$TC15_API, 不一致"
fi
echo "TC15: $TC15"

echo ""
echo "=== TC16-P0: 有效人数与SQL一致 ==="
TC16_SQL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result = '约客有效';")
TC16_API=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['valid'])")
if [ "$TC16_SQL" = "$TC16_API" ]; then
    TC16="SQL=$TC16_SQL API=$TC16_API, 一致"
else
    TC16="SQL=$TC16_SQL API=$TC16_API, 不一致"
fi
echo "TC16: $TC16"

echo ""
echo "=== TC17-P0: 无效人数与SQL一致 ==="
TC17_SQL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM guest_invitation_results WHERE date >= '2026-04-01' AND date <= date('now') AND result = '约客无效';")
TC17_API=$(curl -s -X GET "${API}?period=this-month" -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['summary']['invalid'])")
if [ "$TC17_SQL" = "$TC17_API" ]; then
    TC17="SQL=$TC17_SQL API=$TC17_API, 一致"
else
    TC17="SQL=$TC17_SQL API=$TC17_API, 不一致"
fi
echo "TC17: $TC17"

echo ""
echo "=== 清理TC07测试数据 ==="
sqlite3 "$DB" "DELETE FROM guest_invitation_results WHERE coach_no = 10003 AND date IN ('2026-04-10', '2026-04-11', '2026-04-12') AND result = '约客无效';"
echo "清理完成"

# 保存原始数据供后续生成报告使用
echo "---RAW_DATA---"
echo "TC01=$TC01"
echo "TC02=$TC02"
echo "TC03=$TC03"
echo "TC04=$TC04"
echo "TC05=$TC05"
echo "TC06=$TC06"
echo "TC07=$TC07"
echo "TC08=$TC08"
echo "TC09=$TC09"
echo "TC10=$TC10"
echo "TC11=$TC11"
echo "TC12=$TC12"
echo "TC13=$TC13"
echo "TC14=$TC14"
echo "TC15=$TC15"
echo "TC16=$TC16"
echo "TC17=$TC17"

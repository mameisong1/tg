# 乐捐报备预约时间选择范围调整 - 测试结果

**测试时间**: 2026-04-17 06:36:54
**测试地址**: http://127.0.0.1:8088
**测试数据**: employee_id=5 (芝芝, coach_no=10005)
**测试环境**: 开发环境 (PM2: tgservice-dev)

## 测试概况
- 总计: 12 个用例
- 通过: 12 ✅
- 失败: 0 ❌

## 测试结果

| 用例ID | 测试项 | 优先级 | 预期 | 实际 | 状态 |
|--------|--------|--------|------|------|------|
| TC-P0-01 | 窗口未到预约14:00（03~13范围） | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P0-02 | 未来小时预约（待出发） | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P0-03 | 预约次日00:00 | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P0-04 | 预约次日01:00 | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P0-05 | 预约次日02:00 | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P0-06 | 窗口未到提前预约（方案B核心用例） | P0 | HTTP 200 | HTTP 200 | status=pending immediate=False | ✅通过 |
| TC-P1-01 | 次日03:00应被拒绝 | P1 | HTTP 400 | HTTP 400 | error: 乐捐报备时间为每日14:00-次日02:00，请选择有效时段 | ✅通过 |
| TC-P1-02 | 窗口外小时09:00应被拒绝 | P1 | HTTP 400 | HTTP 400 | error: 乐捐报备时间为每日14:00-次日02:00，请选择有效时段 | ✅通过 |
| TC-P1-03 | 过去时间应被拒绝 | P1 | HTTP 400 | HTTP 400 | error: 当天时段应在当天预约 | ✅通过 |
| TC-P1-04 | 后天00:00应被拒绝 | P1 | HTTP 400 | HTTP 400 | error: 凌晨时段应在次日预约 | ✅通过 |
| TC-P2-01 | 非整点时间应被拒绝 | P2 | HTTP 400 | HTTP 400 | error: 预约时间必须是整点（分钟=00） | ✅通过 |
| TC-P2-02 | 时间格式错误应被拒绝 | P2 | HTTP 400 | HTTP 400 | error: 时间格式错误，必须是 YYYY-MM-DD HH:MM:SS | ✅通过 |

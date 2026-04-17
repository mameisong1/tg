# 测试结果 - QA-20260417-05

| 用例ID | 优先级 | 测试目标 | 预期结果 | 实际结果 | 状态 | 备注 |
|--------|--------|---------|---------|---------|------|------|
| TC01 | P0 | 统计周期-昨天 | HTTP 200, period=yesterday, period_label=昨天, 有summary和missed_coaches | HTTP 500, {"success":false,"error":"获取统计数据失败"} | ❌失败 | 代码bug: guest-invitations.js:727使用了变量`not_invited`(snake_case)，但第678行定义的是`notInvited`(camelCase)，导致ReferenceError |
| TC02 | P0 | 统计周期-前天 | HTTP 200, period=day-before-yesterday, period_label=前天 | HTTP 500, {"success":false,"error":"获取统计数据失败"} | ❌失败 | 同TC01，同一变量名错误 |
| TC03 | P0 | 统计周期-本月 + SQL验证 | HTTP 200, 数据与SQL一致 | HTTP 500, API返回错误 | ❌失败 | SQL可正常查询（应约客=11, 约客有效=32, 约客无效=3），但API因变量名错误崩溃 |
| TC04 | P0 | 统计周期-上月 | HTTP 200, period=last-month, period_label=上月, 若无数据则全0 | HTTP 500, {"success":false,"error":"获取统计数据失败"} | ❌失败 | 同TC01，同一变量名错误 |
| TC05 | P0 | 约课率算法验证 | total_should正确, invite_rate计算正确 | API返回500错误 | ❌失败 | 同TC01，同一变量名错误 |
| TC06 | P0 | 漏约助教数据完整性 | API返回漏约助教列表，与SQL GROUP BY结果一致 | API返回500错误 | ❌失败 | 同TC01，同一变量名错误 |
| TC07 | P0 | 漏约助教排序 | 按missed_count DESC排序 | API返回500错误 | ❌失败 | 同TC01，同一变量名错误（测试数据已插入并清理） |
| TC08 | P1 | 有权限访问 | HTTP 200 | HTTP 500 | ❌失败 | 同TC01，同一变量名错误 |
| TC09 | P1 | 无权限访问 | ⏭️ 跳过 | ⏭️ 跳过 | ⏭️跳过 | 按任务说明跳过（需要助教token） |
| TC10 | P1 | 无效period参数 | HTTP 400 | HTTP 400, {"success":false,"error":"无效的 period 参数"} | ✅通过 | 中文"昨天"和英文"hello"均正确返回400 |
| TC11 | P1 | 缺少period | HTTP 400 | HTTP 400, {"success":false,"error":"缺少 period 参数"} | ✅通过 | 正确返回400 |
| TC12 | P2 | 空数据（上月） | 返回全0数据 | API返回500错误 | ❌失败 | 同TC01，同一变量名错误 |
| TC13 | P2 | 待审查不计入total_should | total_should = not_invited + invalid + valid | API返回500错误 | ❌失败 | 同TC01，同一变量名错误 |
| TC14 | P2 | 头像字段完整性 | 所有漏约助教字段完整 | API返回500错误 | ❌失败 | 同TC01，同一变量名错误 |
| TC15 | P0 | 未约人数与SQL一致 | API not_invited = SQL COUNT（应约客） | API_ERROR, SQL=11 | ❌失败 | 同TC01，同一变量名错误 |
| TC16 | P0 | 有效人数与SQL一致 | API valid = SQL COUNT（约客有效） | API_ERROR, SQL=32 | ❌失败 | 同TC01，同一变量名错误 |
| TC17 | P0 | 无效人数与SQL一致 | API invalid = SQL COUNT（约客无效） | API_ERROR, SQL=3 | ❌失败 | 同TC01，同一变量名错误 |

## 汇总

| 状态 | 数量 | 百分比 |
|------|------|--------|
| ✅通过 | 2 | 12.5% |
| ❌失败 | 14 | 87.5% |
| ⏭️跳过 | 1 | - |

## 根因分析

**所有14个失败用例均由同一个bug引起：**

文件：`/TG/tgservice/backend/routes/guest-invitations.js`

**问题**：第678行定义变量为 `notInvited`（camelCase），但第727行响应体中使用了 `not_invited`（snake_case），导致 `ReferenceError: not_invited is not defined`。

**修复方法**：将第727行的 `not_invited` 改为 `notInvited`。

```diff
  summary: {
-   not_invited,
+   notInvited,
    valid,
    invalid,
    pending,
    total_should: totalShould,
    invite_rate: inviteRate
  },
```

## 测试数据清理

- TC07插入的3条测试记录（coach_no=10003）已清理完毕。

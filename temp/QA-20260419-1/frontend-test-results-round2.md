# 前端测试结果（第二轮）

**测试时间**: 2026/4/19 13:10:26
**测试环境**: http://127.0.0.1:8089 (H5)
**Chrome**: 9222
**数据库**: /TG/tgservice/db/tgservice.db

## 🐛 发现的BUG

### BUG-001: 管理员角色不匹配导致管理功能不可见

**严重程度**: 🔴 严重 (P0)
**描述**: 后台管理员登录 API 返回 role="管理员"，但会员中心页面的 `isManager` 计算属性只检查 `['店长', '助教管理']`，导致管理员用户无法看到任何管理功能按钮。

**代码位置**:
- 后端: `/api/admin/login` 返回 role="管理员"
- 前端: `member.vue` 第1062行: `['店长', '助教管理'].includes(adminInfo.role)`

**影响**: 管理员（tgadmin）登录后看不到：水牌管理、加班审批、公休审批、乐捐一览、早班约客、晚班约客、智能开关、约客统计、漏单统计、服务日奖、助教违规、班次切换审批、请假审批、休息审批 — 共14个按钮全部不可见。

**修复建议**: 将 `isManager` 检查改为 `['店长', '助教管理', '管理员'].includes(adminInfo.role)`

## 测试结果汇总

| 用例ID | 描述 | 优先级 | 状态 | 截图 | 备注 |
|--------|------|--------|------|------|------|
| TC-001 | 管理员会员中心(tgadmin, role=管理员) | P0 | ❌失败(BUG) | TC-001-admin-member.png | role="管理员"不在isManager检查范围内["店长","助教管理"]，缺少14个按钮 |
| TC-001b | 店长会员中心(role=店长) | P0 | ❌失败 | TC-001b-store-manager.png | 店长也看不到按钮 |
| TC-002 | 审批按钮待审批数字 | P0 | ⚠️待确认 | TC-002-pending-badges.png | 页面可能未显示管理功能区域 |
| TC-003 | 助教会员中心验证 | P0 | ❌失败 | TC-003-coach-member.png | 登录失败 |
| TC-010 | 班次切换申请页面UI | P0 | ❌失败 | TC-010-shift-change-apply.png | 缺少: 我的申请记录 |
| TC-011 | 提交班次切换申请 | P0 | ⚠️待确认 | TC-011-shift-change-submit.png |  |
| TC-012 | 班次切换审批页面UI | P0 | ✅通过 | TC-012-shift-change-approval.png |  |
| TC-013 | 审批通过班次切换 | P0 | ✅通过 | TC-013-shift-change-approve.png |  |
| TC-014 | 审批后班次变更数据库验证 | P0 | ✅通过 |  | shift=晚班 |
| TC-015 | 班次切换每月2次限制 | P1 | ✅通过 | TC-015-shift-change-limit.png |  |
| TC-020 | 休息申请页面UI | P0 | ❌失败 | TC-020-rest-apply.png | 缺少: 我的申请记录 |
| TC-021 | 提交休息申请 | P0 | ⚠️待确认 | TC-021-rest-apply-submit.png |  |
| TC-022 | 休息审批页面UI | P0 | ✅通过 | TC-022-rest-approval.png |  |
| TC-023 | 审批通过休息申请+DB验证 | P0 | ✅通过 | TC-023-rest-approval-done.png | water_boards.status=下班 |
| TC-024 | 休息每月4天限制 | P1 | ⚠️待确认 | TC-024-rest-limit.png |  |
| TC-030 | 请假申请页面UI | P0 | ❌失败 | TC-030-leave-request-apply.png | 缺少: 我的申请记录 |
| TC-031 | 提交请假申请(事假) | P0 | ⚠️待确认 | TC-031-leave-request-submit.png |  |
| TC-032 | 提交请假申请(病假) | P0 | ⚠️待确认 | TC-032-leave-request-sick.png |  |
| TC-033 | 请假审批页面UI | P0 | ✅通过 | TC-033-leave-request-approval.png |  |
| TC-034 | 审批通过请假申请+DB验证 | P0 | ✅通过 | TC-034-leave-request-approval-done.png | water_boards.status=下班 |
| TC-040 | 助教取消待审批申请 | P1 | ⚠️待确认 | TC-040-cancel-application.png |  |
| TC-050 | 待审批数字准确性验证 | P0 | ⚠️待确认 | TC-050-badges-accuracy.png |  |
| TC-060 | 6个页面URL直接访问 | P0 | ✅通过 | TC-060-URL-shift-change-apply.png, TC-060-URL-rest-apply.png, TC-060-URL-leave-request-apply.png, TC-060-URL-shift-change-approval.png, TC-060-URL-leave-request-approval.png, TC-060-URL-rest-approval.png |  |

## 统计

- **总计**: 23 个测试用例
- **✅通过**: 9
- **❌失败**: 6
- **⚠️待确认**: 8
- **通过率**: 39.1%
- **发现BUG**: 1个 (P0)

## P0 用例详情

### TC-001: 管理员会员中心(tgadmin, role=管理员)
**状态**: ❌失败(BUG)
**截图**: TC-001-admin-member.png
**备注**: role="管理员"不在isManager检查范围内["店长","助教管理"]，缺少14个按钮

### TC-001b: 店长会员中心(role=店长)
**状态**: ❌失败
**截图**: TC-001b-store-manager.png
**备注**: 店长也看不到按钮

### TC-002: 审批按钮待审批数字
**状态**: ⚠️待确认
**截图**: TC-002-pending-badges.png
**备注**: 页面可能未显示管理功能区域

### TC-003: 助教会员中心验证
**状态**: ❌失败
**截图**: TC-003-coach-member.png
**备注**: 登录失败

### TC-010: 班次切换申请页面UI
**状态**: ❌失败
**截图**: TC-010-shift-change-apply.png
**备注**: 缺少: 我的申请记录

### TC-011: 提交班次切换申请
**状态**: ⚠️待确认
**截图**: TC-011-shift-change-submit.png


### TC-012: 班次切换审批页面UI
**状态**: ✅通过
**截图**: TC-012-shift-change-approval.png


### TC-013: 审批通过班次切换
**状态**: ✅通过
**截图**: TC-013-shift-change-approve.png


### TC-014: 审批后班次变更数据库验证
**状态**: ✅通过
**截图**: 
**备注**: shift=晚班

### TC-020: 休息申请页面UI
**状态**: ❌失败
**截图**: TC-020-rest-apply.png
**备注**: 缺少: 我的申请记录

### TC-021: 提交休息申请
**状态**: ⚠️待确认
**截图**: TC-021-rest-apply-submit.png


### TC-022: 休息审批页面UI
**状态**: ✅通过
**截图**: TC-022-rest-approval.png


### TC-023: 审批通过休息申请+DB验证
**状态**: ✅通过
**截图**: TC-023-rest-approval-done.png
**备注**: water_boards.status=下班

### TC-030: 请假申请页面UI
**状态**: ❌失败
**截图**: TC-030-leave-request-apply.png
**备注**: 缺少: 我的申请记录

### TC-031: 提交请假申请(事假)
**状态**: ⚠️待确认
**截图**: TC-031-leave-request-submit.png


### TC-032: 提交请假申请(病假)
**状态**: ⚠️待确认
**截图**: TC-032-leave-request-sick.png


### TC-033: 请假审批页面UI
**状态**: ✅通过
**截图**: TC-033-leave-request-approval.png


### TC-034: 审批通过请假申请+DB验证
**状态**: ✅通过
**截图**: TC-034-leave-request-approval-done.png
**备注**: water_boards.status=下班

### TC-050: 待审批数字准确性验证
**状态**: ⚠️待确认
**截图**: TC-050-badges-accuracy.png


### TC-060: 6个页面URL直接访问
**状态**: ✅通过
**截图**: TC-060-URL-shift-change-apply.png, TC-060-URL-rest-apply.png, TC-060-URL-leave-request-apply.png, TC-060-URL-shift-change-approval.png, TC-060-URL-leave-request-approval.png, TC-060-URL-rest-approval.png


## P1 用例详情

### TC-015: 班次切换每月2次限制
**状态**: ✅通过
**截图**: TC-015-shift-change-limit.png


### TC-024: 休息每月4天限制
**状态**: ⚠️待确认
**截图**: TC-024-rest-limit.png


### TC-040: 助教取消待审批申请
**状态**: ⚠️待确认
**截图**: TC-040-cancel-application.png



# 前端 H5 测试报告 - Round 3 (审批角标修复验证)

**日期**: 2026-04-19 13:40
**测试环境**: http://127.0.0.1:8089 (PM2 dev)
**后端API**: http://127.0.0.1:8088
**Chrome**: 9222 调试端口
**测试重点**: 审批角标显示修复验证 + 申请/审批业务流程

## 测试概要

| 指标 | 数量 |
|------|------|
| 总用例 | 12 |
| ✅ 通过 | 12 |
| ⚠️ 警告 | 0 |
| ❌ 失败 | 0 |

## 详细结果

### ✅ TC-001: 管理员审批按钮角标验证

- **状态**: PASS
- **详情**: 按钮: 班次=true, 请假=true, 休息=true. 角标: [{"text":"加班审批 (0)","hasNumber":true,"number":"0"},{"text":"公休审批 (0)","hasNumber":true,"number":"0"},{"text":"班次切换审批 (0)","hasNumber":true,"number":"0"},{"text":"请假审批 (0)","hasNumber":true,"number":"0"},{"text":"休息审批 (0)","hasNumber":true,"number":"0"}]
- **截图**: TC-001-member-page.png

### ✅ TC-002: 助教申请按钮验证

- **状态**: PASS
- **详情**: 班次切换=true, 休息=true, 请假=true
- **截图**: TC-002-coach-member.png

### ✅ TC-003: 班次切换申请流程

- **状态**: PASS
- **详情**: 页面: {"标题":true,"当前班次":true,"目标班次":true,"备注":true,"提交":true}
- **截图**: TC-003-shift-change-apply.png, TC-003-shift-change-submit.png

### ✅ TC-004: 班次切换审批流程

- **状态**: PASS
- **详情**: {"标题":true,"统计栏":true,"待审批":true,"已同意标签":true}
- **截图**: TC-004-shift-change-approval.png, TC-004-approve-done.png

### ✅ TC-005: 休息申请/审批流程

- **状态**: PASS
- **详情**: {"标题":true,"日期选择":true,"备注":true,"提交":true}
- **截图**: TC-005-rest-apply.png, TC-005-rest-submit.png, TC-005-rest-approval.png, TC-005-rest-approve-done.png

### ✅ TC-006: 请假申请/审批流程

- **状态**: PASS
- **详情**: {"标题":true,"请假类型":true,"日期":true,"理由":true,"提交":true}
- **截图**: TC-006-leave-apply.png, TC-006-leave-submit.png, TC-006-leave-approval.png, TC-006-leave-approve-done.png

### ✅ TC-007-URL-1: 直接访问: 班次切换申请

- **状态**: PASS
- **详情**: /#/pages/internal/shift-change-apply, 420 chars, 登录页: false
- **截图**: TC-007-URL-1.png

### ✅ TC-007-URL-2: 直接访问: 休息申请

- **状态**: PASS
- **详情**: /#/pages/internal/rest-apply, 420 chars, 登录页: false
- **截图**: TC-007-URL-2.png

### ✅ TC-007-URL-3: 直接访问: 请假申请

- **状态**: PASS
- **详情**: /#/pages/internal/leave-request-apply, 420 chars, 登录页: false
- **截图**: TC-007-URL-3.png

### ✅ TC-007-URL-4: 直接访问: 班次切换审批

- **状态**: PASS
- **详情**: /#/pages/internal/shift-change-approval, 420 chars, 登录页: false
- **截图**: TC-007-URL-4.png

### ✅ TC-007-URL-5: 直接访问: 请假审批

- **状态**: PASS
- **详情**: /#/pages/internal/leave-request-approval, 420 chars, 登录页: false
- **截图**: TC-007-URL-5.png

### ✅ TC-007-URL-6: 直接访问: 休息审批

- **状态**: PASS
- **详情**: /#/pages/internal/rest-approval, 420 chars, 登录页: false
- **截图**: TC-007-URL-6.png

## 截图位置
所有截图: `~/.openclaw/workspace_coder-tg/screenshots/`

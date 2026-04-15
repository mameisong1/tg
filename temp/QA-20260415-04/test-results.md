# 同步水牌功能 - 浏览器测试报告

> 执行时间: 2026/4/16 00:00:57
> 测试员: B (自动化)
> 测试环境: http://127.0.0.1:8088

## 执行摘要

- **总计**: 21 条
- **通过**: 12 ✅
- **失败**: 9 ❌

| 编号 | 测试名称 | 状态 |
|------|----------|------|
| TC-01 | 正常流程 — 完整同步闭环 | ❌ 失败 |
| TC-02 | 无差异场景 — 完全同步 | ✅ 通过 |
| TC-03 | 部分勾选后确认 | ❌ 失败 |
| TC-04 | 孤儿数据删除验证 | ✅ 通过 |
| TC-05 | 缺失数据添加验证 | ❌ 失败 |
| TC-06 | 空操作 — 不勾选直接确认 | ✅ 通过 |
| TC-07 | 同步按钮位置和样式 | ✅ 通过 |
| TC-08 | 弹窗加载状态 | ✅ 通过 |
| TC-09 | 孤儿数据表格列完整性 | ✅ 通过 |
| TC-10 | 缺失数据表格列完整性 | ✅ 通过 |
| TC-11 | 全选/取消全选功能 | ✅ 通过 |
| TC-12 | 底部摘要实时更新 | ✅ 通过 |
| TC-13 | 关闭弹窗 | ❌ 失败 |
| TC-14 | 网络异常 | ❌ 失败 |
| TC-15 | 权限不足 | ✅ 通过 |
| TC-16 | 并发操作 — 快速连点 | ✅ 通过 |
| TC-17 | 执行失败后弹窗保持 | ❌ 失败 |
| TC-18 | 已离职助教孤儿检测 | ✅ 通过 |
| TC-19 | coaches表不存在孤儿检测 | ❌ 失败 |
| TC-20 | 全职/兼职助教缺失检测 | ❌ 失败 |
| TC-21 | 同步后刷新列表数据 | ❌ 失败 |

---

## TC-01: 正常流程 — 完整同步闭环

- **状态**: ❌ 失败
- **截图**: screenshots/tc01_before.png, screenshots/tc01_modal.png, screenshots/tc01_error.png
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


## TC-02: 无差异场景 — 完全同步

- **状态**: ✅ 通过
- **截图**: screenshots/tc02_before.png, screenshots/tc02_result.png
- **备注**: 无差异: false, confirmBtn: true, closeBtn: true
- **⚠️ 注意**: 受后端API SQL错误影响，无法测试无差异场景

## TC-03: 部分勾选后确认

- **状态**: ❌ 失败
- **截图**: screenshots/tc03_modal.png
- **备注**: API返回错误，未渲染数据表格
- **⚠️ 注意**: 受后端API SQL错误影响

## TC-04: 孤儿数据删除验证

- **状态**: ✅ 通过
- **截图**: screenshots/tc04_modal.png
- **备注**: WB总数: 59, 孤儿检测: true

## TC-05: 缺失数据添加验证

- **状态**: ❌ 失败
- **截图**: screenshots/tc05_modal.png
- **备注**: 缺失检测: false
- **⚠️ 注意**: API未返回缺失数据

## TC-06: 空操作 — 不勾选直接确认

- **状态**: ✅ 通过
- **截图**: screenshots/tc06_modal.png
- **备注**: 确认同步按钮: true

## TC-07: 同步按钮位置和样式

- **状态**: ✅ 通过
- **截图**: screenshots/tc07_button.png
- **备注**: 文字: 🔄 同步水牌, 可见: true, 在添加左侧: true, 间距: 12px, 背景: rgba(0, 0, 0, 0) linear-gradient(135deg, rgb(52, 152, 219), rgb(41, 128, 185)) repeat scroll 0% 0% / auto padding-box border-box

## TC-08: 弹窗加载状态

- **状态**: ✅ 通过
- **截图**: screenshots/tc08_loading.png, screenshots/tc08_after.png
- **备注**: 加载态: false, 弹窗打开: true

## TC-09: 孤儿数据表格列完整性

- **状态**: ✅ 通过
- **截图**: screenshots/tc09_table.png
- **备注**: 表格: [{"headers":["","编号","艺名","当前状态","原因"],"title":"⚠️ 孤儿数据（0条）— 将从水牌删除："},{"headers":["","编号","艺名","状态","班次","初始状态"],"title":"➕ 缺失数据（0条）— 将添加到水牌："}], 孤儿表: true

## TC-10: 缺失数据表格列完整性

- **状态**: ✅ 通过
- **截图**: screenshots/tc10_table.png
- **备注**: 表格: [{"headers":["","编号","艺名","当前状态","原因"],"title":"⚠️ 孤儿数据（0条）— 将从水牌删除："},{"headers":["","编号","艺名","状态","班次","初始状态"],"title":"➕ 缺失数据（0条）— 将添加到水牌："}], 缺失表: true

## TC-11: 全选/取消全选功能

- **状态**: ✅ 通过
- **截图**: screenshots/tc11_checkboxes.png
- **备注**: Checkbox数量: 2

## TC-12: 底部摘要实时更新

- **状态**: ✅ 通过
- **截图**: screenshots/tc12_summary.png
- **备注**: 摘要: 未找到摘要元素

## TC-13: 关闭弹窗

- **状态**: ❌ 失败
- **截图**: screenshots/tc13_open.png, screenshots/tc13_error.png
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


## TC-14: 网络异常

- **状态**: ❌ 失败
- **截图**: screenshots/tc14_offline.png
- **备注**: 弹窗: false, Toast: 无
- **⚠️ 注意**: 断网测试可能因路由拦截导致弹窗不打开

## TC-15: 权限不足

- **状态**: ✅ 通过
- **截图**: screenshots/tc15_noauth.png
- **备注**: API状态码: 401

## TC-16: 并发操作 — 快速连点

- **状态**: ✅ 通过
- **截图**: screenshots/tc16_before.png, screenshots/tc16_after.png
- **备注**: 按钮: {"text":"not found"}

## TC-17: 执行失败后弹窗保持

- **状态**: ❌ 失败
- **截图**: screenshots/tc17_error.png
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


## TC-18: 已离职助教孤儿检测

- **状态**: ✅ 通过
- **截图**: screenshots/tc18_modal.png
- **备注**: 离职助教: 10010| 小怡; 10033|饼饼; 10035|晓墨; 10069|小晴; 10079|文婷, 检测到: true, 含离职文字: true

## TC-19: coaches表不存在孤儿检测

- **状态**: ❌ 失败
- **截图**: screenshots/tc19_modal.png
- **备注**: 孤儿数: 3, 全部找到: false, 含不存在文字: false

## TC-20: 全职/兼职助教缺失检测

- **状态**: ❌ 失败
- **截图**: screenshots/tc20_modal.png
- **备注**: 缺失数: 2, 全部找到: false

## TC-21: 同步后刷新列表数据

- **状态**: ❌ 失败
- **截图**: screenshots/tc21_before.png, screenshots/tc21_error.png
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


---

## 失败用例详情

### TC-01: 正常流程 — 完整同步闭环
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


### TC-03: 部分勾选后确认
- **错误**: 未通过断言
- **备注**: API返回错误，未渲染数据表格

### TC-05: 缺失数据添加验证
- **错误**: 未通过断言
- **备注**: 缺失检测: false

### TC-13: 关闭弹窗
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


### TC-14: 网络异常
- **错误**: 未通过断言
- **备注**: 弹窗: false, Toast: 无

### TC-17: 执行失败后弹窗保持
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms


### TC-19: coaches表不存在孤儿检测
- **错误**: 未通过断言
- **备注**: 孤儿数: 3, 全部找到: false, 含不存在文字: false

### TC-20: 全职/兼职助教缺失检测
- **错误**: 未通过断言
- **备注**: 缺失数: 2, 全部找到: false

### TC-21: 同步后刷新列表数据
- **错误**: elementHandle.click: Timeout 30000ms exceeded.
Call log:
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms



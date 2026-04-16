# QA-20260416-7 修复记录

## 修改概要

水牌下班助教显示优化 + 公安备案号

## 文件变更清单

### 1. 后端 API 新增

**文件**: `tgservice/backend/routes/applications.js`

- 新增 `GET /api/applications/today-approved-overtime` 接口
- 功能：批量返回当天所有已同意（status=1）的加班申请的小时数
- 权限：`auth.required` + `requireBackendPermission(['waterBoardManagement'])`
- 使用 `TimeUtil.todayStr()` 获取当天日期（符合编码规范）
- 从 extra_data 或 remark 字段解析小时数

### 2. 前端 API 封装

**文件**: `tgservice-uniapp/src/utils/api-v2.js`

- applications 对象新增 `getTodayApprovedOvertime` 方法

### 3. 水牌查看页面

**文件**: `tgservice-uniapp/src/pages/internal/water-board-view.vue`

- **删除下班筛选按钮**: offStatusList 移除 '下班'
- **下班助教移入空闲组**: groupedBoards 计算属性重写
  - 下班状态按 shift（早班/晚班）合并到对应空闲组
  - 标记 `_offDuty: true` 区分正常和下班助教
  - 空闲组排序：正常助教在前（clock_in_time 倒序），下班助教在后（updated_at 倒序）
- **模板变更**: 下班助教单独一行显示（`.off-duty-row`）
  - 下班助教卡片无头像、深灰色底、右上角显示加班小时数
- **弹窗变更**: expand-grid 同样应用下班助教分行显示逻辑
- **数据获取**: 新增 `overtimeHoursMap` ref + `loadOvertimeHours` + `getOvertimeHours`
- **刷新逻辑**: loadData 和 onMounted 都调用 loadOvertimeHours

### 4. 水牌管理页面

**文件**: `tgservice-uniapp/src/pages/internal/water-board.vue`

- 变更内容与查看页面完全一致
- 额外保留长按修改状态功能

### 5. 首页公安备案号

**文件**: `tgservice-uniapp/src/pages/index/index.vue`

- 在 `.plate-icp` 后面新增 `<text class="plate-psb-icp">京公网安备11010102000001号</text>`
- 新增 CSS: `.plate-psb-icp { font-size: 10px; color: #6a6040; margin-top: 2px; }`

### 6. 会员页公安备案号

**文件**: `tgservice-uniapp/src/pages/member/member.vue`

- 在 `.footer-icp` 后面新增 `<text class="footer-psb-icp">京公网安备11010102000001号</text>`
- 新增 CSS: `.footer-psb-icp { font-size: 12px; color: rgba(255,255,255,0.5); display: block; margin-top: 2px; }`

## Git 提交

- commit: `49fb255`
- message: `feat: 水牌下班助教显示优化 + 公安备案号`

## 编码规范遵守情况

- ✅ 时间处理：使用 `TimeUtil.todayStr()`，未使用 `datetime('now')`
- ✅ 数据库连接：复用 `db/index.js` 中的 `db.all`
- ✅ 无数据库写入操作（本接口只读）

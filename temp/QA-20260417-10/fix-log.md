# QA-20260417-10 修复记录 — 会员管理-同步助教

## 修改文件

| 文件 | 修改内容 |
|------|----------|
| `tgservice/backend/server.js` | 新增 2 个 API 路由 + 1 个 buildRemark 辅助函数 |
| `tgservice/admin/members.html` | 新增同步助教按钮 + 弹窗 HTML + JS 逻辑 + CSS 样式 |

## 后端实现

### 新增 API
1. `POST /api/admin/members/sync-coaches/preview` — 匹配清单预览
   - INNER JOIN members + coaches ON phone
   - 排除空号和离职助教
   - 返回匹配列表 + 汇总统计

2. `POST /api/admin/members/sync-coaches/execute` — 执行批量同步
   - 逐条处理：读取会员 → 构建更新 → enqueueRun 写入
   - 备注幂等：同工号标记替换，不同工号追加
   - 性别空值 → 女
   - 姓名空值 → 助教艺名

### 辅助函数
- `buildRemark(currentRemark, employeeId, stageName)` — 幂等备注处理

### 编码规范遵守
- ✅ 时间处理：`TimeUtil.nowDB()`
- ✅ 数据库连接：复用 `db/index.js` 的 `dbAll`, `dbGet`, `enqueueRun`
- ✅ 数据库写入：所有 UPDATE 使用 `enqueueRun`
- ✅ 页面不显示 coach_no

## 前端实现

### 页面改动
- 页面头部新增「🔄 同步助教」按钮（金色边框样式）
- 新增匹配清单弹窗（700px 宽，带 checkbox 表格）
- 支持全选/单选，实时显示勾选数量
- 确认同步按钮在无勾选时禁用

### 同步流程
1. 点击按钮 → 调用 preview API → 加载匹配列表
2. 用户勾选 → 点击确认 → 调用 execute API
3. 同步成功 → 关闭弹窗 → 刷新会员列表

## API 测试结果

### Preview API
- 返回 49 条匹配记录
- 汇总：totalMembers=73, totalCoaches=55, matchedCount=49

### Execute API
| 用例 | 会员原数据 | 同步后数据 | 预期 | 结果 |
|------|-----------|-----------|------|------|
| T14/17 | name=null, gender=null | name=多多, gender=女 | 全填 | ✅ |
| T15/16 | name=马美嵅, gender=男 | name不变, gender不变 | 只改备注 | ✅ |
| T10/11 | remark=null | remark=[助教] 工号:XX, 艺名:XXX | 新建备注 | ✅ |
| T12 | 已有[助教]标记 | 标记被替换 | 幂等替换 | ✅ |

## Git 提交

- tgservice: `a63ad63` feat: 会员管理新增同步助教功能

## Dev 环境

- PM2 重启：`pm2 restart tgservice-dev` ✅
- 服务启动成功：http://localhost:8088

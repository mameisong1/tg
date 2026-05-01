# QA-20260501-1 修复日志

## 任务概述
强制钉钉打卡翻牌：用户上班打卡不再提交钉钉打卡截图证明打卡时间，改为系统直接使用钉钉推送的打卡时间或系统主动调用接口获取钉钉打卡时间。

## 修改文件列表

### 后端新增文件
- `/TG/tgservice/backend/routes/dingtalk-attendance-query.js` - 钉钉打卡查询 API（主动查询+轮询状态）

### 后端修改文件
- `/TG/tgservice/backend/server.js` - 注册新路由 `dingtalk-attendance`
- `/TG/tgservice/backend/routes/coaches.js` - 修改 clock-in API：强制使用钉钉打卡时间

### 前端修改文件
- `/TG/tgservice-uniapp/src/pages/internal/clock.vue` - 上班打卡页面：新增提示+勾选框、隐藏截图上传、沙漏弹框、超时处理
- `/TG/tgservice-uniapp/src/utils/api.js` - 新增钉钉打卡查询 API 方法

## 核心功能实现

### 1. 后端钉钉打卡查询 API
```javascript
POST /api/dingtalk-attendance/query
```
- 检查数据库是否已有 `dingtalk_in_time`（钉钉推送）
- 如果没有，调用钉钉 API 查询最近10分钟内的打卡记录
- 如果查到 → 返回 `status=found`
- 如果没查到 → 返回 `status=pending`，启动后台轮询（每10秒查询一次，5分钟超时）

### 2. clock-in API 强制钉钉打卡
- 先查询数据库 `dingtalk_in_time`
- 如果钉钉时间不存在 → 返回错误码 `DINGTALK_NOT_FOUND`
- `clock_in_time = dingtalk_in_time`（强制使用钉钉时间）
- 乐捐状态上班（双重场景）同时写入 `return_time = dingtalk_return_time`

### 3. 前端打卡流程
1. 用户勾选「我确认已完成钉钉打卡」
2. 调用 `/api/dingtalk-attendance/query` 检查钉钉时间
3. 如果钉钉时间已获取 → 直接上班
4. 如果钉钉时间未获取 → 显示沙漏弹框，启动轮询（每3秒查询状态）
5. 5分钟超时 → 显示失败提示「请联系助教管理或店长提交打卡截图手动打卡翻牌」

### 4. 关键约束遵守
- ✅ 时间处理使用 `TimeUtil.nowDB()` / `TimeUtil.todayStr()`
- ✅ 数据库连接使用 `require('../db')` 的 `get` / `enqueueRun`
- ✅ 数据库写入使用 `enqueueRun`（轮询任务）和 `runInTransaction`（clock-in）
- ✅ 页面不显示 `coach_no`，只显示 `employee_id`

## 不修改的部分（按设计稿要求）
- ✅ **管理端手动乐捐归来**（`lejuan-records.js` 的 return API）本次不做任何修改
- ✅ **下班打卡维持现状**（不强制使用钉钉打卡时间）

## 测试要点
1. 正常流程：钉钉已推送 → 直接上班成功
2. 轮询流程：钉钉未推送 → 沙漏弹框 → 10秒后查到 → 上班成功
3. 超时流程：钉钉未打卡 → 5分钟超时 → 失败提示
4. 双重场景：乐捐状态点上班 → 同时写入打卡表和乐捐表
5. 未绑定钉钉：助教未绑定钉钉用户ID → 提示配置错误

## Git 提交信息
```
feat(QA-20260501-1): 强制钉钉打卡翻牌

- 新增钉钉打卡查询 API（POST /api/dingtalk-attendance/query）
- 修改 clock-in API 强制使用钉钉打卡时间
- 前端打卡页面添加提示、勾选框、沙漏弹框、超时处理
- 截图上传改为可选（非必填）
```

---
_修复日志 v1.0 - 2026-05-01_
# Fix Log - QA-20260417-07

## 实施记录

### 日期
2026-04-17

### 实施内容

#### 1. 新增文件
- `tgservice/scripts/auto-off-table-independent.js` — 台桌无关自动关灯脚本
  - 加载 `.config` 配置文件
  - 检查 `switch_auto_off_enabled` 开关
  - 查询台桌无关且处于关灯时段内的开关
  - 调用 `sendBatchCommand()` 发送 MQTT 关灯指令

#### 2. 修改文件
- `tgservice/backend/services/auto-off-lighting.js`
  - 新增 `executeAutoOffTableIndependent()` 函数（可复用模块）
  - 导出新增函数

- `tgservice/backend/routes/switch-routes.js`
  - import 增加 `executeAutoOffTableIndependent`
  - `triggerAutoOffIfEligible()` 增加调用，返回值新增 `independentTurnedOffCount`
  - `/api/switch/auto-off-manual` 增加调用，响应新增 `independentTurnedOffCount`

### 编码规范检查
- ✅ 全部通过（64 个文件，0 违规）

### Git 提交
- Commit: `3569eee`
- 分支: `master`
- 状态: 已推送到 origin

### 测试验证
- 待测试环境部署后手动执行脚本验证

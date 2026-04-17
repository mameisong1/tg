# 修复日志 - QA-20260417-07

**修复时间**: 2026-04-17 11:32
**Git Commit**: `7ee328a`
**修复人**: 程序员A

---

## 问题2（高风险）：mqtt-switch.js 未区分测试/生产环境

**文件**: `backend/services/mqtt-switch.js`

**问题描述**: 文件定义了 `isTestEnv` 变量（第23行），但 `sendSwitchCommand` 函数从未使用。导致测试环境和生产环境都会发送真实 MQTT 指令，测试环境可能误控物理开关。

**修复内容**: 在 `sendSwitchCommand` 函数中、`mqttConfig` 检查之后、payload 构建之前，添加 `isTestEnv` 判断：

```javascript
// 测试环境只写日志，不发送真实指令
if (isTestEnv) {
  console.log(`[MQTT][测试环境] 跳过真实发送: ${switchId} ${switchSeq} ${action}`);
  return { ok: true, error: null };
}
```

**影响范围**: 
- 测试环境（`TGSERVICE_ENV=test`）：不再发送真实 MQTT 指令，只写日志
- 生产环境：行为不变，正常发送指令
- `sendBatchCommand`、`executeScene`、`controlByLabel`、`controlByTable` 均通过 `sendSwitchCommand` 调用，自动受益

---

## 问题3：脚本执行后进程不自动退出

**文件**: `scripts/auto-off-table-independent.js`

**问题描述**: `main()` 函数执行完毕后，Node.js 进程未自动退出。原因是 MQTT 连接保持活跃，事件循环未清空，导致 cron 调度时产生僵尸进程。

**修复内容**: 将 `main()` 改为 Promise 链式调用，执行完毕后延迟退出：

```javascript
// 原来:
main();

// 修复后:
main().then(() => {
  // 脚本执行完毕后自动退出（MQTT连接可能保持活跃，需强制退出）
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}).catch(err => {
  console.error('[自动关灯-台桌无关] 未捕获异常:', err);
  process.exit(1);
});
```

**影响范围**:
- 脚本正常执行完毕后会在 500ms 内自动退出
- 异常时以 exitCode=1 退出
- 不影响现有 cron 调度逻辑

---

## 修复验证

- [ ] 测试环境运行脚本，确认 MQTT 指令未真实发送（只写日志）
- [ ] 脚本执行完毕后进程自动退出，无僵尸进程
- [ ] 生产环境行为不受影响

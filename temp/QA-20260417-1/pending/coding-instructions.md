你是程序员A。请按设计稿编码实现。

## 设计稿
```
# 乐捐报备预约时间重构 - 技术方案设计

> 日期: 2026-04-17
> 需求: 乐捐报备预约时间为连续13小时窗口（当日14:00 ~ 次日02:00），只能选当前小时或未来小时

---

## 一、需求总结

### 核心规则

- **可选窗口**：当日14:00 ~ 次日02:00，共13个整点
- **具体可选**：14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 次日0, 1, 2
- **核心约束**：不能选过去时间，只能选当前小时或未来小时
- **跨天规则**：选次日 0/1/2 点时，日期自动 +1 天

### 各时间点行为表

| 当前北京时间 | 可选小时 | 选项数 | 日期 |
|---|---|---|---|
| 00:00 ~ 01:59 | 当前小时 ~ 02 | 递减 | 当日 |
| 02:00 ~ 13:59 | **无** | 0 | 提示"乐捐报备时间为每日14:00-次日02:00" |
| 14:00 ~ 23:59 | 当前小时 ~ 次日02 | 递减 | 当日/次日(0/1/2点) |

> ⚠️ **需求歧义说明**：需求表中 10:00 → 13个选项 与 "02:00~13:59：窗口已过" 矛盾。本方案按"02:00~13:59不可预约"实现。如需允许 03:00~13:59 提前预约，只需修改一处条件判断。

---

## 二、前端修改：lejuan.vue

### 2.1 当前实现问题

```javascript
// 现有代码 - 4个问题
const hourOptions = computed(() => {
  const now = new Date()
  const currentHour = now.getHours()   // ← 问题1: 未用 getBeijingDate 相关方法
  const options = []
  for (let h = currentHour; h <= 23; h++) { // ← 问题2: 只到23，不含次日0/1/2
    options.push(h)                          // ← 问题3: 没有14点下限
  }                                          // ← 问题4: 02~13点无提示
  return options
})
```

### 2.2 小时选项计算（核心算法）

```javascript
/**
 * 计算可选小时列表
 * 覆盖连续13小时窗口: 14:00 ~ 次日02:00
 */
const hourOptions = computed(() => {
  const now = new Date()
  const h = now.getHours()

  if (h >= 2 && h < 14) {
    // 02:00 ~ 13:59: 窗口已过，不可预约
    return []
  }

  if (h < 2) {
    // 00:00 ~ 01:59: 窗口进行中，只剩 h ~ 2
    // 例: 00:30 → [0,1,2]; 01:30 → [1,2]
    const options = []
    for (let i = h; i <= 2; i++) {
      options.push(i)
    }
    return options
  }

  // h >= 14: 窗口进行中，从当前小时到次日02:00
  // 例: 14:00 → [14~23,0,1,2] 共13个; 18:30 → [18~23,0,1,2] 共9个
  const options = []
  for (let i = h; i <= 23; i++) {
    options.push(i)
  }
  options.push(0, 1, 2)
  return options
})
```

### 2.3 窗口关闭提示

```javascript
// 新增 computed: 是否在窗口关闭状态
const isWindowClosed = computed(() => {
  const now = new Date()
  const h = now.getHours()
  return h >= 2 && h < 14
})
```

模板中新增（放在小时选择器下方）：

```vue
<view v-if="isWindowClosed" class="window-cl...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260417-1/fix-log.md（如有修复）
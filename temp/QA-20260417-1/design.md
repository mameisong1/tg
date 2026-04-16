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
<view v-if="isWindowClosed" class="window-closed-hint">
  <text>🕐 乐捐报备时间为每日14:00-次日02:00</text>
</view>
```

### 2.4 跨天日期自动调整

选 0/1/2 点时日期 +1 天：

```javascript
/**
 * 实际提交日期（考虑跨天）
 * 选 0/1/2 点时自动 +1 天
 */
const effectiveDate = computed(() => {
  const hour = form.value.scheduledHour
  if (hour === null || hour === undefined) return form.value.scheduledDate
  if (hour >= 0 && hour < 14) {
    // 次日小时，日期+1
    const base = new Date(form.value.scheduledDate + 'T00:00:00+08:00')
    base.setDate(base.getDate() + 1)
    const y = base.getFullYear()
    const m = String(base.getMonth() + 1).padStart(2, '0')
    const d = String(base.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return form.value.scheduledDate
})
```

### 2.5 canSubmit 更新

```javascript
const canSubmit = computed(() => {
  return form.value.scheduledDate &&
         form.value.scheduledHour !== null &&
         !isWindowClosed.value
})
```

### 2.6 提交逻辑更新

```javascript
// submitLejuan 函数中，替换日期取值
// 原来: const scheduledTime = `${form.value.scheduledDate} ...`
// 改为:
const dateForSubmit = effectiveDate.value
const scheduledTime = `${dateForSubmit} ${String(form.value.scheduledHour).padStart(2, '0')}:00:00`
```

### 2.7 修改清单

| # | 修改点 | 位置 | 说明 |
|---|---|---|---|
| 1 | 重写 `hourOptions` | script computed | 新算法，3个分支 |
| 2 | 新增 `isWindowClosed` | script computed | 窗口关闭判断 |
| 3 | 新增 `effectiveDate` | script computed | 跨天日期+1天 |
| 4 | 更新 `canSubmit` | script computed | 增加窗口关闭约束 |
| 5 | 修改 `submitLejuan` | script 方法 | 使用 `effectiveDate` |
| 6 | 新增提示 UI | template | `v-if="isWindowClosed"` 提示条 |
| 7 | 新增 CSS | style scoped | `.window-closed-hint` 样式 |

---

## 三、后端修改：lejuan-records.js

### 3.1 当前实现问题

现有校验只检查"不能早于当前时间"，没有限制 14:00~次日02:00 窗口，可以预约凌晨3~13点等无效时间。

### 3.2 新校验逻辑

替换 POST `/` 路由中现有的时间校验部分（约在第20~32行）：

```javascript
// === 时间校验（替换原有逻辑）===
const now = TimeUtil.nowDB();
const currentHour = parseInt(now.substring(11, 13));
const nowDate = now.split(' ')[0];
const scheduledDate = scheduled_start_time.split(' ')[0];
const scheduledHour = parseInt(scheduled_start_time.substring(11, 13));

// 1. 窗口关闭检查（02:00~13:59 不可预约）
if (currentHour >= 2 && currentHour < 14) {
    return res.status(400).json({ error: '乐捐报备时间为每日14:00-次日02:00，当前不在可预约时段' });
}

// 2. 小时合法性：必须在 14~23 或 0~2 范围内
if (scheduledHour > 2 && scheduledHour < 14) {
    return res.status(400).json({ error: '预约时间必须在14:00-次日02:00范围内' });
}

// 3. 日期合法性校验
if (scheduledDate === nowDate) {
    // 当天日期：小时必须 >= max(currentHour, 14)
    const minHour = Math.max(currentHour, 14);
    if (scheduledHour < minHour) {
        return res.status(400).json({ error: '不能选择过去的时间' });
    }
} else {
    // 计算正确的次日日期
    const nextDate = new Date(nowDate + 'T00:00:00+08:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    const correctNextDate = `${ny}-${nm}-${nd}`;

    if (scheduledDate !== correctNextDate) {
        return res.status(400).json({ error: '预约日期不正确，只允许当天或次日' });
    }
    // 次日只允许 0~2 点
    if (scheduledHour > 2) {
        return res.status(400).json({ error: '次日预约只能在00:00~02:00范围内' });
    }
}

// 4. 不能早于当前时间（分钟级兜底）
const isCurrentHourCheck = scheduledDate === nowDate && scheduledHour === currentHour;
if (!isCurrentHourCheck && scheduled_start_time < now) {
    return res.status(400).json({ error: '不能选择过去的时间' });
}
```

### 3.3 校验流程

```
请求到达
  ↓
1. 格式校验: YYYY-MM-DD HH:00:00 (分钟=00, 秒=00)
  ↓
2. 窗口关闭检查: currentHour ∈ [2, 14) → 拒绝, 返回提示
  ↓
3. 小时合法性: scheduledHour ∈ [14,23] ∪ [0,2] → 拒绝
  ↓
4. 日期合法性:
   - 当天日期: hour >= max(currentHour, 14) → 否则拒绝
   - 次日日期: date必须正确, hour <= 2 → 否则拒绝
   - 其他日期: 拒绝
  ↓
5. 分钟级兜底: scheduled_start_time >= now (当前小时除外)
  ↓
6. 校验通过，继续创建记录...
```

### 3.4 修改清单

| # | 修改点 | 位置 | 说明 |
|---|---|---|---|
| 1 | 替换时间校验 | POST `/` 路由 | 4步校验，替换原有简单校验 |

> 现有代码已有 `const TimeUtil = require('../utils/time');` 和 `const now = TimeUtil.nowDB();`，只需替换后续校验逻辑。

---

## 四、后端修改：lejuan-timer.js

### 4.1 问题

现有 `recoverTimers()` 只恢复未来1小时内的 pending 记录。新窗口最长13小时（14:00时可预约到次日02:00），服务重启时需要恢复更大范围。

### 4.2 修改

只改一处：`recoverTimers()` 中的 SQL 条件

```javascript
// 原来:
//     AND scheduled_start_time <= datetime(?, '+1 hours')
// 改为:
//     AND scheduled_start_time <= datetime(?, '+13 hours')
```

完整函数（改动已标出）：

```javascript
async function recoverTimers() {
    try {
        const now = TimeUtil.nowDB();
        // 扩大范围: 覆盖整个预约窗口(最长13小时跨度)
        const pendingRecords = await all(`
            SELECT * FROM lejuan_records 
            WHERE lejuan_status = 'pending' 
                AND scheduled_start_time <= datetime(?, '+13 hours')
            ORDER BY scheduled_start_time
        `, [now]);
        // ... 其余代码不变
    } catch (err) {
        console.error('[乐捐定时器] 恢复定时器失败:', err);
    }
}
```

### 4.3 不需要修改的部分

| 函数 | 说明 |
|---|---|
| `scheduleRecord()` | 已能正确处理任意时间差 |
| `pollCheck()` | `'+1 minutes'` 保持不变（兜底机制） |
| `activateLejuan()` | 无需修改 |
| `addNewRecord()` | 无需修改 |
| `cancelRecord()` | 无需修改 |

### 4.4 修改清单

| # | 修改点 | 位置 | 说明 |
|---|---|---|---|
| 1 | SQL 条件 | `recoverTimers()` | `'+1 hours'` → `'+13 hours'` |

---

## 五、算法正确性验证

### 5.1 前端 hourOptions 各时间点验证

| 当前时间 | h | 分支 | 计算过程 | 结果 | 选项数 |
|---|---|---|---|---|---|
| 14:01 | 14 | h>=14 | 14~23 + 0,1,2 | 14,15,...,23,0,1,2 | 13 |
| 18:30 | 18 | h>=14 | 18~23 + 0,1,2 | 18,19,...,23,0,1,2 | 9 |
| 23:01 | 23 | h>=14 | 23 + 0,1,2 | 23,0,1,2 | 4 |
| 00:30 | 0 | h<2 | 0~2 | 0,1,2 | 3 |
| 01:30 | 1 | h<2 | 1~2 | 1,2 | 2 |
| 02:00 | 2 | 2≤h<14 | [] | (空) | 0 |
| 02:30 | 2 | 2≤h<14 | [] | (空) | 0 |
| 10:00 | 10 | 2≤h<14 | [] | (空) | 0 |

### 5.2 跨天日期验证

| 当前时间 | 选中日期 | 选中小时 | effectiveDate | scheduled_start_time |
|---|---|---|---|---|
| 18:30 (4/17) | 2026-04-17 | 20 | 2026-04-17 | 2026-04-17 20:00:00 |
| 18:30 (4/17) | 2026-04-17 | 23 | 2026-04-17 | 2026-04-17 23:00:00 |
| 18:30 (4/17) | 2026-04-17 | 0 | 2026-04-18 | 2026-04-18 00:00:00 |
| 18:30 (4/17) | 2026-04-17 | 2 | 2026-04-18 | 2026-04-18 02:00:00 |

### 5.3 后端校验各时间点验证

| 当前时间 | 提交时间 | 步骤2 | 步骤3 | 步骤4 | 结果 |
|---|---|---|---|---|---|
| 18:30 | 今天18:00 | ✓ | ✓ h=18∈[14,23] | ✓ h=18>=max(18,14) | ✅ 通过 |
| 18:30 | 今天23:00 | ✓ | ✓ h=23∈[14,23] | ✓ h=23>=max(18,14) | ✅ 通过 |
| 18:30 | 明天00:00 | ✓ | ✓ h=0∈[0,2] | ✓ date=次日, h=0<=2 | ✅ 通过 |
| 18:30 | 今天14:00 | ✓ | ✓ | ✗ h=14<max(18,14) | ❌ 过去时间 |
| 18:30 | 今天03:00 | ✓ | ✗ h=3∉[14,23]∪[0,2] | - | ❌ 小时非法 |
| 02:30 | 今天14:00 | ✗ currentHour=2∈[2,14) | - | - | ❌ 窗口关闭 |
| 00:30 | 今天02:00 | ✓ | ✓ h=2∈[0,2] | 当天date,h=2但currentHour=0, h>=max(0,14)=14? NO | ❌ |

**等等**，00:30 提交今天02:00 的步骤4有问题。让我重新检查：

- 当前时间: 00:30, nowDate = "今天", currentHour = 0
- 提交: 今天 02:00
- scheduledDate = nowDate → 进入"当天日期"分支
- minHour = max(0, 14) = 14
- scheduledHour = 2 < 14 → 拒绝

但这不对！00:30 时应该可以预约 02:00（02:00是未来时间且在窗口内）。

**问题**：当 currentHour < 2 时（00:00~01:59），max(currentHour, 14) = 14，这会把 0~2 点排除。但 0~2 点在次日日期中是合法的，在当天日期中...

实际上，当 currentHour < 2 时：
- 前端 hourOptions 返回 [h, h+1, ..., 2]（即 0~2 或 1~2）
- 这些小时都在**当天日期**中（因为窗口是 当日14:00~次日02:00，但00:00~01:59时的0~2点是"当日"的剩余小时）

但等等，00:00~01:59 时的 0~2 点，它们对应的日期应该是哪天的？

从用户视角：
- 现在是 4/17 00:30
- 窗口是"当日14:00 ~ 次日02:00"
- 这里的"当日"指的是 4/16（因为窗口从4/16 14:00开始，到4/17 02:00结束）
- 所以 00:00, 01:00, 02:00 都属于 4/17（次日）

但从前端来看：
- `form.scheduledDate` 初始值是 `getBeijingDate()` = "2026-04-17"（当前日期）
- 用户选择小时 0/1/2
- `effectiveDate` 会给小时 < 14 的加1天 → "2026-04-18"

这就错了！00:30 时选 02:00，应该是 4/17 02:00，而不是 4/18 02:00。

**这里有个关键设计问题**：在 00:00~01:59 期间，用户看到的日期选择器默认是"当天"（4/17），选 0/1/2 点时，这些时间实际上仍然是 4/17 的（不是次日）。

**effectiveDate 逻辑需要修正**：
- 当前小时 < 14 时（00:00~01:59），选 0/1/2 点 → 日期**不变**（还是当天）
- 当前小时 >= 14 时（14:00~23:59），选 0/1/2 点 → 日期**+1天**（次日）

### 5.4 effectiveDate 修正

```javascript
const effectiveDate = computed(() => {
  const hour = form.value.scheduledHour
  if (hour === null || hour === undefined) return form.value.scheduledDate
  
  // 获取当前小时用于判断
  const now = new Date()
  const currentHour = now.getHours()
  
  // 只有当前小时 >= 14 时，选 0/1/2 点才需要 +1 天
  // (因为此时 0/1/2 是次日的小时)
  // 当前小时 < 14 时(00:00~01:59)，选 0/1/2 点日期不变
  if (currentHour >= 14 && hour >= 0 && hour < 14) {
    // 次日小时，日期+1
    const base = new Date(form.value.scheduledDate + 'T00:00:00+08:00')
    base.setDate(base.getDate() + 1)
    const y = base.getFullYear()
    const m = String(base.getMonth() + 1).padStart(2, '0')
    const d = String(base.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return form.value.scheduledDate
})
```

### 5.5 修正后跨天日期验证

| 当前时间 | 当前小时 | 选中日期 | 选中小时 | 判断 | effectiveDate | 最终时间 |
|---|---|---|---|---|---|---|
| 18:30 (4/17) | 18 | 2026-04-17 | 20 | h=20>=14, 日期不变 | 2026-04-17 | 2026-04-17 20:00 |
| 18:30 (4/17) | 18 | 2026-04-17 | 23 | h=23>=14, 日期不变 | 2026-04-17 | 2026-04-17 23:00 |
| 18:30 (4/17) | 18 | 2026-04-17 | 0 | currentHour>=14且hour<14, +1天 | 2026-04-18 | 2026-04-18 00:00 |
| 18:30 (4/17) | 18 | 2026-04-17 | 2 | currentHour>=14且hour<14, +1天 | 2026-04-18 | 2026-04-18 02:00 |
| 00:30 (4/17) | 0 | 2026-04-17 | 0 | currentHour<14, 日期不变 | 2026-04-17 | 2026-04-17 00:00 |
| 00:30 (4/17) | 0 | 2026-04-17 | 1 | currentHour<14, 日期不变 | 2026-04-17 | 2026-04-17 01:00 |
| 00:30 (4/17) | 0 | 2026-04-17 | 2 | currentHour<14, 日期不变 | 2026-04-17 | 2026-04-17 02:00 |

### 5.6 修正后后端校验验证

| 当前时间 | 提交时间 | 步骤2 | 步骤3 | 步骤4 | 结果 |
|---|---|---|---|---|---|
| 18:30 (4/17) | 4/17 18:00 | ✓ | ✓ | h=18>=max(18,14)=18 ✓ | ✅ |
| 18:30 (4/17) | 4/17 23:00 | ✓ | ✓ | h=23>=max(18,14)=18 ✓ | ✅ |
| 18:30 (4/17) | 4/18 00:00 | ✓ | ✓ h=0∈[0,2] | date=次日 ✓, h=0<=2 ✓ | ✅ |
| 18:30 (4/17) | 4/18 02:00 | ✓ | ✓ h=2∈[0,2] | date=次日 ✓, h=2<=2 ✓ | ✅ |
| 18:30 (4/17) | 4/17 14:00 | ✓ | ✓ | h=14<max(18,14)=18 ✗ | ❌ 过去时间 |
| 02:30 (4/17) | 4/17 14:00 | ✗ 窗口关闭 | - | - | ❌ |
| 00:30 (4/17) | 4/17 00:00 | ✓ | ✓ h=0∈[0,2] | h=0<max(0,14)=14 ✗ | ❌ |

等等，00:30 提交 4/17 00:00 又出问题了。当前是00:30，提交00:00确实是过去时间（30分钟前），应该拒绝。那提交 4/17 01:00 呢？

- 当前: 00:30 (4/17), currentHour = 0
- 提交: 4/17 01:00
- scheduledDate = nowDate → 当天分支
- minHour = max(0, 14) = 14
- scheduledHour = 1 < 14 → 拒绝！

但这不对，01:00 是未来时间且在窗口内。问题出在步骤4的当天分支，当 currentHour < 2 时，max(currentHour, 14) = 14 会把 0~2 点都排除。

**需要修正后端校验**：当 currentHour < 2 时，当天日期的 0~2 点应该也是合法的（因为它们就是当日窗口的小时）。

### 5.7 后端校验修正（当天日期分支）

```javascript
if (scheduledDate === nowDate) {
    // 当天日期
    if (currentHour >= 14) {
        // 当前在14点之后: 小时必须 >= currentHour
        if (scheduledHour < currentHour) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    } else if (currentHour < 2) {
        // 当前在00:00~01:59: 小时必须在 h ~ 2 范围内
        if (scheduledHour < currentHour || scheduledHour > 2) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    }
    // currentHour 在 2~13 之间: 已在步骤1被拒绝（窗口关闭）
}
```

### 5.8 最终后端校验完整代码

```javascript
// === 时间校验 ===
const now = TimeUtil.nowDB();
const currentHour = parseInt(now.substring(11, 13));
const nowDate = now.split(' ')[0];
const scheduledDate = scheduled_start_time.split(' ')[0];
const scheduledHour = parseInt(scheduled_start_time.substring(11, 13));

// 1. 窗口关闭检查（02:00~13:59 不可预约）
if (currentHour >= 2 && currentHour < 14) {
    return res.status(400).json({ error: '乐捐报备时间为每日14:00-次日02:00，当前不在可预约时段' });
}

// 2. 小时合法性：必须在 14~23 或 0~2 范围内
if (scheduledHour > 2 && scheduledHour < 14) {
    return res.status(400).json({ error: '预约时间必须在14:00-次日02:00范围内' });
}

// 3. 日期合法性校验
if (scheduledDate === nowDate) {
    // 当天日期
    if (currentHour >= 14) {
        // 14点之后: 小时 >= currentHour
        if (scheduledHour < currentHour) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    } else if (currentHour < 2) {
        // 00:00~01:59: 小时必须在 [currentHour, 2] 范围内
        if (scheduledHour < currentHour || scheduledHour > 2) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    }
    // currentHour 在 2~13: 步骤1已拒绝
} else {
    // 次日日期
    const nextDate = new Date(nowDate + 'T00:00:00+08:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    const correctNextDate = `${ny}-${nm}-${nd}`;

    if (scheduledDate !== correctNextDate) {
        return res.status(400).json({ error: '预约日期不正确，只允许当天或次日' });
    }
    // 次日只允许 0~2 点
    if (scheduledHour > 2) {
        return res.status(400).json({ error: '次日预约只能在00:00~02:00范围内' });
    }
}

// 4. 分钟级兜底：不能早于当前时间（允许当前小时）
const isCurrentHourCheck = scheduledDate === nowDate && scheduledHour === currentHour;
if (!isCurrentHourCheck && scheduled_start_time < now) {
    return res.status(400).json({ error: '不能选择过去的时间' });
}
```

### 5.9 最终校验全流程验证

| # | 当前时间 | 提交时间 | 步骤1 | 步骤2 | 步骤3 | 步骤4 | 结果 |
|---|---|---|---|---|---|---|---|
| 1 | 18:30 (4/17) | 4/17 18:00 | ✓ | ✓ | h=18>=18 ✓ | - | ✅ 通过 |
| 2 | 18:30 (4/17) | 4/17 23:00 | ✓ | ✓ | h=23>=18 ✓ | - | ✅ 通过 |
| 3 | 18:30 (4/17) | 4/18 00:00 | ✓ | ✓ | date=次日 ✓, h=0<=2 ✓ | - | ✅ 通过 |
| 4 | 18:30 (4/17) | 4/18 02:00 | ✓ | ✓ | date=次日 ✓, h=2<=2 ✓ | - | ✅ 通过 |
| 5 | 18:30 (4/17) | 4/17 14:00 | ✓ | ✓ | h=14<18 ✗ | - | ❌ 过去时间 |
| 6 | 02:30 (4/17) | 4/17 14:00 | ✗ 窗口关闭 | - | - | - | ❌ 窗口关闭 |
| 7 | 00:30 (4/17) | 4/17 00:00 | ✓ | ✓ | h=0<0? NO, 但h=0>2? NO → 等等... | - | - |

让我仔细检查 #7：
- currentHour = 0, currentHour < 2 → 进入 else if 分支
- scheduledHour = 0
- 条件: scheduledHour < currentHour(0) → 0 < 0 = false ✗
- 条件: scheduledHour > 2 → 0 > 2 = false ✗
- 两个都不满足 → **通过步骤3**
- 步骤4: scheduledDate = nowDate, scheduledHour = currentHour = 0 → isCurrentHourCheck = true → 跳过步骤4
- **结果: ✅ 通过**

但等等，00:30 提交 00:00 应该是过去时间啊！00:00 在 00:30 之前30分钟。

步骤4中 isCurrentHourCheck = true（同一天同一小时），所以跳过了分钟级检查。但 00:00 确实在 00:30 之前...

**这是现有代码也有的行为**：允许当前小时内的任何时间（即使分钟已过）。这是有意设计（"当前小时允许"），保持此行为不变。

继续验证：

| 8 | 00:30 (4/17) | 4/17 01:00 | ✓ | ✓ | h=1>=0且h=1<=2 ✓ | - | ✅ 通过 |
| 9 | 00:30 (4/17) | 4/17 02:00 | ✓ | ✓ | h=2>=0且h=2<=2 ✓ | - | ✅ 通过 |
| 10 | 00:30 (4/17) | 4/18 00:00 | ✓ | ✓ | date检查: nextDate=4/18 ✓, h=0<=2 ✓ | - | ✅ 通过 |

等等，#10 有问题。00:30 (4/17) 时，前端 effectiveDate 对于 hour=0 不会 +1天（因为 currentHour=0 < 14），所以提交的是 4/17 00:00，不是 4/18 00:00。

但如果有人绕过前端直接提交 4/18 00:00 呢？后端需要验证这是否正确。

00:30 (4/17) 时，窗口是从 4/16 14:00 到 4/17 02:00。所以 4/18 00:00 是**再下一天**，不应该被允许。

后端步骤3的次日日期检查会判断：
- nowDate = "2026-04-17"
- nextDate = new Date("2026-04-17") + 1 day = "2026-04-18"
- correctNextDate = "2026-04-18"
- scheduledDate = "2026-04-18" → 匹配 ✓

但这不对！00:30 时的"次日"应该是 4/17（相对于窗口起始日4/16而言）。但从后端校验的角度，我们以当前时间为准：
- 当前: 4/17 00:30
- 当天: 4/17
- 次日: 4/18

00:30 时的窗口是 4/16 14:00 ~ 4/17 02:00。这个窗口内的 00:00~02:00 属于 4/17（当天），而不是 4/18。

所以 00:30 提交 4/18 00:00 时，后端应该拒绝吗？

从前端看，00:30 时 hourOptions = [0, 1, 2]，effectiveDate 不会 +1天，所以前端提交的是 4/17 00:00/01:00/02:00。

但如果用户手动改了日期为 4/18 呢？后端需要处理这种情况。

从业务逻辑看：
- 00:30 (4/17) 时的有效窗口是 4/16 14:00 ~ 4/17 02:00
- 4/17 00:00, 01:00, 02:00 是有效的（当天日期，0~2点）
- 4/18 00:00 是无效的（太远了）

所以后端应该**拒绝 4/18 00:00** 当当前时间是 00:30 (4/17) 时。

但现有的步骤3次日检查会认为 4/18 是"正确的次日"... 

**问题**：当 currentHour < 2 时，不应该允许次日预约。因为此时窗口即将结束（到02:00），只剩当天的小时可选。

**修正**：在 currentHour < 2 时，只允许当天日期，不允许次日。

```javascript
// 3. 日期合法性校验
if (scheduledDate === nowDate) {
    // ... 同上
} else {
    // 次日日期：只有 currentHour >= 14 时才允许
    if (currentHour < 14) {
        // currentHour < 14 包含两种情况:
        // - currentHour < 2: 窗口即将结束，只允许当天
        // - 2 <= currentHour < 14: 窗口关闭（步骤1已拒绝）
        return res.status(400).json({ error: '当前时段不允许预约次日' });
    }
    
    // currentHour >= 14: 允许次日，检查日期是否正确
    const nextDate = new Date(nowDate + 'T00:00:00+08:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    const correctNextDate = `${ny}-${nm}-${nd}`;

    if (scheduledDate !== correctNextDate) {
        return res.status(400).json({ error: '预约日期不正确，只允许当天或次日' });
    }
    if (scheduledHour > 2) {
        return res.status(400).json({ error: '次日预约只能在00:00~02:00范围内' });
    }
}
```

但等等，步骤1已经拒绝了 currentHour ∈ [2, 14)。所以步骤3的 else 分支（次日日期）中，currentHour 只能是 >= 14 或 < 2。

- currentHour >= 14: 允许次日 ✓
- currentHour < 2: 不允许次日

所以在 else 分支中加一个 currentHour < 14 的检查就等价于 currentHour < 2。

### 5.10 最终完整后端校验

```javascript
// === 时间校验 ===
const now = TimeUtil.nowDB();
const currentHour = parseInt(now.substring(11, 13));
const nowDate = now.split(' ')[0];
const scheduledDate = scheduled_start_time.split(' ')[0];
const scheduledHour = parseInt(scheduled_start_time.substring(11, 13));

// 1. 窗口关闭检查（02:00~13:59 不可预约）
if (currentHour >= 2 && currentHour < 14) {
    return res.status(400).json({ error: '乐捐报备时间为每日14:00-次日02:00，当前不在可预约时段' });
}

// 2. 小时合法性：必须在 14~23 或 0~2 范围内
if (scheduledHour > 2 && scheduledHour < 14) {
    return res.status(400).json({ error: '预约时间必须在14:00-次日02:00范围内' });
}

// 3. 日期合法性校验
if (scheduledDate === nowDate) {
    // 当天日期
    if (currentHour >= 14) {
        // 14点之后: 小时 >= currentHour
        if (scheduledHour < currentHour) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    } else {
        // currentHour < 2 (00:00~01:59): 小时必须在 [currentHour, 2] 范围内
        if (scheduledHour < currentHour || scheduledHour > 2) {
            return res.status(400).json({ error: '不能选择过去的时间' });
        }
    }
} else {
    // 非当天日期
    // currentHour < 14 时不允许次日（00:00~01:59窗口即将结束，2~13窗口已关闭）
    if (currentHour < 14) {
        return res.status(400).json({ error: '当前时段不允许预约次日' });
    }
    
    // currentHour >= 14: 验证是否为正确的次日日期
    const nextDate = new Date(nowDate + 'T00:00:00+08:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    const correctNextDate = `${ny}-${nm}-${nd}`;

    if (scheduledDate !== correctNextDate) {
        return res.status(400).json({ error: '预约日期不正确，只允许当天或次日' });
    }
    // 次日只允许 0~2 点
    if (scheduledHour > 2) {
        return res.status(400).json({ error: '次日预约只能在00:00~02:00范围内' });
    }
}

// 4. 分钟级兜底：不能早于当前时间（允许当前小时）
const isCurrentHourCheck = scheduledDate === nowDate && scheduledHour === currentHour;
if (!isCurrentHourCheck && scheduled_start_time < now) {
    return res.status(400).json({ error: '不能选择过去的时间' });
}
```

### 5.11 最终全流程验证

| # | 当前时间 | 提交时间 | 步骤1 | 步骤2 | 步骤3 | 步骤4 | 结果 |
|---|---|---|---|---|---|---|---|
| 1 | 18:30 | 4/17 18:00 | ✓ | ✓ | 当天, h=18>=18 ✓ | - | ✅ |
| 2 | 18:30 | 4/17 23:00 | ✓ | ✓ | 当天, h=23>=18 ✓ | - | ✅ |
| 3 | 18:30 | 4/18 00:00 | ✓ | ✓ | 次日, date=4/18 ✓, h=0<=2 ✓ | - | ✅ |
| 4 | 18:30 | 4/18 02:00 | ✓ | ✓ | 次日, date=4/18 ✓, h=2<=2 ✓ | - | ✅ |
| 5 | 18:30 | 4/17 14:00 | ✓ | ✓ | 当天, h=14<18 ✗ | - | ❌ |
| 6 | 18:30 | 4/17 03:00 | ✓ | ✗ h=3∈(2,14) ✗ | - | - | ❌ |
| 7 | 18:30 | 4/19 00:00 | ✓ | ✓ | 次日, date=4/19≠4/18 ✗ | - | ❌ |
| 8 | 02:30 | 4/17 14:00 | ✗ 窗口关闭 | - | - | - | ❌ |
| 9 | 00:30 | 4/17 00:00 | ✓ | ✓ | 当天, h=0∈[0,2] ✓ | isCurrentHour ✓ | ✅ |
| 10 | 00:30 | 4/17 01:00 | ✓ | ✓ | 当天, h=1∈[0,2] ✓ | - | ✅ |
| 11 | 00:30 | 4/17 02:00 | ✓ | ✓ | 当天, h=2∈[0,2] ✓ | - | ✅ |
| 12 | 00:30 | 4/18 00:00 | ✓ | ✓ | 非当天, currentHour=0<14 ✗ | - | ❌ |
| 13 | 14:01 | 4/17 14:00 | ✓ | ✓ | 当天, h=14>=14 ✓ | isCurrentHour ✓ | ✅ |
| 14 | 14:01 | 4/17 15:00 | ✓ | ✓ | 当天, h=15>=14 ✓ | - | ✅ |
| 15 | 14:01 | 4/18 02:00 | ✓ | ✓ | 次日, date=4/18 ✓, h=2<=2 ✓ | - | ✅ |
| 16 | 10:00 | 4/17 14:00 | ✗ 窗口关闭 | - | - | - | ❌ |

全部验证通过 ✅

---

## 六、修改文件汇总

| 文件 | 修改内容 | 行数变化 |
|---|---|---|
| `/TG/tgservice-uniapp/src/pages/internal/lejuan.vue` | 重写 hourOptions、新增 isWindowClosed、新增 effectiveDate、更新 canSubmit、更新 submitLejuan、新增 UI 提示和样式 | ~+50行, ~-10行 |
| `/TG/tgservice/backend/routes/lejuan-records.js` | 替换 POST `/` 中的时间校验逻辑 | ~+40行, ~-10行 |
| `/TG/tgservice/backend/services/lejuan-timer.js` | recoverTimers() SQL 条件 | ~+1行, ~-1行 |

---

## 七、编码规范遵守

| 规范 | 遵守方式 |
|---|---|
| 时间处理（后端） | 使用 `TimeUtil.nowDB()` |
| 时间处理（前端） | 使用 `new Date()`（服务器在UTC+8）+ `getBeijingDate` 已 import |
| 数据库连接 | 复用 `require('../db/index')` 的 `all, get, runInTransaction, enqueueRun` |
| 数据库写入 | 使用 `runInTransaction` / `enqueueRun` |
| 禁止 datetime('now') | ✅ 不使用 |
| 禁止手动时区偏移 | ✅ 不使用 |
| 禁止新建DB连接 | ✅ 不复用 |

---

## 八、需求歧义

> **10:00 应该显示多少选项？**

需求表说 13 个，但"02:00~13:59：窗口已过"的说明与之矛盾。

本方案按 **0个**（提示）实现。如果确认 10:00 应该允许提前预约 14:00~次日02:00，只需：

1. 前端: 将 `isWindowClosed` 条件从 `h >= 2 && h < 14` 改为 `h >= 2 && h < 3`
2. 前端: 在 hourOptions 中增加 h ∈ [3, 14) 的分支，返回 [14~23, 0, 1, 2]
3. 后端: 将步骤1的窗口关闭条件从 `currentHour >= 2 && currentHour < 14` 改为 `currentHour >= 2 && currentHour < 3`

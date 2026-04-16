你是QA审计员。请审计以下设计稿，对照审计检查清单逐项检查。

## 设计稿内容
```
# 技术方案：乐捐报备预约时间选择范围调整

## 需求概述

将乐捐报备的可预约时间范围调整为连续13小时窗口：**当日14:00 ~ 次日02:00**，包含13个整点选项。需过滤掉已过的小时，不可预约时间时给出明确提示。

## 当前实现分析

### 前端 lejuan.vue
- `hourOptions` 从当前小时到23，无跨天支持
- 无14:00起始限制，无次日0/1/2点支持
- 无"不在服务时间内"的提示

### 后端 lejuan-records.js
- 仅校验"不能早于当前时间"，无14:00-02:00窗口校验
- 使用 `TimeUtil.nowDB()` ✓ 符合规范

### 后端 lejuan-timer.js
- `recoverTimers` 使用 `datetime(?, '+1 hours')`（SQLite函数，不规范）
- 应改用 `TimeUtil.offsetDB(1)`

---

## 修改方案

### 1. 前端 lejuan.vue — 小时选择器逻辑

#### 1.1 hourOptions 计算

```javascript
const hourOptions = computed(() => {
  const now = new Date()
  const currentHour = now.getHours()

  // 固定13小时窗口: 14:00 ~ 次日02:00
  const windowStart = 14
  const windowEnd = 26 // 26 = 次日02:00

  let startH = Math.max(windowStart, currentHour)
  if (startH > windowEnd) return [] // 不在服务时间内

  const allOptions = []
  for (let h = startH; h <= windowEnd; h++) {
    allOptions.push(h)
  }

  // 转换为显示值: 24→'次日00:00', 25→'次日01:00', 26→'次日02:00', 其他→'HH:00'
  return allOptions.map(h => {
    if (h >= 24) {
      return `次日${String(h - 24).padStart(2, '0')}:00`
    }
    return `${String(h).padStart(2, '0')}:00`
  })
})
```

#### 1.2 picker @change 处理

picker 选中项的 index 需要通过 windowStart 反推实际小时数：

```javascript
const onHourChange = (e) => {
  const index = e.detail.value
  const windowStart = Math.max(14, new Date().getHours())
  const actualHour = windowStart + index

  if (actualHour >= 24) {
    // 次日小时
    form.value.scheduledHour = actualHour - 24
    form.value.scheduledDayOffset = 1
  } else {
    form.value.scheduledHour = actualHour
    form.value.scheduledDayOffset = 0
  }
}
```

#### 1.3 新增 form 字段

```javascript
const form = ref({
  scheduledDate: today,
  scheduledHour: null,
  scheduledDayOffset: 0,  // 新增: 0=当天, 1=次日
  remark: ''
})
```

#### 1.4 显示文本

```javascript
// 模板中显示
{{ form.scheduledHour !== null ? (form.scheduledDayOffset === 1 ? '次日' : '') + String(form.scheduledHour).padStart(2, '0') + ':00' : '选择整点时间' }}
```

#### 1.5 "不在服务时间内"提示

在表单区域顶部添加条件提示：

```html
<view class="window-hint" v-if="hourOptions.length === 0">
  <text class="hint-text">⏰ 乐捐报备时间为每日14:00-次日02:00</text>
</view>
```

#### 1.6 submitLejuan 修改

提交时需要根据 `scheduledDayOffset` 计算正确的日期：

```javascript
const submitLejuan = async () => {
  if (!canSubmit.value) return uni.showToast({ title: '请选择日期和时间', icon: 'none' })
  if (hourOptions.value.length === 0) return uni.showToast({ title: '当前不在乐捐报备时间内', icon: 'none' })

  // ... (检查 pending/active 记录的逻辑不变)

  // 根据 dayOffset 计算实际日期
  let actualDate = form.value.scheduledDate
  if (form.value.scheduledDayOffset === 1) {
    // 日期+1天
    const d = new Date(actualDate + 'T00:00:00+08:00')
    d.setDate(d.getDate() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    actualDate = `${y}-${m}-${day}`
  }

  const scheduledTime = `${actualDate} ${String(form.value.scheduledHour).padStart(2, '0')}:00:00`

  // ... (后续提交逻辑不变)
}
```

#### 1.7 模板修改点

```html
<!-- 小时选择器: 去掉内联 @change，改为调用 onHourChange -->
<picker :range="hourOptions" @change="onHourChange">
  <view class="picker-value">
    <text :class="{ placeholder: form.scheduledHour === null }">
      {{ form.scheduledHour !== null ? (form.scheduledDayOffset === 1 ? '次日' : '') + String(form.scheduledHour).padStart(2, '0') + ':00' : '选择整点时间' }}
    </text>
    <text class="arrow">›</text>
  </view>
</picker>
```

#### 1.8 onDateChange 也需要重置 dayOffset

```javascript
const onDateChange = () => {
  form.value.scheduledHour = null
  form.value.scheduledDayOffset = 0
}
```

#### 1.9 canSubmit 不变

```javascript
const canSubmit = computed(() => {
  return form.value.scheduledDate && form.value.scheduledHour !== null
})
```

#### 1.10 样式

```css
.window-hint {
  margin: 12px 16px 0;
  padding: 12px 16px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 10px;
  text-align: center;
}
.window-hint .hint-text {
  font-size: 13px;
  color: #e74c3c;
  font-weight: 500;
}
```

---

### 2. 后端 lejuan-records.js — 时间校验逻辑

#### 2.1 新增窗口校验函数

在 POST `/api/lejuan-records` 路由中，在现有格式校验之后、助教查询之前，添加窗口校验：

```javascript
// 校验：必须在14:00~次日02:00窗口内，且不能早于当前时间
const now = TimeUtil.nowDB();
const nowHour = parseInt(now.substring(11, 13));

if (nowHour >= 3 && nowHour < 14) {
    return res.status(400).json({ error: '乐捐报备时间为每日14:00-次日02:00' });
}

const scheduledDate = scheduled_start_time.split(' ')[0];
const scheduledHour = parseInt(scheduled_start_time.substring(11, 13));
const nowDate = now.split(' ')[0];

// 计算"今天"的日期（跨凌晨时，00-02点属于前一天的窗口）
let windowBaseDate = nowDate;
if (nowHour < 3) {
    // 凌晨00:00-02:59，窗口属于前一天14:00开始的
    const yesterday = new Date(nowDate + 'T00:00:00+08:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    windowBaseDate = `${y}-${m}-${d}`;
}

if (scheduledDate === windowBaseDate) {
    // 选择的是窗口当天的日期，小时必须在14-23
    if (scheduledHour < 14) {
        return res.status(400).json({ error: '预约时间必须在当日14:00-次日02:00范围内' });
    }
} else {
    // 选择的是次日的日期，小时必须在0-2
    const nextDate = new Date(windowBaseDate + 'T00:00:00+08:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    const expectedNextDate = `${ny}-${nm}-${nd}`;

    if (scheduledDate !== expectedNextDate) {
        return res.status(400).json({ error: '预约日期超出可预约范围' });
    }
    if (scheduledHour > 2) {
        return res.status(400).json({ error: '预约时间必须在当日14:00-次日02:00范围内' });
    }
}

// 校验：不能早于当前时间
if (scheduled_start_time < now) {
    return res.status(400).json({ error: '预约时间不能早于当前时间' });
}
```

#### 2.2 替换原有时间校验

**删除**原有的时间校验代码（"校验：必须在未来"部分），用上面的窗口校验替换。

---

### 3. 后端 lejuan-timer.js — 定时器恢复范围

#### 3.1 recoverTimers 修复

将 `datetime(?, '+1 hours')` 替换为 `TimeUtil.offsetDB(1)`：

```javascript
// 修改前:
const pendingRecords = await all(`
    SELECT * FROM lejuan_records 
    WHERE lejuan_status = 'pending' 
        AND scheduled_start_time <= datetime(?, '+1 hours')
    ORDER BY scheduled_start_time
`, [now]);

// 修改后:
const cutoffTime = TimeUtil.offsetDB(1);
const pendingRecords = await all(`
    SELECT * FROM lejuan_records 
    WHERE lejuan_status = 'pending' 
        AND scheduled_start_time <= ?
    ORDER BY scheduled_start_time
`, [cutoffTime]);
```

#### 3.2 pollCheck 修复

同样替换 `datetime(?, '+1 minutes')`：

```javascript
// 修改前:
const missedRecords = await all(`
    SELECT * FROM lejuan_records 
    WHERE lejuan_status = 'pending' 
        AND scheduled = 0
        AND scheduled_start_time <= datetime(?, '+1 minutes')
    ORDER BY scheduled_start_time
`, [now]);

// 修改后:
const pollCutoff = TimeUtil.offsetDB(1 / 60); // 1分钟后
const missedRecords = await all(`
    SELECT * FROM lejuan_records 
    WHERE lejuan_status = 'pending' 
        AND scheduled = 0
        AND scheduled_start_time <= ?
    ORDER BY scheduled_start_time
`, [pollCutoff]);
```

---

## 边界情况处理

| 当前时间 | hourOptions | 说明 |
|----------|-------------|------|
| 14:01 | 14:00~次日02:00 (13个) | 完整窗口 |
| 18:30 | 18:00~次日02:00 (9个) | 过滤掉过去小时 |
| 23:01 | 23:00, 次日00:00, 次日01:00, 次日02:00 (4个) | 跨天 |
| 00:30 | 00:00, 01:00, 02:00 (3个) | 凌晨时段 |
| 03:00 | [] (空) | 不在窗口内，显示提示 |
| 10:00 | 14:00~次日02:00 (13个) | 窗口未到，但全部可选 |
| 13:59 | 14:00~次日02:00 (13个) | 即将开放 |

---

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `tgservice-uniapp/src/pages/internal/lejuan.vue` | 修改 | hourOptions 计算、onHourChange、form 字段、submit 逻辑、模板、样式 |
| `tgservice/backend/routes/lejuan-records.js` | 修改 | POST路由中新增窗口校验，替换原有时间校验 |
| `tgservice/backend/services/lejuan-timer.js` | 修改 | recoverTimers 和 pollCheck 中的 SQL datetime 替换为 TimeUtil |

---

## 编码规范合规检查

| 规范项 | 合规情况 |
|--------|----------|
| 后端时间处理 | ✅ 使用 `TimeUtil.nowDB()`, `TimeUtil.offsetDB()` |
| 前端时间处理 | ✅ 使用 `getBeijingDate()`, `new Date(str + '+08:00')` |
| 数据库连接 | ✅ 使用 `require('../db/index')` 的 `all/get/enqueueRun/runInTransaction` |
| 数据库写入 | ✅ 使用 `runInTransaction` / `enqueueRun`，无裸事务 |
| 禁止 datetime('now') | ✅ timer.js 中两处替换为 TimeUtil |
| 禁止手动时区偏移 | ✅ 无 `getTime() + 8*60*60*1000` 类写法 |

```

## 审计检查清单
# 代码审计检查清单

## 编码规范检查（自动化）

运行 `check-style.js` 脚本，检查：

| 规则ID | 检查项 | 禁止 | 必须 |
|--------|--------|------|------|
| TIME | 时间处理 | `datetime('now')`、手动时区偏移 | `TimeUtil` |
| DB_CONN | 数据库连接 | `new sqlite3.Database()` | `db/index.js` |
| DB_WRITE | 数据库写入 | 裸开事务 | `writeQueue` |

## 人工审计检查项

### 逻辑正确性

- [ ] API路径、方法、参数与设计方案一致
- [ ] 数据库字段名、类型与设计一致
- [ ] 业务逻辑分支完整（if/else覆盖所有情况）
- [ ] 边界值处理（空值、最大值、最小值）

### 安全性

- [ ] 输入验证（参数类型、长度、范围）
- [ ] SQL注入防护（参数化查询）
- [ ] 权限校验（用户身份验证）

### 错误处理

- [ ] API错误有明确的错误码和消息
- [ ] 数据库操作有try/catch
- [ ] 异常情况有fallback处理

### 代码质量

- [ ] 变量命名清晰
- [ ] 函数单一职责
- [ ] 无死代码（未使用的变量/函数）
- [ ] Git提交信息描述清晰

### 前后端一致性

- [ ] API请求/响应格式前后端匹配
- [ ] 前端字段名与后端返回一致
- [ ] 错误处理前后端对齐


## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题（对应检查清单的哪些项）
3. 如果通过，提取设计摘要（改了什么文件、新增什么API、数据表变更等）

这是第 1/3 次审计。
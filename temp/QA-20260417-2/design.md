# QA-20260417-2 乐捐预约时间窗口变更设计

## 变更概述

乐捐报备预约时间窗口从 **"当日14:00 ~ 次日02:00"（13个整点）** 改为 **"当日14:00 ~ 次日01:00"（12个整点）**。

只需将次日02:00从可选范围中移除，其他逻辑不变。

---

## 变更文件清单

| 序号 | 文件 | 变更类型 |
|------|------|----------|
| 1 | `/TG/tgservice-uniapp/src/pages/internal/lejuan.vue` | 前端 hourOptions 计算 |
| 2 | `/TG/tgservice/backend/routes/lejuan-records.js` | 后端 validateLejuanTime 校验 + 错误消息 |
| 3 | `/TG/tgservice/backend/services/lejuan-timer.js` | 定时器恢复/轮询范围 |

---

## 详细修改方案

### 1. 前端 `lejuan.vue` — hourOptions 计算

**位置**: `const hourOptions = computed(() => { ... })` 共 3 处数字 `2` 改为 `1`

#### 修改 1.1：凌晨窗口边界 (行约 53-56)

```diff
- // 00:00 ~ 02:59: 窗口末尾，从当前小时到 02:00
- if (h >= 0 && h <= 2) {
+ // 00:00 ~ 01:59: 窗口末尾，从当前小时到 01:00
+ if (h >= 0 && h <= 1) {
    const opts = []
-   for (let i = h; i <= 2; i++) opts.push(i)
+   for (let i = h; i <= 1; i++) opts.push(i)
    return opts
  }
```

#### 修改 1.2：窗口未到，预定义选项数组 (行约 59-61)

```diff
  // 03:00 ~ 13:59: 窗口未到，显示全部选项（允许提前预约）
  if (h >= 3 && h < 14) {
-   return [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2]
+   return [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1]
  }
```

#### 修改 1.3：窗口进行中，末尾追加 (行约 64-66)

```diff
  // 14:00 ~ 23:59: 从当前小时到次日 01:00
  const opts = []
  for (let i = h; i <= 23; i++) opts.push(i)
- opts.push(0, 1, 2)
+ opts.push(0, 1)
  return opts
```

**影响**: 用户在前端选择器中不再看到 `02:00` 选项。

---

### 2. 后端 `lejuan-records.js` — 时间校验

#### 修改 2.1：validateLejuanTime 小时窗口校验 (行约 24)

```diff
- // 校验2: 小时必须在窗口内 (14~23 或 0~2)
- if (schedHour >= 3 && schedHour <= 13) {
+ // 校验2: 小时必须在窗口内 (14~23 或 0~1)
+ if (schedHour >= 2 && schedHour <= 13) {
    return { valid: false, error: '乐捐报备时间为每日14:00-次日02:00，请选择有效时段' };
  }
```

**说明**: `schedHour >= 2` 意味着 hour=2 被拒绝（原条件 `>= 3` 允许 hour=2 通过）。

#### 修改 2.2：错误消息文案

```diff
- return { valid: false, error: '乐捐报备时间为每日14:00-次日02:00，请选择有效时段' };
+ return { valid: false, error: '乐捐报备时间为每日14:00-次日01:00，请选择有效时段' };
```

#### 修改 2.3：pending-timers 查询范围 (行约 229)

```diff
  const records = await all(`
      SELECT * FROM lejuan_records 
      WHERE lejuan_status = 'pending'
-         AND scheduled_start_time <= datetime(?, '+13 hours')
+         AND scheduled_start_time <= datetime(?, '+12 hours')
      ORDER BY scheduled_start_time
  `, [now]);
```

---

### 3. 后端 `lejuan-timer.js` — 定时器恢复/轮询

#### 修改 3.1：recoverTimers 恢复范围 (行约 75)

```diff
  const pendingRecords = await all(`
      SELECT * FROM lejuan_records 
      WHERE lejuan_status = 'pending' 
          AND scheduled_start_time <= datetime(?, '+13 hours')
      ORDER BY scheduled_start_time
  `, [now]);
```

改为：

```diff
  const pendingRecords = await all(`
      SELECT * FROM lejuan_records 
      WHERE lejuan_status = 'pending' 
          AND scheduled_start_time <= datetime(?, '+12 hours')
      ORDER BY scheduled_start_time
  `, [now]);
```

#### 修改 3.2：pollCheck 轮询范围 (行约 99)

```diff
  const missedRecords = await all(`
      SELECT * FROM lejuan_records 
      WHERE lejuan_status = 'pending' 
          AND scheduled = 0
          AND scheduled_start_time <= datetime(?, '+13 hours')
      ORDER BY scheduled_start_time
  `, [now]);
```

改为：

```diff
  const missedRecords = await all(`
      SELECT * FROM lejuan_records 
      WHERE lejuan_status = 'pending' 
          AND scheduled = 0
          AND scheduled_start_time <= datetime(?, '+12 hours')
      ORDER BY scheduled_start_time
  `, [now]);
```

---

## 变更汇总

| 文件 | 变更点 | 旧值 | 新值 |
|------|--------|------|------|
| lejuan.vue | hourOptions 凌晨边界 | `h <= 2` | `h <= 1` |
| lejuan.vue | hourOptions 凌晨循环 | `i <= 2` | `i <= 1` |
| lejuan.vue | hourOptions 预定义数组 | `..., 0, 1, 2]` | `..., 0, 1]` |
| lejuan.vue | hourOptions 末尾追加 | `push(0, 1, 2)` | `push(0, 1)` |
| lejuan-records.js | validateLejuanTime 小时拒绝范围 | `>= 3 && <= 13` | `>= 2 && <= 13` |
| lejuan-records.js | 错误消息 | `次日02:00` | `次日01:00` |
| lejuan-records.js | pending-timers 查询范围 | `+13 hours` | `+12 hours` |
| lejuan-timer.js | recoverTimers 范围 | `+13 hours` | `+12 hours` |
| lejuan-timer.js | pollCheck 范围 | `+13 hours` | `+12 hours` |

**总计**: 2个文件，9处修改（4处前端数字、3处后端SQL、1处后端校验条件、1处错误消息文案）。

---

## 验证要点

1. **前端验证**：00:00时选择器显示 `[00:00, 01:00]` 两个选项
2. **前端验证**：01:00时选择器显示 `[01:00]` 一个选项
3. **前端验证**：14:00时选择器显示 `14:00 ~ 23:00, 次日00:00, 次日01:00` 共12个选项
4. **前端验证**：不再出现 `02:00` 选项
5. **后端验证**：提交 02:00 的时间应被拒绝，返回新错误消息
6. **后端验证**：提交 01:00 的时间应正常通过校验
7. **后端验证**：服务重启后恢复范围不超过未来12小时

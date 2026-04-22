# Bug 修复记录：门迎排序 batchRank TypeError

## Bug 描述
在 `batchRank` 方法中，SQL 查询使用了 `get` 方法（返回单行对象），但代码期望的是 `rows` 数组（所有行），导致 `for (const row of rows)` 报错：`TypeError: rows is not iterable`。

## 修复内容

### 文件：`/TG/tgservice/backend/services/guest-ranking-service.js`

**修改 1：导入语句**
```diff
- const { get, runInTransaction, enqueueRun } = require('../db');
+ const { get, all, runInTransaction, enqueueRun } = require('../db');
```

**修改 2：batchRank 方法中的 SQL 查询（约第 145 行）**
```diff
- const rows = await get(`
+ const rows = await all(`
    SELECT wb.coach_no, wb.clock_in_time
    FROM water_boards wb
    WHERE wb.status IN (${placeholders})
    ORDER BY wb.clock_in_time DESC
  `, [...statusList]);
```

### 原因分析
- `get()` → 返回单行对象 `{ coach_no: '...', clock_in_time: '...' }`
- `all()` → 返回数组 `[{ coach_no: '...' }, { coach_no: '...' }]`
- `batchRank` 需要遍历所有匹配记录，必须使用 `all()`

## Git 提交
```
commit: 2fee799
message: "fix: batchRank SQL查询改用all方法"
```

## PM2 重启
- 命令：`pm2 restart tgservice-dev`
- 状态：✅ 重启成功，服务 online

## 修复时间
2026-04-22 10:06

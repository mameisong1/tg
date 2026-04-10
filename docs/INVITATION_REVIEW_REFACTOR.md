# 约客审查改造方案

> 更新时间：2026-04-10

---

## 一、改造目标

1. 前端 H5 约客审查页面标题改为「今日约客审查-早班/晚班」
2. 新增时间限制提示（早班16:00后、晚班20:00后开始审查）
3. 后端增加审查时间校验（早班16:00前、晚班20:00前审查当日数据报错）
4. 在审查页面新增「开始审查」按钮，点击确定应约客人员
5. 删除独立的约客统计页面，统计功能整合到审查页面

---

## 二、时间限制规则

### 2.1 提交约客记录时间窗口

| 班次 | 提交窗口 | 说明 |
|------|----------|------|
| 早班 | 14:00 - 18:00 | 16点前后2小时 |
| 晚班 | 18:00 - 22:00 | 20点前后2小时 |

### 2.2 开始审查时间

| 班次 | 开始审查时间 | 说明 |
|------|-------------|------|
| 早班 | ≥ 16:00 | 16点后才能审查当日数据 |
| 晚班 | ≥ 20:00 | 20点后才能审查当日数据 |

---

## 三、数据库设计

使用现有约客结果表 `guest_invitation_results`：

```sql
CREATE TABLE IF NOT EXISTS guest_invitation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- 日期 YYYY-MM-DD
  shift TEXT NOT NULL,                   -- 班次：早班/晚班
  coach_no TEXT NOT NULL,                -- 助教编号
  stage_name TEXT,                       -- 艺名
  invitation_image_url TEXT,             -- 约客截图
  result TEXT NOT NULL DEFAULT '待审查', -- 结果：应约客/待审查/约客有效/约客无效
  reviewed_at DATETIME,                  -- 审查时间
  reviewer_phone TEXT,                   -- 审查人手机号
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, shift, coach_no)          -- 每日每班每人唯一
);
```

---

## 四、应约客人员确定逻辑

### 4.1 简化处理

**用户要求**：只要提交了约客记录的，都当做应约客对象。不用考虑开始审查时是否在空闲状态。

### 4.2 点击「开始审查」流程

```
1. 检查时间限制（早班≥16:00，晚班≥20:00）
2. 检查是否已锁定（防止重复锁定）
3. 获取当日当班次所有已提交记录的助教
4. 写入 guest_invitation_results，result='应约客'
5. 返回锁定结果
```

---

## 五、统计算法

| 统计项 | 计算规则 |
|--------|----------|
| **应约客人数** | `result IN ('应约客', '待审查', '约客有效', '约客无效')` 的总数 |
| **已约客人数** | `result IN ('待审查', '约客有效', '约客无效')` 的总数 |
| **未约客助教** | `result='应约客' AND invitation_image_url IS NULL` 的列表 |
| **无效约客** | `result='约客无效'` 的列表 |

---

## 六、改造文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `invitation-review.vue` | 改造 | 标题、提示、按钮、统计 |
| `invitation-stats.vue` | 删除 | 功能整合到审查页面 |
| `pages.json` | 修改 | 移除 stats 路由 |
| `guest-invitations.js` | 改造 | 时间校验、统计算法 |
| `init-db.js` | 修改 | 新增表结构 |

---

## 七、API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/guest-invitations/lock-should-invite` | POST | 锁定应约客人员 |
| `/api/guest-invitations` | GET | 获取约客记录列表 |
| `/api/guest-invitations/:id/review` | PUT | 审查约客记录 |
| `/api/guest-invitations/statistics/:date/:shift` | GET | 获取统计数据（实时计算） |
| `/api/guest-invitations` | POST | 提交约客记录（时间窗口校验） |

---

## 八、前端页面改造详情

### 8.1 标题

```
旧：约客审查-早班
新：今日约客审查-早班
```

### 8.2 提示文案

```
早班约客审查需在16:00后开始
晚班约客审查需在20:00后开始
```

### 8.3 新增「开始审查」按钮

- 点击调用 `POST /api/guest-invitations/lock-should-invite`
- 显示锁定结果（应约客人数）
- 锁定后按钮隐藏或禁用

### 8.4 统计模块（替代 stats 页面）

```
┌─────────────────────────────────────┐
│  应约客: 20人  │  已约客: 15人       │
├─────────────────────────────────────┤
│  无效约客: 3人  │  未约客: 5人        │
└─────────────────────────────────────┘

无效约客列表：
- 小美 (1001)
- ...

未约客列表：
- 小红 (1005)
- ...
```

---

## 九、测试环境

- 前端：`npm run build:h5:dev` + `pm2 restart tgservice-uniapp-dev`
- 后端：`pm2 restart tgservice-dev`
- 域名：`tg.tiangong.club`

---

*文档版本：v1.0*
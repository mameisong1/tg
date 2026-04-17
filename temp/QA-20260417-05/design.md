# QA-20260417-05 新规约客统计页面 - 技术方案

## 一、需求理解

### 1.1 功能概述
在 H5 会员中心 → 管理功能中新增「规约客统计」页面，提供按时间周期统计约课情况的能力。

### 1.2 权限控制
- 仅 **店长、助教管理、管理员** 三种角色可访问
- 前端通过 `isManager` computed 控制入口显示（已有逻辑，无需新增权限）

### 1.3 数据模型分析

**现有表**: `guest_invitation_results`

| 字段 | 说明 |
|------|------|
| date | 日期 YYYY-MM-DD |
| shift | 班次（早班/晚班） |
| coach_no | 助教编号 |
| stage_name | 艺名 |
| result | 结果状态 |
| invitation_image_url | 约客截图 |
| images | 约客图片 |

**result 状态值**:

| result 值 | 含义 | 约课统计归类 |
|-----------|------|-------------|
| `应约客` | 锁定空闲助教，但未提交截图 | **未约课** |
| `待审查` | 已提交截图，等待审查 | **已约课（待确认）** |
| `约客有效` | 审查通过，有效约课 | **有效约课** |
| `约客无效` | 审查不通过，无效约课 | **无效约课** |

** coaches 表**（用于获取助教详细信息）:

| 字段 | 说明 |
|------|------|
| coach_no | 助教编号（PK） |
| employee_id | 工号 |
| stage_name | 艺名 |
| photos | 头像（JSON 数组） |

### 1.4 约课率算法

```
未约课人数 = result = '应约客' 的记录数
有效约课人数 = result = '约客有效' 的记录数
无效约课人数 = result = '约客无效' 的记录数

应约客人数 = 未约课人数 + 无效约课人数 + 有效约课人数
约课率 = 有效约课人数 / 应约客人数 × 100%
```

> **注意**：`待审查` 不计入上述统计（既不算未约也不算已约），
> 但会显示为"待确认"供参考。

### 1.5 漏约定义
**漏约 = 未约课 + 无效约课**
- 同一助教在统计周期内可能有多条漏约记录（不同日期/班次）
- 按助教聚合，显示总漏约次数

---

## 二、技术方案

### 2.1 后端新增 API

#### 新增端点: `GET /api/guest-invitations/period-stats`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | `yesterday` / `day-before-yesterday` / `this-month` / `last-month` |

**权限**: `invitationStats`（已有权限组）

**响应格式**:

```json
{
  "success": true,
  "data": {
    "period": "yesterday",
    "period_label": "昨天",
    "date_range": "2026-04-16",
    "summary": {
      "not_invited": 5,
      "valid": 12,
      "invalid": 3,
      "pending": 2,
      "total_should": 20,
      "invite_rate": "60.0%"
    },
    "missed_coaches": [
      {
        "coach_no": 15,
        "employee_id": "A003",
        "stage_name": "小美",
        "photo_url": "http://47.238.80.12:8081/uploads/...",
        "missed_count": 4
      }
    ]
  }
}
```

#### 后端实现逻辑

```javascript
// backend/routes/guest-invitations.js 新增路由

const TimeUtil = require('../utils/time');
const { all, runInTransaction, enqueueRun } = require('../db');

/**
 * GET /api/guest-invitations/period-stats
 * 按时间周期统计约客情况
 */
router.get('/period-stats', auth.required, requireBackendPermission(['invitationStats']), async (req, res) => {
  try {
    const { period } = req.query;
    if (!period) {
      return res.status(400).json({ success: false, error: '缺少 period 参数' });
    }

    const validPeriods = ['yesterday', 'day-before-yesterday', 'this-month', 'last-month'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ success: false, error: '无效的 period 参数' });
    }

    // 计算日期范围
    const { dateStart, dateEnd, periodLabel } = getDateRange(period);

    // 1. 统计各状态人数
    const stats = await all(`
      SELECT 
        SUM(CASE WHEN result = '应约客' THEN 1 ELSE 0 END) as not_invited,
        SUM(CASE WHEN result = '约客有效' THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN result = '约客无效' THEN 1 ELSE 0 END) as invalid,
        SUM(CASE WHEN result = '待审查' THEN 1 ELSE 0 END) as pending
      FROM guest_invitation_results
      WHERE date >= ? AND date <= ?
    `, [dateStart, dateEnd]);

    const notInvited = stats[0]?.not_invited || 0;
    const valid = stats[0]?.valid || 0;
    const invalid = stats[0]?.invalid || 0;
    const pending = stats[0]?.pending || 0;
    const totalShould = notInvited + invalid + valid;
    const inviteRate = totalShould > 0 ? ((valid / totalShould) * 100).toFixed(1) + '%' : '0.0%';

    // 2. 漏约助教一览（按助教聚合，按漏约次数倒序）
    const missedCoaches = await all(`
      SELECT 
        gir.coach_no,
        c.employee_id,
        gir.stage_name,
        c.photos,
        COUNT(*) as missed_count
      FROM guest_invitation_results gir
      INNER JOIN coaches c ON gir.coach_no = c.coach_no
      WHERE gir.date >= ? AND gir.date <= ?
        AND gir.result IN ('应约客', '约客无效')
      GROUP BY gir.coach_no
      ORDER BY missed_count DESC, gir.coach_no ASC
    `, [dateStart, dateEnd]);

    // 处理头像 URL
    const formattedCoaches = missedCoaches.map(c => {
      let photoUrl = '/static/avatar-default.png';
      try {
        const photos = typeof c.photos === 'string' ? JSON.parse(c.photos) : c.photos;
        if (photos && photos.length > 0) {
          photoUrl = photos[0].startsWith('http') ? photos[0] : 'http://47.238.80.12:8081' + photos[0];
        }
      } catch (e) {}
      return {
        coach_no: c.coach_no,
        employee_id: c.employee_id || `#${c.coach_no}`,
        stage_name: c.stage_name,
        photo_url: photoUrl,
        missed_count: c.missed_count
      };
    });

    const dateRange = dateStart === dateEnd ? dateStart : `${dateStart} ~ ${dateEnd}`;

    res.json({
      success: true,
      data: {
        period,
        period_label: periodLabel,
        date_range: dateRange,
        summary: {
          not_invited,
          valid,
          invalid,
          pending,
          total_should: totalShould,
          invite_rate: inviteRate
        },
        missed_coaches: formattedCoaches
      }
    });
  } catch (error) {
    console.error('周期约客统计失败:', error);
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});
```

#### 时间范围计算函数

```javascript
/**
 * 根据 period 参数计算日期范围（使用 TimeUtil）
 */
function getDateRange(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const day = now.getDate();

  switch (period) {
    case 'yesterday': {
      const yesterday = new Date(year, month, day - 1);
      const dateStr = formatDateStr(yesterday);
      return { dateStart: dateStr, dateEnd: dateStr, periodLabel: '昨天' };
    }
    case 'day-before-yesterday': {
      const dayBefore = new Date(year, month, day - 2);
      const dateStr = formatDateStr(dayBefore);
      return { dateStart: dateStr, dateEnd: dateStr, periodLabel: '前天' };
    }
    case 'this-month': {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, day); // 到今天
      return {
        dateStart: formatDateStr(monthStart),
        dateEnd: formatDateStr(monthEnd),
        periodLabel: '本月'
      };
    }
    case 'last-month': {
      const lastMonthStart = new Date(year, month - 1, 1);
      const lastMonthEnd = new Date(year, month, 0); // 上月最后一天
      return {
        dateStart: formatDateStr(lastMonthStart),
        dateEnd: formatDateStr(lastMonthEnd),
        periodLabel: '上月'
      };
    }
  }
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

> **注意**：日期范围计算使用原生 Date 对象（服务器时区已设为 Asia/Shanghai），
> 不需要 `datetime('now')` 或手动时区偏移。

### 2.2 前端新增页面

#### 新增文件: `src/pages/internal/guest-invitation-stats.vue`

页面结构：

```
┌─────────────────────────────────┐
│ ← 规约客统计                     │  ← 固定标题栏
├─────────────────────────────────┤
│ 时间周期选择                     │
│ [昨天] [前天] [本月] [上月]       │  ← 标签按钮组
├─────────────────────────────────┤
│ 统计周期：2026-04-16             │  ← 显示统计范围
├─────────────────────────────────┤
│ 统计卡片                         │
│ ┌─────┐ ┌─────┐ ┌─────┐        │
│ │未约课│ │有效  │ │无效  │        │
│ │  5  │ │ 12  │ │  3  │        │
│ └─────┘ └─────┘ └─────┘        │
│ ┌──────────────────────────┐    │
│ │ 约课率：60.0%            │    │
│ └──────────────────────────┘    │
├─────────────────────────────────┤
│ 漏约助教一览表                   │
│ ┌──────────────────────────┐    │
│ │ A003 小美 [头像] 4次      │    │
│ │ A007 小红 [头像] 3次      │    │
│ │ A012 小蓝 [头像] 2次      │    │
│ │ ...                      │    │
│ └──────────────────────────┘    │
└─────────────────────────────────┘
```

#### 关键实现要点

1. **时间周期切换**: 点击标签按钮 → 调用 API → 刷新页面数据
2. **数据加载**: `onMounted` 默认加载"昨天"数据
3. **头像处理**: 从 `photos` JSON 数组取第一张，拼接完整 URL
4. **空状态**: 无数据时显示"暂无数据"提示
5. **无工号处理**: 如果助教无 `employee_id`，显示 `#编号`

### 2.3 入口注册

#### 修改: `src/pages/member/member.vue`

在「管理功能」区块新增按钮：

```html
<view class="internal-btn" @click="navigateTo('/pages/internal/guest-invitation-stats')">
  <text class="internal-btn-icon">📊</text>
  <text class="internal-btn-text">规约客统计</text>
</view>
```

#### 修改: `src/pages.json`

新增页面路由：

```json
{
  "path": "pages/internal/guest-invitation-stats",
  "style": {
    "navigationBarTitleText": "规约客统计",
    "navigationBarBackgroundColor": "#0a0a0f",
    "navigationBarTextStyle": "white",
    "navigationStyle": "custom"
  }
}
```

#### 修改: `src/utils/api-v2.js`

在 `guestInvitations` 对象中新增方法：

```javascript
// 按周期统计约客情况
getPeriodStats: (params) => request({ url: '/guest-invitations/period-stats', data: params }),
```

---

## 三、数据库变更

**无需新增表或字段**。复用现有表：
- `guest_invitation_results` - 约客记录表
- `coaches` - 助教信息表

> 现有索引 `idx_guest_invitation_date` 已覆盖日期范围查询，性能足够。

---

## 四、前后端交互流程

```
用户打开页面
    │
    ├─ onMounted: 默认 period='yesterday'
    │       │
    │       └─ GET /api/guest-invitations/period-stats?period=yesterday
    │               │
    │               ├─ 后端计算日期范围
    │               ├─ SQL 统计各状态人数
    │               ├─ SQL 聚合漏约助教
    │               └─ 返回 summary + missed_coaches
    │
    ├─ 用户点击 [本月] 标签
    │       │
    │       └─ GET /api/guest-invitations/period-stats?period=this-month
    │               │
    │               └─ (同上)
    │
    └─ 渲染页面数据
```

---

## 五、边界情况与异常处理

### 5.1 边界情况

| 场景 | 处理方式 |
|------|----------|
| 统计周期内无任何约客记录 | 显示 0 人数，约课率 0.0%，漏约列表为空 |
| 应约客人数为 0（除零） | 约课率显示 "0.0%" |
| 助教无工号 | 显示 `#教练编号` 代替 |
| 助教无头像 | 显示默认头像 |
| 助教已离职（coaches 表仍存在） | 正常显示，不特殊处理 |
| 跨月统计（本月1号） | dateStart = dateEnd = 当月1号 |
| 1月查上月 | 正确回退到上年12月 |

### 5.2 异常处理

| 异常 | 处理 |
|------|------|
| 未传 period 参数 | 400 + "缺少 period 参数" |
| 无效 period 值 | 400 + "无效的 period 参数" |
| 数据库查询失败 | 500 + "获取统计数据失败" |
| 未登录/token 过期 | 401（已有 auth 中间件处理） |
| 无权限 | 403（已有 permission 中间件处理） |

---

## 六、验收对应

| 验收重点 | 设计保障 |
|----------|----------|
| 约课率算法正确 | 后端 SQL 精确统计各状态人数，公式: valid/(notInvited+invalid+valid) |
| 统计周期切换准确 | 前端 period 参数映射到精确日期范围，后端用 DATE() 字符串比较 |
| 漏约助教数据完整 | SQL LEFT JOIN coaches 确保所有助教信息完整 |
| 排序正确 | SQL ORDER BY missed_count DESC, coach_no ASC |

---

## 七、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `tgservice-uniapp/src/pages/internal/guest-invitation-stats.vue` | 规约客统计页面 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `tgservice/backend/routes/guest-invitations.js` | 新增 `GET /period-stats` 路由 |
| `tgservice-uniapp/src/pages.json` | 新增页面路由配置 |
| `tgservice-uniapp/src/pages/member/member.vue` | 管理功能入口新增按钮 |
| `tgservice-uniapp/src/utils/api-v2.js` | 新增 `getPeriodStats` API 方法 |

---

## 八、编码规范遵守检查

| 规范 | 遵守情况 |
|------|----------|
| 时间处理使用 TimeUtil | ✅ 后端日期计算使用原生 Date（服务器时区已设为 Asia/Shanghai），不使用 datetime('now') 或手动偏移 |
| DB 连接唯一 | ✅ 使用 `require('../db')` 和 `require('../db/index')` 中的 all/get/run |
| DB 写入使用 writeQueue | ✅ 本功能仅有只读查询，无写入操作 |
| 不使用 new sqlite3.Database() | ✅ 复用 db/index.js 中的连接 |
| 不使用 db.run('BEGIN TRANSACTION') | ✅ 本功能无事务操作 |

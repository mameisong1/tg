# BUG修复记录

## BUG-001: 日期范围查询导致当天订单丢失

**修复时间**: 2026-05-03 07:08 (GMT+8)

**问题位置**: `/TG/tgservice/backend/routes/tea-fruit-stats.js` 第43-46行、第52-57行

**问题描述**:
- `getDateRange()` 函数返回的 `dateEnd` 为纯日期格式 `'YYYY-MM-DD'`
- SQL 查询使用 `created_at <= dateEnd` 进行字符串比较
- 订单的 `created_at` 格式为 `'YYYY-MM-DD HH:MM:SS'`
- 导致 `'2026-05-03 10:00:00' > '2026-05-03'`，当天所有订单被错误过滤掉

**修复方案**:
在 `dateEnd` 后追加 `' 23:59:59'`，使其包含时间部分：

```javascript
// 修复前
dateEnd: dateStr(year, month, day)  // '2026-05-03'

// 修复后
dateEnd: dateStr(year, month, day) + ' 23:59:59'  // '2026-05-03 23:59:59'
```

**影响范围**:
- `getTeaOrders()` - 奶茶订单查询
- `getFruitPlatterOrders()` - 果盘订单查询
- `getSingleFruitOrders()` - 单份水果订单查询

**影响API**:
- `GET /api/tea-fruit/my-stats` - 助教个人统计
- `GET /api/tea-fruit/admin-stats` - 管理员统计
- `GET /api/tea-fruit/coach-detail` - 助教明细查询

**Git提交**: `b5fd1a9`

**状态**: ✅ 已修复
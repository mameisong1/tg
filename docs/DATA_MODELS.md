# 天宫国际 - 数据模型文档

## 数据库概述

- **数据库类型**: SQLite
- **数据库文件**: `/TG/tgservice/db/tgservice.db`
- **ORM/驱动**: sqlite3 (Node.js)
- **连接中心**: `/TG/tgservice/backend/db/index.js`（唯一数据库连接）

> **2026-04-12 变更**：采用单连接架构，所有路由和 server.js 都从 `db/index.js` 获取连接，消除多连接竞争。
> 配置：WAL 模式 + synchronous=NORMAL + busy_timeout=3000ms + writeQueue 写串行化。

---

## 时间与时区规范

### 存储格式

- **数据库所有时间字段**（`created_at`、`updated_at` 等）统一存储为 **北京时间**（Asia/Shanghai, UTC+8）
- **格式**：`YYYY-MM-DD HH:MM:SS`（纯文本，无时区标记）
- **示例**：`2026-04-14 08:30:00`（表示北京时间 8:30）

### 时间生成

- **禁止**在 SQL 中使用 `datetime('now')` 或 `datetime('now', 'localtime')`
- **统一**使用 Node.js 工具类生成时间，作为参数传入 SQL

```javascript
// 后端: backend/utils/time.js
const TimeUtil = require('./utils/time');
const time = TimeUtil.nowDB();       // "2026-04-14 08:30:00"
const time5hAgo = TimeUtil.offsetDB(-5);  // 5小时前
const today = TimeUtil.todayStr();   // "2026-04-14"
```

### 时间解析

- 数据库中的时间字符串解析为 JavaScript Date 时，**必须**显式指定 `+08:00` 时区：
```javascript
const d = new Date(dbTime + '+08:00');
```

### 历史数据

- **2026-04-14 数据迁移**：orders、service_orders、table_action_orders 三张表的存量 UTC 时间已统一转为北京时间
- 迁移后所有表时间字段均为北京时间，格式一致

### 容器时区

- Docker 容器环境变量：`TZ=Asia/Shanghai`
- 服务器时区：`Asia/Shanghai`（CST, UTC+8）

> **注意**：虽然容器和服务器时区已设为 Asia/Shanghai，但代码中所有时间操作仍通过工具类进行，
> 不依赖系统时区设置，确保在任何环境下行为一致。

---

## 数据表一览

| 表名 | 说明 | 主键 |
|------|------|------|
| `admin_users` | 后台管理员用户表 | username |
| `product_categories` | 商品分类表 | name |
| `products` | 商品表 | name |
| `coaches` | 助教表 | coach_no |
| `water_boards` | 水牌状态表 | coach_no |
| `carts` | 购物车表 | id (自增) |
| `orders` | 订单表 | id (自增) |
| `tables` | 台桌表 | id (自增) |
| `vip_rooms` | VIP包房表 | id (自增) |
| `home_config` | 首页配置表 | id (固定=1) |
| `members` | 会员表 | member_no |
| `sms_codes` | 短信验证码表 | id (自增) |
| `device_visits` | 设备访问记录表 | id (自增) |
| `lejuan_records` | 乐捐记录表（2026-04-15新增） | id (自增) |

---

## 表结构详情

### 1. admin_users - 后台管理员表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| username | TEXT | PRIMARY KEY | 用户名 |
| password | TEXT | NOT NULL | 密码（bcrypt加密） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**默认数据**:
- 用户名: `tgadmin`
- 密码: `mms633268` (已bcrypt加密存储)

---

### 2. product_categories - 商品分类表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| name | TEXT | PRIMARY KEY | 分类名称（如"饮料"、"零食"） |
| creator | TEXT | | 创建者 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

### 3. products - 商品表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| name | TEXT | PRIMARY KEY | 商品名称 |
| category | TEXT | FOREIGN KEY | 所属分类（关联product_categories.name） |
| image_url | TEXT | | 商品图片URL |
| price | REAL | DEFAULT 0 | 商品价格（元） |
| stock_total | INTEGER | DEFAULT 0 | 总库存 |
| stock_available | INTEGER | DEFAULT 0 | 可用库存 |
| status | TEXT | DEFAULT '上架' | 商品状态（上架/下架） |
| creator | TEXT | | 创建者 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**关联关系**: 
- `category` → `product_categories.name`

---

### 4. coaches - 助教表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| coach_no | TEXT | PRIMARY KEY | 助教工号（如"26"） |
| employee_id | TEXT | | 员工编号 |
| stage_name | TEXT | | 艺名（如"四瑶"） |
| real_name | TEXT | | 真实姓名 |
| phone | TEXT | UNIQUE | 手机号（用于H5登录识别员工身份） |
| id_card_last6 | TEXT | | 身份证后6位（用于登录） |
| level | TEXT | DEFAULT '初级' | 等级（女神/精英/初级） |
| price | REAL | DEFAULT 2.3 | 助教价格（元/小时或固定费用） |
| age | INTEGER | | 年龄 |
| height | INTEGER | | 身高（cm） |
| photos | TEXT | | 照片URL数组（JSON字符串） |
| video | TEXT | | 视频URL |
| intro | TEXT | | 个人介绍 |
| is_popular | INTEGER | DEFAULT 0 | 是否人气助教（0/1） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**photos字段格式示例**:
```json
["https://oss.xxx.com/coach1.jpg", "https://oss.xxx.com/coach2.jpg"]
```

**业务规则**:
- 助教登录凭证: `coach_no` + `id_card_last6`（身份证后6位）
- 第一张照片作为头像展示

---

### 4.5 water_boards - 水牌状态表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 水牌记录ID |
| coach_no | TEXT | NOT NULL, UNIQUE | 助教工号（关联coaches.coach_no） |
| stage_name | TEXT | NOT NULL | 助教艺名（冗余字段，便于查询） |
| status | TEXT | DEFAULT '下班' | 当前水牌状态 |
| table_no | TEXT | | 当前关联台桌号 |
| clock_in_time | DATETIME | | 上班时间（点上班时写入，下班时清空） |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 状态最后变更时间 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 记录创建时间 |

**状态枚举值**:
| 状态 | 说明 |
|------|------|
| 早班上桌 | 早班 + 已上桌 |
| 早班空闲 | 早班 + 空闲（点上班后进入此状态） |
| 晚班上桌 | 晚班 + 已上桌 |
| 晚班空闲 | 晚班 + 空闲（点上班后进入此状态） |
| 早加班 | 早班加班 |
| 晚加班 | 晚班加班 |
| 休息 | 休息 |
| 公休 | 公休 |
| 请假 | 请假 |
| 乐捐 | 乐捐 |
| 下班 | 已下班 |

**业务规则**:
- 创建助教时自动创建水牌记录，初始状态为 `下班`
- 点上班（POST `/api/coaches/:coach_no/clock-in`）：根据班次变为 `早班空闲` 或 `晚班空闲`，同时写入 `clock_in_time`
- 点下班（POST `/api/coaches/:coach_no/clock-out`）：状态变为 `下班`，清空 `clock_in_time`
- 手动更新状态（PUT `/api/water-boards/:coach_no/status`）：从非工作状态变为工作状态时写入 `clock_in_time`
- 上班时间记录：`clock_in_time` 用于前端水牌页面空闲状态按上班时间倒序排序

**关联关系**:
- `coach_no` → `coaches.coach_no`

---

### 5. carts - 购物车表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 购物车项ID |
| session_id | TEXT | NOT NULL | 会话ID（用于关联用户） |
| table_no | TEXT | | 台桌号（可选） |
| product_name | TEXT | NOT NULL | 商品名称 |
| quantity | INTEGER | DEFAULT 1 | 数量 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 添加时间 |

**业务规则**:
- `session_id` 用于匿名用户购物车关联
- 同一会话+同一商品会合并数量
- 提交订单后清空对应会话的购物车

---

### 6. orders - 订单表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 订单ID |
| order_no | TEXT | UNIQUE NOT NULL | 订单编号（如"TG20260321150000001"） |
| table_no | TEXT | | 台桌号 |
| items | TEXT | NOT NULL | 订单项（JSON字符串） |
| total_price | REAL | DEFAULT 0 | 订单总价 |
| status | TEXT | DEFAULT '待处理' | 订单状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**items字段格式示例**:
```json
[
  {"name": "可乐", "quantity": 2, "price": 5, "subtotal": 10},
  {"name": "薯片", "quantity": 1, "price": 8, "subtotal": 8}
]
```

**订单状态流转**:
```
待处理 → 已完成
     ↘ 已取消
```

**订单号规则**: `TG` + `yyyyMMddHHmmss` + `序号(3位)`

---

### 7. tables - 台桌表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 台桌ID |
| area | TEXT | NOT NULL | 区域（普台区/包厢区等） |
| name | TEXT | NOT NULL UNIQUE | 台桌名称（如"普台1"、"BOX1"） |
| name_pinyin | TEXT | UNIQUE | 台桌名称拼音（用于扫码URL） |
| status | TEXT | DEFAULT '空闲' | 台桌状态 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**台桌状态**:
- 空闲
- 计费中
- 暂停

**拼音生成规则**: 
- "普台1" → "putai1"
- "BOX1" → "box1"

---

### 8. vip_rooms - VIP包房表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 包房ID |
| name | TEXT | NOT NULL UNIQUE | 包房名称 |
| status | TEXT | DEFAULT '空闲' | 包房状态 |
| intro | TEXT | | 包房介绍 |
| photos | TEXT | | 照片URL数组（JSON字符串） |
| videos | TEXT | | 视频URL数组（JSON字符串） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**photos/videos字段格式示例**:
```json
["https://oss.xxx.com/room1.jpg", "https://oss.xxx.com/room2.jpg"]
```

---

### 9. home_config - 首页配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY CHECK (id = 1) | 固定ID=1（单例） |
| banner_image | TEXT | | Banner图片URL |
| banner_title | TEXT | DEFAULT '充值送台费活动' | Banner标题 |
| banner_desc | TEXT | DEFAULT '...' | Banner描述 |
| hot_products | TEXT | | 热门商品名称列表（JSON数组） |
| popular_coaches | TEXT | | 人气助教工号列表（JSON数组） |
| notice | TEXT | | 公告内容 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**业务规则**:
- 该表只有一条记录（id=1）
- 通过 `CHECK (id = 1)` 约束保证单例

**hot_products/popular_coaches格式**:
```json
["可乐", "薯片", "啤酒"]
["26", "18", "12"]
```

---

### 10. members - 会员表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| member_no | TEXT | PRIMARY KEY | 会员编号（如"TG000001"） |
| phone | TEXT | UNIQUE | 手机号 |
| openid | TEXT | UNIQUE | 微信openid |
| nickname | TEXT | | 昵称 |
| avatar | TEXT | | 头像URL |
| balance | REAL | DEFAULT 0 | 账户余额 |
| points | INTEGER | DEFAULT 0 | 积分 |
| level | TEXT | DEFAULT '普通会员' | 会员等级 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**会员编号规则**: `TG` + `6位序号`

**登录方式**:
1. 手机号 + 短信验证码
2. 微信小程序授权（通过openid匹配）

---

### 11. sms_codes - 短信验证码表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录ID |
| phone | TEXT | NOT NULL | 手机号 |
| code | TEXT | NOT NULL | 验证码（6位） |
| expired_at | DATETIME | NOT NULL | 过期时间 |
| used | INTEGER | DEFAULT 0 | 是否已使用（0/1） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**业务规则**:
- 验证码有效期: 5分钟
- 同一手机号60秒内不可重复发送
- 验证成功后标记为已使用

---

### 12. device_visits - 设备访问记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录ID |
| device_fp | TEXT | NOT NULL | 设备指纹 |
| visit_date | TEXT | NOT NULL | 访问日期（北京时间 `YYYY-MM-DD`） |
| first_visit_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 首次访问时间 |

**索引**：`idx_device_visits_date(visit_date)`  
**唯一约束**：`UNIQUE(device_fp, visit_date)`  
**用途**：设备访问统计、12 周趋势分析

⚠️ **注意**：`visit_date` 存储北京时间日期（非 UTC），由 `TimeUtil.todayStr()` 生成。2026-04-14 修复前使用 `toISOString()` 存 UTC 导致凌晨统计异常。

---

## 表关系图

```
┌──────────────────┐     ┌──────────────────┐
│ product_categories│←────│     products     │
│  (商品分类)        │     │    (商品)        │
└──────────────────┘     └──────────────────┘
                                  ↑
                                  │ 引用product_name
                                  │
                         ┌────────┴────────┐
                         │      carts      │
                         │   (购物车)       │
                         └────────┬────────┘
                                  │ 转化为订单
                                  ↓
                         ┌──────────────────┐
                         │     orders       │
                         │    (订单)        │
                         └────────┬────────┘
                                  │ 关联table_no
                                  ↓
┌──────────────────┐     ┌──────────────────┐
│     coaches      │     │     tables       │
│    (助教)         │     │    (台桌)        │
└──────────────────┘     └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│    vip_rooms     │     │    members       │
│   (VIP包房)       │     │    (会员)        │
└──────────────────┘     └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│   home_config    │     │  admin_users     │
│  (首页配置-单例)  │     │  (后台用户)       │
└──────────────────┘     └──────────────────┘
```

---

## 重要业务规则

### 1. 购物车→订单流程

```
1. 用户添加商品到购物车（carts表）
2. 用户选择/扫码绑定台桌（更新cart.table_no）
3. 用户提交订单:
   - 读取购物车内容
   - 创建订单记录（orders表）
   - 清空购物车
4. 后台处理订单:
   - 待处理 → 已完成/已取消
```

### 2. 助教登录验证

```
输入: coach_no (工号) + id_card_last6 (身份证后6位)
查询: SELECT * FROM coaches WHERE coach_no = ? AND id_card_last6 = ?
成功: 生成JWT token
```

### 3. 会员登录流程

```
短信登录:
1. POST /api/sms/send 发送验证码
2. POST /api/member/login-sms 验证登录
3. 新用户自动创建会员记录

微信登录:
1. 前端获取微信code和phoneCode
2. POST /api/member/login
3. 后端获取openid和手机号
4. 关联或创建会员记录
```

### 4. 首页配置（单例模式）

```sql
-- 首页配置表强制只有一条记录
CREATE TABLE home_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- 约束id必须为1
  ...
)
```

### 5. 台桌二维码扫码流程

```
1. 生成二维码URL: https://xxx.com/?t={name_pinyin}
2. 用户扫码打开小程序/H5
3. 前端解析URL参数t
4. 调用 GET /api/table/{pinyin} 获取台桌信息
5. 自动绑定台桌到购物车
```

---

## 数据初始化

运行初始化脚本:

```bash
cd /TG/tgservice/backend
node init-db.js
```

**初始化内容**:
1. 创建所有数据表
2. 导入默认管理员账号
3. 从 `/TG/data/taikeduo-products.json` 导入商品数据
4. 从 `/TG/data/taikeduo-tables.json` 导入台桌数据
5. 解析助教数据并导入

**防重复机制**:
- 脚本会检查是否已有数据，有则跳过导入
- 如需重新初始化，需先删除数据库文件

---

## SQLite特性说明

1. **日期时间**: 使用 `DATETIME` 类型，存储格式为 ISO 8601 字符串
2. **布尔值**: 使用 `INTEGER`，0表示false，1表示true
3. **JSON数组**: 以 `TEXT` 类型存储JSON字符串
4. **自增ID**: 使用 `INTEGER PRIMARY KEY AUTOINCREMENT`
5. **本地时间**: 使用 `datetime("now", "localtime")` 获取本地时间

---

## 2026-04-15 新增：lejuan_records 乐捐记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录ID |
| coach_no | TEXT | NOT NULL | 助教编号 |
| employee_id | TEXT | NOT NULL | 工号（冗余） |
| stage_name | TEXT | | 艺名（冗余） |
| scheduled_start_time | TEXT | NOT NULL | 预约开始时间（整点） |
| extra_hours | INTEGER | | 预计外出小时数 |
| remark | TEXT | | 备注 |
| lejuan_status | TEXT | DEFAULT 'pending' | pending/active/returned |
| scheduled | INTEGER | DEFAULT 0 | 0=未调度, 1=已调度 |
| actual_start_time | TEXT | | 实际开始时间 |
| return_time | TEXT | | 归来时间 |
| lejuan_hours | INTEGER | | 实际外出小时数（向上取整） |
| proof_image_url | TEXT | | 付款截图URL |
| proof_image_updated_at | TEXT | | 截图最后更新时间 |
| created_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TEXT | DEFAULT CURRENT_TIMESTAMP | 更新时间 |
| created_by | TEXT | | 操作人 |
| returned_by | TEXT | | 归来操作人 |

**索引**：
- `idx_lejuan_coach` ON (coach_no)
- `idx_lejuan_status` ON (lejuan_status)
- `idx_lejuan_scheduled` ON (scheduled_start_time)
- `idx_lejuan_status_time` ON (lejuan_status, scheduled_start_time)

**业务规则**：
- 助教预约乐捐，到时间自动变乐捐状态
- 定时器 + 启动恢复 + 每分钟轮询兜底
- 乐捐归来时计算外出小时数（向上取整）
- 近2天的乐捐记录可提交/修改付款截图

---

## 2026-04-15 变更：water_boards 表 table_no 字段

- **原**：单值 TEXT，存单个台桌号
- **现**：逗号分隔字符串，如 `"A1,A3,B2"`
- **辅助字段**：后端API返回时增加 `table_no_list` 数组字段（如 `["A1", "A3"]`）
- **用途**：支持助教同时上多个桌

---

*文档更新时间：2026年4月15日*

---

## attendance_records 表字段说明（2026-04-23更新）

### 钉钉打卡时间字段

| 字段 | 类型 | 说明 |
|------|------|------|
| dingtalk_in_time | TEXT | 钉钉上班打卡时间（YYYY-MM-DD HH:MM:SS） |
| dingtalk_out_time | TEXT | 钉钉下班打卡时间（YYYY-MM-DD HH:MM:SS） |

### 数据来源

| 字段 | 来源 |
|------|------|
| clock_in_time | 系统打卡（H5/小程序） |
| dingtalk_in_time | 钉钉推送/主动查询 |

### 合并逻辑

钉钉推送和系统打卡可能产生两条记录，已修复为合并逻辑：
1. 钉钉推送 → 创建记录（只有 dingtalk_in_time）
2. 系统打卡 → UPDATE该记录（写入 clock_in_time）


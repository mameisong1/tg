# 天宫国际 - 数据模型文档

## 数据库概述

- **数据库类型**: SQLite
- **数据库文件**: `/TG/tgservice/db/tgservice.db`
- **ORM/驱动**: better-sqlite3 (Node.js)
- **初始化脚本**: `/TG/tgservice/backend/init-db.js`

---

## 数据表一览

| 表名 | 说明 | 主键 |
|------|------|------|
| `admin_users` | 后台管理员用户表 | username |
| `product_categories` | 商品分类表 | name |
| `products` | 商品表 | name |
| `coaches` | 助教表 | coach_no |
| `carts` | 购物车表 | id (自增) |
| `orders` | 订单表 | id (自增) |
| `tables` | 台桌表 | id (自增) |
| `vip_rooms` | VIP包房表 | id (自增) |
| `home_config` | 首页配置表 | id (固定=1) |
| `members` | 会员表 | member_no |
| `sms_codes` | 短信验证码表 | id (自增) |
| `device_visits` | 设备访问记录表 | id (自增) |

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
| fingerprint | TEXT | NOT NULL | 设备指纹 |
| platform | TEXT | | 平台（h5/mp-weixin等） |
| user_agent | TEXT | | 用户代理 |
| screen_size | TEXT | | 屏幕尺寸 |
| language | TEXT | | 语言 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 访问时间 |

**用途**: 统计用户设备和访问来源

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

*文档更新时间：2026年3月*

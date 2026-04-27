# 天宫国际 - 数据模型

## 数据库架构
- **生产**: Turso 云端 (`libsql://`)，`TGSERVICE_ENV=production`（本地 SQLite 已废弃）
- **开发**: Turso 云端 (`libsql://tgservicedev-mameisong.aws-ap-northeast-1.turso.io`)，`TGSERVICE_ENV=test`
- **入口**: `db/index.js` 根据环境变量选择实现
- **Turso 预处理**: `preprocess-sql.js` 自动将 SQL 中的字符串常量转为参数化查询（Turso 不支持直接字符串）

> 时间规范：所有时间字段为北京时间，用 `TimeUtil` 生成，禁止 `datetime('now')`

## 数据表一览

| 表 | 说明 | 主键 |
|------|------|------|
| `admin_users` | 后台管理员 | username |
| `product_categories` | 商品分类 | name |
| `products` | 商品 | name |
| `coaches` | 助教 | coach_no |
| `water_boards` | 水牌状态 | coach_no |
| `carts` | 购物车 | id |
| `orders` | 订单 | id |
| `tables` | 台桌 | id |
| `vip_rooms` | VIP包房 | id |
| `home_config` | 首页配置(单例) | id=1 |
| `members` | 会员 | member_no |
| `sms_codes` | 短信验证码 | id |
| `device_visits` | 设备访问记录 | id |
| `lejuan_records` | 乐捐记录 | id |
| `attendance_records` | 考勤记录 | id |

## 关键字段

### coaches (助教)
coach_no, employee_id, stage_name, phone, id_card_last6, level(女神/精英/初级), price, photos(JSON), video, intro, is_popular

### water_boards (水牌)
coach_no, stage_name, status, table_no(逗号分隔，如"A1,A3"), clock_in_time
**状态**: 早班上桌/早班空闲/晚班上桌/晚班空闲/早加班/晚加班/休息/公休/请假/乐捐/下班

### orders (订单)
order_no(TG+yyyyMMddHHmmss+3位序号), table_no, items(JSON), total_price, status(待处理/已完成/已取消)

### carts (购物车)
session_id, table_no, product_name, quantity

### home_config (单例 id=1)
banner_image/title/desc, hot_products(JSON数组), popular_coaches(JSON数组), notice

### members (会员)
member_no(TG+6位序号), phone, openid, nickname, avatar, balance, points, level

### lejuan_records (乐捐)
coach_no, employee_id, stage_name, scheduled_start_time, extra_hours, lejuan_status(pending/active/returned), scheduled, actual_start_time, return_time, lejuan_hours, proof_image_url

### attendance_records (考勤)
clock_in_time(系统打卡), dingtalk_in_time(钉钉上班), dingtalk_out_time(钉钉下班)

## 关系
- product_categories → products ← carts → orders → tables
- coaches → water_boards
- members 独立
- home_config 单例

## 业务规则
- 购物车提交后自动清空
- 订单必须关联台桌
- 助教登录: coach_no + id_card_last6
- 创建助教时自动创建水牌记录(初始"下班")
- 点上班 → clock_in_time 写入；点下班 → 清空

## 初始化
```bash
cd /TG/tgservice/backend && node init-db.js
```
创建所有表 + 导入管理员/商品/台桌/助教数据

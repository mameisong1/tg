# 天宫国际 - API接口文档

## 基本信息

- **基础URL**: `http://localhost:8081`
- **响应格式**: JSON
- **认证方式**: JWT Token（后台管理接口需要）

---

## 请求限制

### 限流策略

| 接口类型 | 限制 | 说明 |
|---------|------|------|
| API 接口 | 60 次/分钟/IP | 用户端接口 |
| 后台管理 | 120 次/分钟/IP | 管理员操作 |
| 白名单 | 无限制 | `/api/health`、`/api/front-config`、`/api/agreement/` |

超出限制返回：`{ "error": "请求太频繁，请稍后再试" }` (HTTP 429)

### 爬虫拦截

以下 User-Agent 会被直接拦截（返回 403）：
- SEO 爬虫：semrush、ahrefs、mj12bot、dotbot
- 搜索引擎：baiduspider、yandexbot、sogou、360spider
- 数据采集：bytespider、petalbot、spider、crawler、scraper

---

## 目录

1. [公共接口](#公共接口)
2. [首页接口](#首页接口)
3. [商品接口](#商品接口)
4. [购物车接口](#购物车接口)
5. [订单接口](#订单接口)
6. [助教接口](#助教接口)
7. [台桌接口](#台桌接口)
8. [VIP包房接口](#vip包房接口)
9. [会员接口](#会员接口)
10. [后台管理接口](#后台管理接口)
11. [文件上传接口](#文件上传接口)
12. [协议接口](#协议接口)
13. [前端配置接口](#前端配置接口)
14. [日志接口](#日志接口)

---

## 公共接口

### 健康检查

- **路径**: `GET /api/health`
- **参数**: 无
- **返回**: 
  ```json
  { "status": "ok", "timestamp": "2026-03-21T15:00:00.000Z" }
  ```
- **说明**: 用于检查服务是否正常运行

---

## 首页接口

### 获取首页数据

- **路径**: `GET /api/home`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | t | string | 否 | 台桌拼音（用于绑定台桌） |
- **返回**: 
  ```json
  {
    "banner": {
      "image": "图片URL",
      "title": "活动标题",
      "desc": "活动描述"
    },
    "notice": "公告内容",
    "hotProducts": [...],
    "popularCoaches": [...],
    "tableInfo": { "area": "区域", "name": "台桌名" }
  }
  ```
- **说明**: 获取首页展示数据，包括banner、公告、热门商品、人气助教、台桌信息

---

## 商品选项接口

### 获取商品选项

- **路径**: `GET /api/product-options`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | category | string | 是 | 商品分类 |
  | product_name | string | 是 | 商品名称 |
- **返回**: 
  ```json
  {
    "options": {
      "id": 1,
      "category": "奶茶店",
      "product_name": "美式",
      "temperature": "冰/去冰/常温/热",
      "sugar": "无糖"
    }
  }
  ```
- **说明**: 获取商品可选项（温度、糖度）。无选项返回 `{"options": null}`。支持通配匹配（product_name='所有商品'）

## 商品接口

### 获取商品分类

- **路径**: `GET /api/categories`
- **参数**: 无
- **返回**: 
  ```json
  ["饮料", "零食", "酒水", ...]
  ```
- **说明**: 获取所有商品分类名称列表

### 获取商品列表

- **路径**: `GET /api/products`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | category | string | 否 | 分类名称筛选 |
- **返回**: 
  ```json
  [
    {
      "name": "商品名称",
      "category": "分类",
      "image_url": "图片URL",
      "price": 10.00,
      "stock_available": 100,
      "status": "上架"
    }
  ]
  ```
- **说明**: 获取商品列表，可按分类筛选

### 获取商品详情

- **路径**: `GET /api/products/:name`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | name | string | 是 | 商品名称（URL路径参数） |
- **返回**: 
  ```json
  {
    "name": "商品名称",
    "category": "分类",
    "image_url": "图片URL",
    "price": 10.00,
    "stock_total": 100,
    "stock_available": 100,
    "status": "上架",
    "created_at": "2026-03-21 15:00:00"
  }
  ```
- **说明**: 获取单个商品详情

---

## 购物车接口

### 添加商品到购物车

- **路径**: `POST /api/cart`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "tableNo": "台桌号（可选）",
    "productName": "商品名称",
    "quantity": 1,
    "options": "正常冰+少糖"
  }
  ```
- **返回**: 
  ```json
  { "success": true, "cartId": 123 }
  ```
- **说明**: 添加商品到购物车。如果商品已存在且options相同则增加数量；不同options视为独立行

### 获取购物车

- **路径**: `GET /api/cart/:sessionId`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | sessionId | string | 是 | 会话ID（URL路径参数） |
- **返回**: 
  ```json
  {
    "items": [
      {
        "id": 1,
        "product_name": "商品名",
        "quantity": 2,
        "table_no": "普台1",
        "price": 10.00,
        "image_url": "图片URL",
        "options": "正常冰+少糖"
      }
    ],
    "totalPrice": 20.00
  }
  ```
- **说明**: 获取指定会话的购物车内容。返回中包含options字段

### 更新购物车商品数量

- **路径**: `PUT /api/cart`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "productName": "商品名称",
    "quantity": 3,
    "options": "正常冰+少糖"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 更新购物车中指定商品的数量。需传递options以精确匹配

### 删除购物车商品

- **路径**: `DELETE /api/cart`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "productName": "商品名称",
    "options": "正常冰+少糖"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 从购物车中删除指定商品。需传递options以精确匹配

### 清空购物车

- **路径**: `DELETE /api/cart/:sessionId`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | sessionId | string | 是 | 会话ID（URL路径参数） |
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 清空指定会话的购物车

### 更新购物车台桌

- **路径**: `PUT /api/cart/table`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "tableNo": "普台1"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 更新购物车绑定的台桌号

---

## 服务单接口

### 创建服务单

- **路径**: `POST /api/service-orders`
- **认证**: 需要登录（助教/后台用户均可）
- **参数**:
  ```json
  {
    "table_no": "A05",
    "requirement": "换垃圾袋",
    "requester_name": "四瑶",
    "requester_type": "助教"
  }
  ```
- **返回**:
  ```json
  {
    "success": true,
    "data": { "id": 1, "status": "待处理" }
  }
  ```
- **说明**: 助教和所有后台用户均可提交服务单。仅需 `auth.required` 认证。

> **前端快捷需求按钮（2026-04-11 新增）**：
> 服务下单页面（`/pages/internal/service-order.vue`）提供 5 组快捷需求按钮，点击自动填入需求内容，仍需手动提交。
>
> | 分组 | 颜色 | 按钮 |
> |------|------|------|
> | 账务 | 🔴 #e74c3c | 看账单 |
> | 挂烟 | 🟠 #e67e22 | 挂烟1包、挂烟2包 |
> | 配件 | 🟡 #f39c12 | 打火机、换电池 |
> | 酒具 | 🔵 #3498db | 啤酒杯、样酒杯 |
> | 其它 | 🟣 #9b59b6 | 零食推车、换垃圾袋、搞卫生、音响连接、加水 |
>
> 布局：分组名与按钮左右排列（flex row），每组占一行，按钮自动换行。

### 获取服务单列表

- **路径**: `GET /api/service-orders`
- **认证**: 需要后台权限（`serviceOrder`）
- **参数**: `?status=已完成&table_no=A05&date=2026-04-17&limit=50`
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | status | string | 否 | 状态筛选（待处理/已完成/已取消） |
  | table_no | string | 否 | 台桌号过滤 |
  | date | string | 否 | 日期过滤（格式：YYYY-MM-DD） |
  | date_start | string | 否 | 日期范围起始（格式：YYYY-MM-DD） |
  | date_end | string | 否 | 日期范围结束（格式：YYYY-MM-DD） |
  | limit | int | 否 | 返回数量上限，默认 50 |
- **说明**: 获取服务单列表，支持按状态、台桌号、日期过滤。返回格式 `{ success: true, data: [...] }`。
- **更新时间**: 2026-04-17

---

## 订单接口

### 提交订单

- **路径**: `POST /api/order`
- **参数**:
  ```json
  {
    "sessionId": "会话ID",
    "tableNo": "台桌号（必填）",
    "deviceFingerprint": "设备指纹（可选，用于黑名单检测）"
  }
  ```
- **返回**:
  ```json
  {
    "success": true,
    "orderNo": "TG20260321150000001",
    "totalPrice": 50.00
  }
  ```
- **说明**: 将购物车内容提交为订单，提交后清空购物车。如果设备指纹在黑名单中，将返回 403 错误。

### 获取台桌待处理订单

- **路径**: `GET /api/orders/pending/:tableName`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | tableName | string | 是 | 台桌名称（URL路径参数） |
- **返回**: 
  ```json
  [
    {
      "id": 1,
      "order_no": "TG20260321150000001",
      "items": "[{\"name\":\"可乐\",\"quantity\":2,\"price\":5}]",
      "total_price": 10.00,
      "status": "待处理",
      "created_at": "2026-03-21 15:00:00"
    }
  ]
  ```
- **说明**: 获取指定台桌的待处理订单列表（按台桌筛选，已废弃）

### 获取当前设备的待处理订单

- **路径**: `GET /api/orders/my-pending`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | deviceFingerprint | string | 是 | 设备指纹（URL查询参数） |
- **返回**: 
  ```json
  [
    {
      "id": 1,
      "order_no": "TG20260321150000001",
      "table_no": "普台1",
      "items": "[{\"name\":\"可乐\",\"quantity\":2,\"price\":5}]",
      "total_price": 10.00,
      "status": "待处理",
      "created_at": "2026-03-21 15:00:00"
    }
  ]
  ```
- **说明**: 获取当前设备的待处理订单列表（严格模式，只显示当前设备下的订单，5小时内的订单）
- **更新时间**: 2026-04-02

---

## 助教接口

### 获取助教列表

- **路径**: `GET /api/coaches`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | level | string | 否 | 按等级筛选 |
- **返回**: 
  ```json
  [
    {
      "coach_no": "26",
      "stage_name": "四瑶",
      "level": "女神",
      "price": 2.3,
      "age": 22,
      "height": 165,
      "photos": "[\"url1\", \"url2\"]",
      "is_popular": 1
    }
  ]
  ```
- **说明**: 获取助教列表，可按等级筛选

### 获取人气助教TOP6

- **路径**: `GET /api/coaches/popularity/top6`
- **参数**: 无
- **返回**: 
  ```json
  [
    { "coach_no": "26", "stage_name": "四瑶", "level": "女神", ... }
  ]
  ```
- **说明**: 获取人气最高的6位助教

### 获取助教详情

- **路径**: `GET /api/coaches/:coachNo`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | coachNo | string | 是 | 助教工号（URL路径参数） |
- **返回**: 
  ```json
  {
    "coach_no": "26",
    "employee_id": "26",
    "stage_name": "四瑶",
    "real_name": "张某某",
    "level": "女神",
    "price": 2.3,
    "age": 22,
    "height": 165,
    "photos": "[\"url1\", \"url2\"]",
    "video": "视频URL",
    "intro": "个人介绍",
    "is_popular": 1
  }
  ```
- **说明**: 获取助教详细信息

### 助教查询自己的水牌状态

- **路径**: `GET /api/coaches/:coachNo/water-status`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | coachNo | string | 是 | 助教工号（URL路径参数） |
- **返回**: 
  ```json
  {
    "success": true,
    "data": {
      "coach_no": "10010",
      "stage_name": "小怡",
      "status": "晚班上桌",
      "table_no": "A15",
      "updated_at": "2026-04-10 20:00:00"
    }
  }
  ```
- **说明**: 助教查询自己的水牌状态（含当前台桌号），用于H5员工下单时默认选台

### 同步水牌预览

- **路径**: `GET /api/admin/coaches/sync-water-boards/preview`
- **权限**: `authMiddleware` + `requireBackendPermission(['coachManagement'])`
- **说明**: 检测三类数据：
  1. **孤儿数据**：水牌中存在但教练表不存在或已离职
  2. **缺失数据**：教练表中在职但水牌中不存在
  3. **离店残留台桌**（2026-04-16 新增）：状态为休息/公休/请假/下班且 table_no 非空的助教
- **响应**:
  ```json
  {
    "orphanRecords": [
      { "coach_no": "10010", "stage_name": "小怡", "wb_status": "下班", "reason": "coaches.status=离职" }
    ],
    "missingRecords": [
      { "coach_no": "10125", "stage_name": "测试小A", "status": "全职", "shift": "早班" }
    ],
    "offDutyWithTables": [
      {
        "coach_no": "10009",
        "stage_name": "momo",
        "status": "休息",
        "table_no": "VIP1",
        "table_no_list": ["VIP1"],
        "shift": "晚班"
      }
    ],
    "summary": { "orphanCount": 1, "missingCount": 1, "offDutyCount": 1 }
  }
  ```

### 同步水牌执行

- **路径**: `POST /api/admin/coaches/sync-water-boards/execute`
- **权限**: `authMiddleware` + `requireBackendPermission(['coachManagement'])`
- **参数**:
  ```json
  {
    "deleteOrphanIds": ["10010"],
    "addMissingIds": ["10125"],
    "clearTableCoachNos": ["10009"]
  }
  ```
- **说明**: 按用户勾选执行同步。孤儿数据删除（从 water_boards 表），缺失数据添加（自动根据班次设置初始状态：早班→早班空闲，晚班→晚班空闲），残留台桌清理（2026-04-16 新增）：将指定助教的 table_no 更新为 NULL，保留水牌记录。
- **响应**:
  ```json
  { "success": true, "deleted": 1, "added": 1, "cleared": 1, "errors": [] }
  ```

### 助教登录

- **路径**: `POST /api/coach/login`
- **参数**: 
  ```json
  {
    "coachNo": "26",
    "idCardLast6": "123456"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "coach": { "coach_no": "26", "stage_name": "四瑶", ... }
  }
  ```
- **说明**: 助教使用工号和身份证后6位登录

### 更新助教资料

- **路径**: `PUT /api/coach/profile`
- **Headers**: `Authorization: Bearer <token>`
- **参数**: 
  ```json
  {
    "age": 23,
    "height": 166,
    "intro": "新的个人介绍",
    "photos": "[\"url1\", \"url2\"]",
    "video": "视频URL"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 助教更新自己的个人资料

### 更新助教头像

- **路径**: `PUT /api/coach/avatar`
- **Headers**: `Authorization: Bearer <token>`
- **参数**: 
  ```json
  {
    "avatarUrl": "新头像URL"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 助教更新自己的头像（photos数组第一张）

---

## 台桌接口

### 获取台桌信息（按拼音）

- **路径**: `GET /api/table/:pinyin`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | pinyin | string | 是 | 台桌拼音（URL路径参数） |
- **返回**: 
  ```json
  {
    "id": 1,
    "area": "普台区",
    "name": "普台1",
    "name_pinyin": "putai1",
    "status": "计费中"
  }
  ```
- **说明**: 通过拼音获取台桌信息（用于扫码）

### 获取所有台桌

- **路径**: `GET /api/tables`
- **参数**: 无
- **返回**: 
  ```json
  [
    { "id": 1, "area": "普台区", "name": "普台1", "status": "空闲" },
    { "id": 2, "area": "包厢区", "name": "BOX1", "status": "计费中" }
  ]
  ```
- **说明**: 获取所有台桌列表

---

## VIP包房接口

### 获取包房列表

- **路径**: `GET /api/vip-rooms`
- **参数**: 无
- **返回**: 
  ```json
  [
    {
      "id": 1,
      "name": "雀斯诺克1号房",
      "status": "空闲",
      "intro": "豪华包房，配备斯诺克球台",
      "photos": "[\"url1\"]",
      "videos": "[\"url1\"]"
    }
  ]
  ```
- **说明**: 获取VIP包房列表

### 获取包房详情

- **路径**: `GET /api/vip-rooms/:id`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | id | number | 是 | 包房ID（URL路径参数） |
- **返回**: 
  ```json
  {
    "id": 1,
    "name": "雀斯诺克1号房",
    "status": "空闲",
    "intro": "详细介绍...",
    "photos": "[\"url1\", \"url2\"]",
    "videos": "[\"url1\"]"
  }
  ```
- **说明**: 获取单个包房详情

---

## 会员接口

### 发送短信验证码

- **路径**: `POST /api/sms/send`
- **参数**: 
  ```json
  {
    "phone": "13800138000"
  }
  ```
- **返回**: 
  ```json
  { "success": true, "message": "验证码已发送" }
  ```
- **说明**: 发送手机验证码（60秒内不可重复发送）

### 短信验证码登录

- **路径**: `POST /api/member/login-sms`
- **参数**: 
  ```json
  {
    "phone": "13800138000",
    "code": "123456"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "member": {
      "member_no": "TG000001",
      "phone": "13800138000",
      "nickname": "会员昵称"
    },
    "isNew": false,
    "adminInfo": { "username": "13800138000", "role": "admin" },
    "adminToken": "jwt-token",
    "coachInfo": {
      "coachNo": 10040,
      "employeeId": "999",
      "stageName": "四瑶",
      "phone": "13800138000",
      "level": "初级",
      "shift": "早班",
      "status": "全职"
    },
    "coachToken": "base64-token"
  }
  ```
- **说明**: 使用手机号和验证码登录，新用户自动注册。
  如果手机号匹配后台用户表（admin_users.username），返回 adminInfo 和 adminToken。
  如果手机号匹配助教表（coaches.phone），返回 coachInfo 和 coachToken。
  前端通过 adminToken 或 coachToken 判断是否为登录员工。

### 微信登录（获取手机号）

- **路径**: `POST /api/member/login`
- **参数**: 
  ```json
  {
    "code": "微信登录code",
    "phoneCode": "微信手机号授权code"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "member": { ... },
    "isNew": false
  }
  ```
- **说明**: 微信小程序登录，通过phoneCode获取手机号

### 自动登录

- **路径**: `POST /api/member/auto-login`
- **参数**: 
  ```json
  {
    "code": "微信登录code"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "member": { ... }
  }
  ```
- **说明**: 已绑定手机号的用户可通过openid自动登录

### 获取会员信息

- **路径**: `GET /api/member/profile`
- **Headers**: `Authorization: Bearer <token>`
- **参数**: 无
- **返回**: 
  ```json
  {
    "member_no": "TG000001",
    "phone": "138****8000",
    "nickname": "会员昵称",
    "avatar": "头像URL",
    "balance": 100.00,
    "points": 500,
    "level": "普通会员",
    "created_at": "2026-03-21 15:00:00"
  }
  ```
- **说明**: 获取当前登录会员的信息

### 更新会员信息

- **路径**: `PUT /api/member/profile`
- **Headers**: `Authorization: Bearer <token>`
- **参数**: 
  ```json
  {
    "nickname": "新昵称",
    "avatar": "新头像URL"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 更新会员昵称或头像

### 会员登出

- **路径**: `POST /api/member/logout`
- **Headers**: `Authorization: Bearer <token>`
- **参数**: 无
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 登出当前会员

---

## 后台管理接口

> 以下接口需要在Headers中携带：`Authorization: Bearer <admin-token>`

### 管理员登录

#### 密码登录

- **路径**: `POST /api/admin/login`
- **参数**: 
  ```json
  {
    "username": "tgadmin",
    "password": "mms633268"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "role": "管理员",
    "user": { "username": "tgadmin", "name": "系统管理员", "role": "管理员" },
    "permissions": { ... }
  }
  ```
- **说明**: 后台管理员密码登录

#### 验证码登录

- **路径**: `POST /api/admin/login/sms`
- **参数**: 
  ```json
  {
    "phone": "18600000001",
    "code": "123456"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "token": "jwt-token",
    "role": "店长",
    "user": { "username": "18600000001", "name": "张三", "role": "店长" },
    "permissions": { ... }
  }
  ```
- **说明**: 后台管理员验证码登录，手机号即用户名
- **验证码发送**: 调用 `/api/sms/send` 发送验证码
- **注意事项**: 
  - 验证码 5 分钟有效期
  - 验证码一次性使用（登录成功后失效）
  - 服务员和教练禁止登录后台
- **更新时间**: 2026-04-23

### 获取统计数据

- **路径**: `GET /api/admin/stats`
- **返回**: 
  ```json
  {
    "todayOrders": 50,
    "todayRevenue": 2500.00,
    "totalMembers": 1000,
    "totalCoaches": 20
  }
  ```

### 订单管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/orders` | GET | 获取订单列表（支持 date/status 过滤） |
| `/api/admin/orders/:id/complete` | POST | 完成订单 |
| `/api/admin/orders/:id/cancel` | POST | 取消订单 |
| `/api/admin/orders/:id/cancel-item` | POST | 取消订单中的单个商品 |

#### 获取订单列表

- **路径**: `GET /api/admin/orders`
- **认证**: 需要后台权限（`cashierDashboard`）
- **参数**: `?status=已完成&date=2026-04-17&date_start=2026-04-14&date_end=2026-04-17`
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | status | string | 否 | 状态筛选（待处理/已完成/已取消/全部），不传时默认排除已取消 |
  | date | string | 否 | 日期过滤（格式：YYYY-MM-DD），按 `DATE(created_at)` 精确匹配 |
  | date_start | string | 否 | 日期范围起始（格式：YYYY-MM-DD） |
  | date_end | string | 否 | 日期范围结束（格式：YYYY-MM-DD） |
- **说明**: 获取订单列表，支持按状态和日期过滤。**2026-04-13 更新**：新增 `date` 参数；**2026-04-17 更新**：新增 `date_start`/`date_end` 范围查询。

> **时区说明**：所有时间字段（`created_at`、`updated_at`）存储为北京时间（Asia/Shanghai, UTC+8）。
> 日期过滤参数 `date` 按北京时间解析。API 返回的时间格式为 `YYYY-MM-DD HH:MM:SS`（北京时间）。

#### 取消订单中的单个商品

- **路径**: `POST /api/admin/orders/:id/cancel-item`
- **Headers**: `Authorization: Bearer <admin-token>`
- **参数**: 
  ```json
  {
    "itemName": "啤酒",
    "cancelQuantity": 2
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "orderEmpty": false,
    "order": {
      "id": 52,
      "items": [...],
      "total_price": 56.00
    }
  }
  ```
- **说明**: 取消订单中的指定商品，支持部分取消和全部取消
- **特性**:
  - 部分取消：减少商品数量，重新计算总价
  - 全部取消：从订单中移除该商品
  - 订单无商品时自动取消订单
- **更新时间**: 2026-04-03

### 用户管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/users` | GET | 获取管理员列表 |
| `/api/admin/users` | POST | 创建管理员 |
| `/api/admin/users/:username` | PUT | 更新管理员 |
| `/api/admin/users/:username` | DELETE | 删除管理员 |

#### 创建管理员

- **路径**: `POST /api/admin/users`
- **参数**:
  ```json
  {
    "username": "13800138000",
    "name": "张三",
    "role": "cashier",
    "password": "随机密码"
  }
  ```
- **说明**: 创建后台用户。**v2.0.1更新**：`username` 字段录入手机号，`name` 字段为姓名（新增时可录入），初始密码随机生成。

#### 更新管理员

- **路径**: `PUT /api/admin/users/:username`
- **参数**:
  ```json
  {
    "name": "新姓名",
    "role": "floorManager"
  }
  ```
- **说明**: 更新管理员信息。**v2.0.1更新**：`name`（姓名）字段可修改。

### 商品分类管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/categories` | GET | 获取分类列表 |
| `/api/admin/categories` | POST | 创建分类 |
| `/api/admin/categories/:name` | PUT | 更新分类 |
| `/api/admin/categories/:name` | DELETE | 删除分类 |

### 商品管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/products` | GET | 获取商品列表 |
| `/api/admin/products` | POST | 创建商品 |
| `/api/admin/products/:name` | PUT | 更新商品 |
| `/api/admin/products/:name` | DELETE | 删除商品 |

### 助教管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/coaches` | GET | 获取助教列表 |
| `/api/admin/coaches` | POST | 创建助教 |
| `/api/admin/coaches/:coachNo` | PUT | 更新助教 |
| `/api/admin/coaches/:coachNo` | DELETE | 删除助教 |

> **唯一约束**: `employee_id` + `stage_name` 组合必须唯一，创建/更新时会检查重复。
> - 创建重复时返回: `{ "error": "该工号和艺名组合已存在，请检查是否重复添加" }`
> - 更新重复时返回: `{ "error": "该工号和艺名组合已被其他助教使用" }`

### 水牌管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/water-boards` | GET | 获取所有水牌状态 |
| `/api/water-boards/:coach_no` | GET | 获取单个助教水牌 |
| `/api/water-boards/:coach_no/status` | PUT | 更新水牌状态 |
| `/api/coaches/:coach_no/clock-in` | POST | 助教点上班 |
| `/api/coaches/:coach_no/clock-out` | POST | 助教点下班 |

#### 获取所有水牌状态

- **路径**: `GET /api/water-boards`
- **返回**: 
  ```json
  {
    "success": true,
    "data": [
      {
        "coach_no": "10005",
        "stage_name": "芝芝",
        "status": "早班空闲",
        "table_no": null,
        "clock_in_time": "2026-04-14 08:00:00",
        "shift": "早班",
        "photos": ["https://..."],
        "employee_id": "1005"
      }
    ]
  }
  ```
- **说明**: 返回所有助教的水牌状态，`photos` 字段已解析为数组格式。`clock_in_time` 为上班时间（北京时间）。

#### 助教点上班

- **路径**: `POST /api/coaches/:coach_no/clock-in`
- **权限**: `coachManagement`（助教只能打自己的卡）
- **说明**: 根据班次将状态从非在班状态变为 `早班空闲` 或 `晚班空闲`，同时写入 `clock_in_time`
- **返回**:
  ```json
  {
    "success": true,
    "data": {
      "coach_no": "10005",
      "stage_name": "芝芝",
      "status": "早班空闲"
    }
  }
  ```

#### 助教点下班

- **路径**: `POST /api/coaches/:coach_no/clock-out`
- **权限**: `coachManagement`（助教只能打自己的卡）
- **说明**: 将状态变为 `下班`，清空 `clock_in_time`
- **返回**:
  ```json
  {
    "success": true,
    "data": {
      "coach_no": "10005",
      "status": "下班"
    }
  }
  ```

#### 更新水牌状态

- **路径**: `PUT /api/water-boards/:coach_no/status`
- **参数**: 
  ```json
  {
    "status": "早班上桌",
    "table_no": "A01"
  }
  ```
- **返回**: 
  ```json
  {
    "success": true,
    "data": {
      "coach_no": "10005",
      "status": "早班上桌",
      "table_no": "A01"
    }
  }
  ```
- **有效状态值**: 早班上桌、早班空闲、晚班上桌、晚班空闲、早加班、晚加班、休息、公休、请假、乐捐、下班
- **联动规则**（2026-04-16 更新）:
  - 当状态变更为 **休息/公休/请假/下班** 时，自动清除 `table_no = NULL`
  - 当状态变更为 **下班** 时，额外清除 `clock_in_time = NULL`
  - 如果请求体显式传了 `table_no` 值，则尊重用户输入，不强制清除

### 会员管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/members` | GET | 获取会员列表 |
| `/api/admin/members` | POST | 创建会员 |
| `/api/admin/members/:memberNo` | PUT | 更新会员 |
| `/api/admin/members/sync-coaches/preview` | POST | 同步助教—预览匹配清单 |
| `/api/admin/members/sync-coaches/execute` | POST | 同步助教—执行批量同步 |

#### 同步助教—预览匹配清单

- **路径**: `POST /api/admin/members/sync-coaches/preview`
- **认证**: 需要 `Authorization: Bearer <token>`
- **权限**: `coachManagement`（管理员、店长、助教管理）
- **请求体**: 无
- **返回**:
  ```json
  {
    "success": true,
    "matches": [
      {
        "member_no": 1,
        "phone": "13800138000",
        "name": "张三",
        "gender": "",
        "remark": "",
        "coach_employee_id": "T001",
        "coach_stage_name": "小美",
        "coach_status": "全职"
      }
    ],
    "summary": {
      "totalMembers": 100,
      "totalCoaches": 20,
      "matchedCount": 5
    }
  }
  ```
- **说明**: 根据手机号精确匹配会员与助教（排除空号和离职助教），返回匹配清单供前端勾选。

#### 同步助教—执行批量同步

- **路径**: `POST /api/admin/members/sync-coaches/execute`
- **认证**: 需要 `Authorization: Bearer <token>`
- **权限**: `coachManagement`
- **请求体**:
  ```json
  {
    "items": [
      {
        "member_no": 1,
        "coach_employee_id": "T001",
        "coach_stage_name": "小美"
      }
    ]
  }
  ```
- **返回**:
  ```json
  {
    "success": true,
    "syncedCount": 2,
    "details": [
      { "member_no": 1, "status": "success", "updated_fields": ["remark", "gender", "name"] }
    ],
    "errors": []
  }
  ```
- **同步逻辑**:
  1. 备注追加 `[助教] 工号:XX, 艺名:XXX`（幂等：同工号标记会替换，不会重复追加）
  2. 性别为空（NULL/空字符串/空格）→ 设为「女」
  3. 姓名为空 → 填入助教艺名
- **匹配条件**: `members.phone = coaches.phone` 精确匹配，排除空手机号和 `status = '离职'` 的助教

- **更新时间**: 2026-04-18

### 首页配置管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/home-config` | GET | 获取首页配置 |
| `/api/admin/home-config` | PUT | 更新首页配置 |

### 台桌管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/tables` | GET | 获取台桌列表 |
| `/api/admin/tables` | POST | 创建台桌 |
| `/api/admin/tables/:id` | PUT | 更新台桌 |
| `/api/admin/tables/:id` | DELETE | 删除台桌 |
| `/api/admin/tables/qrcode/check` | GET | 检查二维码目录 |

### VIP包房管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/vip-rooms` | GET | 获取包房列表 |
| `/api/admin/vip-rooms` | POST | 创建包房 |
| `/api/admin/vip-rooms/:id` | PUT | 更新包房 |
| `/api/admin/vip-rooms/:id` | DELETE | 删除包房 |
| `/api/admin/vip-rooms/:id/photo` | DELETE | 删除包房照片 |
| `/api/admin/vip-rooms/:id/video` | DELETE | 删除包房视频 |
| `/api/admin/vip-rooms/:id/avatar` | PUT | 设置包房封面 |

### 上下桌单管理

> 以下接口需要在Headers中携带：`Authorization: Bearer <admin-token>`

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/table-action-orders` | GET | 获取上下桌单列表 |
| `/api/admin/table-action-orders/:id` | PUT | 更新上下桌单状态 |

#### 获取上下桌单列表

- **路径**: `GET /api/admin/table-action-orders`
- **参数**:
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | status | string | 否 | 状态筛选（待处理/已完成/已取消） |
  | order_type | string | 否 | 单类型筛选（上桌单/下桌单/取消单） |
  | coach_no | string | 否 | 助教工号筛选 |
  | date | string | 否 | 日期过滤（格式：YYYY-MM-DD） |
  | date_start | string | 否 | 日期范围起始（格式：YYYY-MM-DD） |
  | date_end | string | 否 | 日期范围结束（格式：YYYY-MM-DD） |
  | limit | number | 否 | 返回数量（默认50） |
- **返回**:
  ```json
  [
    {
      "id": 1,
      "table_no": "A01",
      "coach_no": "C001",
      "employee_id": "1",
      "stage_name": "小美",
      "order_type": "上桌单",
      "action_category": "普通课",
      "status": "待处理",
      "created_at": "2026-04-09T10:00:00.000Z"
    }
  ]
  ```
- **说明**: 获取上下桌单列表，支持状态/类型/助教筛选。**v2.0.1更新**：返回结果包含 `employee_id` 字段（通过 LEFT JOIN coaches 表获取），用于收银看板显示工号。
- **更新时间**: 2026-04-09

### 设备统计

- **路径**: `GET /api/admin/device-stats`
- **返回**: 设备访问统计数据
- **说明**: 获取设备访问统计（用于分析用户来源）

### DB 写入队列监控

- **路径**: `GET /api/admin/db-queue-stats`
- **认证**: 需要后台权限（`authMiddleware`）
- **返回**:
  ```json
  {
    "timestamps": [1776009420000, 1776009480000],
    "queueLengths": [1, 0],
    "waitTimes": [7, 0],
    "currentQueueLength": 0,
    "currentMinute": 1776009540000
  }
  ```
- **说明**: 获取 DB 写入队列监控数据（纯内存读取，不碰数据库）。
  - `timestamps`: 采样时间点（Unix 毫秒戳）
  - `queueLengths`: 对应每分钟队列最长长度
  - `waitTimes`: 对应每分钟最长等待毫秒数
  - `currentQueueLength`: 当前队列等待中的写操作数
  - 采样间隔 60 秒，保留最近 6 小时（360 个点）
- **更新时间**: 2026-04-12

### 漏单统计

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/missing-table-out-orders/stats` | GET | 获取漏单统计列表 |
| `/api/missing-table-out-orders/detail` | GET | 获取指定助教的漏单明细 |

**权限**：`missingTableOutStats`（管理员、店长、助教管理）

#### 获取漏单统计

- **路径**: `GET /api/missing-table-out-orders/stats?period=yesterday`
- **认证**: 需要 `Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | `yesterday` / `beforeYesterday` / `thisMonth` / `lastMonth` |

- **返回**:
  ```json
  {
    "success": true,
    "data": {
      "period": "yesterday",
      "period_label": "昨天",
      "date_start": "2026-04-16",
      "date_end": "2026-04-16",
      "list": [
        {
          "coach_no": 10032,
          "employee_id": "37",
          "stage_name": "三七",
          "missing_count": 3
        }
      ],
      "total_coaches": 2,
      "total_missing": 5
    }
  }
  ```
- **说明**: 按助教统计指定周期内漏单数量。上桌单发出后15小时内无对应下桌单（同助教+同桌号+同艺名）即判定为缺失。
  - **2026-04-21更新**: 如果有对应的取消单，不算漏单（排除已取消的上桌单）。

#### 获取指定助教的漏单明细

- **路径**: `GET /api/missing-table-out-orders/detail?period=yesterday&coach_no=10032`
- **认证**: 需要 `Authorization: Bearer <token>`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | 周期（同上） |
| coach_no | number | 是 | 助教系统编号 |

- **返回**:
  ```json
  {
    "success": true,
    "data": {
      "coach_no": 10032,
      "employee_id": "37",
      "stage_name": "三七",
      "details": [
        {
          "id": 102,
          "table_no": "A3",
          "table_date": "2026-04-16",
          "table_time": "14:30:00",
          "action_category": "普通课",
          "created_at": "2026-04-16 14:30:00"
        }
      ]
    }
  }
  ```
- **说明**: 用户点击统计列表项时调用，返回该助教在指定周期内的上桌单缺失明细。仅在用户点击时按需查询，不预加载。

- **更新时间**: 2026-04-17

---

## 文件上传接口

### 上传图片（本地）

- **路径**: `POST /api/upload/image`
- **Content-Type**: `multipart/form-data`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | image | file | 是 | 图片文件 |
- **返回**: 
  ```json
  { "url": "/uploads/images/xxx.jpg" }
  ```

### 上传视频（本地）

- **路径**: `POST /api/upload/video`
- **Content-Type**: `multipart/form-data`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | video | file | 是 | 视频文件 |
- **返回**: 
  ```json
  { "url": "/uploads/videos/xxx.mp4" }
  ```

### 获取OSS签名URL

- **路径**: `GET /api/oss/sts`
- **查询参数**: 
  | 参数 | 类型 | 必填 | 默认值 | 说明 |
  |------|------|------|--------|------|
  | type | string | 否 | image | 文件类型（image/video） |
  | ext | string | 否 | jpg | 文件扩展名 |
  | dir | string | 否 | coaches/ | 上传目录 |
- **返回**: 
  ```json
  {
    "success": true,
    "signedUrl": "https://xxx.oss-cn-xxx.aliyuncs.com/coaches/xxx.jpg?OSSAccessKeyId=...",
    "accessUrl": "https://xxx.oss-cn-xxx.aliyuncs.com/coaches/xxx.jpg",
    "objectKey": "coaches/1775871062425_xxx.jpg",
    "expires": 3600
  }
  ```
- **说明**: 获取阿里云OSS签名URL，用于前端直传。前端使用PUT方法将文件上传到signedUrl。

#### 上传目录分配

| 页面 | dir 参数 | OSS目录 |
|------|----------|--------|
| 助教个人中心 | `coaches/` | `coaches/` |
| 包房编辑 | `coaches/` | `coaches/` |
| 约客记录 | `TgTemp/` | `TgTemp/` |
| 加班申请 | `TgTemp/` | `TgTemp/` |
| 公休申请 | `TgTemp/` | `TgTemp/` |

### 上传到OSS

- **路径**: `POST /api/oss/upload`
- **Content-Type**: `multipart/form-data`
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | file | file | 是 | 文件 |
  | type | string | 否 | 类型（image/video） |
- **返回**: 
  ```json
  { "url": "https://xxx.oss-cn-xxx.aliyuncs.com/xxx.jpg" }
  ```

---

## 协议接口

### 获取用户协议

- **路径**: `GET /api/agreement/user`
- **返回**: 
  ```json
  {
    "title": "天宫国际用户服务协议",
    "content": "协议内容..."
  }
  ```

### 获取隐私政策

- **路径**: `GET /api/agreement/privacy`
- **返回**: 
  ```json
  {
    "title": "天宫国际隐私政策",
    "content": "隐私政策内容..."
  }
  ```

---

## 设备访问记录

### 记录设备访问

- **路径**: `POST /api/device/visit`
- **参数**: 
  ```json
  {
    "fingerprint": "设备指纹",
    "platform": "h5/mp-weixin",
    "userAgent": "UA信息",
    "screenSize": "1920x1080",
    "language": "zh-CN"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 记录设备访问信息，用于统计分析

---

## 设备指纹黑名单接口

> 以下接口需要在Headers中携带：`Authorization: Bearer <admin-token>`

### 获取黑名单列表

- **路径**: `GET /api/admin/blacklist`
- **参数**: 无
- **返回**:
  ```json
  [
    {
      "id": 1,
      "device_fingerprint": "abc123...",
      "reason": "恶意刷单",
      "created_at": "2026-03-22 12:00:00",
      "created_by": "admin"
    }
  ]
  ```
- **说明**: 获取所有设备指纹黑名单记录

### 添加黑名单

- **路径**: `POST /api/admin/blacklist`
- **参数**:
  ```json
  {
    "deviceFingerprint": "设备指纹",
    "reason": "拉黑原因（可选）"
  }
  ```
- **返回**:
  ```json
  { "success": true }
  ```
- **说明**: 将指定设备指纹加入黑名单，该设备将无法下单

### 删除黑名单

- **路径**: `DELETE /api/admin/blacklist/:id`
- **参数**: 无（id为路径参数）
- **返回**:
  ```json
  { "success": true }
  ```
- **说明**: 从黑名单中移除指定记录

---

## 错误响应格式

所有接口在发生错误时返回统一格式：

```json
{
  "error": "错误描述信息"
}
```

常见HTTP状态码：
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未授权（需要登录）
- `403` - 禁止访问
- `404` - 资源不存在
- `500` - 服务器内部错误

---

## 前端配置接口

### 获取前端配置

- **路径**: `GET /api/front-config`
- **参数**: 无
- **返回**: 
  ```json
  {
    "tableAuth": {
      "expireMinutes": 10
    },
    "env": {
      "name": "production"
    }
  }
  ```
- **说明**: 获取前端配置，包括扫码台桌授权有效期等。测试环境 expireMinutes 为 5，生产环境为 10（2026-04-14 从 30 改为 10）。

---

## 日志接口

### 上报摄像头错误

- **路径**: `POST /api/log/camera-error`
- **参数**: 
  ```json
  {
    "errorName": "NotReadableError",
    "errorMessage": "Could not start video source",
    "errorStack": "Error stack trace...",
    "userAgent": "Mozilla/5.0...",
    "platform": "Linux x86_64",
    "url": "https://tg.tiangong.club/",
    "clientTimestamp": 1711073445123
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 前端上报摄像头启动失败的详细信息，日志保存到 `logs/camera-error.log`。用于调试华为浏览器等设备上的摄像头兼容性问题。

### 获取台桌列表

- **路径**: `GET /api/tables`
- **说明**: 获取所有台桌数据，按区域和名称排序。供前台台桌选择器使用。
- **返回**: 台桌数组
  ```json
  [
    { "area": "大厅", "name": "普台 1", "name_pinyin": "putai-1", "status": "空闲" },
    { "area": "包房", "name": "V1", "name_pinyin": "v1", "status": "占用" }
  ]
  ```

---

## 智能开关接口

所有智能开关接口需要权限验证（店长/助教管理/管理员）。

### 获取场景列表

- **路径**: `GET /api/switch/scenes`
- **返回**: 场景数组
  ```json
  [
    { "id": 1, "scene_name": "全部开灯", "action": "ON", "switches": "[{\"switch_id\":\"0x...\",\"switch_seq\":\"state_l1\"}]", "sort_order": 1 },
    { "id": 2, "scene_name": "全部关灯", "action": "OFF", "switches": "[...]", "sort_order": 2 }
  ]
  ```

### 获取开关标签列表

- **路径**: `GET /api/switch/labels`
- **返回**: 标签数组
  ```json
  [{ "switch_label": "普台区" }, { "switch_label": "VIP区" }]
  ```

### 获取台桌列表及关联开关

- **路径**: `GET /api/switch/tables`
- **返回**: 台桌数组（含关联的 switch_id 和 switch_seq）
  ```json
  [{ "table_name_en": "putai1", "table_name_cn": "普台1", "area": "大厅区", "switches": [{ "switch_id": "0x...", "switch_seq": "state_l1" }] }]
  ```

### 获取自动关灯状态

- **路径**: `GET /api/switch/auto-status`
- **返回**:
  ```json
  { "auto_off_enabled": true }
  ```

### 切换自动关灯启停

- **路径**: `POST /api/switch/auto-off-toggle`
- **返回**: `{ "success": true, "enabled": true }`

### 手动执行智能省电

- **路径**: `POST /api/switch/auto-off-manual`
- **说明**: 手动触发一次自动关灯逻辑。先对空闲台桌发送关灯指令，再对台桌无关开关发送关灯指令
- **返回**:
  ```json
  { "success": true, "turnedOffCount": 40, "maybeOffCount": 50, "cannotOffCount": 47, "independentTurnedOffCount": 60 }
  ```
- **新增字段**: `independentTurnedOffCount` — 台桌无关开关关闭数量

### 执行场景

- **路径**: `POST /api/switch/scene/:id`
- **返回**: `{ "success": true, "count": 5 }`（成功发送的 MQTT 指令数）

### 按标签批量控制

- **路径**: `POST /api/switch/label-control`
- **请求体**: `{ "label": "普台区", "action": "ON" }`（ON 或 OFF）
- **返回**: `{ "success": true, "count": 10 }`

### 按台桌控制

- **路径**: `POST /api/switch/table-control`
- **请求体**: `{ "table_name_en": "putai1", "action": "OFF" }`
- **返回**: `{ "success": true, "count": 4, "table_name_en": "putai1" }`

### 错误返回

MQTT 发送失败时返回 HTTP 502：
```json
{ "error": "MQTT 发送失败：2/5 个失败", "details": ["MQTT 发送失败...", "..."] }
```

---

## 约客管理接口（2026-04-20更新）

### 锁定应约客人员

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/guest-invitations/lock-should-invite` | POST | 手动锁定（需权限校验） |
| `/api/guest-invitations/internal/lock` | POST | 自动锁定（内部调用，无权限校验） |
| `/api/guest-invitations/check-lock` | GET | 检查是否已锁定 |

#### POST /api/guest-invitations/lock-should-invite

**用途**：手动触发锁定应约客人员（管理员操作）

**认证**：需要登录 + `invitationReview` 权限

**请求体**：
```json
{
  "date": "2026-04-20",
  "shift": "早班"
}
```

**时间校验**：
- 早班锁定需在 16:00 后
- 晚班锁定需在 20:00 后

**响应示例**：
```json
{
  "success": true,
  "data": {
    "date": "2026-04-20",
    "shift": "早班",
    "locked_count": 4,
    "total_count": 4,
    "coaches": [{"coach_no":"10002","stage_name":"陆飞"}]
  }
}
```

#### POST /api/guest-invitations/internal/lock

**用途**：Cron 自动调用锁定应约客人员（无权限校验）

**认证**：无（仅允许 127.0.0.1 内部调用）

**请求体**：同上

**特殊处理**：
- 跳过 16:00/20:00 时间校验
- 操作人记录为 `cron_system` / `系统自动`

**响应示例**：同上

**错误响应**：
- `403` - 仅允许内部调用（非 127.0.0.1 来源）
- `400` - 今日已开始审查，无需重复锁定

---

## 规约客统计接口（2026-04-17新增）

### 按周期统计约客情况

- **路径**: `GET /api/guest-invitations/period-stats`
- **认证**: 需要认证（管理员/店长/助教管理权限）
- **权限**: `invitationStats`
- **参数**: `period` = `yesterday` | `day-before-yesterday` | `this-month` | `last-month`

**响应**:
```json
{
  "success": true,
  "data": {
    "period": "this-month",
    "period_label": "本月",
    "date_range": "2026-04-01 ~ 2026-04-17",
    "summary": {
      "not_invited": 11,
      "valid": 32,
      "invalid": 3,
      "pending": 1,
      "total_should": 46,
      "invite_rate": "69.6%"
    },
    "missed_coaches": [
      {
        "coach_no": 15,
        "employee_id": "A003",
        "stage_name": "小美",
        "photo_url": "http://...",
        "missed_count": 4
      }
    ]
  }
}
```

**统计规则**:
- 未约课 = `result = '应约客'`
- 有效约课 = `result = '约客有效'`
- 无效约课 = `result = '约客无效'`
- 待审查 = `result = '待审查'`（不计入约课率分母）
- 漏约助教 = `result IN ('应约客', '约客无效')`，按次数倒序

**约课率**: `valid / (not_invited + invalid + valid) × 100%`

**错误响应**:
- `400` - 缺少 period 参数 / 无效的 period 参数
- `401` - 未登录
- `403` - 权限不足
- `500` - 服务器错误

---

## 乐捐记录接口（2026-04-15新增，2026-04-15更新）

### 提交乐捐报备

- **路径**: `POST /api/lejuan-records`
- **认证**: 需要认证（助教权限）
- **请求体**:
  ```json
  {
    "employee_id": "26",
    "scheduled_start_time": "2026-04-15 14:00:00",
    "remark": "和客人外出"
  }
  ```
- **返回**:
  ```json
  {
    "success": true,
    "data": { "id": 1, "immediate": false }
  }
  ```
- **说明**: 
  - 提交乐捐预约，到时间自动生效。时间必须为整点且在未来。
  - **时间窗口**：当日 14:00 ~ 次日 01:00（12小时窗口）。
    - 00:00~00:59：可选 00:00、01:00
    - 01:00~01:59：可选 01:00
    - 02:00~13:59：可预约 14:00~23:00 + 次日 00:00、01:00
    - 14:00~23:59：可选当前整点~23:00 + 次日 00:00、01:00
  - **已删除 `extra_hours` 字段**（2026-04-15 优化）。
  - 重复报备检查：有待出发（pending）或乐捐中（active）记录时，弹提示阻止提交。

### 我的乐捐记录

- **路径**: `GET /api/lejuan-records/my`
- **认证**: 需要认证
- **参数**: `?employee_id=26`
- **返回**: 近2天的乐捐记录列表
- **排序规则**: 乐捐中（active）> 待出发（pending）> 已归来（returned），同状态内按预约时间倒序

### 乐捐一览（管理）

- **路径**: `GET /api/lejuan-records/list`
- **认证**: 需要后台权限（coachManagement）
- **参数**: `?status=pending|active|returned|all&days=3`
- **返回**: 所有符合条件的乐捐记录
- **页面功能**:
  - 显示乐捐付款截图（默认小图 50x50，点击可放大预览）
  - **已删除"乐捐归来"按钮**（2026-04-15 优化）

### 提交付款截图

- **路径**: `PUT /api/lejuan-records/:id/proof`
- **认证**: 需要认证
- **请求体**: `{ "proof_image_url": "https://..." }`
- **说明**: 仅限近2天的乐捐记录

### 乐捐结束流程（2026-04-15 更新）

**乐捐不再需要"乐捐归来"操作，改为助教自己点"上班"按钮结束乐捐：**

1. 助教在乐捐状态下，点击"上班"按钮（clock-in）
2. 后端自动检测该助教是否有 `active` 状态的乐捐记录
3. 如果有，自动计算乐捐时长（向上取整，最少1小时），更新记录为 `returned` 状态
4. 水牌状态自动恢复为对应班次的空闲状态（早班空闲/晚班空闲）

**API 端点**:
- **路径**: `POST /api/coaches/v2/:coach_no/clock-in`
- **说明**: 乐捐状态下调用此接口，自动结束乐捐并进入空闲状态

---

## 上下桌单接口变更（2026-04-15）

### 多桌上桌支持

- **上桌单**: 正在上桌的助教可以继续上其他桌，`table_no` 追加到列表
- **下桌单**: 需指定要下桌的台桌号，从列表中移除指定台桌号
- **台桌号格式**: 逗号分隔字符串 `"A1,A3,B2"`
- **API返回**: 增加 `table_no_list` 数组字段，如 `["A1", "A3"]`

### 上桌单状态限制（2026-04-20 新增）

- **禁止状态**: 以下水牌状态不允许提交上桌单
  - `下班`、`公休`、`早加班`、`晚加班`、`休息`、`请假`
- **允许状态**: 以下水牌状态允许提交上桌单
  - `早班空闲`、`晚班空闲` → 提交后状态变为 `早班上桌`/`晚班上桌`
  - `早班上桌`、`晚班上桌` → 支持多桌上桌，追加台桌号
- **错误提示**: `当前状态（{状态}）不允许提交上桌单`

---

## 申请列表接口变更（2026-04-15，2026-04-21 更新）

### 扩展参数

- **since**: 时间过滤，如 `?since=2026-04-13 00:00:00`
- **status**: 支持多值（逗号分隔），如 `?status=1,2`

### 近期已审批记录

- **路径**: `GET /api/applications/approved-recent`
- **认证**: 需要后台权限（coachManagement）
- **参数**: `?application_types=早加班申请,晚加班申请&days=2&status=1`
- **返回**: 近N天内已审批的记录，包含班次、工号、艺名、小时数、审批结果

### 当天已同意加班小时数（批量接口）

- **路径**: `GET /api/applications/today-approved-overtime`
- **认证**: 需要后台权限（waterBoardManagement）
- **参数**: 无
- **返回**: `{ "success": true, "data": { "<employee_id>": { "hours": 2, "coach_no": "10040", "shift": "早班" } } }`
- **说明**: 一次性返回当天所有已同意（status=1）的加班申请的小时数，key 为助教 employee_id。供水牌页面 30 秒刷新时使用，避免频繁调用。

### 撤销预约申请（2026-04-21 新增）

- **路径**: `POST /api/applications/:id/cancel-approved`
- **认证**: 需要后台权限（coachManagement）
- **参数**: id（URL路径参数，申请记录ID）
- **校验规则**:
  - 申请类型必须为「请假申请」或「休息申请」
  - 申请状态必须为已同意（status=1）
  - 当前时间必须 < 请假/休息日期 12:00
- **操作**: 取消 Timer + 更新状态为已撤销（status=3）
- **返回示例**:
  ```json
  { "success": true, "target_date": "2026-04-21", "new_status": 3 }
  ```
- **错误响应**:
  - 400：只能撤销请假/休息申请
  - 400：只能撤销已同意的申请
  - 400：撤销时间已截止（预约当日12:00前）
  - 404：申请记录不存在

### 申请状态定义

| status | 状态名称 |
|--------|----------|
| 0 | 待处理 |
| 1 | 已同意 |
| 2 | 已拒绝 |
| 3 | 已撤销（2026-04-21 新增） |

---

## 水牌显示优化（2026-04-16）

### V1.0 — 下班助教优化

- 删除「下班」筛选按钮
- 下班助教根据班次移入「早班空闲」/「晚班空闲」组，排在正常助教后面
- 下班助教卡片无头像、深灰色底、分行显示
- 下班助教当天有已同意加班时，卡片右上角显示红色粗体加班小时数（数字）
- 加班小时数批量接口一次返回所有

### V1.1 — 加班助教优化

- 删除「早加班」/「晚加班」筛选按钮
- 加班助教根据班次移入「早班空闲」/「晚班空闲」组，排在下班助教后面
- 加班助教卡片样式与下班助教一致（无头像、深灰色底）
- 加班助教卡片右上角显示红色粗体加班小时数（数字，不加 h 后缀）
- 下班和加班助教的工号/艺名使用灰白色字体
- 水牌管理页面长按下班/加班卡片可弹出修改状态菜单

### 分组排序规则

空闲组内卡片排序：正常助教（按 clock_in_time 倒序）→ 下班助教（按 updated_at 倒序）→ 加班助教（按 updated_at 倒序）

---

## 助教管理接口变更（2026-04-15）

### 水牌联动

| 操作 | 水牌联动 |
|------|----------|
| 删除助教 | 删除对应水牌记录 |
| 助教改为离职 | 删除对应水牌记录 |
| 离职改为全职/兼职 | 创建水牌记录（初始状态根据班次设置） |
| 修改班次 | 映射水牌状态（早班↔晚班） |

### 审批通过联动（2026-04-16 更新）

审批通过以下类型申请时，自动清除助教的 `table_no` 和 `clock_in_time`：
- 公休申请 → 状态改为「公休」，`table_no = NULL, clock_in_time = NULL`
- 早加班申请 → 状态改为「早加班」，`table_no = NULL, clock_in_time = NULL`
- 晚加班申请 → 状态改为「晚加班」，`table_no = NULL, clock_in_time = NULL`

---

## 奖罚管理（2026-04-18 新增）

### 奖罚类型配置

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/reward-penalty/types` | GET | 获取奖罚类型配置 |
| `/api/admin/reward-penalty/types` | PUT | 更新奖罚类型配置 |

### 奖罚数据 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/reward-penalty/upsert` | POST | 写入/更新/删除奖罚记录 |
| `/api/reward-penalty/list` | GET | 查询奖罚记录（按用户过滤） |
| `/api/reward-penalty/stats` | GET | 统计摘要（按人员分组，不含明细） |
| `/api/reward-penalty/stats/detail` | GET | 按人员查明细（弹框用） |
| `/api/reward-penalty/detail/:id` | POST | 修改明细金额（可改为0，不删除） |
| `/api/reward-penalty/stats/execute-person` | POST | 一键执行某人所有未执行明细 |
| `/api/reward-penalty/stats/summary` | GET | 金额汇总 |
| `/api/reward-penalty/batch-set` | POST | 批量设定奖金 |
| `/api/reward-penalty/targets` | GET | 获取目标人员列表 |
| `/api/reward-penalty/my-types` | GET | 获取当前用户可用的奖罚类型 |
| `/api/reward-penalty/execute/:id` | POST | 执行单条奖罚 |
| `/api/reward-penalty/unexecute/:id` | POST | 撤销执行 |
| `/api/reward-penalty/batch-execute` | POST | 批量执行奖罚 |

### 后台用户管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/users/:username/status` | PUT | 更新用户在职状态 |

### 数据库变更

- **新表**: `reward_penalties`（奖罚No/类型/确定日期/手机号/姓名/金额/备注/执行状态/执行日期）
- **唯一约束**: `UNIQUE(confirm_date, type, phone)`
- **新字段**: `admin_users.employment_status`（在职/离职）
- **新配置**: `system_config.reward_penalty_types`（JSON 数组）

### 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 奖金设定 | `/pages/internal/reward-penalty-set` | 店长给服务员设日奖 |
| 奖金查看 | `/pages/internal/reward-penalty-view` | 服务员/助教查看自己奖罚 |
| 奖罚统计 | `admin/reward-penalty-stats.html` | 人事执行奖罚，两阶段加载+弹框明细+金额编辑 |

---

## 系统报告接口

> QA3 & QA4 新增接口（2026-04-19）

### 系统运行概览

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/system-report/overview` | GET | 系统运行概览（计时器状态 + Cron 任务状态 + 最近执行日志） |
| `/api/system-report/timer-logs` | GET | 计时器生命周期日志 |
| `/api/system-report/cron-logs` | GET | Cron 执行历史 |
| `/api/system-report/cron-tasks` | GET | Cron 任务列表 |
| `/api/system-report/cron/:taskName/trigger` | POST | 手动触发 Cron 任务 |
| `/api/system-report/cron/:taskName/toggle` | POST | 启用/禁用 Cron 任务 |

#### GET /api/system-report/overview

**响应示例**：
```json
{
  "success": true,
  "timerStats": {
    "total": 2,
    "lejuan": 1,
    "application": 1
  },
  "cronTasks": [
    {
      "task_name": "end_lejuan_morning",
      "task_type": "end_lejuan",
      "description": "晚上23点自动结束早班助教的乐捐，水牌设为下班",
      "cron_expression": "0 23 * * *",
      "next_run": "2026-04-19 23:00:00",
      "is_enabled": 1
    },
    {
      "task_name": "end_lejuan_evening",
      "task_type": "end_lejuan",
      "description": "凌晨2点自动结束晚班助教的乐捐，水牌设为下班",
      "cron_expression": "0 2 * * *",
      "next_run": "2026-04-20 02:00:00",
      "is_enabled": 1
    },
    {
      "task_name": "sync_reward_penalty",
      "task_type": "sync_reward_penalty",
      "description": "中午12点奖罚自动同步（去重逻辑）",
      "cron_expression": "0 12 * * *",
      "next_run": "2026-04-20 12:00:00",
      "is_enabled": 1
    },
    {
      "task_name": "lock_guest_invitation_morning",
      "task_type": "lock_guest_invitation",
      "description": "下午16点自动锁定早班应约客人员",
      "cron_expression": "0 16 * * *",
      "next_run": "2026-04-21 16:00:00",
      "is_enabled": 1
    },
    {
      "task_name": "lock_guest_invitation_evening",
      "task_type": "lock_guest_invitation",
      "description": "晚上20点自动锁定晚班应约客人员",
      "cron_expression": "0 20 * * *",
      "next_run": "2026-04-21 20:00:00",
      "is_enabled": 1
    }
  ],
  "recentLogs": [...]
}
```

#### GET /api/system-report/timer-logs

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 计时器类型：lejuan / application |
| action | string | 否 | 事件类型：create / execute / cancel / recover / poll_miss |
| limit | number | 否 | 返回条数，默认 50 |

#### GET /api/system-report/cron-logs

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskName | string | 否 | 任务名称：end_lejuan_morning / end_lejuan_evening / sync_reward_penalty / lock_guest_invitation_morning / lock_guest_invitation_evening |
| status | string | 否 | 执行状态：success / failed |
| limit | number | 否 | 返回条数，默认 50 |

#### POST /api/system-report/cron/:taskName/trigger

**用途**：手动触发 Cron 任务（用于测试或紧急执行）

**响应示例**：
```json
{
  "success": true,
  "task": "end_lejuan_morning",
  "status": "success",
  "records_affected": 3,
  "details": "结束 早班 3 个 active 乐捐，水牌设为下班"
}
```

### 数据库变更

- **新表**: `timer_log`（计时器生命周期日志）
- **新表**: `cron_tasks`（Cron 任务配置）
- **新表**: `cron_log`（Cron 执行历史）
- **新字段**: `lejuan_records.extra_data`（JSON 字段，用于标记奖罚同步状态）

### 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 系统报告 | `admin/system-report.html` | 4 个 Tab：概览 / Cron 任务 / Cron 日志 / 计时器日志 |

---

## 活跃计时器接口（2026-04-20 新增）

> QA-20260420-3 新增接口：合并计时器系统后，统一查看所有活跃计时器

### GET /api/active-timers

**用途**：获取当前所有活跃的计时器列表（乐捐 + 申请），含完整助教信息

**响应示例**：
```json
{
  "success": true,
  "total": 2,
  "timers": [
    {
      "timerId": "lejuan_10080",
      "type": "lejuan",
      "coach_no": "10080",
      "employee_id": "80",
      "stage_name": "歪歪",
      "executeAt": "2026-04-20 23:00:00",
      "remainingMinutes": 180,
      "createdAt": "2026-04-20 10:00:00"
    },
    {
      "timerId": "app_rest_10083",
      "type": "application",
      "application_type": "休息申请",
      "coach_no": "10083",
      "employee_id": "80",
      "stage_name": "AA",
      "executeAt": "2026-04-21 14:00:00",
      "remainingMinutes": 960,
      "createdAt": "2026-04-20 12:00:00"
    }
  ]
}
```

**字段说明**：
| 字段 | 说明 |
|------|------|
| timerId | 计时器唯一标识 |
| type | 类型：lejuan / application |
| coach_no | 助教内部编号 |
| employee_id | 助教工号（页面显示用） |
| stage_name | 助教艺名 |
| executeAt | 执行时间（北京时间） |
| remainingMinutes | 剩余分钟数 |
| createdAt | 创建时间 |

---

## 助教休假日历接口（2026-04-21 新增）

> QA-20260421-2 新增接口：显示本月和下月每天的预计休息人数

### GET /api/leave-calendar/stats

**用途**：获取本月和下月的休假日历统计（每天预计休息人数）

**认证**：需要登录

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| yearMonth | string | 否 | 指定月份，格式 YYYY-MM，默认本月 |

**响应示例**：
```json
{
  "success": true,
  "data": {
    "currentMonth": {
      "yearMonth": "2026-04",
      "days": {
        "2026-04-02": 3,
        "2026-04-06": 2,
        "2026-04-10": 1
      }
    },
    "nextMonth": {
      "yearMonth": "2026-05",
      "days": {
        "2026-05-01": 5,
        "2026-05-03": 2
      }
    }
  }
}
```

**字段说明**：
| 字段 | 说明 |
|------|------|
| currentMonth.yearMonth | 当前月份 |
| currentMonth.days | 每天的休息人数对象 {"YYYY-MM-DD": count} |
| nextMonth.yearMonth | 下个月份 |
| nextMonth.days | 下月每天的休息人数 |

**统计逻辑**：统计 `status=1`（已同意）的请假申请 + 休息申请，按日期分组计算 `COUNT(DISTINCT applicant_phone)`

---

### GET /api/leave-calendar/day-count

**用途**：获取指定日期的预计休息人数

**认证**：需要登录

**请求参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 是 | 日期，格式 YYYY-MM-DD |

**响应示例**：
```json
{
  "success": true,
  "data": {
    "date": "2026-04-27",
    "count": 3
  }
}
```

**用途说明**：用于请假审批和休息审批页面显示预计休息人数，帮助审批人判断是否同意申请。

---

### 架构改进

**重构前**（三套独立系统）：
- TimerManager、LejuanTimer、ApplicationTimer 三套独立轮询
- 三套内存 Map 分散存储

**重构后**（单一管理中心）：
- TimerManager 成为唯一计时器管理中心
- 一套 activeTimers Map 统一存储所有计时器
- coachInfo 内存存储助教完整信息

---

## 申请审批时间段校验（QA-20260420-4）

### 时间段限制规则

| 操作类型 | 时间段 | 违规处理 |
|---------|--------|---------|
| 加班/公休申请提交 | 0:00 - 14:00 | ≥14:01 拒绝，提示「申请时间已截止」 |
| 加班/公休审批 | 12:00 - 18:00 | <12或≥18:01 拒绝，提示「审批时间仅限12-18点」 |
| 加班/公休过期审批 | 只能审批当天申请 | 过期申请同意时拒绝，提示「只能拒绝不能同意」 |
| 请假/休息审批 | 12:00 - 18:00 | <12或≥18:01 拒绝 |

### 水牌状态校验规则

| 操作类型 | 前置状态要求 | 状态不符时处理 |
|---------|------------|--------------|
| 加班/公休申请提交 | 必须是「下班」 | API拒绝（返回400） |
| 加班/公休审批同意 | 「下班」才能修改水牌 | 审批成功，不修改水牌 |
| 请假/休息审批同意（当天+已过12点） | 离店状态才能修改水牌 | 审批成功，不修改水牌 |
| 请假/休息审批同意（未来） | 不检查 | 设置Timer，Timer到期再判断 |
| Timer执行恢复 | 必须是「请假」或「休息」 | 跳过恢复，记录skip_reason |

### 请假/休息Timer逻辑

**当天+已过12点**：不设置Timer，直接修改水牌（如果水牌是离店状态）
**未来日期或当天未过12点**：设置Timer，Timer在请假/休息日期的12:00执行恢复

### 前端提示栏

每个申请/审批页面顶部显示提示栏，根据时间段变色：
- **绿色**：时间段正常
- **红色**：时间段已过期
- **黄色**：水牌状态不符或日期限制提示

---

*文档更新时间：2026年4月20日 23:15*

---

### 乐捐归来（增强版）

**接口**: `POST /api/lejuan-records/:id/return`

**权限**: `coachManagement`（店长、管理员、助教管理、教练）

**功能**: 结束乐捐记录，计算乐捐时长，更新水牌状态

#### 计算逻辑

1. **下班时间计算**:
   - 早班助教: 当天 23:00
   - 晚班助教: 次日 02:00

2. **时间对比**:
   - 当前时间 >= 下班时间: 按下班时间计算时长，水牌设为"下班"
   - 当前时间 < 下班时间: 按当前时间计算时长，水牌设为"空闲"

3. **乐捐时长计算**:
   - baseHours = 时间差小时数（向下取整）
   - extraHour = 结束分钟 > 10 ? 1 : 0
   - lejuan_hours = Math.max(1, baseHours + extraHour)

4. **水牌状态检查**:
   - 只有水牌当前状态为"乐捐"时才更新水牌
   - 其他状态（上桌、下班、请假等）不修改水牌

#### 请求参数

```json
{
  "operator": "操作人手机号或用户名"
}
```

#### 返回示例

```json
{
  "success": true,
  "data": {
    "id": 123,
    "lejuan_hours": 2,
    "return_time": "2026-04-21 11:30:00",
    "stage_name": "小泡",
    "water_status": "早班空闲",
    "water_updated": true
  }
}
```

#### 测试用例

| 场景 | 班次 | 水牌状态 | 预期结果 |
|------|------|---------|---------|
| 未过下班时间 + 分钟>10 | 早班 | 乐捐 | lejuan_hours=baseHours+1, 水牌=早班空闲 |
| 未过下班时间 + 分钟<=10 | 早班 | 乐捐 | lejuan_hours=baseHours, 水牌=早班空闲 |
| 未过下班时间 | 晚班 | 乐捐 | 水牌=晚班空闲 |
| 水牌非乐捐 | 早班 | 早班上桌 | water_updated=false, 水牌不变 |
| 水牌非乐捐 | 早班 | 下班 | water_updated=false, 水牌不变 |
| 班次为null | null | 乐捐 | 按晚班处理, 水牌=晚班空闲 |
| 刚开始乐捐 | 早班 | 乐捐 | lejuan_hours=1（最小值） |

---

## 鉴权配置（QA-20260422-3）

### 功能说明

一键关闭所有 API 鉴权机制。关闭后所有后台 API 无需 token 直接放行，适用于开发测试环境。

⚠️ **警告**：生产环境强烈不建议关闭！关闭后任何人都可以访问管理功能、修改数据。

### API 接口

#### 获取鉴权配置

- **路径**: `GET /api/admin/auth-config`
- **认证**: 独立验证（不走 authMiddleware）
- **参数**: 无
- **返回**: 
  ```json
  { "enabled": true }
  ```
- **说明**: 返回当前鉴权开关状态

#### 更新鉴权配置

- **路径**: `PUT /api/admin/auth-config`
- **认证**: 独立验证（必须提供有效管理员 token）
- **参数**: 
  | 参数 | 类型 | 必填 | 说明 |
  |------|------|------|------|
  | enabled | boolean | 是 | true=启用鉴权, false=关闭鉴权 |
- **返回**: 
  ```json
  { "success": true, "message": "鉴权已关闭" }
  ```
- **说明**: 更新鉴权开关，同时更新数据库和内存缓存

### 实现机制

| 组件 | 说明 |
|------|------|
| 内存缓存 | `authEnabledCache` 变量，服务启动时从数据库加载 |
| authMiddleware | 每次请求检查缓存，关闭时直接放行 |
| 数据库存储 | `system_config` 表，key=`auth_enabled` |
| 自动初始化 | 数据库无记录时自动插入默认值 `true` |

### 使用方式

**后台页面**：settings.html → 「API鉴权配置」卡片

**注意事项**：
1. 配置修改 API 独立验证，即使关闭鉴权仍需 token
2. 关闭时设置 `{ role: '管理员', userType: 'system' }` 绕过权限检查
3. 操作日志记录每次切换行为

---

### 系统配置总览

#### 获取所有系统配置

- **路径**: `GET /api/admin/system-config/all`
- **认证**: 需要后台权限
- **参数**: 无
- **返回**: 
  ```json
  {
    "success": true,
    "data": [
      {
        "key": "sms_provider",
        "value": "kltx",
        "description": "短信服务商: aliyun / kltx",
        "updated_at": "2026-03-27 11:27:48"
      },
      {
        "key": "auth_enabled",
        "value": "true",
        "description": "API鉴权开关",
        "updated_at": "2026-04-23 00:15:47"
      },
      ...
    ]
  }
  ```
- **说明**: 返回 system_config 表所有数据，仅供查看，不可修改
- **用途**: 后台管理页面「系统配置」→「配置总览」板块
- **更新时间**: 2026-04-23

---

*文档更新时间：2026年4月23日 07:15*


## 前端错误上报系统 (2026-04-23 更新)

### 系统架构

天宫国际前端错误上报系统分为两部分：
- **H5 前端（UniApp Vue）**: 使用统一的 `errorReporter` 框架（`/utils/error-reporter.js`）
- **后台 Admin HTML**: 使用独立的 `reportFrontendError` 函数（各页面内嵌）

### H5 前端错误上报

**位置**: `/TG/tgservice-uniapp/src/utils/error-reporter.js`

**特性**:
- 全局自动捕获：Vue错误、JS错误、Promise未捕获
- 去重：1分钟内同类型错误只上报一次
- 日志文件：写入 `/logs/frontend-error.log`
- API endpoint: `/admin/frontend-error-log`

**使用方式**:
```javascript
import errorReporter from "@/utils/error-reporter.js";

// 业务追踪
errorReporter.track("action_name", { detail1: "value1" });

// 错误上报
errorReporter.report({ type: "custom_error", message: "错误信息" });
```

### 后台 Admin HTML 错误上报（2026-04-23 改进）

**改进内容**:
- 添加去重逻辑（60秒内同类型错误只上报一次）
- 补充完整信息：
  - `apiUrl`: 调用的具体 API URL
  - `apiMethod`: GET/POST 等
  - `userRole`: 从 JWT token 解析的用户角色
  - `username`: 从 JWT token 解析的用户名
- 添加 `parseUserInfo()` 函数解析 JWT token

**日志格式**:
```json
{
  "type": "admin_frontend_error",
  "action": "API Error",
  "apiUrl": "/api/admin/orders",
  "apiMethod": "GET",
  "status": 403,
  "userRole": "收银",
  "username": "tgcashier",
  "timestamp": "2026-04-23 09:10:00",
  "url": "https://tiangong.club/admin/cashier-dashboard.html",
  "userAgent": "Mozilla/5.0...",
  "state": { "filters": {...}, "soundEnabled": true }
}
```

### 注意事项

- API endpoint 路径为 `/admin/frontend-error-log`（不带 `/api` 前缀）
- BASE_URL 已包含 `/api`，最终 URL 为 `https://tiangong.club/api/admin/frontend-error-log`
- 日志保留 3 天，存储在 `/TG/run/logs/frontend-error.log`（生产环境）


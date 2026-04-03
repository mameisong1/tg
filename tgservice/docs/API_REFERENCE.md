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
    "quantity": 1
  }
  ```
- **返回**: 
  ```json
  { "success": true, "cartId": 123 }
  ```
- **说明**: 添加商品到购物车，如果商品已存在则增加数量

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
        "image_url": "图片URL"
      }
    ],
    "totalPrice": 20.00
  }
  ```
- **说明**: 获取指定会话的购物车内容

### 更新购物车商品数量

- **路径**: `PUT /api/cart`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "productName": "商品名称",
    "quantity": 3
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 更新购物车中指定商品的数量

### 删除购物车商品

- **路径**: `DELETE /api/cart`
- **参数**: 
  ```json
  {
    "sessionId": "会话ID",
    "productName": "商品名称"
  }
  ```
- **返回**: 
  ```json
  { "success": true }
  ```
- **说明**: 从购物车中删除指定商品

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
    "isNew": false
  }
  ```
- **说明**: 使用手机号和验证码登录，新用户自动注册

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
    "username": "tgadmin"
  }
  ```
- **说明**: 后台管理员登录

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
| `/api/admin/orders` | GET | 获取订单列表 |
| `/api/admin/orders/:id/complete` | POST | 完成订单 |
| `/api/admin/orders/:id/cancel` | POST | 取消订单 |
| `/api/admin/orders/:id/cancel-item` | POST | 取消订单中的单个商品 |

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

### 会员管理

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/admin/members` | GET | 获取会员列表 |
| `/api/admin/members` | POST | 创建会员 |
| `/api/admin/members/:memberNo` | PUT | 更新会员 |

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

### 设备统计

- **路径**: `GET /api/admin/device-stats`
- **返回**: 设备访问统计数据
- **说明**: 获取设备访问统计（用于分析用户来源）

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

### 获取OSS临时凭证

- **路径**: `GET /api/oss/sts`
- **返回**: 
  ```json
  {
    "accessKeyId": "临时AK",
    "accessKeySecret": "临时SK",
    "stsToken": "STS Token",
    "expiration": "过期时间",
    "bucket": "bucket名称",
    "region": "区域"
  }
  ```
- **说明**: 获取阿里云OSS STS临时凭证，用于前端直传

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
      "expireMinutes": 30
    },
    "env": {
      "name": "production"
    }
  }
  ```
- **说明**: 获取前端配置，包括扫码台桌授权有效期等。测试环境 expireMinutes 为 5，生产环境为 30。

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

---

*文档更新时间：2026年3月*

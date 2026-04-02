# 天宫国际 - 系统架构文档

本文档描述系统的整体架构设计、模块划分和数据流。

---

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           客户端层                                   │
├───────────────────┬───────────────────┬───────────────────────────────┤
│   微信小程序       │      H5 网页       │        管理后台              │
│  (MP-WEIXIN)      │    (浏览器)        │      (Web Admin)             │
│                   │                   │                              │
│  - 微信登录        │  - 短信登录        │  - 商品管理                   │
│  - 扫码选台        │  - 扫码授权        │  - 助教管理                   │
│  - 商品浏览        │  - 购物/下单       │  - 订单管理                   │
│  - 购物车/下单     │  - 助教打榜        │  - 台桌管理                   │
│  - 助教打榜        │                   │  - 数据分析                   │
└────────┬──────────┴─────────┬─────────┴──────────────┬───────────────┘
         │                    │                        │
         ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API 网关层                                  │
│                         (Nginx 反向代理)                             │
│                                                                     │
│  - SSL/HTTPS 终止                                                   │
│  - 静态资源服务 (H5 页面)                                            │
│  - API 请求转发 (/api/* → Node.js)                                  │
│  - 请求限流 & 安全防护                                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         应用服务层                                   │
│                    (Node.js + Express)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  商品模块    │  │  助教模块    │  │  会员模块    │  │  订单模块    │ │
│  │             │  │             │  │             │  │             │ │
│  │ - 列表查询   │  │ - 助教列表   │  │ - 微信登录   │  │ - 购物车     │ │
│  │ - 分类筛选   │  │ - 详情展示   │  │ - 短信登录   │  │ - 下单      │ │
│  │ - 增删改    │  │ - 登录验证   │  │ - Token    │  │ - 订单列表   │ │
│  │            │  │ - 人气投票   │  │            │  │ - 状态更新   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  台桌模块    │  │  上传模块    │  │  通知模块    │                  │
│  │             │  │             │  │             │                  │
│  │ - 台桌管理   │  │ - 图片上传   │  │ - 钉钉通知   │                  │
│  │ - 二维码    │  │ - OSS存储   │  │ - 订单提醒   │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│                                                                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    SQLite       │  │   阿里云 OSS     │  │   钉钉 API      │
│    数据库       │  │   文件存储       │  │   消息推送      │
│                 │  │                 │  │                 │
│ - coaches      │  │ - 商品图片       │  │ - 新订单通知    │
│ - products     │  │ - 助教照片       │  │ - 加签验证      │
│ - orders       │  │ - 助教视频       │  │                 │
│ - carts        │  │                 │  │                 │
│ - members      │  │                 │  │                 │
│ - tables       │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 2. 目录结构

### 2.1 后端目录 (`/TG/tgservice/backend/`)

```
backend/
├── server.js           # 主入口，包含所有 API 路由和业务逻辑
├── package.json        # 依赖管理
├── tiangong.db         # SQLite 数据库文件
└── logs/               # 日志目录
    ├── app.log         # 应用日志
    ├── error.log       # 错误日志
    └── operation.log   # 操作日志
```

### 2.2 前端目录 (`/TG/tgservice-uniapp/src/`)

```
src/
├── App.vue             # 应用入口，全局生命周期
├── main.js             # Vue 入口
├── manifest.json       # uni-app 配置（小程序/H5/App）
├── pages.json          # 页面路由配置
│
├── pages/              # 页面组件
│   ├── index/          # 首页
│   │   └── index.vue
│   ├── products/       # 商品列表
│   │   └── products.vue
│   ├── product-detail/ # 商品详情
│   │   └── product-detail.vue
│   ├── cart/           # 购物车
│   │   └── cart.vue
│   ├── coaches/        # 助教列表
│   │   └── coaches.vue
│   ├── coach-detail/   # 助教详情
│   │   └── coach-detail.vue
│   ├── coach-login/    # 助教登录
│   │   └── coach-login.vue
│   ├── coach-profile/  # 助教个人中心
│   │   └── coach-profile.vue
│   ├── member/         # 会员中心
│   │   └── member.vue
│   ├── login/          # 登录页
│   │   └── login.vue
│   └── admin/          # 管理后台（内嵌）
│       └── admin.vue
│
├── components/         # 公共组件
│   ├── nav-bar.vue     # 导航栏
│   ├── tab-bar.vue     # 底部导航
│   ├── product-card.vue # 商品卡片
│   └── coach-card.vue  # 助教卡片
│
├── utils/              # 工具函数
│   ├── api.js          # API 请求封装
│   ├── config.js       # 环境配置
│   └── utils.js        # 通用工具
│
├── static/             # 静态资源
│   ├── images/         # 图片
│   └── icons/          # 图标
│
└── uni_modules/        # uni-app 插件
```

### 2.3 项目根目录 (`/TG/tgservice/`)

```
tgservice/
├── .config             # 后端配置文件
├── deploy-h5.sh        # H5 部署脚本
├── backend/            # 后端代码
├── docs/               # 项目文档
│   ├── PROJECT_OVERVIEW.md
│   ├── API_REFERENCE.md
│   ├── DATA_MODELS.md
│   ├── FRONTEND_GUIDE.md
│   ├── BUSINESS_LOGIC.md
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── CONFIGURATION.md
└── ...
```

---

## 3. 模块划分

### 3.1 后端模块

| 模块 | 职责 | 主要接口 |
|------|------|----------|
| **商品模块** | 商品CRUD、分类管理 | `GET/POST/PUT/DELETE /api/products` |
| **助教模块** | 助教信息、登录、人气 | `GET/POST/PUT /api/coaches/*` |
| **会员模块** | 登录、注册、Token | `/api/member/wechat-login`, `/api/member/sms-login` |
| **购物车模块** | 购物车CRUD | `GET/POST/PUT/DELETE /api/cart` |
| **订单模块** | 下单、订单管理 | `GET/POST/PUT /api/order` |
| **台桌模块** | 台桌管理 | `GET/POST/PUT/DELETE /api/tables` |
| **上传模块** | 文件上传到OSS | `POST /api/upload/image`, `/api/upload/video` |
| **通知模块** | 钉钉消息推送 | 内部函数 `sendDingtalkMessage()` |

### 3.2 前端模块

| 模块 | 页面 | 功能 |
|------|------|------|
| **首页模块** | index | 热销商品、人气助教展示 |
| **商品模块** | products, product-detail | 商品浏览、详情、加购 |
| **购物车模块** | cart | 购物车管理、下单 |
| **助教模块** | coaches, coach-detail | 助教浏览、详情、投票 |
| **助教中心** | coach-login, coach-profile | 助教登录、资料编辑 |
| **会员模块** | member, login | 会员登录、个人中心 |
| **管理模块** | admin | 后台管理入口 |

---

## 4. 数据流说明

### 4.1 下单数据流

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端    │     │  Nginx   │     │  Node.js │     │  SQLite  │
│ (用户)   │     │ (代理)   │     │ (API)    │     │ (数据库) │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1.点击下单     │                │                │
     │───────────────>│                │                │
     │                │ 2.转发请求     │                │
     │                │───────────────>│                │
     │                │                │ 3.查询购物车    │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │                │ 4.返回商品列表  │
     │                │                │                │
     │                │                │ 5.验证台桌号    │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │                │                │
     │                │                │ 6.创建订单      │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │                │                │
     │                │                │ 7.发钉钉通知    │
     │                │                │──────┐         │
     │                │                │      │ (异步)  │
     │                │                │<─────┘         │
     │                │                │                │
     │                │                │ 8.清空购物车    │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │<───────────────│                │
     │<───────────────│ 9.返回成功     │                │
     │  10.显示结果   │                │                │
```

### 4.2 会员登录数据流（微信）

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  小程序   │     │  Node.js │     │  微信API  │     │  SQLite  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1.wx.login()   │                │                │
     │──────┐         │                │                │
     │<─────┘ code    │                │                │
     │                │                │                │
     │ 2.发送code     │                │                │
     │───────────────>│                │                │
     │                │ 3.换取openid   │                │
     │                │───────────────>│                │
     │                │<───────────────│                │
     │                │  openid        │                │
     │                │                │                │
     │                │ 4.查询会员     │                │
     │                │───────────────>│<──────────────>│
     │                │                │                │
     │                │ 5.生成Token   │                │
     │                │──────┐         │                │
     │                │<─────┘ JWT     │                │
     │                │                │                │
     │<───────────────│                │                │
     │  6.返回token   │                │                │
     │                │                │                │
     │ 7.存储token    │                │                │
     │──────┐         │                │                │
     │<─────┘         │                │                │
```

### 4.3 图片上传数据流

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  前端    │     │  Node.js │     │  OSS SDK │     │ 阿里云OSS │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1.选择图片     │                │                │
     │──────┐         │                │                │
     │<─────┘ file    │                │                │
     │                │                │                │
     │ 2.上传请求     │                │                │
     │───────────────>│                │                │
     │                │ 3.生成key     │                │
     │                │──────┐         │                │
     │                │<─────┘ key     │                │
     │                │                │                │
     │                │ 4.put(key,buf)│                │
     │                │───────────────>│                │
     │                │                │───────────────>│
     │                │                │<───────────────│
     │                │<───────────────│                │
     │                │  url           │                │
     │                │                │                │
     │<───────────────│                │                │
     │  5.返回URL     │                │                │
```

---

## 5. 前后端交互方式

### 5.1 API 规范

- **协议**: HTTPS
- **数据格式**: JSON
- **认证方式**: Bearer Token（JWT）
- **基础URL**: `https://your-domain.com/api`

### 5.2 请求格式

```javascript
// 通用请求头
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"  // 需要认证时
}

// 请求体示例
{
  "sessionId": "sess_xxx",
  "tableNo": "普台1号",
  "productName": "啤酒",
  "quantity": 2
}
```

### 5.3 响应格式

```javascript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应
{
  "error": "错误描述信息"
}

// 列表响应
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### 5.4 前端 API 封装

```javascript
// utils/api.js
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://xxx.com/api'
  : 'http://localhost:3000/api';

export const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token');
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail: reject
    });
  });
};

export const api = {
  get: (url, data) => request({ url, data }),
  post: (url, data) => request({ url, method: 'POST', data }),
  put: (url, data) => request({ url, method: 'PUT', data }),
  delete: (url, data) => request({ url, method: 'DELETE', data })
};
```

---

## 6. 条件编译架构（H5/小程序）

### 6.1 条件编译语法

uni-app 使用特殊注释实现条件编译：

```vue
<template>
  <!-- #ifdef MP-WEIXIN -->
  <button open-type="getUserInfo">微信登录</button>
  <!-- #endif -->
  
  <!-- #ifdef H5 -->
  <button @click="smsLogin">短信登录</button>
  <!-- #endif -->
</template>

<script>
export default {
  methods: {
    login() {
      // #ifdef MP-WEIXIN
      this.wechatLogin();
      // #endif
      
      // #ifdef H5
      this.smsLogin();
      // #endif
    }
  }
}
</script>

<style>
/* #ifdef H5 */
.container { padding-top: 44px; }  /* H5 需要留出导航栏空间 */
/* #endif */
</style>
```

### 6.2 平台差异处理

| 功能 | 微信小程序 | H5 |
|------|-----------|-----|
| **登录** | wx.login() + openid | 短信验证码 |
| **台桌选择** | 扫码 + Storage | 扫码 + 30分钟授权 |
| **支付** | wx.requestPayment | 暂不支持 |
| **分享** | wx.showShareMenu | 无 |
| **下拉刷新** | 原生支持 | 需要组件 |
| **导航栏** | 原生 | 自定义组件 |

### 6.3 关键平台差异代码

#### 登录处理

```javascript
// pages/login/login.vue
methods: {
  async handleLogin() {
    // #ifdef MP-WEIXIN
    const { code } = await uni.login({ provider: 'weixin' });
    const res = await api.post('/member/wechat-login', { code });
    // #endif
    
    // #ifdef H5
    // H5 跳转到短信登录页
    uni.navigateTo({ url: '/pages/sms-login/sms-login' });
    return;
    // #endif
    
    if (res.success) {
      uni.setStorageSync('token', res.token);
    }
  }
}
```

#### 台桌授权

```javascript
// App.vue
onLaunch() {
  // #ifdef H5
  this.checkH5Auth();
  // #endif
  
  // #ifdef MP-WEIXIN
  // 小程序不需要特殊授权检查
  // #endif
}

// #ifdef H5
checkH5Auth() {
  const query = this.getUrlParams();
  if (query.table) {
    if (query.table === 'clear') {
      this.clearAuth();
    } else {
      uni.setStorageSync('h5SessionTable', query.table);
      uni.setStorageSync('h5SessionTime', Date.now());
    }
  }
}
// #endif
```

#### 样式适配

```scss
// H5 需要处理安全区域
/* #ifdef H5 */
.page-container {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.fixed-bottom {
  bottom: constant(safe-area-inset-bottom);
  bottom: env(safe-area-inset-bottom);
}
/* #endif */

// 小程序使用原生导航栏
/* #ifdef MP-WEIXIN */
.custom-nav { display: none; }
/* #endif */
```

### 6.4 构建配置

```json
// manifest.json 部分配置
{
  "mp-weixin": {
    "appid": "wx...",
    "setting": {
      "urlCheck": false
    }
  },
  "h5": {
    "title": "天宫国际",
    "router": {
      "mode": "history",
      "base": "/"
    },
    "devServer": {
      "proxy": {
        "/api": {
          "target": "http://localhost:3000"
        }
      }
    }
  }
}
```

---

## 7. 技术栈总结

| 层次 | 技术 | 说明 |
|------|------|------|
| **前端框架** | uni-app + Vue 2 | 跨平台开发 |
| **UI组件** | uni-ui | 官方组件库 |
| **后端框架** | Node.js + Express | RESTful API |
| **数据库** | SQLite | 轻量级嵌入式 |
| **文件存储** | 阿里云 OSS | 图片/视频存储 |
| **消息推送** | 钉钉 API | 订单通知 |
| **进程管理** | PM2 | 后端进程守护 |
| **反向代理** | Nginx | SSL/静态资源/代理 |
| **认证** | JWT | 无状态认证 |

---

## 8. 安全架构

### 8.1 传输安全
- HTTPS 全站加密
- Nginx SSL 证书配置

### 8.2 认证安全
- JWT Token 认证
- Token 30天过期
- 敏感操作需要二次验证

### 8.3 数据安全
- 助教身份证信息脱敏存储
- SQL 参数化查询（防注入）
- 日志脱敏处理

### 8.4 业务安全
- 人气投票防刷机制
- 短信发送频率限制
- H5 授权30分钟过期

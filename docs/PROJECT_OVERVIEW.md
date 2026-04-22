# 天宫国际台球厅服务系统 - 项目概览

## 项目简介

**天宫国际台球厅服务系统** 是为中山市开火体育文化有限公司（天宫国际台球城）开发的线上服务平台，提供商品点单、助教预约、VIP包房预订等功能，同时配套后台管理系统。

### 核心价值

- 🎱 顾客可通过小程序/H5自助点单，提升服务效率
- 👩‍🏫 助教展示和预约功能，增强用户体验
- 🏠 VIP包房在线展示和预约
- 📊 后台统一管理商品、订单、会员等数据

---

## 技术栈

### 后端 (Backend)

| 技术 | 说明 |
|------|------|
| **Node.js** | 运行时环境 |
| **Express 4.x** | Web框架 |
| **SQLite** (sqlite3) | 轻量级关系型数据库，WAL模式 |
| **bcryptjs** | 密码加密 |
| **jsonwebtoken** | JWT身份认证 |
| **multer** | 文件上传处理 |
| **阿里云 OSS** | 对象存储（图片/视频） |
| **阿里云短信服务** | 验证码发送 |
| **winston** | 日志管理 |

> **2026-04-12 变更**：数据库连接统一为单连接架构（`db/index.js` 是唯一连接中心），避免多连接竞争导致的 SQLITE_BUSY 错误。所有路由和 server.js 都从 `db/index.js` 获取连接。

### 前端 (Frontend)

| 技术 | 说明 |
|------|------|
| **UniApp** | 跨平台开发框架 |
| **Vue 3** | 前端框架 (Composition API) |
| **Vite** | 构建工具 |
| **html5-qrcode** | 二维码扫描 |
| **条件编译** | 支持H5、微信小程序、支付宝小程序等多端 |

---

## 核心功能模块

### 1. 用户端功能

#### 🏠 首页
- 轮播banner展示活动
- 公告通知
- 热门商品推荐
- 人气助教推荐

#### 🛒 商品点单
- 商品分类浏览
- 商品详情查看
- 购物车管理（增删改）
- 台桌选择（扫码进入自动绑定）
- 提交订单

#### 👩‍🏫 助教服务
- 助教列表展示（照片、等级、价格）
- 助教详情页（个人介绍、视频展示）
- 人气排行

#### 🏠 VIP包房
- 包房列表展示
- 包房详情（图片、视频、简介）
- 在线预约（跳转电话/微信）

#### 👤 会员中心
- 手机号登录（短信验证码）
- 微信一键登录
- 个人信息管理
- 订单记录

### 2. 助教端功能

- 助教登录（工号+身份证后6位）
- 个人信息管理
- 头像/照片/视频上传
- 个人介绍编辑

### 3. 后台管理功能

- 管理员登录（JWT认证，支持密码登录和验证码登录）
- 数据看板（订单统计、会员统计、设备访问统计）
- 商品管理（分类、商品CRUD）
- 助教管理（信息、照片、视频）
- 会员管理
- 台桌管理（二维码生成）
- VIP包房管理
- 首页配置（banner、公告、热门推荐）
- 操作日志
- 用户管理
- 系统配置

#### 角色权限控制

| 角色 | 可访问目录 | 禁止访问 | 说明 |
|------|------------|----------|------|
| 管理员 | 全部 | 无 | 超级管理员，全部权限 |
| 店长 | 数据概览、管理、前厅、助教 | 系统 | 可管理用户，但不能授权管理员角色 |
| 助教管理 | 助教 | 其他所有目录 | 仅助教列表、批量更新班次 |
| 前厅领班 | 前厅 | 其他所有目录 | 收银看板、商品管理、包房管理、台桌管理、商品分类 |
| 收银 | 前厅（仅收银看板） | 其他所有目录 | 仅收银看板 |
| 教练 | ❌ 禁止登录后台 | 全部 | 登录后跳转登录页 |
| 服务员 | ❌ 禁止登录后台 | 全部 | 登录后跳转登录页 |

> **2026-04-23 变更**：完善角色权限控制，新增验证码登录功能，店长不能授权管理员角色。

---

## 项目结构

```
/TG/
├── tgservice/                    # 后端项目
│   ├── backend/
│   │   ├── server.js             # 主服务入口（从 db/index.js 获取连接）
│   │   ├── db/
│   │   │   └── index.js          # ⭐ 数据库连接中心（单连接）
│   │   ├── package.json
│   │   └── logs/                 # 日志目录
│   ├── db/
│   │   └── tgservice.db          # SQLite数据库
│   ├── uploads/                  # 本地上传目录
│   └── docs/                     # 文档目录
│
├── tgservice-uniapp/             # 前端项目
│   ├── src/
│   │   ├── pages/                # 页面目录
│   │   ├── components/           # 公共组件
│   │   ├── utils/                # 工具函数
│   │   ├── store/                # 状态管理
│   │   ├── static/               # 静态资源
│   │   ├── pages.json            # 页面配置
│   │   └── manifest.json         # 应用配置
│   └── package.json
│
└── data/                         # 初始数据文件
    ├── taikeduo-products.json    # 商品数据
    └── taikeduo-tables.json      # 台桌数据
```

---

## 部署信息

### 后端部署

```bash
# 安装依赖
cd /TG/tgservice/backend
npm install

# 初始化数据库（首次部署）
node init-db.js

# 启动服务
node server.js
# 或使用 PM2
pm2 start server.js --name tgservice
```

**服务配置**：
- 默认端口：8081
- 数据库路径：`/TG/tgservice/db/tgservice.db`
- 日志路径：`/TG/tgservice/backend/logs/`

### 前端部署

```bash
cd /TG/tgservice-uniapp

# 安装依赖
npm install

# 开发模式（H5）
npm run dev:h5

# 开发模式（微信小程序）
npm run dev:mp-weixin

# 构建H5
npm run build:h5

# 构建微信小程序
npm run build:mp-weixin
```

### 环境变量配置

后端配置文件 `/TG/tgservice/backend/.config`：

```javascript
module.exports = {
  server: { port: 8081 },
  jwt: { secret: 'your-jwt-secret', expiresIn: '24h' },
  aliyun: {
    oss: {
      accessKeyId: 'xxx',
      accessKeySecret: 'xxx',
      bucket: 'xxx',
      region: 'xxx'
    },
    sms: {
      accessKeyId: 'xxx',
      accessKeySecret: 'xxx',
      signName: 'xxx',
      templateCode: 'xxx'
    }
  }
};
```

---

## 访问地址

| 服务 | 地址 |
|------|------|
| API服务 | http://localhost:8081 |
| 后台管理 | http://localhost:8081/frontend/index.html |
| 健康检查 | http://localhost:8081/api/health |

---

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 后台管理员 | tgadmin | mms633268 |

---

## 技术特点

1. **轻量级架构**：使用SQLite数据库，无需安装MySQL/PostgreSQL，部署简单
2. **跨平台支持**：基于UniApp，一套代码编译到H5、微信小程序、支付宝小程序等多端
3. **云存储集成**：图片和视频上传到阿里云OSS，支持STS临时凭证
4. **短信验证**：集成阿里云短信服务，支持手机号验证码登录
5. **数据保护**：数据库初始化脚本带有防重复导入机制
6. **日志系统**：使用winston进行结构化日志记录

---

## 联系方式

**运营公司**：中山市开火体育文化有限公司  
**项目名称**：天宫国际台球城线上服务系统

---

*文档更新时间：2026年3月*

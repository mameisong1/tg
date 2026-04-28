# 天宫国际线上服务系统

## 项目概述

天宫国际线上服务系统是中山天宫国际台球厅的线上服务平台，提供商品点单、助教预约等功能。

## 项目结构

```
/TG/tgservice/
├── backend/           # 后端服务 (Express + SQLite)
│   ├── server.js      # 主服务文件
│   └── init-db.js     # 数据库初始化
├── frontend/          # 原移动网页版（已废弃，不再维护）
│   └── admin/         # 后台管理页面（继续使用）
├── db/                # SQLite数据库
├── images/            # 本地图片存储
├── videos/            # 本地视频存储
├── logs/              # 日志文件
└── .config            # 配置文件

/TG/tgservice-uniapp/  # UniApp版前台（主维护版本）
├── src/
│   ├── pages/         # 页面组件
│   ├── utils/         # 工具函数
│   └── static/        # 静态资源
└── package.json
```

## 前端版本说明

| 版本 | 路径 | 状态 | 说明 |
|------|------|------|------|
| **UniApp版** | `/TG/tgservice-uniapp/` | ✅ 主维护 | 前台页面，支持微信/抖音小程序 |
| 移动网页版 | `/TG/tgservice/frontend/` | ❌ 已废弃 | 不再维护 |
| 后台管理 | `/TG/tgservice/frontend/admin/` | ✅ 继续使用 | 管理员后台 |

**重要：今后天宫国际线上服务的前台，只维护UniApp版本，彻底放弃移动版。**

## 访问地址

| 服务 | 地址 |
|------|------|
| 后端API | http://47.238.80.12:8081/api/ |
| 后台管理 | http://47.238.80.12:8081/frontend/admin/ |
| UniApp H5 | 需单独启动，默认 localhost:5173 |

## 启动命令

```bash
# 启动后端服务（端口8081）
cd /TG/tgservice/backend && node server.js

# 启动UniApp H5开发服务器
cd /TG/tgservice-uniapp && npm run dev:h5

# 编译微信小程序
cd /TG/tgservice-uniapp && npm run build:mp-weixin

# 编译抖音小程序
cd /TG/tgservice-uniapp && npm run build:mp-toutiao
```

## 配置文件

配置文件位于 `/TG/tgservice/.config`，包含：

- 服务器配置（端口）
- 数据库配置（Turso 云端数据库，本地 SQLite 已废弃）
- OSS配置（阿里云对象存储）
- 钉钉webhook配置
- JWT密钥

## 核心功能

### 前台功能
- 首页展示（Banner、热门商品、人气助教）
- 商品浏览、购物车、下单
- 助教列表、详情展示
- 助教登录、个人中心
- OSS直传上传（照片/视频）

### 后台功能
- 商品管理
- 助教管理
- 分类管理
- 首页配置
- 用户管理
- 订单管理（含设备指纹显示）
- 系统配置（设备指纹黑名单）

## API 接口

### 设备指纹黑名单 API

```
# 获取黑名单列表
GET /api/admin/blacklist

# 添加黑名单
POST /api/admin/blacklist
Body: { "deviceFingerprint": "xxx", "reason": "恶意点单" }

# 删除黑名单
DELETE /api/admin/blacklist/:id
```

### 订单提交（含设备指纹）

```
POST /api/order
Body: { 
  "sessionId": "xxx", 
  "deviceFingerprint": "设备指纹（可选）"
}

# 被黑名单的设备会返回 403 错误
```

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前台**: UniApp (Vue3)
- **后台**: 原生HTML/CSS/JS
- **存储**: 阿里云OSS
- **通知**: 钉钉机器人（加签方式）

## 文件上传功能

### 实现方式

本项目支持照片和视频上传，采用阿里云 OSS 存储。根据平台特性，使用不同的上传策略：

| 平台 | 上传方式 | 说明 |
|------|----------|------|
| **H5（网页版）** | 签名 URL 直传 OSS | 前端获取签名 URL，直接上传到 OSS，无文件大小限制 |
| **小程序** | 后端代理上传 | 前端上传到后端，后端转发到 OSS，受服务器超时限制 |

### H5 上传流程（签名 URL 直传）

1. 前端调用 `/api/upload/sign-url` 获取签名 URL
2. 前端使用签名 URL 直接 PUT 上传文件到 OSS
3. 支持大文件分片上传，无超时限制
4. 上传完成后调用业务 API 保存文件 URL

**优势**：
- 文件不经过后端服务器，无大小限制
- 上传速度快，直接传输到 OSS
- 不会占用后端服务器带宽和内存

### 小程序上传流程（后端代理）

1. 前端调用 `wx.uploadFile` 或 `tt.uploadFile` 上传到后端
2. 后端接收文件并转发到 OSS
3. 返回 OSS 文件 URL

**限制**：
- 受后端服务器超时限制（默认 2 分钟）
- 大文件可能超时失败
- 建议单文件控制在 50MB 以内

### 自动保存功能

包房管理页面上传照片/视频后，自动保存到数据库：
- 上传成功后自动调用保存 API
- 无需手动点击保存按钮
- 刷新页面后数据不丢失

## 更新日志

### 2026-03-26
- 修复大文件上传超时问题（H5 改用签名 URL 直传）
- 修复上传进度条卡死问题（前端状态管理优化）
- 新增自动保存功能（上传成功后自动保存到数据库）

### 2026-03-22
- 新增设备指纹黑名单功能（封锁恶意点单）
- 订单表新增 device_fingerprint 字段
- 后台订单管理显示设备指纹
- 后台新增系统配置页面（黑名单管理）
- 后台菜单结构调整（配置菜单新增系统配置）

### 2026-03-13
- 新增OSS直传上传功能
- 创建UniApp版本前台
- 移动网页版标记为废弃
- 钉钉通知改为加签方式

---

_最后更新: 2026-03-26_
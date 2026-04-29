# 天宫国际台球厅服务系统 - 项目概览

## 简介
天宫国际台球厅线上服务平台，提供商品点单、助教预约、VIP包房预订及后台管理。

## 技术栈
- **后端**: Node.js + Express + SQLite (WAL) + Redis (2026-04-27新增)
- **前端**: UniApp + Vue 3 + Vite（H5/微信小程序）
- **其他**: 阿里云OSS（图片/视频）、阿里云短信、bcryptjs、jsonwebtoken、winston

> 数据库单连接架构（`db/index.js` 是唯一连接中心，测试/生产均连接 Turso 云端数据库），2026-04-12确立，2026-04-28迁移Turso。

## 核心功能
- 首页（banner/公告/热门商品/人气助教）
- 商品点单（分类/购物车/台桌绑定/下单）
- 助教服务（列表/详情/登录/个人中心）
- VIP包房（列表/详情/预约）
- 会员中心（手机验证码登录/微信登录/订单记录）
- 后台管理（数据看板/商品/助教/会员/台桌/包房/首页配置/操作日志）

## 角色权限
| 角色 | 后台权限 | H5权限 |
|------|---------|--------|
| 管理员 | 全部 | 全部 |
| 店长 | 数据概览/管理/前厅/助教 | 常用+管理功能 |
| 助教管理 | 仅助教 | 常用+管理功能 |
| 前厅领班 | 仅前厅 | 仅常用功能 |
| 收银 | 仅收银看板 | 服务下单、我的奖罚 |
| 教练/服务员 | ❌禁止登录 | 服务下单、我的奖罚 |

> 常用功能：水牌查看（收银/服务员不可用）、服务下单、我的奖罚
> 助教专用：个人中心、上下班、上下桌、约客上传、各类申请
> 管理功能：水牌管理、打卡审查、乐捐、约客、审批等

## 项目结构
```
/TG/
├── tgservice/backend/      # 后端（db/index.js 为数据库连接中心，连接 Turso 云端 DB）
├── tgservice-uniapp/src/   # 前端UniApp
├── run/                    # 生产数据（db/logs/images/qrcode/redis-data/scripts）
└── data/                   # 初始数据（商品/台桌）
```

## 部署
- **生产**: Docker `tgservice` 容器，/端口，`TGSERVICE_ENV=production`
- **开发**: PM2（`tgservice-dev`/`tgservice-uniapp-dev`），8088/8089端口，`TGSERVICE_ENV=test`
- 环境判断用 `TGSERVICE_ENV` 而非 `NODE_ENV`
- Redis 独立容器，端口8090，数据持久化到 `/TG/run/redis-data`
- 配置文件：`.config`（生产）、`.config.env`（开发）

## 访问地址
- API: `http://localhost:`
- 后台: `http://localhost:/frontend/index.html`
- 健康检查: `http://localhost:/api/health`
- 默认管理员: tgadmin / mms633268

## 技术特点
1. SQLite轻量架构 + WAL模式
2. UniApp跨平台（H5/微信小程序）
3. 阿里云OSS直传（STS临时凭证）
4. Redis缓存（会话管理/热点数据）
5. winston结构化日志

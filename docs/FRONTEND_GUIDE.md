# 天宫国际 - 前端开发指南

## 概述
UniApp + Vue 3 跨平台项目（H5/微信小程序），暗色主题，主色金色(#d4af37)。

## 技术栈
UniApp 3.0 + Vue 3.4 + Vite 5.2 + vue-i18n + html5-qrcode + miniprogram-ci

## 项目结构
```
/TG/tgservice-uniapp/src/
├── pages/          # 页面（index/products/cart/coaches/coach-detail/coach-login/coach-profile/vip-rooms/vip-detail/member/profile/agreement）
├── components/     # 公共组件
├── utils/api.js    # API请求封装
├── store/          # 状态管理
├── static/tabbar/  # TabBar图标
├── App.vue / main.js
└── pages.json / manifest.json / uni.scss
```

## TabBar页面
首页 | 商品 | 教练 | V包 | 我的

## 条件编译
```vue
<!-- #ifdef H5 --> H5专属 <!-- #endif -->
<!-- #ifdef MP-WEIXIN --> 小程序专属 <!-- #endif -->
```
主要差异：登录方式（H5短信/小程序微信授权）、台桌扫码（H5 URL参数/小程序scene）、二维码扫描（H5 html5-qrcode/小程序 uni.scanCode）

## API请求
封装在 `utils/api.js`，baseURL: `https://tg.tiangong.club/api`
支持 `authType: 'member'` 和 `authType: 'coach'` 两种认证。

## 本地存储
| 键 | 说明 |
|------|------|
| sessionId | 匿名会话ID |
| memberToken/coachToken/adminToken | JWT Token |
| adminInfo/coachInfo | 用户信息缓存 |
| tableName/tableAuth/tablePinyin | 台桌信息 |
| device_fp | 设备指纹 |

> 员工识别：adminToken 或 coachToken 存在即为登录员工

## 样式规范
- 主色: `#d4af37`（金色）
- 背景: `#0a0a0f`（深黑）
- 卡片: `rgba(255,255,255,0.05)`
- 字体: `PingFang SC, -apple-system, sans-serif`

## 开发命令
```bash
npm run dev:h5        # H5开发
npm run dev:mp-weixin # 小程序开发
npm run build:h5      # H5构建
npm run build:mp-weixin # 小程序构建
```

## H5特有功能
- **悬浮返回按钮**: 助教详情和包房详情页左下角
- **全屏按钮**: 首页左下角
- **台桌授权**: localStorage存储，30分钟有效（测试5分钟）
- **PWA支持**: `/src/static/sw.js`，iOS添加到桌面引导
- **设备指纹**: Canvas指纹+浏览器信息，防作弊

## V2.0 后台管理页面 (`/TG/tgservice/admin/`)
原生HTML/CSS/JS，不依赖UniApp。
主要页面：login/index/products/categories/tables/vip-rooms/coaches/cashier-dashboard/members/users/home/operation-logs/settings

### 水牌管理 (water-boards.html)
全屏显示，按状态分组，长按修改状态，分段可放大显示。

### 收银看板 (cashier-dashboard.html)
三列布局：商品订单/服务单/上下桌单，每10秒轮询待处理订单，自动播放提示音。

## 调试
- H5: Chrome DevTools + Eruda
- 小程序: 微信开发者工具真机调试
- 页面路由: switchTab(TabBar页) / navigateTo(普通页) / redirectTo(重定向)

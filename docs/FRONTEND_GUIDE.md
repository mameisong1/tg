# 天宫国际 - 前端开发指南

## 项目概述

天宫国际台球厅前端项目基于 **UniApp + Vue 3** 开发，支持编译到 H5、微信小程序、支付宝小程序等多个平台。项目采用暗色主题设计，主色调为金色(#d4af37)。

---

## 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| UniApp | 3.0.0-4080720251210001 | 跨平台开发框架 |
| Vue | 3.4.21 | 前端框架 (Composition API) |
| Vite | 5.2.8 | 构建工具 |
| vue-i18n | 9.1.9 | 国际化（预留） |
| html5-qrcode | 2.3.8 | 二维码扫描 |
| miniprogram-ci | 2.1.31 | 小程序CI工具 |

---

## 项目结构

```
/TG/tgservice-uniapp/
├── src/
│   ├── pages/                    # 页面目录
│   │   ├── index/                # 首页
│   │   ├── products/             # 商品点单
│   │   ├── cart/                 # 购物车
│   │   ├── coaches/              # 助教列表
│   │   ├── coach-detail/         # 助教详情
│   │   ├── coach-login/          # 助教登录
│   │   ├── coach-profile/        # 助教个人中心
│   │   ├── vip-rooms/            # VIP包房列表
│   │   ├── vip-detail/           # 包房详情
│   │   ├── member/               # 会员中心
│   │   ├── profile/              # 个人信息
│   │   └── agreement/            # 用户协议
│   ├── components/               # 公共组件
│   ├── utils/
│   │   └── api.js                # API请求封装
│   ├── store/                    # 状态管理
│   ├── static/                   # 静态资源
│   │   └── tabbar/               # TabBar图标
│   ├── App.vue                   # 应用入口
│   ├── main.js                   # 主入口
│   ├── pages.json                # 页面配置
│   ├── manifest.json             # 应用配置
│   └── uni.scss                  # 全局样式变量
├── dist/                         # 构建输出目录
├── package.json
└── vite.config.js
```

---

## 页面说明

### TabBar页面（5个）

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/pages/index/index` | Banner、公告、热门商品、人气助教 |
| 商品 | `/pages/products/products` | 商品分类、商品列表、加购 |
| 教练 | `/pages/coaches/coaches` | 助教列表、等级筛选 |
| V包 | `/pages/vip-rooms/vip-rooms` | VIP包房列表 |
| 我的 | `/pages/member/member` | 会员中心、登录入口 |

### 二级页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 购物车 | `/pages/cart/cart` | 购物车管理、提交订单 |
| 助教详情 | `/pages/coach-detail/coach-detail` | 助教个人介绍、照片、视频 |
| 助教登录 | `/pages/coach-login/coach-login` | 助教工号登录 |
| 助教中心 | `/pages/coach-profile/coach-profile` | 助教资料编辑 |
| 包房详情 | `/pages/vip-detail/vip-detail` | 包房介绍、预约 |
| 个人信息 | `/pages/profile/profile` | 会员信息修改 |
| 协议 | `/pages/agreement/agreement` | 用户协议/隐私政策 |

---

## 条件编译

UniApp使用条件编译实现平台差异化代码。

### 语法

```vue
<!-- 仅H5平台编译 -->
<!-- #ifdef H5 -->
<div>仅在H5显示</div>
<!-- #endif -->

<!-- 仅微信小程序编译 -->
<!-- #ifdef MP-WEIXIN -->
<button open-type="getPhoneNumber">微信授权</button>
<!-- #endif -->

<!-- 非H5平台 -->
<!-- #ifndef H5 -->
<view>小程序代码</view>
<!-- #endif -->
```

### 项目中的主要差异

#### 1. 登录方式

```vue
<!-- H5：短信验证码登录 -->
<!-- #ifdef H5 -->
<input v-model="phone" placeholder="请输入手机号"/>
<input v-model="code" placeholder="请输入验证码"/>
<button @click="sendCode">发送验证码</button>
<button @click="loginBySms">登录</button>
<!-- #endif -->

<!-- 小程序：微信一键登录 -->
<!-- #ifdef MP-WEIXIN -->
<button open-type="getPhoneNumber" @getphonenumber="wxLogin">
  微信一键登录
</button>
<!-- #endif -->
```

#### 2. 台桌扫码

```javascript
// App.vue - handleTableParams方法

// H5：从URL参数获取台桌
// #ifdef H5
const urlParams = new URLSearchParams(window.location.search)
let urlTable = urlParams.get('table')
// #endif

// 小程序：从scene参数获取
// #ifndef H5
if (options.scene) {
  const scene = decodeURIComponent(options.scene)
  tablePinyin = scene.replace('table=', '')
}
// #endif
```

#### 3. 二维码扫描

```vue
<!-- H5：使用html5-qrcode库 -->
<!-- #ifdef H5 -->
<script>
import { Html5QrcodeScanner } from 'html5-qrcode'
</script>
<!-- #endif -->

<!-- 小程序：使用uni.scanCode -->
<!-- #ifndef H5 -->
<script>
uni.scanCode({
  success: (res) => {
    console.log(res.result)
  }
})
</script>
<!-- #endif -->
```

### 平台标识符

| 标识符 | 平台 |
|--------|------|
| `H5` | H5网页 |
| `MP-WEIXIN` | 微信小程序 |
| `MP-ALIPAY` | 支付宝小程序 |
| `MP-BAIDU` | 百度小程序 |
| `MP-TOUTIAO` | 字节小程序 |
| `MP-QQ` | QQ小程序 |
| `APP-PLUS` | App |

---

## API请求

### 配置

API请求封装在 `/src/utils/api.js`：

```javascript
// 基础URL
const BASE_URL = 'https://tg.tiangong.club/api'

// 请求封装
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('memberToken') || uni.getStorageSync('coachToken')
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => { ... },
      fail: (err) => { ... }
    })
  })
}
```

### 使用示例

```vue
<script setup>
import api from '@/utils/api.js'

// 获取商品列表
const products = ref([])
const loadProducts = async () => {
  products.value = await api.getProducts('饮料')
}

// 添加购物车
const addToCart = async (productName) => {
  const sessionId = uni.getStorageSync('sessionId')
  await api.addCart({ sessionId, productName, quantity: 1 })
}
</script>
```

### 认证类型

API支持两种认证类型：
- `authType: 'member'` - 会员认证
- `authType: 'coach'` - 助教认证

```javascript
// 会员接口
getMemberProfile: () => request({ url: '/member/profile', authType: 'member' })

// 助教接口
updateCoachProfile: (data) => request({ 
  url: '/coach/profile', 
  method: 'PUT', 
  data, 
  authType: 'coach' 
})
```

---

## 样式规范

### 主题色

```scss
// 主色 - 金色
$color-primary: #d4af37;
$color-gold: #d4af37;

// 背景色 - 深黑
$color-bg: #0a0a0f;
$color-bg-card: rgba(255, 255, 255, 0.05);

// 文字色
$color-text: #ffffff;
$color-text-muted: rgba(255, 255, 255, 0.4);

// 边框色
$color-border: rgba(218, 165, 32, 0.1);
```

### 全局样式 (App.vue)

```css
/* 页面背景 */
page {
  background-color: #0a0a0f;
  color: #ffffff;
  font-family: 'PingFang SC', -apple-system, sans-serif;
}

/* 工具类 */
.text-gold { color: #d4af37; }
.text-muted { color: rgba(255,255,255,0.4); }
.container { padding: 16px; }
```

### 组件样式规范

```vue
<style scoped lang="scss">
.card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  
  &-title {
    color: #d4af37;
    font-size: 16px;
    font-weight: 600;
  }
  
  &-content {
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
  }
}

.btn-primary {
  background: linear-gradient(135deg, #d4af37 0%, #b8963a 100%);
  color: #000;
  border-radius: 24px;
  padding: 12px 24px;
  font-weight: 600;
}
</style>
```

---

## 本地存储

项目使用 `uni.setStorageSync` / `uni.getStorageSync` 进行本地存储：

| 键名 | 说明 |
|------|------|
| `sessionId` | 匿名会话ID（购物车关联） |
| `memberToken` | 会员JWT Token |
| `coachToken` | 助教JWT Token |
| `coachInfo` | 助教信息缓存 |
| `tablePinyin` | 当前台桌拼音 |
| `tableName` | 当前台桌名称 |
| `tableAuth` | 台桌授权信息（H5） |
| `device_fp` | 设备指纹 |

### 台桌授权机制（H5）

```javascript
// 扫码进入时记录授权
const tableAuth = {
  table: tablePinyin,
  tableName: table.name,
  time: Date.now()
}
uni.setStorageSync('tableAuth', JSON.stringify(tableAuth))

// 授权有效期：30分钟
const isExpired = (Date.now() - oldAuth.time) > 30 * 60 * 1000
```

---

## 开发命令

### 安装依赖

```bash
cd /TG/tgservice-uniapp
npm install
```

### 开发模式

```bash
# H5
npm run dev:h5

# 微信小程序
npm run dev:mp-weixin

# 支付宝小程序
npm run dev:mp-alipay

# 其他平台
npm run dev:mp-baidu    # 百度
npm run dev:mp-toutiao  # 字节
npm run dev:mp-qq       # QQ
```

### 构建

```bash
# H5
npm run build:h5

# 微信小程序
npm run build:mp-weixin

# 支付宝小程序
npm run build:mp-alipay

# 其他平台
npm run build:mp-baidu
npm run build:mp-toutiao
npm run build:mp-qq
```

### 构建输出

- H5: `dist/build/h5/`
- 微信小程序: `dist/build/mp-weixin/`
- 其他: `dist/build/{platform}/`

---

## 部署

### H5部署

1. 构建项目：
   ```bash
   npm run build:h5
   ```

2. 将 `dist/build/h5/` 目录部署到Web服务器

3. Nginx配置示例：
   ```nginx
   location / {
     root /var/www/tgservice-h5;
     try_files $uri $uri/ /index.html;
   }
   ```

### 微信小程序部署

1. 构建项目：
   ```bash
   npm run build:mp-weixin
   ```

2. 打开微信开发者工具

3. 导入 `dist/build/mp-weixin/` 目录

4. 上传并提交审核

### CI/CD（小程序）

项目已集成 `miniprogram-ci`，可实现自动上传：

```javascript
const ci = require('miniprogram-ci')

const project = new ci.Project({
  appid: 'wx******',
  type: 'miniProgram',
  projectPath: './dist/build/mp-weixin',
  privateKeyPath: './private.key',
})

ci.upload({
  project,
  version: '1.0.0',
  desc: '更新描述'
})
```

---

## 开发注意事项

### 1. 图片资源

- TabBar图标使用PNG格式，放在 `/static/tabbar/`
- 其他图片优先使用OSS云端地址
- 小程序包体积限制2MB，避免过多本地图片

### 2. 请求超时

```javascript
// 建议设置请求超时
uni.request({
  timeout: 10000,  // 10秒
  ...
})
```

### 3. 页面路由

```javascript
// TabBar页面使用 switchTab
uni.switchTab({ url: '/pages/index/index' })

// 普通页面使用 navigateTo
uni.navigateTo({ url: '/pages/coach-detail/coach-detail?id=26' })

// 重定向使用 redirectTo
uni.redirectTo({ url: '/pages/coach-login/coach-login' })
```

### 4. 自定义导航栏

页面配置 `"navigationStyle": "custom"` 时需自行实现导航栏：

```vue
<template>
  <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="nav-content">
      <text class="title">页面标题</text>
    </view>
  </view>
</template>

<script setup>
const statusBarHeight = uni.getSystemInfoSync().statusBarHeight
</script>
```

### 5. 设备兼容

```javascript
// 获取设备信息
const systemInfo = uni.getSystemInfoSync()

// 安全区域（iPhone X等）
const safeAreaBottom = systemInfo.safeAreaInsets?.bottom || 0

// 胶囊按钮位置（小程序）
// #ifdef MP-WEIXIN
const menuButton = uni.getMenuButtonBoundingClientRect()
// #endif
```

---

## 调试技巧

### 1. 控制台日志

```javascript
console.log('调试信息', data)

// 生产环境可关闭
// #ifdef H5
if (process.env.NODE_ENV === 'development') {
  console.log('开发环境日志')
}
// #endif
```

### 2. 微信开发者工具

- 使用真机调试排查小程序问题
- 检查Network面板查看请求
- 使用AppData面板查看数据

### 3. H5调试

- 使用Chrome DevTools
- 使用Eruda进行移动端调试：
  ```html
  <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
  <script>eruda.init()</script>
  ```

---

## 常见问题

### Q: 小程序请求失败？
A: 检查域名是否在小程序管理后台配置白名单

### Q: H5跨域问题？
A: 后端需配置CORS，或使用Nginx代理

### Q: 图片不显示？
A: 检查图片URL是否支持HTTPS，小程序要求HTTPS

### Q: 条件编译不生效？
A: 注意条件编译注释格式，必须是 `<!-- #ifdef -->` 而不是 `/* #ifdef */`

---

## renderjs 使用

### 什么是 renderjs？

renderjs 是 UniApp 提供的一种运行在视图层（webview）的脚本方式，可以直接操作 DOM，适用于：
- 需要直接操作 DOM 的场景（如摄像头、Canvas）
- 需要使用仅浏览器支持的 Web API
- 需要绕过 UniApp 组件封装的限制

### 摄像头扫码组件（ScanModal.vue）

**问题背景**：UniApp 的 `<video>` 组件的 `ref` 返回 Vue 组件实例而非原生 DOM，导致 `srcObject` 和 `play()` 方法在华为浏览器/鸿蒙系统上失败。

**解决方案**：使用 renderjs 直接操作原生 DOM：

```vue
<template>
  <video 
    id="scanVideo"
    :prop="cameraState"
    :change:prop="cameraHandler.handleCamera"
    autoplay
    playsinline
    muted
  ></video>
</template>

<script setup>
// 逻辑层 - 状态管理
const cameraState = ref({ visible: false, action: '' })

// 监听变化，触发 renderjs
watch(() => props.visible, (newVal) => {
  cameraState.value = { visible: newVal, action: newVal ? 'start' : 'stop' }
})

// 回调方法（由 renderjs 调用）
const onScanSuccess = (data) => { emit('success', data) }
</script>

<script module="cameraHandler" lang="renderjs">
// 视图层 - 直接操作 DOM
export default {
  methods: {
    async handleCamera(newValue, oldValue, ownerInstance, instance) {
      const videoEl = document.querySelector('#scanVideo')
      const stream = await navigator.mediaDevices.getUserMedia({...})
      videoEl.srcObject = stream  // 直接操作原生 DOM
      await videoEl.play()
      ownerInstance.callMethod('onScanSuccess', qrData)
    }
  }
}
</script>
```

### renderjs 通信机制

| 方向 | 方式 |
|------|------|
| 逻辑层 → 视图层 | `:prop` + `:change:prop` |
| 视图层 → 逻辑层 | `ownerInstance.callMethod()` |

### 兼容性

| 平台 | 支持情况 |
|------|----------|
| H5 | ✅ 完全支持 |
| 小程序 | ❌ 不支持 |

---

## H5 特有功能

### 悬浮返回按钮

在助教详情和包房详情页面，H5 端添加了悬浮返回按钮，方便用户返回：

```vue
<!-- #ifdef H5 -->
<view class="float-back-btn" @click="goBack">
  <text class="float-back-icon">←</text>
</view>
<!-- #endif -->

<style>
/* #ifdef H5 */
.float-back-btn {
  position: fixed;
  left: 20px;
  bottom: 80px;
  width: 44px;
  height: 44px;
  background: rgba(212, 175, 55, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 100;
}
/* #endif */
</style>
```

### 全屏按钮

首页左下角提供全屏按钮，用户可切换全屏模式：

```javascript
// 切换全屏
const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen()
  }
}

// 监听全屏状态变化
document.addEventListener('fullscreenchange', () => {
  isFullscreen.value = !!document.fullscreenElement
})
```

### 台桌授权机制

H5 端使用 localStorage 存储台桌授权信息，授权有效期为 30 分钟（测试环境 5 分钟）：

```javascript
// 扫码进入时记录授权
const tableAuth = {
  table: tablePinyin,
  tableName: table.name,
  time: Date.now()
}
localStorage.setItem('tableAuth', JSON.stringify(tableAuth))

// 检查授权是否过期
const isExpired = (Date.now() - oldAuth.time) > expireMinutes * 60 * 1000
```

### 扫码提示文案优化（2026-03-23）

针对不同扫码场景，提供更精准的提示文案：

| 场景 | 提示文案 |
|------|----------|
| 未扫码进入 | "请用手机相机扫码进入" |
| 授权已过期 | "请用手机相机重新扫码" |
| 授权有效 | 正常显示页面内容 |

实现逻辑：

```javascript
// App.vue handleTableParams 方法
const expireMinutes = isTest ? 5 : 30

if (!storedAuth) {
  // 未扫码进入
  scanError.value = '请用手机相机扫码进入'
} else if (isExpired) {
  // 授权已过期
  scanError.value = '请用手机相机重新扫码'
} else {
  // 授权有效，继续
}
```

---

## PWA 支持

项目已添加 PWA (Progressive Web App) 支持，用户可将网站添加到手机桌面。

### Service Worker

Service Worker 文件位于 `/src/static/sw.js`，主要功能：
- 缓存静态资源
- 离线访问支持
- 后台同步

### 添加到桌面引导

针对 iOS 设备，提供添加到桌面的引导弹窗：

```javascript
// 检测是否为 iOS Safari
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
const isStandalone = window.navigator.standalone === true

// 如果是 iOS Safari 且未添加到桌面，显示引导
if (isIOS && !isStandalone) {
  showAddToHomeGuide()
}
```

### PWA 清单

在 `manifest.json` 中配置：

```json
{
  "name": "天宫国际",
  "short_name": "天宫",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#d4af37",
  "icons": [...]
}
```

---

## 设备指纹

项目使用设备指纹识别用户设备，用于：
1. 防止用户收藏带参 URL 后离店点单
2. 恶意设备黑名单检测

### 生成设备指纹

```javascript
// 生成设备指纹
const generateFingerprint = async () => {
  const components = []
  
  // 浏览器信息
  components.push(navigator.userAgent)
  components.push(navigator.language)
  components.push(screen.width + 'x' + screen.height)
  components.push(screen.colorDepth)
  
  // 时区
  components.push(new Date().getTimezoneOffset())
  
  // Canvas 指纹
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'
  ctx.font = '14px Arial'
  ctx.fillText('fingerprint', 2, 2)
  components.push(canvas.toDataURL())
  
  // 生成 hash
  const fingerprint = await crypto.subtle.digest('SHA-256', 
    new TextEncoder().encode(components.join('')))
  return Array.from(new Uint8Array(fingerprint))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### 下单时提交设备指纹

```javascript
// 提交订单时携带设备指纹
const submitOrder = async () => {
  const deviceFingerprint = uni.getStorageSync('device_fp')
  await api.submitOrder({
    sessionId,
    tableNo,
    deviceFingerprint
  })
}
```

### 黑名单机制

后端会检测设备指纹是否在黑名单中，如果设备被拉黑，将返回 403 错误。

---

*文档更新时间：2026年3月*

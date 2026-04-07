# 天宫国际 - 配置说明文档

本文档详细说明系统的所有配置项及其用途。

---

## 1. 后端配置文件（.config）

配置文件位置：`/TG/tgservice/.config`

### 1.1 完整配置示例

```json
{
  "server": {
    "port": 8081,
    "host": "0.0.0.0"
  },
  "dingtalk": {
    "webhook": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
    "secret": "SECxxx",
    "frontDeskGroup": "160165020904",
    "_comment": "webhook填入钉钉机器人完整地址，secret填入加签密钥"
  },
  "database": {
    "path": "./db/tgservice.db"
  },
  "upload": {
    "imageDir": "./images",
    "videoDir": "./videos",
    "maxImageSize": 10485760,
    "maxVideoSize": 52428800
  },
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "resource-images-sh",
    "accessKeyId": "xxx",
    "accessKeySecret": "xxx",
    "endpoint": "oss-cn-shanghai.aliyuncs.com",
    "uploadDir": "coaches/",
    "stsRoleArn": "",
    "stsExpiry": 3600
  },
  "jwt": {
    "secret": "YOUR_JWT_SECRET",
    "expiresIn": "7d"
  },
  "log": {
    "errorLog": "./logs/error.log",
    "accessLog": "./logs/access.log",
    "operationLog": "./logs/operation.log"
  },
  "wechat": {
    "appid": "wxxxxxxxxxxx",
    "appsecret": "xxxxxxxxxxxxxxxx",
    "mchid": "",
    "mchkey": ""
  },
  "miniprogram": {
    "appid": "wxxxxxxxxxxx",
    "appsecret": "xxxxxxxxxxxxxxxx",
    "projectPath": "/TG/tgservice-uniapp/dist/build/mp-weixin",
    "privateKeyPath": "/TG/tgservice-uniapp/private.wxxxxxxxxxxx.key"
  },
  "aliyunSms": {
    "accessKeyId": "xxx",
    "accessKeySecret": "xxx",
    "signName": "天宫国际",
    "templateCode": "SMS_123456789",
    "regionId": "cn-hangzhou"
  }
}
```

### 1.2 配置字段详解

#### server - 服务器配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | number | 8081 | 服务监听端口 |
| `host` | string | "0.0.0.0" | 绑定地址，0.0.0.0 表示监听所有网卡 |

```json
{
  "server": {
    "port": 8081,
    "host": "0.0.0.0"
  }
}
```

#### dingtalk - 钉钉机器人配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `webhook` | string | 钉钉机器人 Webhook 完整 URL |
| `secret` | string | 加签密钥（以 SEC 开头） |
| `frontDeskGroup` | string | 前台群 ID（预留字段） |

**获取方式**：
1. 进入钉钉群 → 群设置 → 智能群助手
2. 添加机器人 → 自定义机器人
3. 安全设置选择"加签"
4. 复制 Webhook 地址和加签密钥

```json
{
  "dingtalk": {
    "webhook": "https://oapi.dingtalk.com/robot/send?access_token=7d47010560d2c2e6deb678a7bc64fbfe21b59ee1bd4df9312ca7c785631cbafa",
    "secret": "YOUR_DINGTALK_SECRET",
    "frontDeskGroup": "160165020904"
  }
}
```

#### database - 数据库配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `path` | string | SQLite 数据库文件路径（相对于 backend 目录） |

```json
{
  "database": {
    "path": "./db/tgservice.db"
  }
}
```

#### upload - 上传配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `imageDir` | string | "./images" | 本地图片存储目录 |
| `videoDir` | string | "./videos" | 本地视频存储目录 |
| `maxImageSize` | number | 10485760 | 图片最大大小（10MB） |
| `maxVideoSize` | number | 52428800 | 视频最大大小（50MB） |

```json
{
  "upload": {
    "imageDir": "./images",
    "videoDir": "./videos",
    "maxImageSize": 10485760,
    "maxVideoSize": 52428800
  }
}
```

#### oss - 阿里云 OSS 配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `region` | string | OSS 区域，如 "oss-cn-shanghai" |
| `bucket` | string | Bucket 名称 |
| `accessKeyId` | string | 阿里云 AccessKey ID |
| `accessKeySecret` | string | 阿里云 AccessKey Secret |
| `endpoint` | string | OSS 访问域名 |
| `uploadDir` | string | 上传目录前缀 |
| `stsRoleArn` | string | STS 角色 ARN（如使用临时凭证） |
| `stsExpiry` | number | STS 凭证有效期（秒） |

```json
{
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "resource-images-sh",
    "accessKeyId": "YOUR_ACCESS_KEY_ID",
    "accessKeySecret": "YOUR_ACCESS_KEY_SECRET",
    "endpoint": "oss-cn-shanghai.aliyuncs.com",
    "uploadDir": "coaches/",
    "stsRoleArn": "",
    "stsExpiry": 3600
  }
}
```

**上传后的文件 URL 格式**：
```
https://resource-images-sh.oss-cn-shanghai.aliyuncs.com/coaches/xxx.jpg
```

#### jwt - JWT 配置

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `secret` | string | - | JWT 签名密钥（请使用复杂字符串） |
| `expiresIn` | string | "7d" | Token 有效期（支持 "7d", "30d", "24h" 等） |

```json
{
  "jwt": {
    "secret": "YOUR_JWT_SECRET",
    "expiresIn": "7d"
  }
}
```

**安全建议**：
- secret 应至少 32 位随机字符
- 生产环境不要使用简单字符串
- 定期更换密钥

#### log - 日志配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `errorLog` | string | 错误日志文件路径 |
| `accessLog` | string | 访问日志文件路径 |
| `operationLog` | string | 操作日志文件路径 |

```json
{
  "log": {
    "errorLog": "./logs/error.log",
    "accessLog": "./logs/access.log",
    "operationLog": "./logs/operation.log"
  }
}
```

#### wechat - 微信配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `appid` | string | 微信小程序 AppID |
| `appsecret` | string | 微信小程序 AppSecret |
| `mchid` | string | 微信支付商户号（可选） |
| `mchkey` | string | 微信支付商户密钥（可选） |

```json
{
  "wechat": {
    "appid": "wx9bba9dfb6c6792a9",
    "appsecret": "YOUR_WECHAT_APPSECRET",
    "mchid": "",
    "mchkey": ""
  }
}
```

**获取方式**：
1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 开发管理 → 开发设置
3. 获取 AppID 和 AppSecret

#### miniprogram - 小程序上传配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `appid` | string | 小程序 AppID |
| `appsecret` | string | 小程序 AppSecret |
| `projectPath` | string | 小程序构建输出目录 |
| `privateKeyPath` | string | 小程序上传密钥路径 |

```json
{
  "miniprogram": {
    "appid": "wx9bba9dfb6c6792a9",
    "appsecret": "YOUR_WECHAT_APPSECRET",
    "projectPath": "/TG/tgservice-uniapp/dist/build/mp-weixin",
    "privateKeyPath": "/TG/tgservice-uniapp/private.wx9bba9dfb6c6792a9.key"
  }
}
```

**上传密钥获取**：
1. 微信公众平台 → 开发管理 → 小程序代码上传
2. 生成/重置上传密钥
3. 下载密钥文件保存到服务器

#### aliyunSms - 阿里云短信配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `accessKeyId` | string | 阿里云 AccessKey ID |
| `accessKeySecret` | string | 阿里云 AccessKey Secret |
| `signName` | string | 短信签名（需审核通过） |
| `templateCode` | string | 短信模板 ID |
| `regionId` | string | 区域 ID，一般为 "cn-hangzhou" |

```json
{
  "aliyunSms": {
    "accessKeyId": "LTAIxxxxxxxxxxxx",
    "accessKeySecret": "xxxxxxxxxxxxxxxxxxxxxxxx",
    "signName": "天宫国际",
    "templateCode": "SMS_123456789",
    "regionId": "cn-hangzhou"
  }
}
```

**配置步骤**：
1. 开通 [阿里云短信服务](https://dysms.console.aliyun.com)
2. 申请短信签名（如"天宫国际"）
3. 创建验证码类型的短信模板
4. 创建 AccessKey

**短信模板示例**：
```
您的验证码是${code}，5分钟内有效，请勿泄露。
```

---

## 2. 前端配置（manifest.json）

配置文件位置：`/TG/tgservice-uniapp/src/manifest.json`

### 2.1 完整配置示例

```json
{
  "name": "天宫国际",
  "appid": "__UNI__46BD97E",
  "description": "天宫国际 - KTV智慧服务平台",
  "versionName": "1.0.0",
  "versionCode": "100",
  "transformPx": false,
  
  "mp-weixin": {
    "appid": "wx9bba9dfb6c6792a9",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "permission": {
      "scope.userLocation": {
        "desc": "获取位置信息用于显示附近门店"
      }
    },
    "requiredPrivateInfos": [
      "chooseLocation",
      "getLocation"
    ]
  },
  
  "h5": {
    "title": "天宫国际",
    "template": "template.h5.html",
    "router": {
      "mode": "hash",
      "base": "/"
    },
    "devServer": {
      "port": 8083,
      "disableHostCheck": true,
      "proxy": {
        "/api": {
          "target": "http://localhost:8081",
          "changeOrigin": true,
          "secure": false
        }
      }
    },
    "optimization": {
      "treeShaking": {
        "enable": true
      }
    }
  },
  
  "app-plus": {
    "usingComponents": true,
    "nvueStyleCompiler": "uni-app",
    "compilerVersion": 3,
    "splashscreen": {
      "alwaysShowBeforeRender": true,
      "waiting": true,
      "autoclose": true,
      "delay": 0
    },
    "modules": {},
    "distribute": {
      "android": {
        "permissions": [
          "<uses-permission android:name=\"android.permission.CHANGE_NETWORK_STATE\"/>",
          "<uses-permission android:name=\"android.permission.MOUNT_UNMOUNT_FILESYSTEMS\"/>",
          "<uses-permission android:name=\"android.permission.VIBRATE\"/>",
          "<uses-permission android:name=\"android.permission.READ_LOGS\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_WIFI_STATE\"/>",
          "<uses-feature android:name=\"android.hardware.camera.autofocus\"/>",
          "<uses-permission android:name=\"android.permission.ACCESS_NETWORK_STATE\"/>",
          "<uses-permission android:name=\"android.permission.CAMERA\"/>",
          "<uses-permission android:name=\"android.permission.GET_ACCOUNTS\"/>",
          "<uses-permission android:name=\"android.permission.READ_PHONE_STATE\"/>",
          "<uses-permission android:name=\"android.permission.CHANGE_WIFI_STATE\"/>",
          "<uses-permission android:name=\"android.permission.WAKE_LOCK\"/>",
          "<uses-permission android:name=\"android.permission.FLASHLIGHT\"/>",
          "<uses-feature android:name=\"android.hardware.camera\"/>",
          "<uses-permission android:name=\"android.permission.WRITE_SETTINGS\"/>"
        ]
      },
      "ios": {},
      "sdkConfigs": {}
    }
  },
  
  "quickapp": {},
  
  "uniStatistics": {
    "enable": false
  },
  
  "vueVersion": "2"
}
```

### 2.2 关键配置说明

#### 基础信息

| 字段 | 说明 |
|------|------|
| `name` | 应用名称 |
| `appid` | uni-app 应用 ID（DCloud 平台） |
| `versionName` | 版本号（如 "1.0.0"） |
| `versionCode` | 版本码（数字，每次发布递增） |

#### mp-weixin - 微信小程序配置

| 字段 | 说明 |
|------|------|
| `appid` | 微信小程序 AppID |
| `setting.urlCheck` | 是否检查域名（调试时可关闭） |
| `permission` | 权限申请描述 |
| `requiredPrivateInfos` | 需要的隐私接口 |

#### h5 - H5 配置

| 字段 | 说明 |
|------|------|
| `title` | 网页标题 |
| `router.mode` | 路由模式（hash / history） |
| `router.base` | 路由基础路径 |
| `devServer.port` | 开发服务器端口 |
| `devServer.proxy` | API 代理配置 |

```json
{
  "h5": {
    "devServer": {
      "port": 8083,
      "proxy": {
        "/api": {
          "target": "http://localhost:8081",
          "changeOrigin": true
        }
      }
    }
  }
}
```

---

## 3. 阿里云 OSS 配置详解

### 3.1 控制台配置

1. **创建 Bucket**
   - 登录 [OSS 控制台](https://oss.console.aliyun.com)
   - 创建 Bucket，选择上海区域
   - 读写权限：公共读（或私有 + 签名 URL）

2. **跨域配置（CORS）**
   ```
   来源：*
   允许 Methods：GET, POST, PUT, DELETE, HEAD
   允许 Headers：*
   暴露 Headers：ETag, x-oss-request-id
   ```

3. **创建 AccessKey**
   - 访问 [RAM 控制台](https://ram.console.aliyun.com)
   - 创建用户，授予 OSS 权限
   - 生成 AccessKey

### 3.2 代码使用示例

```javascript
// 后端上传到 OSS
const OSS = require('ali-oss');

const client = new OSS({
  region: config.oss.region,
  accessKeyId: config.oss.accessKeyId,
  accessKeySecret: config.oss.accessKeySecret,
  bucket: config.oss.bucket
});

async function uploadToOSS(fileBuffer, fileName) {
  const key = `${config.oss.uploadDir}${Date.now()}_${fileName}`;
  const result = await client.put(key, fileBuffer);
  return result.url;
}
```

---

## 4. 短信服务配置详解

### 4.1 开通短信服务

1. 登录 [阿里云短信控制台](https://dysms.console.aliyun.com)
2. 开通短信服务
3. 完成实名认证

### 4.2 申请签名

1. 国内消息 → 签名管理 → 添加签名
2. 签名名称：`天宫国际`
3. 适用场景：验证码
4. 等待审核（1-2 个工作日）

### 4.3 创建模板

1. 国内消息 → 模板管理 → 添加模板
2. 模板类型：验证码
3. 模板名称：登录验证码
4. 模板内容：`您的验证码是${code}，5分钟内有效，请勿泄露。`
5. 等待审核

### 4.4 代码调用示例

```javascript
const Core = require('@alicloud/pop-core');

const client = new Core({
  accessKeyId: config.aliyunSms.accessKeyId,
  accessKeySecret: config.aliyunSms.accessKeySecret,
  endpoint: 'https://dysmsapi.aliyuncs.com',
  apiVersion: '2017-05-25'
});

async function sendSms(phone, code) {
  const params = {
    RegionId: config.aliyunSms.regionId,
    PhoneNumbers: phone,
    SignName: config.aliyunSms.signName,
    TemplateCode: config.aliyunSms.templateCode,
    TemplateParam: JSON.stringify({ code })
  };
  
  const result = await client.request('SendSms', params);
  return result;
}
```

---

## 5. 环境变量说明

### 5.1 Node.js 环境变量

| 变量 | 说明 | 生产环境 | 开发环境 |
|------|------|----------|----------|
| `NODE_ENV` | 运行环境 | production | development |
| `TGSERVICE_ENV` | 服务环境（决定配置文件） | production | test |
| `PORT` | 服务端口 | 8081 | 8088 |

### 5.2 TGSERVICE_ENV 说明

**重要**：后端通过 `TGSERVICE_ENV` 环境变量决定加载哪个配置文件：

| `TGSERVICE_ENV` | 配置文件 | 用途 |
|-----------------|----------|------|
| `test` | `.config.env` | 开发环境 |
| 其他值 | `.config` | 生产环境 |

```javascript
// server.js 中的判断逻辑
const env = process.env.TGSERVICE_ENV || 'production';
const configFileName = env === 'test' ? '.config.env' : '.config';
```

⚠️ **注意**：`NODE_ENV` 只影响前端构建，后端配置文件选择由 `TGSERVICE_ENV` 决定。

### 5.3 使用方式

```bash
# 命令行设置
NODE_ENV=production PORT=8081 node server.js

# PM2 配置
pm2 start server.js --env production

# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tgservice',
    script: 'server.js',
    env: {
      NODE_ENV: 'development',
      PORT: 8081
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8081
    }
  }]
};
```

### 5.3 代码中读取

```javascript
// server.js
const env = process.env.NODE_ENV || 'development';
const port = process.env.PORT || 8081;

// 根据环境加载不同配置
const configPath = process.env.CONFIG_PATH || '../.config';
const config = JSON.parse(fs.readFileSync(configPath));
```

---

## 6. 配置最佳实践

### 6.1 敏感信息保护

```bash
# .config 文件权限
chmod 600 /TG/tgservice/.config

# 不要提交到 Git
echo ".config" >> .gitignore
```

### 6.2 配置备份

```bash
# 备份配置
cp /TG/tgservice/.config /backup/config_$(date +%Y%m%d).json

# 定期备份
crontab -e
0 0 * * * cp /TG/tgservice/.config /backup/config_$(date +\%Y\%m\%d).json
```

### 6.3 配置变更流程

1. 备份当前配置
2. 修改配置文件
3. 验证 JSON 格式
4. 重启服务
5. 测试功能

```bash
# 验证 JSON 格式
node -e "console.log(JSON.parse(require('fs').readFileSync('/TG/tgservice/.config')))"

# 重启服务
pm2 restart tgservice
```

---

## 7. 配置检查清单

部署前请确认以下配置：

- [ ] `server.port` - 端口未被占用
- [ ] `dingtalk.webhook` - 钉钉机器人地址正确
- [ ] `dingtalk.secret` - 加签密钥正确
- [ ] `database.path` - 数据库目录存在且可写
- [ ] `oss.accessKeyId` - OSS 密钥有效
- [ ] `oss.bucket` - Bucket 存在且可访问
- [ ] `jwt.secret` - 使用强密码
- [ ] `wechat.appid` - 小程序 AppID 正确
- [ ] `wechat.appsecret` - AppSecret 正确
- [ ] `aliyunSms.signName` - 短信签名已审核通过
- [ ] `aliyunSms.templateCode` - 短信模板已审核通过

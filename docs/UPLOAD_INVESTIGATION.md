# 上传问题调查报告

**日期**: 2026-03-26  
**调查人**: Coder-tg

---

## 问题1：35M文件上传失败，显示上传超时

### 日志分析

**后端错误日志**:
```
[2026-03-26T13:14:57.641Z] error: OSS上传失败: Response timeout for 300000ms
[2026-03-26T13:27:31.310Z] error: OSS上传失败: Failed to upload some parts with error: socket hang up
```

**Nginx错误日志**:
```
2026/03/26 22:18:33 [error] upstream timed out (110: Connection timed out) while reading response header from upstream
```

### 根本原因

1. **Nginx 代理超时**: `proxy_read_timeout 300s` (5分钟)
2. **OSS SDK 超时**: 设置为 600000ms (10分钟)，但实际报 300000ms 超时
3. **网络不稳定**: `socket hang up` 表示连接被断开，可能是 OSS 服务端或中间网络问题

### 问题链

```
客户端 → Nginx (300s超时) → 后端 → OSS (分片上传)
                    ↑
              这里超时断开
```

当大文件上传时：
- 客户端先传到 Nginx（进度条走完）
- Nginx 再传给后端
- 后端使用分片上传到 OSS
- 如果 OSS 上传慢，超过 300s，Nginx 就会断开连接

---

## 问题2：进度条卡在最后

### 现象

> 进度条一开始匀速走，走到最后就卡住不动，等5分钟以上报错

### 原因分析

**当前架构（小程序）**:
```
客户端 → 后端服务器 → OSS
   ↑          ↑
 进度显示   实际还在上传
```

进度条显示的是「客户端 → 服务器」的上传进度，不是「客户端 → OSS」的进度。

当进度到 100% 时：
- 只是客户端把文件传给了服务器
- 服务器还需要继续上传到 OSS
- 这段时间客户端无进度反馈
- 所以看起来"卡在最后"

**H5 架构（已直传）**:
```
客户端 → OSS (签名URL直传)
   ↑
 进度是真实的
```

H5 使用签名 URL 直传，进度条是真实的上传进度。如果卡在最后，是 OSS 响应慢或网络问题。

---

## 问题3：前端直传 OSS 方案

### 当前实现

| 平台 | 上传方式 | 进度准确性 |
|------|----------|------------|
| H5 | 签名URL直传OSS | ✅ 真实进度 |
| 小程序 | 后端代理上传 | ❌ 只显示客户端→服务器 |

### 代码位置

**后端 API**:
- `/api/oss/sts` - 获取 STS 临时凭证（需配置 stsRoleArn）
- `/api/oss/sign` - 获取签名URL（当前H5使用）

**前端代码**:
- `src/pages/coach-profile/coach-profile.vue` - 上传逻辑
- `src/utils/api.js` - `getOSSSignature` 方法

### 为什么小程序不能用前端直传

1. **API 限制**: 微信小程序只能用 `wx.uploadFile`，不能直接用 `XMLHttpRequest` 或 `fetch`
2. **域名白名单**: 需要在小程序后台配置 OSS 域名
3. **签名问题**: 需要后端提供签名，小程序无法直接调用 OSS SDK

### 解决方案

#### 方案A：小程序使用 STS 临时凭证直传

**原理**:
1. 后端提供 `/api/oss/sts` 返回临时 AccessKey
2. 小程序使用 `wx.uploadFile` 直接上传到 OSS
3. 需要配置 OSS Bucket 允许跨域和小程序域名白名单

**步骤**:

1. **后端配置 STS 角色**:
   - 在阿里云 RAM 创建 STS 角色
   - 配置 `.config` 文件添加 `stsRoleArn`

2. **小程序后台配置**:
   - 添加 OSS 域名到 uploadFile 合法域名: `https://resource-images-sh.oss-cn-shanghai.aliyuncs.com`

3. **前端修改**:
```javascript
// 获取STS临时凭证
const stsRes = await api.getOSSSTS()
const { credentials, bucket, region, uploadDir } = stsRes

// 计算签名
const policy = {
  expiration: new Date(Date.now() + 3600000).toISOString(),
  conditions: [
    ['content-length-range', 0, 50 * 1024 * 1024]
  ]
}
const policyBase64 = Base64.encode(JSON.stringify(policy))
const signature = crypto.sha1(credentials.accessKeySecret, policyBase64)

// 直传OSS
wx.uploadFile({
  url: `https://${bucket}.oss-${region}.aliyuncs.com`,
  filePath: filePath,
  name: 'file',
  formData: {
    OSSAccessKeyId: credentials.accessKeyId,
    policy: policyBase64,
    Signature: signature,
    'x-oss-security-token': credentials.securityToken,
    key: `${uploadDir}${Date.now()}_${randomStr}.${ext}`,
    success_action_status: '200'
  },
  success: (res) => {
    // 上传成功
  }
})
```

**优点**:
- 进度条真实
- 减轻服务器压力
- 上传更快（直连OSS）

**缺点**:
- 需要配置 RAM 角色
- 小程序需要配置域名白名单
- 签名计算较复杂

#### 方案B：优化后端代理上传

**原理**: 保持后端代理，但优化用户体验

**修改方案**:

1. **增加 Nginx 超时时间**:
```nginx
proxy_read_timeout 600s;  # 10分钟
proxy_send_timeout 600s;
```

2. **后端返回实际进度**（WebSocket 或轮询）:
   - 后端分片上传时记录进度
   - 通过 WebSocket 推送给前端

3. **前端提示优化**:
   - 显示"服务器处理中..."而不是进度卡住
   - 增加"处理中"动画

**优点**:
- 不需要修改小程序配置
- 实现简单

**缺点**:
- 仍然占用服务器带宽
- 进度反馈不够精确

---

## 建议

### 短期方案（推荐先尝试）

1. **增加 Nginx 超时**: 从 300s 改为 600s
2. **增加 OSS SDK 超时**: 确保配置生效
3. **优化前端提示**: 显示"服务器处理中"而不是进度卡住

### 长期方案

1. **H5**: 保持当前签名URL直传（已实现）
2. **小程序**: 考虑使用 STS 临时凭证直传

---

## 待确认

1. 是否有 STS 角色配置权限？
2. 小程序后台是否有 OSS 域名白名单？
3. 是否需要我实施上述方案？

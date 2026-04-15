# 乐捐付款截图多图支持 — 技术方案

## 1. 需求分析

**需求**：前台H5助教用的乐捐报备页面，乐捐详情页面现在只能提交1张照片，需要改成最多提交3张照片。要求复用公共照片提交模块，不自写上传代码。

**核心问题**：经代码审查发现，**提交付款截图的页面 (`lejuan-proof.vue`) 已经支持最多3张照片**，且已正确使用了公共 `useImageUpload` 模块。但存在一个导致页面崩溃的 Bug，且列表/详情展示页面只处理了单张照片的情况。

---

## 2. 现有代码分析

### 2.1 公共照片提交模块

**文件**：`/TG/tgservice-uniapp/src/utils/image-upload.js`

`useImageUpload` 是一个 Vue3 Composable，已支持：
- 多图片上传（通过 `maxCount` 参数控制数量）
- 阿里云 OSS STS 签名直传
- 进度条与错误处理
- 选择图片时自动计算剩余可上传数量

```javascript
// 用法示例（lejuan-proof.vue 中已使用）
const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } =
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'lejuan_proof' })
```

### 2.2 提交付款截图页面

**文件**：`/TG/tgservice-uniapp/src/pages/internal/lejuan-proof.vue`

当前状态分析：

| 功能 | 状态 | 说明 |
|------|------|------|
| 多图上传 UI | ✅ 已实现 | `v-if="imageUrls.length < 3"` 控制上传按钮显示 |
| 公共模块调用 | ✅ 已实现 | `useImageUpload({ maxCount: 3 })` |
| 数据保存 | ✅ 已实现 | `JSON.stringify(imageUrls.value)` 存为 JSON 数组 |
| 已有图片加载 | ✅ 已实现 | `JSON.parse(record.proof_image_url)` 解析 |
| `watch` 导入 | ❌ **BUG** | 使用了 `watch()` 但未从 vue 导入 |

**关键 Bug**：第 136 行使用了 `watch(proofUrls, ...)` 初始化已有图片，但 import 语句只有 `{ ref, onMounted }`，缺少 `watch`。这会导致页面加载时直接崩溃。

### 2.3 乐捐报备主页（列表页）

**文件**：`/TG/tgservice-uniapp/src/pages/internal/lejuan.vue`

当前问题：

| 位置 | 问题 | 说明 |
|------|------|------|
| `goToProof()` 方法 | ❌ 只预览单张 | `uni.previewImage({ urls: [rec.proof_image_url] })` 未解析 JSON 数组 |
| 记录卡片 | ❌ 只显示文字 | `v-if="rec.proof_image_url"` 显示 `✅ 已传截图`，不显示缩略图 |

### 2.4 乐捐一览页面

**文件**：`/TG/tgservice-uniapp/src/pages/internal/lejuan-list.vue`

当前问题：

| 位置 | 问题 | 说明 |
|------|------|------|
| 截图展示 | ❌ 只显示单张缩略图 | `<image :src="item.proof_image_url">` 直接使用原始字段 |
| `previewProof()` | ❌ 只预览单张 | `uni.previewImage({ urls: [url] })` |

### 2.5 后端 API

**文件**：`/TG/tgservice/backend/routes/lejuan-records.js`

| 接口 | 状态 | 说明 |
|------|------|------|
| `PUT /:id/proof` | ✅ 无需修改 | 接收 `proof_image_url` 字段，直接存为字符串（JSON 数组也是字符串） |
| 写入方式 | ✅ 符合规范 | 使用 `enqueueRun` 写入，符合 writeQueue 规范 |

### 2.6 数据库

**表**：`lejuan_records`

`proof_image_url` 字段类型为 `TEXT`，可存储单 URL 或 JSON 数组字符串。**无需数据库变更**。

**历史数据兼容**：旧数据是单 URL 字符串，新数据是 JSON 数组。前端需要兼容两种格式（`lejuan-proof.vue` 已有兼容逻辑）。

---

## 3. 技术方案

### 3.1 总览

```
┌─────────────────────────────────────────────────────────────┐
│                    修改范围（仅前端）                          │
├──────────────────┬──────────────────┬───────────────────────┤
│  lejuan-proof.vue │   lejuan.vue     │   lejuan-list.vue     │
│  修复 watch Bug   │   多图展示适配    │   多图展示适配         │
└──────────────────┴──────────────────┴───────────────────────┘

后端：✅ 无需修改
数据库：✅ 无需修改
公共模块：✅ 无需修改（已满足需求）
```

### 3.2 前端改动详情

#### 修改 1：`lejuan-proof.vue` — 修复 watch 导入 Bug

**问题**：第 73 行 import 缺少 `watch`

**修改前**：
```javascript
import { ref, onMounted } from 'vue'
```

**修改后**：
```javascript
import { ref, onMounted, watch } from 'vue'
```

**影响**：修复后页面才能正常加载已有图片并初始化到 `imageUrls` 中。

---

#### 修改 2：`lejuan.vue` — 列表页展示多图 & 修复预览

**2a. 修复 `goToProof()` 方法**

**问题**：已有截图时只传单张 URL 给 `previewImage`

**修改前**：
```javascript
if (rec.proof_image_url) {
  uni.previewImage({ urls: [rec.proof_image_url] })
  return
}
```

**修改后**：
```javascript
if (rec.proof_image_url) {
  let urls = []
  try {
    const parsed = JSON.parse(rec.proof_image_url)
    urls = Array.isArray(parsed) ? parsed : [rec.proof_image_url]
  } catch (e) {
    urls = [rec.proof_image_url]
  }
  uni.previewImage({ urls })
  return
}
```

**2b. 记录卡片显示缩略图**

**问题**：只显示 `✅ 已传截图` 文字，不显示图片缩略图

**修改前**：
```html
<text class="record-detail" v-if="rec.proof_image_url">✅ 已传截图</text>
```

**修改后**：
```html
<view class="record-detail proof-images" v-if="getProofUrls(rec).length > 0">
  <text>✅ 已传截图 ({{ getProofUrls(rec).length }}张)</text>
  <view class="proof-thumbs">
    <image
      v-for="(url, idx) in getProofUrls(rec)"
      :key="idx"
      :src="url"
      mode="aspectFill"
      class="proof-thumb"
      @click.stop="previewProofImages(rec, idx)"
    />
  </view>
</view>
```

**新增方法**：
```javascript
// 解析 proof_image_url 为 URL 数组（兼容单URL和JSON数组）
const getProofUrls = (rec) => {
  if (!rec.proof_image_url) return []
  try {
    const parsed = JSON.parse(rec.proof_image_url)
    return Array.isArray(parsed) ? parsed : [rec.proof_image_url]
  } catch (e) {
    return [rec.proof_image_url]
  }
}

// 预览多张截图
const previewProofImages = (rec, idx) => {
  const urls = getProofUrls(rec)
  uni.previewImage({ urls, current: idx })
}
```

---

#### 修改 3：`lejuan-list.vue` — 一览页展示多图

**3a. 截图展示区**

**修改前**：
```html
<view class="lj-proof" v-if="item.proof_image_url" @click="previewProof(item.proof_image_url)">
  <text class="lj-proof-label">付款截图</text>
  <image :src="item.proof_image_url" mode="aspectFill" class="lj-proof-thumb" />
</view>
```

**修改后**：
```html
<view class="lj-proof" v-if="getProofUrls(item).length > 0">
  <text class="lj-proof-label">付款截图 ({{ getProofUrls(item).length }}张)</text>
  <view class="proof-thumbs">
    <image
      v-for="(url, idx) in getProofUrls(item)"
      :key="idx"
      :src="url"
      mode="aspectFill"
      class="lj-proof-thumb"
      @click="previewProofImages(item, idx)"
    />
  </view>
</view>
```

**3b. 新增方法**：
```javascript
// 解析 proof_image_url 为 URL 数组
const getProofUrls = (item) => {
  if (!item.proof_image_url) return []
  try {
    const parsed = JSON.parse(item.proof_image_url)
    return Array.isArray(parsed) ? parsed : [item.proof_image_url]
  } catch (e) {
    return [item.proof_image_url]
  }
}

// 预览多张截图
const previewProofImages = (item, idx) => {
  const urls = getProofUrls(item)
  uni.previewImage({ urls, current: idx })
}
```

**3c. 样式适配**：
```css
.proof-thumbs {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}
.lj-proof-thumb {
  width: 50px;
  height: 50px;
  border-radius: 6px;
}
```

---

## 4. 涉及的文件列表

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `tgservice-uniapp/src/pages/internal/lejuan-proof.vue` | Bug 修复 | 添加 `watch` 导入 |
| `tgservice-uniapp/src/pages/internal/lejuan.vue` | 功能增强 | 多图展示 + 修复预览 |
| `tgservice-uniapp/src/pages/internal/lejuan-list.vue` | 功能增强 | 多图展示 + 修复预览 |
| ~~`tgservice/backend/routes/lejuan-records.js`~~ | 无需修改 | 后端已兼容 JSON 数组 |
| ~~数据库~~ | 无需变更 | TEXT 字段可存 JSON 字符串 |

---

## 5. 注意事项

### 5.1 数据兼容性

- **旧数据**：`proof_image_url` 存储的是单 URL 字符串（如 `https://.../image.jpg`）
- **新数据**：`proof_image_url` 存储的是 JSON 数组字符串（如 `["https://.../1.jpg","https://.../2.jpg"]`）
- 所有解析逻辑必须使用 `try-catch` 兼容两种格式

### 5.2 编码规范

- **时间处理**：本次修改不涉及时间处理逻辑
- **数据库连接**：本次修改仅前端，不涉及后端数据库
- **数据库写入**：本次修改不涉及新的数据库写入

### 5.3 测试要点

1. **lejuan-proof.vue**：
   - 页面能否正常加载（watch bug 修复后）
   - 能否选择并上传 1~3 张图片
   - 提交后能否正确保存和回显
   - 上传第 4 张时是否被 `useImageUpload` 正确拦截

2. **lejuan.vue**：
   - 已有单张截图的记录能否正常预览
   - 已有多张截图的记录能否正常预览（可滑动切换）
   - 列表卡片能否显示缩略图

3. **lejuan-list.vue**：
   - 一览列表中多条截图能否正确显示
   - 点击缩略图能否预览所有图片

4. **历史数据兼容**：
   - 只传了 1 张图的旧记录，在三个页面都能正常显示

### 5.4 不需要做的

- ❌ 不需要写任何新的图片上传代码（已复用 `useImageUpload`）
- ❌ 不需要修改后端 API
- ❌ 不需要数据库迁移
- ❌ 不需要新增数据库字段

# 需求2 设计稿：图片上传数量增加 + 公共模块封装

> 作者：程序员A2 | 日期：2026-04-14

---

## 一、现状分析

### 1.1 涉及页面清单

| 页面 | 文件路径 | 当前图片上传 | 当前图片展示 |
|------|----------|-------------|-------------|
| 乐捐报备 | `src/pages/internal/lejuan.vue` | ❌ 无 | ❌ 无 |
| 公休申请 | `src/pages/internal/leave-apply.vue` | ✅ 单张（120×120） | — |
| 请假申请（公休申请） | `src/pages/internal/leave-apply.vue` | ✅ 单张（120×120） | — |
| 约客记录上传 | `src/pages/internal/invitation-upload.vue` | ✅ 单张（140×140） | — |
| 加班审批 | `src/pages/internal/overtime-approval.vue` | — | ✅ 单张 `proof_image_url` |
| 公休审批 | `src/pages/internal/leave-approval.vue` | — | ✅ 单张 `proof_image_url` |
| 乐捐一览 | `src/pages/internal/lejuan-list.vue` | — | ❌ 无 |
| 约客审查 | `src/pages/internal/invitation-review.vue` | — | ✅ 单张 `invitation_image_url` + 全屏审查弹窗 |

### 1.2 现有上传逻辑分析

**4 个页面各自独立实现了图片上传**，代码高度重复：

- **leave-apply.vue**: `uploadImage()` + `uploadFile()` — XHR 直传 OSS，含进度条和错误上报
- **overtime-apply.vue**: 完全相同的 `uploadImage()` + `uploadFile()` 逻辑
- **invitation-upload.vue**: 完全相同的 `uploadImage()` + `uploadFile()` 逻辑
- **coach-profile.vue**: 已有多图上传模式（最多50张），但用于照片展示，不是申请表单

**共同特征**：
1. `uni.chooseImage({ count: 1 })` — 每次只选1张
2. 获取 OSS 签名：`api.getOSSSignature(type, ext, 'TgTemp/')`
3. XHR PUT 直传 OSS
4. 上传进度条（`uploading / uploadProgress / uploadText`）
5. 错误上报 `/api/upload-error`
6. 存储为单字符串：`form.proof_image_url` 或 `form.invitation_image_url`

### 1.3 后端数据库分析

**applications 表**：
```sql
proof_image_url TEXT  -- 当前只存单个 URL 字符串
extra_data TEXT       -- JSON 格式扩展字段
```

**guest_invitation_results 表**：
```sql
invitation_image_url TEXT  -- 当前只存单个 URL 字符串
```

> **关键决策：数据库不增加字段，复用 `extra_data` JSON 字段存储多图片 URL 数组**
> 
> 原因：
> 1. `extra_data` 已存在且是 JSON TEXT 类型，天然支持数组
> 2. `applications` 表已有此字段（乐捐报备用它存 `{date, hours}`）
> 3. 避免新增列和 ALTER TABLE 迁移
> 4. 向后兼容：旧数据 `proof_image_url` 仍可用

---

## 二、公共图片上传模块设计

### 2.1 模块路径

```
/TG/tgservice-uniapp/src/utils/image-upload.js
```

### 2.2 模块 API 设计

```javascript
/**
 * 图片上传工具模块
 * 
 * 功能：
 * - 选择图片（支持最多3张）
 * - 阿里云 OSS 直传（签名获取 + XHR PUT）
 * - 上传进度反馈
 * - 错误处理与上报
 * - 图片删除
 */

/**
 * useImageUpload - Vue3 Composable 函数
 * @param {Object} options
 * @param {number} options.maxCount - 最大上传数量，默认 3
 * @param {string} options.ossDir - OSS 目录前缀，默认 'TgTemp/'
 * @param {string} options.errorType - 错误上报类型标识，默认 'image_upload'
 * 
 * @returns {Object}
 *   imageUrls: Ref<string[]> - 已上传图片 URL 数组
 *   uploading: Ref<boolean> - 是否正在上传
 *   uploadProgress: Ref<number> - 上传进度 0-100
 *   uploadText: Ref<string> - 上传状态文本
 *   
 *   chooseAndUpload: Function - 触发选择并上传
 *   removeImage: Function(index) - 删除指定图片
 *   clearAll: Function - 清空所有图片
 */
```

### 2.3 模块实现概要

```javascript
// /TG/tgservice-uniapp/src/utils/image-upload.js

import { ref } from 'vue'
import api from '@/utils/api.js'

export function useImageUpload(options = {}) {
  const maxCount = options.maxCount || 3
  const ossDir = options.ossDir || 'TgTemp/'
  const errorType = options.errorType || 'image_upload'

  const imageUrls = ref([])
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const uploadText = ref('')

  // 错误上报
  const reportError = async (info) => {
    try {
      await uni.request({
        url: '/api/upload-error',
        method: 'POST',
        data: { time: new Date().toISOString(), type: errorType, ...info },
        header: { 'Content-Type': 'application/json' }
      })
    } catch (e) {}
  }

  // 选择并上传图片
  const chooseAndUpload = async () => {
    const remaining = maxCount - imageUrls.value.length
    if (remaining <= 0) {
      return uni.showToast({ title: `最多上传${maxCount}张`, icon: 'none' })
    }

    try {
      uni.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          // 逐个上传
          for (const filePath of res.tempFilePaths) {
            await uploadSingleFile(filePath)
          }
        }
      })
    } catch (e) {
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  // 上传单张图片
  const uploadSingleFile = async (filePath) => {
    uploading.value = true
    uploadText.value = '上传图片中...'
    uploadProgress.value = 0

    try {
      // 推断文件扩展名
      let ext = 'jpg'
      try {
        const blobCheck = await fetch(filePath).then(r => r.blob())
        if (blobCheck.type) {
          const mimeExt = blobCheck.type.split('/')[1]
          if (mimeExt && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(mimeExt)) {
            ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt
          }
        }
      } catch (e) {}

      // 获取 OSS 签名
      const signData = await api.getOSSSignature('image', ext, ossDir)
      if (!signData.success) {
        throw new Error(signData.error || '获取上传凭证失败')
      }

      // 读取文件为 blob
      const response = await fetch(filePath)
      const blob = await response.blob()

      // XHR 直传 OSS
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signData.signedUrl, true)
      xhr.setRequestHeader('Content-Type', 'image/jpeg')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          uploadProgress.value = Math.round((e.loaded / e.total) * 100)
        }
      }

      xhr.timeout = 300000

      xhr.onload = async () => {
        uploading.value = false
        if (xhr.status === 200) {
          imageUrls.value.push(signData.accessUrl)
          uni.showToast({ title: '上传成功', icon: 'success' })
        } else {
          let errorMsg = `上传失败(${xhr.status})`
          if (xhr.status === 413) errorMsg = '文件太大，请压缩后重试'
          else if (xhr.status === 504 || xhr.status === 502) errorMsg = '服务器超时，请稍后重试'
          else if (xhr.status === 500) errorMsg = '服务器错误，请联系管理员'
          else if (xhr.status === 403) errorMsg = '没有上传权限'
          else if (xhr.status === 401) errorMsg = '登录已过期，请重新登录'
          uni.showToast({ title: errorMsg, icon: 'none' })
          await reportError({ stage: 'XHR上传', status: xhr.status, response: xhr.responseText?.substring(0, 200) })
        }
      }

      xhr.onerror = async () => {
        uploading.value = false
        uni.showToast({ title: '网络错误，请检查网络连接', icon: 'none' })
        await reportError({ stage: 'XHR网络错误', signedUrl: signData.signedUrl?.substring(0, 80) })
      }

      xhr.ontimeout = async () => {
        uploading.value = false
        uni.showToast({ title: '上传超时，请重试', icon: 'none' })
        await reportError({ stage: 'XHR超时' })
      }

      xhr.send(blob)
    } catch (e) {
      uploading.value = false
      await reportError({ stage: '异常', error: e.message || String(e) })
      uni.showToast({ title: e.message || '上传失败', icon: 'none' })
    }
  }

  // 删除指定图片
  const removeImage = (index) => {
    imageUrls.value.splice(index, 1)
  }

  // 清空所有图片
  const clearAll = () => {
    imageUrls.value = []
  }

  return {
    imageUrls,
    uploading,
    uploadProgress,
    uploadText,
    chooseAndUpload,
    removeImage,
    clearAll
  }
}
```

### 2.4 公共上传 UI 模板（可复用片段）

在页面中使用时，模板部分统一为：

```vue
<!-- 图片上传区域 -->
<view class="form-item">
  <text class="form-label">证明图片（最多3张）</text>
  <view class="image-grid">
    <!-- 已上传图片 -->
    <view class="image-item" v-for="(url, index) in imageUrls" :key="index">
      <image :src="url" mode="aspectFill" class="uploaded-img" @click="previewImage(url)" />
      <view class="image-delete" @click.stop="removeImage(index)">
        <text class="delete-icon">✕</text>
      </view>
    </view>
    <!-- 添加按钮 -->
    <view class="image-add" v-if="imageUrls.length < 3" @click="chooseAndUpload">
      <text class="add-icon">+</text>
      <text class="add-text">上传图片</text>
    </view>
  </view>
</view>

<!-- 上传进度遮罩 -->
<view class="upload-progress" v-if="uploading">
  <view class="progress-content">
    <text class="progress-text">{{ uploadText }}</text>
    <view class="progress-bar">
      <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
    </view>
  </view>
</view>
```

---

## 三、数据库存储方案

### 3.1 applications 表（乐捐报备、公休申请、加班申请）

**提交时**：
```javascript
// 前端提交数据
{
  applicant_phone: phone,
  application_type: '乐捐报备',  // 或 '公休申请', '早加班申请', '晚加班申请'
  remark: form.remark,
  proof_image_url: imageUrls.value[0] || null,  // 第一张图存 proof_image_url（兼容旧版）
  extra_data: JSON.stringify({
    images: imageUrls.value,  // 全部图片 URL 数组
    date: form.date,
    hours: form.hours
  })
}
```

**读取时**：
```javascript
// 后端/前端解析
function getImageUrls(record) {
  // 优先从 extra_data.images 读取
  if (record.extra_data) {
    try {
      const extra = JSON.parse(record.extra_data);
      if (Array.isArray(extra.images) && extra.images.length > 0) {
        return extra.images;
      }
    } catch (e) {}
  }
  // 兼容旧数据：proof_image_url 单张
  if (record.proof_image_url) {
    return [record.proof_image_url];
  }
  return [];
}
```

### 3.2 guest_invitation_results 表（约客记录）

**提交时**：
```javascript
// 前端提交数据（POST /api/guest-invitations）
{
  coach_no: coachInfo.coachNo,
  date: today,
  shift: form.shift,
  invitation_image_url: imageUrls.value[0],  // 第一张存主字段
  extra_data: JSON.stringify({
    images: imageUrls.value  // 全部图片
  })
}
```

> **注意**：需要修改后端 `guest-invitations.js` 的 POST 接口，接收 `extra_data` 参数并存储。

**读取时**：
```javascript
function getInvitationImageUrls(record) {
  if (record.extra_data) {
    try {
      const extra = JSON.parse(record.extra_data);
      if (Array.isArray(extra.images) && extra.images.length > 0) {
        return extra.images;
      }
    } catch (e) {}
  }
  if (record.invitation_image_url) {
    return [record.invitation_image_url];
  }
  return [];
}
```

### 3.3 后端 API 修改清单

| 文件 | 修改点 |
|------|--------|
| `backend/routes/applications.js` | 无需修改（`extra_data` 已支持 JSON） |
| `backend/routes/guest-invitations.js` | POST 接口需增加 `extra_data` 参数接收（约10行改动） |

**guest-invitations.js POST 修改**：

```javascript
// 当前（约第115行）
router.post('/', requireBackendPermission(['all']), async (req, res) => {
  const { date, shift, coach_no, invitation_image_url } = req.body;
  // ...
  
  // 修改为：
  const { date, shift, coach_no, invitation_image_url, extra_data } = req.body;
  // INSERT 时增加 extra_data 参数
});
```

---

## 四、每个页面修改方案

### 4.1 乐捐报备 (`lejuan.vue`)

**当前状态**：无图片上传

**修改内容**：

1. **引入公共模块**：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'
```

2. **初始化上传**：
```javascript
const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'lejuan_proof' })
```

3. **模板增加图片上传区域**（在备注之后、提交按钮之前）：
```vue
<view class="form-item">
  <text class="form-label">证明图片（最多3张，选填）</text>
  <view class="image-grid">
    <view class="image-item" v-for="(url, index) in imageUrls" :key="index">
      <image :src="url" mode="aspectFill" class="uploaded-img" @click="previewImage(url)" />
      <view class="image-delete" @click.stop="removeImage(index)">
        <text class="delete-icon">✕</text>
      </view>
    </view>
    <view class="image-add" v-if="imageUrls.length < 3" @click="chooseAndUpload">
      <text class="add-icon">+</text>
      <text class="add-text">上传图片</text>
    </view>
  </view>
</view>
```

4. **提交逻辑修改**：
```javascript
await api.applications.create({
  applicant_phone: phone,
  application_type: '乐捐报备',
  remark: form.value.remark || `${form.value.date} 外出${form.value.hours}小时`,
  proof_image_url: imageUrls.value[0] || null,
  extra_data: {
    date: form.value.date,
    hours: form.value.hours,
    images: imageUrls.value  // ← 新增
  }
})
```

5. **增加图片预览函数**：
```javascript
const previewImage = (url) => uni.previewImage({ urls: imageUrls.value, current: url })
```

6. **增加上传进度遮罩**（复用现有 CSS）：
```vue
<view class="upload-progress" v-if="uploading">
  <view class="progress-content">
    <text class="progress-text">{{ uploadText }}</text>
    <view class="progress-bar"><view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view></view>
  </view>
</view>
```

---

### 4.2 公休申请 (`leave-apply.vue`)

**当前状态**：已有单张图片上传

**修改内容**：

1. **删除**原有 `uploadImage()`、`uploadFile()`、`reportError()` 函数
2. **删除**原有 `uploading`、`uploadText`、`uploadProgress` ref
3. **删除** `form.value.proof_image_url` 字段
4. **引入并初始化**公共模块：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'leave_proof' })
```

5. **模板替换**上传区域：
```vue
<!-- 替换原来的单图上传区域 -->
<view class="form-item">
  <text class="form-label">加班截图证明（最多3张）</text>
  <view class="image-grid">
    <view class="image-item" v-for="(url, index) in imageUrls" :key="index">
      <image :src="url" mode="aspectFill" class="uploaded-img" @click="previewImage(url)" />
      <view class="image-delete" @click.stop="removeImage(index)">
        <text class="delete-icon">✕</text>
      </view>
    </view>
    <view class="image-add" v-if="imageUrls.length < 3" @click="chooseAndUpload">
      <text class="add-icon">+</text>
      <text class="add-text">上传图片</text>
    </view>
  </view>
</view>
```

6. **提交逻辑修改**：
```javascript
// before:
// proof_image_url: form.value.proof_image_url
// after:
await applications.create({
  applicant_phone: phone,
  application_type: '公休申请',
  remark: form.value.remark,
  proof_image_url: imageUrls.value[0] || null,
  extra_data: { images: imageUrls.value }
})
```

7. **canSubmit 校验修改**：
```javascript
// before: form.value.proof_image_url
// after:
const canSubmit = computed(() => imageUrls.value.length > 0 && form.value.remark)
```

8. **增加图片预览**：
```javascript
const previewImage = (url) => uni.previewImage({ urls: imageUrls.value, current: url })
```

---

### 4.3 加班/晚到申请 (`overtime-apply.vue`)

**修改内容与公休申请几乎相同**（4.2），区别仅在于：

- `errorType: 'overtime_proof'`
- 申请类型是动态的（`早加班申请` / `晚加班申请`）
- 提交逻辑不变（`proof_image_url` + `extra_data.images`）

---

### 4.4 约客记录上传 (`invitation-upload.vue`)

**修改内容**：

1. **删除**原有 `uploadImage()`、`uploadFile()`、`reportError()` 函数及相关 ref
2. **引入公共模块**：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'invitation_screenshot' })
```

3. **模板替换**上传区域：
```vue
<view class="form-item">
  <text class="form-label">约客截图（最多3张）</text>
  <view class="image-grid">
    <view class="image-item" v-for="(url, index) in imageUrls" :key="index">
      <image :src="url" mode="aspectFill" class="uploaded-img" @click="previewImage(url)" />
      <view class="image-delete" @click.stop="removeImage(index)">
        <text class="delete-icon">✕</text>
      </view>
    </view>
    <view class="image-add" v-if="imageUrls.length < 3" @click="chooseAndUpload">
      <text class="add-icon">+</text>
      <text class="add-text">上传图片</text>
    </view>
  </view>
</view>
```

4. **提交逻辑修改**：
```javascript
// before:
// invitation_image_url: form.value.invitation_image_url
// after:
await guestInvitations.create({
  coach_no: coachInfo.value.coachNo,
  date: today.value,
  shift: form.value.shift,
  invitation_image_url: imageUrls.value[0],  // 第一张存主字段
  extra_data: JSON.stringify({ images: imageUrls.value })  // 全部图片
})
```

5. **canSubmit 修改**：
```javascript
const canSubmit = computed(() => imageUrls.value.length > 0)
```

6. **增加图片预览**：
```javascript
const previewImage = (url) => uni.previewImage({ urls: imageUrls.value, current: url })
```

7. **提交成功后清空**：
```javascript
// before: form.value.invitation_image_url = ''
// after: 调用 clearAll()（如果公共模块提供了 clearAll 方法）
```

---

### 4.5 加班审批 (`overtime-approval.vue`)

**修改内容**：仅模板展示层

```vue
<!-- before: 单张图片 -->
<image v-if="app.proof_image_url" :src="app.proof_image_url" mode="widthFix" class="app-image" @click="previewImage(app.proof_image_url)" />

<!-- after: 多图横向滚动 -->
<view class="image-scroll" v-if="getImageUrls(app).length > 0">
  <image 
    v-for="(url, idx) in getImageUrls(app)" 
    :key="idx" 
    :src="url" 
    mode="widthFix" 
    class="app-image" 
    @click="previewImages(app, idx)" 
  />
</view>
```

```javascript
// 新增函数
const getImageUrls = (record) => {
  if (record.extra_data) {
    try {
      const extra = JSON.parse(record.extra_data)
      if (Array.isArray(extra.images) && extra.images.length > 0) return extra.images
    } catch (e) {}
  }
  return record.proof_image_url ? [record.proof_image_url] : []
}

const previewImages = (record, idx) => {
  uni.previewImage({ urls: getImageUrls(record), current: idx })
}
```

**CSS 修改**：
```css
/* 新增：横向滚动图片容器 */
.image-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  margin-top: 8px;
}
.image-scroll .app-image {
  flex-shrink: 0;
  width: 120px;
  max-width: 120px;
}
```

---

### 4.6 公休审批 (`leave-approval.vue`)

**修改内容与加班审批完全相同**（4.5）。

---

### 4.7 乐捐一览 (`lejuan-list.vue`)

**当前状态**：无图片展示

**修改内容**：增加图片展示区域

```vue
<!-- 在 lj-remark 之后增加 -->
<view class="image-scroll" v-if="getImageUrls(item).length > 0">
  <image 
    v-for="(url, idx) in getImageUrls(item)" 
    :key="idx" 
    :src="url" 
    mode="aspectFill" 
    class="lj-image" 
    @click="previewImages(item, idx)" 
  />
</view>
```

```javascript
const getImageUrls = (record) => {
  if (record.extra_data) {
    try {
      const extra = JSON.parse(record.extra_data)
      if (Array.isArray(extra.images) && extra.images.length > 0) return extra.images
    } catch (e) {}
  }
  return []
}

const previewImages = (record, idx) => {
  uni.previewImage({ urls: getImageUrls(record), current: idx })
}
```

**CSS 新增**：
```css
.image-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 0;
}
.lj-image {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 8px;
}
```

---

### 4.8 约客审查 (`invitation-review.vue`)

这是最复杂的修改，分两部分：

#### A. 列表展示支持多图

**待审查卡片**：
```vue
<!-- before: 单张 card-image -->
<image v-if="inv.invitation_image_url" :src="inv.invitation_image_url" mode="aspectFill" class="card-image" />

<!-- after: 多图网格 -->
<view class="card-image-grid" v-if="getImageUrls(inv).length > 0">
  <image 
    v-for="(url, idx) in getImageUrls(inv).slice(0, 3)" 
    :key="idx" 
    :src="url" 
    mode="aspectFill" 
    class="card-thumb"
    @click.stop="openReviewWithImage(inv, idx)"
  />
</view>
```

#### B. 全屏审查弹窗改造（重点：图片放大 + 按钮缩小）

**当前问题**：
- `.review-image` 最大高度 `50vh`，图片太小
- `.review-btn` 高度 `44px` + 大字，按钮太大占空间

**修改后模板**：
```vue
<!-- 全屏审查弹窗 -->
<view class="review-overlay" v-if="showReview" @click="closeReview">
  <view class="review-box" @click.stop>
    <!-- 顶部栏：计数器 + 关闭 -->
    <view class="review-header">
      <text class="review-counter">{{ reviewIndex + 1 }} / {{ pendingList.length }}</text>
      <view class="review-close" @click="closeReview"><text>✕</text></view>
    </view>
    
    <!-- 图片区域（占屏幕 90%） -->
    <view class="review-image-wrapper">
      <image 
        v-if="getCurrentReviewImages().length > 0" 
        :src="getCurrentReviewImages()[currentImageIndex]" 
        mode="aspectFit" 
        class="review-image-full" 
        @click="previewAllImages()"
      />
      <!-- 多图指示器 -->
      <view class="image-indicator" v-if="getCurrentReviewImages().length > 1">
        <text class="indicator-text">{{ currentImageIndex + 1 }}/{{ getCurrentReviewImages().length }}</text>
        <view class="indicator-dots">
          <view 
            class="indicator-dot" 
            v-for="(_, idx) in getCurrentReviewImages()" 
            :key="idx" 
            :class="{ active: idx === currentImageIndex }"
            @click="currentImageIndex = idx"
          ></view>
        </view>
        <!-- 左右切换箭头 -->
        <view class="img-nav-arrow img-nav-left" @click="prevImage" v-if="currentImageIndex > 0">
          <text>‹</text>
        </view>
        <view class="img-nav-arrow img-nav-right" @click="nextImage" v-if="currentImageIndex < getCurrentReviewImages().length - 1">
          <text>›</text>
        </view>
      </view>
      <view class="review-placeholder" v-else><text>暂无截图</text></view>
    </view>
    
    <!-- 助教信息 -->
    <view class="review-info">
      <text class="review-name">{{ currentReview?.stage_name }} ({{ currentReview?.employee_id || currentReview?.coach_no }}号)</text>
      <text class="review-meta">{{ formatTime(currentReview?.created_at) }} · {{ shiftLabel }}</text>
    </view>
    
    <!-- 操作按钮（缩小版） -->
    <view class="review-actions">
      <view class="review-btn btn-invalid" @click="submitReview('约客无效')">
        <text class="btn-text">❌ 无效</text>
      </view>
      <view class="review-btn btn-valid" @click="submitReview('约客有效')">
        <text class="btn-text">✅ 有效</text>
      </view>
    </view>
    
    <!-- 上下条导航 -->
    <view class="review-nav" v-if="pendingList.length > 1">
      <view class="nav-arrow" @click="navigateReview(-1)"><text>‹</text></view>
      <view class="nav-arrow" @click="navigateReview(1)"><text>›</text></view>
    </view>
  </view>
</view>
```

**新增 JS 函数**：
```javascript
const currentImageIndex = ref(0)

const getCurrentReviewImages = () => {
  if (!currentReview.value) return []
  return getImageUrls(currentReview.value)
}

const getImageUrls = (record) => {
  if (!record) return []
  if (record.extra_data) {
    try {
      const extra = typeof record.extra_data === 'string' 
        ? JSON.parse(record.extra_data) 
        : record.extra_data
      if (Array.isArray(extra.images) && extra.images.length > 0) return extra.images
    } catch (e) {}
  }
  return record.invitation_image_url ? [record.invitation_image_url] : []
}

const prevImage = () => {
  if (currentImageIndex.value > 0) currentImageIndex.value--
}

const nextImage = () => {
  const images = getCurrentReviewImages()
  if (currentImageIndex.value < images.length - 1) currentImageIndex.value++
}

const previewAllImages = () => {
  const images = getCurrentReviewImages()
  if (images.length > 0) {
    uni.previewImage({ urls: images, current: currentImageIndex.value })
  }
}

// 打开审查时重置图片索引
const openReview = (idx) => {
  reviewIndex.value = idx
  currentImageIndex.value = 0  // ← 新增
  showReview.value = true
}
```

**CSS 修改**（关键调整）：

```css
/* === 修改前 → 修改后 === */

/* 审查弹窗容器 - 占满 90% 屏幕 */
.review-box {
  width: 90%;              /* 原: 90% */
  max-width: 480px;        /* 原: 400px → 略增 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 图片区域 - 占屏幕 90% */
.review-image-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.review-image-full {
  width: 90vw;             /* 原: width: 100% */
  max-height: 85vh;        /* 原: max-height: 50vh → 大幅增大 */
  border-radius: 10px;
}

/* 多图指示器 */
.image-indicator {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.indicator-text {
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.6);
  padding: 2px 8px;
  border-radius: 10px;
}

.indicator-dots {
  display: flex;
  gap: 6px;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
}

.indicator-dot.active {
  background: #d4af37;
}

/* 图片左右切换箭头 */
.img-nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
}

.img-nav-left { left: 10px; }
.img-nav-right { right: 10px; }

/* 操作按钮 - 缩小 */
.review-actions {
  display: flex;
  gap: 10px;               /* 原: 12px */
  margin-top: 12px;        /* 原: 16px → 减小间距 */
  width: 100%;
}

.review-btn {
  flex: 1;
  height: 36px;            /* 原: 44px → 缩小 */
  border-radius: 8px;      /* 原: 10px */
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-text {
  font-size: 13px;         /* 原: 15px → 缩小字号 */
  font-weight: 600;
}

.btn-invalid {
  background: rgba(231,76,60,0.2);
  border: 1px solid rgba(231,76,60,0.3);
  color: #e74c3c;
}

.btn-valid {
  background: linear-gradient(135deg, #d4af37, #ffd700);
  color: #000;
}

/* 审查信息 - 缩小 */
.review-info {
  text-align: center;
  margin-top: 8px;         /* 原: 12px */
}

.review-name {
  font-size: 15px;         /* 原: 18px */
  color: #d4af37;
  font-weight: 600;
  display: block;
}

.review-meta {
  font-size: 11px;         /* 原: 12px */
  color: rgba(255,255,255,0.5);
  display: block;
  margin-top: 2px;
}
```

**待审查卡片多图样式**：
```css
.card-image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
}

.card-thumb {
  width: 100%;
  height: 70px;
  border-radius: 6px;
}
```

---

## 五、新增公共图片网格 CSS

以下 CSS 应添加到公共样式或每个页面的 `<style>` 中：

```css
/* 图片网格 - 用于表单上传 */
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 10px;
  overflow: hidden;
}

.uploaded-img {
  width: 100%;
  height: 100%;
  border-radius: 10px;
}

.image-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  background: rgba(0,0,0,0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-icon {
  font-size: 12px;
  color: #fff;
}

.image-add {
  width: 100px;
  height: 100px;
  background: rgba(255,255,255,0.05);
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.add-icon {
  font-size: 28px;
  color: rgba(255,255,255,0.4);
}

.add-text {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

/* 横向滚动 - 用于审批列表展示 */
.image-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
}

/* 上传进度遮罩（各页面已有，保持一致） */
.upload-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.progress-content {
  text-align: center;
}

.progress-text {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  display: block;
  margin-bottom: 20px;
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(255,255,255,0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d4af37, #ffd700);
  transition: width 0.3s;
}
```

---

## 六、文件修改清单汇总

### 6.1 新建文件

| 文件 | 说明 |
|------|------|
| `src/utils/image-upload.js` | 公共图片上传 Composable 模块 |

### 6.2 修改文件

| 文件 | 改动类型 | 改动量估计 |
|------|----------|-----------|
| `src/pages/internal/lejuan.vue` | 新增图片上传 + extra_data | +80 行 |
| `src/pages/internal/leave-apply.vue` | 替换上传为公共模块 | 删 60 行，增 20 行 |
| `src/pages/internal/overtime-apply.vue` | 替换上传为公共模块 | 删 60 行，增 20 行 |
| `src/pages/internal/invitation-upload.vue` | 替换上传为公共模块 + extra_data | 删 60 行，增 30 行 |
| `src/pages/internal/overtime-approval.vue` | 多图展示 + getImageUrls | +30 行 |
| `src/pages/internal/leave-approval.vue` | 多图展示 + getImageUrls | +30 行 |
| `src/pages/internal/lejuan-list.vue` | 新增图片展示 + getImageUrls | +35 行 |
| `src/pages/internal/invitation-review.vue` | 大图 90% + 按钮缩小 + 多图指示器 + getImageUrls | +100 行 |
| `backend/routes/guest-invitations.js` | POST 接口增加 extra_data 参数 | +5 行 |

### 6.3 无需修改

| 文件 | 原因 |
|------|------|
| `backend/routes/applications.js` | `extra_data` 已存在，JSON.parse/JSON.stringify 前端处理即可 |
| `backend/server.js` | OSS STS 接口无需变动 |
| `src/utils/api-v2.js` | API 调用接口无需变动 |
| `src/utils/api.js` | OSS 签名接口无需变动 |

---

## 七、数据流图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 H5                                 │
│                                                              │
│  乐捐报备 / 公休申请 / 请假申请 / 约客记录上传                 │
│       ↓                                                      │
│  useImageUpload()  ──→  chooseAndUpload()                    │
│       ↓                                                      │
│  api.getOSSSignature() ──→ 后端 GET /api/oss/sts             │
│       ↓                                                      │
│  XHR PUT ──→ 阿里云 OSS (直传)                                │
│       ↓                                                      │
│  imageUrls.value = ['url1', 'url2', 'url3']                  │
│       ↓                                                      │
│  提交表单 ──→ POST /api/applications 或 /api/guest-invitations │
│       body: {                                                 │
│         proof_image_url: 'url1',        // 第一张（兼容）       │
│         invitation_image_url: 'url1',   // 第一张（兼容）       │
│         extra_data: { images: [...] }   // 全部（新）          │
│       }                                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      后端 API                                 │
│                                                              │
│  applications.js:                                           │
│    INSERT INTO applications (..., proof_image_url, extra_data) │
│    ← proof_image_url 存第一张URL                              │
│    ← extra_data 存 JSON({images: [...]})                     │
│                                                              │
│  guest-invitations.js:                                      │
│    INSERT INTO guest_invitation_results (..., invitation_image_url) │
│    ← invitation_image_url 存第一张URL                         │
│    ← 需要新增接收 extra_data 字段                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   前端读取展示                                  │
│                                                              │
│  getImageUrls(record):                                      │
│    1. 尝试解析 record.extra_data.images                     │
│    2. 如果失败/不存在，回退到 [record.proof_image_url]         │
│    3. 返回 URL 数组                                           │
│                                                              │
│  审批列表/乐捐一览 → 横向滚动展示                              │
│  约客审查弹窗 → 全屏大图(90vw) + 多图指示器 + 左右切换          │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、向后兼容性保证

| 场景 | 处理方式 |
|------|----------|
| 旧数据只有 `proof_image_url` 无 `extra_data.images` | `getImageUrls()` 回退到单元素数组 |
| 旧数据 `extra_data` 不是数组格式（如乐捐存了 `{date, hours}` 但无 `images`） | `getImageUrls()` 安全 fallback 到 `proof_image_url` |
| 前端老版本提交的数据（无 `extra_data.images`） | 后端 `extra_data` 字段为 NULL，前端安全解析 |
| 新版本提交多图片后，老版本前端读取 | 老版本读取 `proof_image_url` 看到第一张图，不会报错 |

---

## 九、约客审查页面改造对比

### 修改前
```
┌────────────────────────┐
│ 计数器    [✕] 关闭     │
│                        │
│  ┌──────────────────┐  │
│  │                  │  │  ← max-height: 50vh (图片小)
│  │     图片         │  │
│  │                  │  │
│  └──────────────────┘  │
│                        │
│ 助教名 (工号)           │
│ 时间 · 班次             │
│                        │
│  ┌────────┐ ┌────────┐ │
│  │❌ 无效  │ │✅ 有效  │ │  ← height: 44px, font: 15px (按钮大)
│  └────────┘ └────────┘ │
│                        │
│     ‹          ›       │
└────────────────────────┘
```

### 修改后
```
┌────────────────────────┐
│ 计数器    [✕] 关闭     │
│                        │
│  ┌──────────────────┐  │
│  │                  │  │  ← max-height: 85vh (图片大!)
│  │                  │  │
│  │     大图 90vw    │  │
│  │                  │  │
│  │     ‹    ›       │  │  ← 左右切换箭头
│  └──────────────────┘  │
│      1/3   ● ○ ○       │  ← 多图指示器
│                        │
│ 助教名 (工号)           │  ← 字号缩小
│ 时间 · 班次             │
│                        │
│  ┌──────┐ ┌──────┐     │
│  │❌无效 │ │✅有效 │     │  ← height: 36px, font: 13px
│  └──────┘ └──────┘     │
│                        │
│     ‹          ›       │
└────────────────────────┘
```

---

## 十、实施建议顺序

1. **第一步**：创建 `src/utils/image-upload.js` 公共模块
2. **第二步**：修改 `backend/routes/guest-invitations.js` 增加 `extra_data` 接收
3. **第三步**：修改 4 个上传页面（lejuan → leave-apply → overtime-apply → invitation-upload）
4. **第四步**：修改 3 个展示页面（overtime-approval → leave-approval → lejuan-list）
5. **第五步**：修改约客审查页面（invitation-review）—— 最复杂，最后处理
6. **第六步**：全面测试（H5 端）

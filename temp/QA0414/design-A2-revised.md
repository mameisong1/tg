# 需求2 设计稿（修订版）：图片上传数量增加 + 公共模块封装

> 作者：程序员A2 | 日期：2026-04-14 | 修订原因：用户反馈简化方案，不需要兼容旧数据格式
> 
> **修订要点**：
> 1. 数据库不再复用 `extra_data`，直接新增 `images` TEXT 字段（存储 JSON 数组）
> 2. 编写迁移脚本将 `proof_image_url` / `invitation_image_url` 迁移到 `images`
> 3. 前端和后端代码直接读写 `images` 字段，无需任何向后兼容逻辑

---

## 一、现状分析

### 1.1 涉及页面清单

| 页面 | 文件路径 | 当前图片上传 | 当前图片展示 |
|------|----------|-------------|-------------|
| 乐捐报备 | `src/pages/internal/lejuan.vue` | ❌ 无 | ❌ 无 |
| 公休申请 | `src/pages/internal/leave-apply.vue` | ✅ 单张（120×120） | — |
| 约客记录上传 | `src/pages/internal/invitation-upload.vue` | ✅ 单张（140×140） | — |
| 加班审批 | `src/pages/internal/overtime-approval.vue` | — | ✅ 单张 `proof_image_url` |
| 公休审批 | `src/pages/internal/leave-approval.vue` | — | ✅ 单张 `proof_image_url` |
| 乐捐一览 | `src/pages/internal/lejuan-list.vue` | — | ❌ 无 |
| 约客审查 | `src/pages/internal/invitation-review.vue` | — | ✅ 单张 `invitation_image_url` + 全屏审查弹窗 |

### 1.2 现有上传逻辑分析

**4 个页面各自独立实现了图片上传**，代码高度重复：

- **leave-apply.vue**: `uploadImage()` + `uploadFile()` — XHR 直传 OSS
- **overtime-apply.vue**: 完全相同的逻辑
- **invitation-upload.vue**: 完全相同的逻辑
- 共同特征：`uni.chooseImage({ count: 1 })`、获取 OSS 签名、XHR PUT 直传、存单字符串

### 1.3 当前数据库表结构

#### `applications` 表（乐捐报备、公休申请、加班申请）
```sql
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_phone TEXT NOT NULL,
  application_type TEXT NOT NULL,
  remark TEXT,
  proof_image_url TEXT,          -- ⚠️ 将被 images 替代
  status INTEGER DEFAULT 0,
  approver_phone TEXT,
  approve_time DATETIME,
  extra_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `guest_invitation_results` 表（约客记录）
```sql
CREATE TABLE guest_invitation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  coach_no TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  invitation_image_url TEXT,     -- ⚠️ 将被 images 替代
  result TEXT DEFAULT '待审查',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  reviewer_phone TEXT,
  UNIQUE(date, shift, coach_no)
);
```

---

## 二、数据库结构变更（⚠️ DDL 变更）

### 2.1 applications 表：新增 `images` 字段

```sql
ALTER TABLE applications ADD COLUMN images TEXT;
```

- 类型：`TEXT`
- 内容格式：JSON 数组字符串，如 `["https://oss.../img1.jpg", "https://oss.../img2.jpg"]`
- 无图片时存 `NULL`（不存空数组 `[]`，保持与旧数据一致）
- **`proof_image_url` 保留但不用**（迁移后不再写入，旧数据保留作为归档）

### 2.2 guest_invitation_results 表：新增 `images` 字段

```sql
ALTER TABLE guest_invitation_results ADD COLUMN images TEXT;
```

- 类型：`TEXT`
- 内容格式：JSON 数组字符串
- 无图片时存 `NULL`
- **`invitation_image_url` 保留但不复用**（迁移后不再写入，旧数据保留作为归档）

> **🔴 数据库结构变更标记**：以上 2 条 `ALTER TABLE` 语句涉及表结构变更。

---

## 三、数据迁移脚本

### 3.1 脚本路径

```
/TG/tgservice/backend/migrations/migrate-images-to-array.js
```

### 3.2 脚本功能

1. 打开指定路径的 SQLite 数据库
2. 检查 `images` 列是否已存在（防止重复执行）
3. 执行 `ALTER TABLE` 新增 `images` 列
4. 将 `proof_image_url` 非空数据迁移为 `images = '["url"]'`
5. 将 `invitation_image_url` 非空数据迁移为 `images = '["url"]'`
6. 输出迁移统计信息

### 3.3 迁移脚本完整实现

```javascript
/**
 * 数据迁移脚本：将单图片 URL 字段迁移到 images JSON 数组字段
 * 
 * 用途：将 proof_image_url / invitation_image_url 的单 URL 字符串
 *       迁移到新增的 images 字段（JSON 数组格式）
 * 
 * 执行方式（发布时手动执行）：
 *   node backend/migrations/migrate-images-to-array.js <db_path>
 * 
 * 示例：
 *   # 测试环境
 *   node backend/migrations/migrate-images-to-array.js /TG/tgservice/db/tgservice.db
 * 
 *   # 生产环境（Docker 容器内）
 *   docker exec tgservice node /app/backend/migrations/migrate-images-to-array.js /app/db/tgservice.db
 * 
 *   # 生产环境（宿主机直接执行）
 *   cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js /TG/run/db/tgservice.db
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ========== 获取数据库路径 ==========

function getDbPath() {
  // 支持命令行参数
  const cliArg = process.argv[2];
  if (cliArg) {
    return path.resolve(cliArg);
  }

  // 根据 TGSERVICE_ENV 自动选择
  const env = process.env.TGSERVICE_ENV || 'development';
  if (env === 'production') {
    // 生产环境：/TG/run/db/tgservice.db（Docker 挂载路径）
    return path.resolve(__dirname, '../../../run/db/tgservice.db');
  } else {
    // 开发/测试环境：/TG/tgservice/db/tgservice.db
    return path.resolve(__dirname, '../../db/tgservice.db');
  }
}

// ========== 主函数 ==========

async function migrate(dbPath) {
  console.log(`\n📦 开始迁移: ${dbPath}`);
  console.log(`   TGSERVICE_ENV: ${process.env.TGSERVICE_ENV || 'development'}\n`);

  const db = await openDb(dbPath);

  try {
    // 步骤1：检查 images 列是否已存在
    const appsHasImages = await columnExists(db, 'applications', 'images');
    const guestHasImages = await columnExists(db, 'guest_invitation_results', 'images');

    // 步骤2：applications 表迁移
    if (!appsHasImages) {
      console.log('  [1/4] applications 表：新增 images 列...');
      await runSql(db, 'ALTER TABLE applications ADD COLUMN images TEXT');
      console.log('        ✅ 列已添加');
    } else {
      console.log('  [1/4] applications 表：images 列已存在，跳过 ALTER');
    }

    console.log('  [2/4] applications 表：迁移 proof_image_url → images...');
    const appsMigrated = await runSql(db,
      "UPDATE applications SET images = json_array(proof_image_url) WHERE proof_image_url IS NOT NULL AND proof_image_url != '' AND (images IS NULL OR images = '')"
    );
    console.log(`        ✅ 迁移了 ${appsMigrated.changes} 行`);

    // 步骤3：guest_invitation_results 表迁移
    if (!guestHasImages) {
      console.log('  [3/4] guest_invitation_results 表：新增 images 列...');
      await runSql(db, 'ALTER TABLE guest_invitation_results ADD COLUMN images TEXT');
      console.log('        ✅ 列已添加');
    } else {
      console.log('  [3/4] guest_invitation_results 表：images 列已存在，跳过 ALTER');
    }

    console.log('  [4/4] guest_invitation_results 表：迁移 invitation_image_url → images...');
    const guestMigrated = await runSql(db,
      "UPDATE guest_invitation_results SET images = json_array(invitation_image_url) WHERE invitation_image_url IS NOT NULL AND invitation_image_url != '' AND (images IS NULL OR images = '')"
    );
    console.log(`        ✅ 迁移了 ${guestMigrated.changes} 行`);

    // 步骤4：统计汇总
    const stats = await getStats(db);
    console.log('\n📊 迁移统计:');
    console.log(`   applications 总行数:        ${stats.appsTotal}`);
    console.log(`   applications images 有数据:  ${stats.appsImages}`);
    console.log(`   applications proof_image_url 有数据: ${stats.appsProof}`);
    console.log(`   guest_invitation_results 总行数:     ${stats.guestTotal}`);
    console.log(`   guest_invitation_results images 有数据: ${stats.guestImages}`);
    console.log(`   guest_invitation_results invitation_image_url 有数据: ${stats.guestInvitation}`);

    // 步骤5：验证数据一致性
    console.log('\n🔍 数据一致性检查:');
    const appsOrphan = await dbGet(db,
      "SELECT COUNT(*) as cnt FROM applications WHERE proof_image_url IS NOT NULL AND proof_image_url != '' AND (images IS NULL OR images = '')"
    );
    if (appsOrphan.cnt > 0) {
      console.log(`   ⚠️  applications 表有 ${appsOrphan.cnt} 行 proof_image_url 有值但 images 为空`);
    } else {
      console.log('   ✅ applications 表数据一致');
    }

    const guestOrphan = await dbGet(db,
      "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE invitation_image_url IS NOT NULL AND invitation_image_url != '' AND (images IS NULL OR images = '')"
    );
    if (guestOrphan.cnt > 0) {
      console.log(`   ⚠️  guest_invitation_results 表有 ${guestOrphan.cnt} 行 invitation_image_url 有值但 images 为空`);
    } else {
      console.log('   ✅ guest_invitation_results 表数据一致');
    }

    console.log('\n✅ 迁移完成！\n');

  } catch (err) {
    console.error('\n❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    await closeDb(db);
  }
}

// ========== 辅助函数 ==========

function openDb(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) reject(new Error(`无法打开数据库: ${err.message}`));
      else resolve(db);
    });
  });
}

function closeDb(db) {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

function runSql(db, sql) {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function dbGet(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function columnExists(db, tableName, columnName) {
  const cols = await new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  return cols.some(c => c.name === columnName);
}

async function getStats(db) {
  const [appsTotal, appsImages, appsProof, guestTotal, guestImages, guestInvitation] = await Promise.all([
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications WHERE images IS NOT NULL AND images != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM applications WHERE proof_image_url IS NOT NULL AND proof_image_url != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE images IS NOT NULL AND images != ''"),
    dbGet(db, "SELECT COUNT(*) as cnt FROM guest_invitation_results WHERE invitation_image_url IS NOT NULL AND invitation_image_url != ''"),
  ]);
  return {
    appsTotal: appsTotal.cnt,
    appsImages: appsImages.cnt,
    appsProof: appsProof.cnt,
    guestTotal: guestTotal.cnt,
    guestImages: guestImages.cnt,
    guestInvitation: guestInvitation.cnt,
  };
}

// ========== 入口 ==========

const dbPath = getDbPath();
migrate(dbPath);
```

### 3.4 执行方式

| 环境 | 执行命令 |
|------|----------|
| **测试环境** | `cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js` |
| **测试环境（指定路径）** | `cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js /TG/tgservice/db/tgservice.db` |
| **生产环境（宿主机）** | `cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js /TG/run/db/tgservice.db` |
| **生产环境（Docker 内）** | `docker exec tgservice node /app/backend/migrations/migrate-images-to-array.js /app/db/tgservice.db` |

### 3.5 发布时执行流程

```bash
# 1. 构建并推送新镜像（含迁移脚本）
docker build -t mameisong/tgservice:latest /TG
docker push mameisong/tgservice:latest

# 2. 先执行迁移脚本（在重启容器之前）
cd /TG/tgservice && node backend/migrations/migrate-images-to-array.js /TG/run/db/tgservice.db

# 3. 确认迁移成功后，重启容器
docker restart tgservice

# 4. 验证服务正常
docker logs -f tgservice --tail 20
```

> **⚠️ 重要**：迁移脚本必须在重启 Docker 容器**之前**执行，否则新代码读取 `images` 字段时该列还不存在。

---

## 四、公共图片上传模块设计

### 4.1 模块路径

```
/TG/tgservice-uniapp/src/utils/image-upload.js
```

### 4.2 模块 API 设计

```javascript
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

### 4.3 模块实现概要

> 实现与原设计稿相同，此处省略详细代码（与原稿 2.3 节一致）。
> 核心逻辑：`uni.chooseImage` → 获取 OSS 签名 → XHR PUT 直传 → 追加到 `imageUrls` 数组。

---

## 五、后端 API 修改

### 5.1 applications.js — 无需修改

`extra_data` 字段已在 INSERT 语句中接收，无需改动。
前端提交的 `images` 字段直接在 INSERT/UPDATE 时写入数据库。

**但需要修改应用创建/更新逻辑，将 `images` 写入 `images` 列**：

```javascript
// 当前 INSERT（简化示意）
INSERT INTO applications (applicant_phone, application_type, remark, proof_image_url, extra_data)
VALUES (?, ?, ?, ?, ?)

// 修改为：增加 images 列
INSERT INTO applications (applicant_phone, application_type, remark, images, extra_data)
VALUES (?, ?, ?, ?, ?)
// 注意：不再写入 proof_image_url
```

### 5.2 guest-invitations.js — 需要修改

#### POST 接口修改

```javascript
// 当前（约第115行）
router.post('/', requireBackendPermission(['all']), async (req, res) => {
  const { date, shift, coach_no, invitation_image_url } = req.body;
  // INSERT 不含 images
  
  // 修改为：
  const { date, shift, coach_no, images } = req.body;
  // images: JSON 数组字符串，如 '["url1", "url2"]'
  
  // INSERT 增加 images 列
  // 不再写入 invitation_image_url
});
```

### 5.3 后端 API 修改清单

| 文件 | 修改点 | 改动量 | 🔴 数据库变更 |
|------|--------|--------|-------------|
| `backend/routes/applications.js` | INSERT/UPDATE 增加 `images` 参数，移除 `proof_image_url` | ~10 行 | ✅ ALTER TABLE 已在迁移脚本执行 |
| `backend/routes/guest-invitations.js` | POST 接口接收 `images`，INSERT 增加 `images` 列 | ~10 行 | ✅ ALTER TABLE 已在迁移脚本执行 |
| `backend/migrations/migrate-images-to-array.js` | **新建**迁移脚本 | ~150 行 | ✅ ALTER TABLE + UPDATE |

---

## 六、前端代码修改方案

> **核心简化**：所有页面直接读写 `images` 字段，**无需任何兼容逻辑**。

### 6.1 读取图片的辅助函数（统一写法）

```javascript
// 所有展示页面统一使用这个函数
function getImageUrls(record) {
  if (record.images) {
    try {
      const imgs = typeof record.images === 'string' 
        ? JSON.parse(record.images) 
        : record.images;
      if (Array.isArray(imgs)) return imgs;
    } catch (e) {}
  }
  return [];  // 无图片时返回空数组
}
```

> **简化说明**：不再需要 `proof_image_url` fallback，直接解析 `images` 字段即可。

### 6.2 乐捐报备 (`lejuan.vue`)

**引入公共模块**：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'lejuan_proof' })
```

**提交逻辑**：
```javascript
await api.applications.create({
  applicant_phone: phone,
  application_type: '乐捐报备',
  remark: form.value.remark || `${form.value.date} 外出${form.value.hours}小时`,
  images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null,
  extra_data: {
    date: form.value.date,
    hours: form.value.hours
  }
})
```

### 6.3 公休申请 (`leave-apply.vue`)

**删除**原有 `uploadImage()`、`uploadFile()` 函数及相关 ref

**引入公共模块**：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'leave_proof' })
```

**提交逻辑**：
```javascript
await applications.create({
  applicant_phone: phone,
  application_type: '公休申请',
  remark: form.value.remark,
  images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null
})
```

**canSubmit 校验**：
```javascript
const canSubmit = computed(() => imageUrls.value.length > 0 && form.value.remark)
```

### 6.4 加班/晚到申请 (`overtime-apply.vue`)

**修改与公休申请几乎相同**，区别：
- `errorType: 'overtime_proof'`
- 申请类型动态（`早加班申请` / `晚加班申请`）

### 6.5 约客记录上传 (`invitation-upload.vue`)

**引入公共模块**：
```javascript
import { useImageUpload } from '@/utils/image-upload.js'

const { imageUrls, uploading, uploadProgress, uploadText, chooseAndUpload, removeImage, clearAll } = 
  useImageUpload({ maxCount: 3, ossDir: 'TgTemp/', errorType: 'invitation_screenshot' })
```

**提交逻辑**：
```javascript
await guestInvitations.create({
  coach_no: coachInfo.value.coachNo,
  date: today.value,
  shift: form.value.shift,
  images: imageUrls.value.length > 0 ? JSON.stringify(imageUrls.value) : null
})
```

**成功后清空**：
```javascript
clearAll()
```

### 6.6 加班审批 (`overtime-approval.vue`) — 展示层

```vue
<!-- 多图横向滚动展示 -->
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
const getImageUrls = (record) => {
  if (record.images) {
    try {
      const imgs = typeof record.images === 'string' ? JSON.parse(record.images) : record.images
      if (Array.isArray(imgs)) return imgs
    } catch (e) {}
  }
  return []
}

const previewImages = (record, idx) => {
  uni.previewImage({ urls: getImageUrls(record), current: idx })
}
```

### 6.7 公休审批 (`leave-approval.vue`)

**修改与加班审批完全相同**（6.6）

### 6.8 乐捐一览 (`lejuan-list.vue`)

**增加图片展示**：
```vue
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

### 6.9 约客审查 (`invitation-review.vue`) — 最复杂

#### A. 列表展示支持多图

```vue
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

#### B. 全屏审查弹窗改造

**核心改动**：
- 图片从 `max-height: 50vh` → `max-height: 85vh`（大幅增大）
- 按钮从 `height: 44px, font: 15px` → `height: 36px, font: 13px`（缩小）
- 增加多图指示器（圆点 + 序号）
- 增加左右切换箭头

**新增 JS**：
```javascript
const currentImageIndex = ref(0)

const getCurrentReviewImages = () => {
  if (!currentReview.value) return []
  return getImageUrls(currentReview.value)
}

const getImageUrls = (record) => {
  if (!record) return []
  if (record.images) {
    try {
      const imgs = typeof record.images === 'string' ? JSON.parse(record.images) : record.images
      if (Array.isArray(imgs)) return imgs
    } catch (e) {}
  }
  return []
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

---

## 七、CSS 样式

> 与原设计稿第 5 节相同，增加 `image-grid`、`image-scroll`、`upload-progress` 等公共样式。
> 约客审查弹窗的 CSS 修改要点：
> - `.review-image-full`: `max-height: 85vh`（原 50vh）
> - `.review-btn`: `height: 36px`（原 44px），`font-size: 13px`（原 15px）
> - `.review-name`: `font-size: 15px`（原 18px）
> - 新增 `.image-indicator`、`.indicator-dots`、`.img-nav-arrow`

---

## 八、文件修改清单汇总

### 8.1 新建文件

| 文件 | 说明 | 🔴 数据库变更 |
|------|------|-------------|
| `src/utils/image-upload.js` | 公共图片上传 Composable 模块 | — |
| `backend/migrations/migrate-images-to-array.js` | 数据迁移脚本 | ✅ ALTER TABLE + UPDATE |

### 8.2 修改文件

| 文件 | 改动类型 | 改动量估计 | 🔴 数据库变更 |
|------|----------|-----------|-------------|
| `src/pages/internal/lejuan.vue` | 新增图片上传 | +80 行 | — |
| `src/pages/internal/leave-apply.vue` | 替换为公共模块 | 删 60 行，增 20 行 | — |
| `src/pages/internal/overtime-apply.vue` | 替换为公共模块 | 删 60 行，增 20 行 | — |
| `src/pages/internal/invitation-upload.vue` | 替换为公共模块 | 删 60 行，增 30 行 | — |
| `src/pages/internal/overtime-approval.vue` | 多图展示 | +30 行 | — |
| `src/pages/internal/leave-approval.vue` | 多图展示 | +30 行 | — |
| `src/pages/internal/lejuan-list.vue` | 新增图片展示 | +35 行 | — |
| `src/pages/internal/invitation-review.vue` | 大图 90% + 按钮缩小 + 多图 | +100 行 | — |
| `backend/routes/applications.js` | INSERT 增加 `images` 列 | +10 行 | — |
| `backend/routes/guest-invitations.js` | POST 接收 `images`，INSERT 增加 `images` 列 | +10 行 | — |

### 8.3 无需修改

| 文件 | 原因 |
|------|------|
| `backend/server.js` | OSS STS 接口无需变动 |
| `src/utils/api-v2.js` | API 调用接口无需变动 |
| `src/utils/api.js` | OSS 签名接口无需变动 |
| `backend/db/index.js` | 数据库连接模块无需变动 |

---

## 九、数据流图（简化版）

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 H5                                 │
│                                                              │
│  乐捐报备 / 公休申请 / 加班申请 / 约客记录上传                 │
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
│       body: {                                                │
│         images: JSON.stringify(['url1', 'url2', 'url3'])     │
│       }                                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      后端 API                                 │
│                                                              │
│  applications.js:                                           │
│    INSERT INTO applications (..., images, extra_data)        │
│    ← images = JSON 数组字符串                                │
│                                                              │
│  guest-invitations.js:                                      │
│    INSERT INTO guest_invitation_results (..., images)        │
│    ← images = JSON 数组字符串                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   前端读取展示                                  │
│                                                              │
│  getImageUrls(record):                                      │
│    解析 record.images → JSON 数组                            │
│    返回 URL 数组（或空数组）                                   │
│                                                              │
│  审批列表/乐捐一览 → 横向滚动展示                              │
│  约客审查弹窗 → 全屏大图(85vh) + 多图指示器 + 左右切换          │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、约客审查页面改造对比

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
│  │❌ 无效  │ │✅ 有效  │ │  ← height: 44px, font: 15px
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

## 十一、数据库变更影响分析

### 🔴 涉及数据库结构变更的操作汇总

| 序号 | 操作 | 表 | SQL | 执行时机 |
|------|------|------|------|----------|
| 1 | 新增列 | `applications` | `ALTER TABLE applications ADD COLUMN images TEXT` | 发布前手动执行迁移脚本 |
| 2 | 新增列 | `guest_invitation_results` | `ALTER TABLE guest_invitation_results ADD COLUMN images TEXT` | 发布前手动执行迁移脚本 |
| 3 | 数据迁移 | `applications` | `UPDATE applications SET images = json_array(proof_image_url) WHERE ...` | 同上 |
| 4 | 数据迁移 | `guest_invitation_results` | `UPDATE guest_invitation_results SET images = json_array(invitation_image_url) WHERE ...` | 同上 |

### 旧字段处理

| 字段 | 处理方式 |
|------|----------|
| `applications.proof_image_url` | **保留列，不再写入**，旧数据保留作为归档 |
| `guest_invitation_results.invitation_image_url` | **保留列，不再写入**，旧数据保留作为归档 |
| `applications.extra_data` | 保留，继续存储业务扩展数据（如 `{date, hours}`），但不再存 images |

> 保留旧列的原因：万一需要回滚或排查问题，旧数据仍在。不删除列是因为 DROP COLUMN 在 SQLite 中需要重建表，风险较大。

---

## 十二、实施建议顺序

1. **第一步**：创建 `src/utils/image-upload.js` 公共模块
2. **第二步**：创建 `backend/migrations/migrate-images-to-array.js` 迁移脚本
3. **第三步**：修改后端路由（`applications.js` + `guest-invitations.js`）增加 `images` 写入
4. **第四步**：在测试环境执行迁移脚本，验证
5. **第五步**：修改 4 个上传页面（lejuan → leave-apply → overtime-apply → invitation-upload）
6. **第六步**：修改 3 个展示页面（overtime-approval → leave-approval → lejuan-list）
7. **第七步**：修改约客审查页面（invitation-review）—— 最复杂，最后处理
8. **第八步**：全面测试（H5 端）
9. **第九步**：发布时在生产环境执行迁移脚本，再重启 Docker

---

## 十三、与原设计稿的差异对照

| 项目 | 原设计稿 | 修订版 |
|------|----------|--------|
| 数据库存储 | 复用 `extra_data.images` JSON | 新增 `images` TEXT 列 |
| 向后兼容 | `getImageUrls()` 需 fallback 到 `proof_image_url` | 直接读取 `images`，无 fallback |
| 提交数据 | `proof_image_url` + `extra_data.images` 双写 | 只写 `images` |
| 迁移脚本 | 无 | 新建 `migrate-images-to-array.js` |
| 后端修改 | `applications.js` 无需改 | `applications.js` 需改 INSERT 列 |
| `guest-invitations.js` | 增加 `extra_data` 接收 | 增加 `images` 接收 |
| 代码复杂度 | 需要兼容逻辑 | 更简洁，无兼容逻辑 |

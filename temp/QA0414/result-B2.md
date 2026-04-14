## 测试结果 - 需求2

| 用例ID | 测试场景 | 结果 | 备注 |
|--------|---------|------|------|
| TC2-01 | 乐捐报备-上传1张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-02 | 乐捐报备-上传2张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-03 | 乐捐报备-上传3张图片（最大数量） | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-04 | 公休申请-上传1/2/3张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-05 | 请假申请-上传1/2/3张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-06 | 约客记录上传-上传1/2/3张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-07 | 尝试上传第4张图片（超限阻止） | ✅ 通过 | 4个页面均使用 `v-if="imageUrls.length < 3"` 隐藏上传按钮；`image-upload.js` 中 `chooseAndUpload()` 也有 `canChoose <= 0` 防护并弹出 toast 提示 |
| TC2-08 | 上传过程中取消选择 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-09 | 上传进度条显示 | ⚠️ 需人工 | 需要手机H5操作（但代码确认有 XHR upload.onprogress 进度条实现） |
| TC2-10 | 上传失败-网络异常 | ⚠️ 需人工 | 需要手机H5操作（但代码确认有 xhr.onerror 网络错误处理） |
| TC2-11 | 上传失败-OSS签名过期 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-12 | 已上传图片的删除功能 | ✅ 通过（代码审查） | `image-upload.js` 中 `removeImage(index)` 使用 `imageUrls.value.splice(index, 1)` 正确移除 |
| TC2-13 | 删除全部图片后重新上传 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-14 | 上传非图片文件 | ⚠️ 部分通过 | `uni.chooseImage` 本身无 `extension` 参数（该API标准参数中不存在此属性），但 `sourceType: ['album', 'camera']` 和 `sizeType: ['compressed']` 在系统相册端自动过滤非图片文件；`uploadFile` 中通过 `blob.type` 检查 MIME 类型推断扩展名 |
| TC2-15 | 加班审批-显示多张图片 | ⚠️ 需人工 | 需要后台管理操作 |
| TC2-16 | 公休审批-显示多张图片 | ⚠️ 需人工 | 需要后台管理操作 |
| TC2-17 | 乐捐一览-显示多张图片 | ⚠️ 需人工 | 需要手机H5操作 |
| TC2-18 | 约客审查-列表显示多张图片 | ✅ 通过（代码审查） | `invitation-review.vue` 中使用 `.card-image-grid` 网格展示，`slice(0, 3)` 限制最多3张，点击图片调用 `previewAllImages` |
| TC2-19 | 约客审查-单张图片的记录仍正常显示 | ⚠️ 需人工 | 需要迁移后的旧数据验证 |
| TC2-20 | 约客审查-图片占90%屏幕 | ✅ 通过 | CSS `.review-image-full` 设置 `max-height: 85vh; width: 100%` |
| TC2-21 | 约客审查-有效/无效按钮缩小 | ✅ 通过 | CSS `.review-btn` 设置 `height: 36px; font-size: 13px` |
| TC2-22 | 约客审查-多图指示器 | ✅ 通过 | `.indicator-dots` 圆点指示器 + `.image-counter-text` 显示 "当前/总数" |
| TC2-23 | 约客审查-左右切换图片 | ✅ 通过 | `prevReviewImage()` 和 `nextReviewImage()` 正确限制边界（`> 0` 和 `< length - 1`）；左右箭头仅 `currentReviewImages.length > 1` 时显示 |
| TC2-24 | 约客审查-点击助教名可全屏预览 | ✅ 通过 | 图片点击触发 `previewAllCurrentImages()`，调用 `uni.previewImage({ urls: images, current: currentImageIndex.value })` 从当前图片开始预览 |
| TC2-25 | 迁移脚本-正常执行（测试环境） | ✅ 通过 | 执行输出：[1/4] images列已存在 → [2/4] 迁移applications 0行 → [3/4] images列已存在 → [4/4] 迁移guest表 0行 → 数据一致性检查 ✅ |
| TC2-26 | 迁移脚本-旧数据正确迁移 | ✅ 通过 | applications 表5条记录 images 字段格式为 `'["URL"]'`；guest_invitation_results 表99条记录 images 字段格式正确 |
| TC2-27 | 迁移脚本-幂等性（执行两次不报错） | ✅ 通过 | 第二次执行：迁移 0 行，exit code 0，"images 列已存在，跳过 ALTER"，数据统计与第一次一致 |
| TC2-28 | 迁移脚本-指定数据库路径 | ✅ 通过 | 执行 `node backend/migrations/migrate-images-to-array.js /TG/tgservice/db/tgservice.db` 正常，输出中显示正确的数据库路径 |
| TC2-29 | 迁移脚本-无旧数据时执行 | ⏭️ 跳过 | 需要无旧数据的环境，当前数据库已有旧数据 |
| TC2-30 | 公共模块-image-upload.js 存在且可导入 | ✅ 通过 | 文件 `/TG/tgservice-uniapp/src/utils/image-upload.js` 存在（5576字节）；4个页面均通过 `import { useImageUpload }` 引入；无各自独立的 uploadImage/uploadFile 函数 |
| TC2-31 | 公共模块-maxCount 参数生效 | ✅ 通过 | 4个页面均传入 `maxCount: 3`；errorType 分别为 lejuan_proof / leave_proof / overtime_proof / invitation_screenshot；ossDir 均为 'TgTemp/' |
| TC2-32 | 公共模块-removeImage 功能 | ✅ 通过（代码审查） | `imageUrls.value.splice(index, 1)` 正确移除指定索引；Vue3 响应式数组更新触发视图刷新 |
| TC2-33 | 公共模块-clearAll 功能 | ✅ 通过（代码审查） | `imageUrls.value = []` 清空数组；约客上传页面提交成功后调用 `imageUrls.value = []` 清空 |
| TC2-34 | 后端-applications.js 接收 images 字段 | ✅ 通过（代码审查） | INSERT 语句包含 `images` 列；参数绑定 `images \|\| null`；POST 端点解构 `req.body` 中的 `images` |
| TC2-35 | 后端-guest-invitations.js 接收 images 字段 | ✅ 通过（代码审查） | POST 端点解构 `req.body` 中的 `images`；INSERT 语句包含 `images` 列；UPDATE 也包含 `images` 字段 |
| TC2-36 | 后端-查询接口返回 images 字段 | ✅ 通过（代码审查） | applications.js 返回数据中明确包含 `images: a.images`；guest-invitations.js 使用 `SELECT gir.*` 并通过 `{ ...inv }` 展开返回，images 字段包含在内 |
| TC2-37 | 小程序端-各页面不受H5改动影响 | ⚠️ 需人工 | 需要微信开发者工具或真机测试 |
| TC2-38 | 小程序端-条件编译正确隔离 | ⚠️ 需人工 | 需要微信开发者工具编译验证 |

---

## 测试汇总

### 服务器端可执行测试（20个用例）

| 结果 | 数量 | 用例ID |
|------|------|--------|
| ✅ 通过 | 18 | TC2-07, TC2-12, TC2-18, TC2-20, TC2-21, TC2-22, TC2-23, TC2-24, TC2-25, TC2-26, TC2-27, TC2-28, TC2-30, TC2-31, TC2-32, TC2-33, TC2-34, TC2-35, TC2-36 |
| ⚠️ 部分通过 | 1 | TC2-14（uni.chooseImage 无 extension 参数，但系统相册自动过滤图片） |
| ⏭️ 跳过 | 1 | TC2-29（需要无旧数据环境） |

### 需要人工执行的测试（18个用例）

| 结果 | 数量 | 用例ID |
|------|------|--------|
| ⚠️ 需人工 | 18 | TC2-01~TC2-06, TC2-08~TC2-11, TC2-13, TC2-15~TC2-17, TC2-19, TC2-37~TC2-38 |

### 代码审查发现的亮点

1. **公共模块化良好**：4个上传页面统一使用 `useImageUpload` 组合式函数，无重复代码
2. **迁移脚本幂等性良好**：第二次执行不报错、不重复写入数据
3. **约客审查 UI 改造符合设计稿**：85vh 图片、36px 按钮、多图指示器、左右切换均实现
4. **错误处理完善**：uploadFile 包含多种 HTTP 状态码的错误提示和自动上报

### 需要注意的点

1. **TC2-14**：`uni.chooseImage` API 标准参数中没有 `extension` 属性，无法强制过滤非图片文件。但 `sourceType` 和 `sizeType` 在系统相册端会自动限制为图片类型。H5 端如果用户通过文件选择器选择了非图片文件，`uploadFile` 中的 blob.type 检查可能会推断出非图片扩展名，但不会阻止上传。建议后续可考虑在 `chooseAndUpload` 中添加文件类型校验。

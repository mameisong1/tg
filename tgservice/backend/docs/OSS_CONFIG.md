# OSS 上传目录配置说明

## V2.0 上传目录结构

```
OSS Bucket: resource-images-sh
Region: oss-cn-shanghai

目录结构:
├── coaches/          # 助教照片/视频（原有）
├── products/         # 商品图片（新增）
├── invitations/      # 约客记录截图（新增）
└── TgTemp/          # 临时上传目录（加班截图等）（原有）
```

## 配置文件更新

### .config (生产环境)
```json
{
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "resource-images-sh",
    "uploadDir": "coaches/",
    "tmpDir": "TgTemp/",
    "coachDir": "coaches/",
    "productDir": "products/",
    "invitationDir": "invitations/"
  }
}
```

### .config.env (测试环境)
```json
{
  "oss": {
    "region": "oss-cn-shanghai",
    "bucket": "resource-images-sh",
    "uploadDir": "coaches/",
    "tmpDir": "TgTemp/",
    "coachDir": "coaches/",
    "productDir": "products/",
    "invitationDir": "invitations/"
  }
}
```

## 使用场景

### 1. 助教上传（复用原有功能）
- 照片：`coaches/{coach_no}_{timestamp}.jpg`
- 视频：`coaches/{coach_no}_{timestamp}.mp4`

### 2. 加班申请（新增）
- 证明图片：`TgTemp/overtime/{phone}_{timestamp}.jpg`

### 3. 约客记录（新增）
- 约客截图：`invitations/{date}_{shift}_{coach_no}.jpg`

### 4. 商品管理（新增）
- 商品图片：`products/{category}_{timestamp}.jpg`

## 前端直传流程

1. 前端请求 `/api/oss/sts` 获取临时凭证
2. 使用 STS 凭证直接上传文件到 OSS 指定目录
3. 上传成功后，将 URL 提交到后端 API

## 安全建议

1. **临时凭证有效期**：建议设置为 3600 秒（1 小时）
2. **目录权限**：前端只能上传到指定目录，不能删除或列出文件
3. **文件名校名**：使用 `{业务前缀}_{时间戳}.{扩展名}` 格式
4. **定期清理**：TgTemp/ 目录建议设置生命周期规则，7 天后自动删除

## 生命周期规则（推荐配置）

```
TgTemp/* → 7 天后过期删除
invitations/* → 永久保存（业务数据）
coaches/* → 永久保存（业务数据）
products/* → 永久保存（业务数据）
```

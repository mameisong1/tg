# 商品数据同步说明

## 概述

商品数据同步脚本用于从台客多后台采集商品数据，同步到天宫国际数据库。

> **2026-04-08 更新**：同步脚本已迁移到 `/TG/run/scripts`，数据库和日志路径同步更新。

## 脚本位置

```
/TG/run/scripts/sync-products.js
```

## 使用方法

```bash
# 手动执行同步
cd /TG/run/scripts
node sync-products.js

# 或直接运行
node /TG/run/scripts/sync-products.js
```

## 定时任务

脚本通过 crontab 设置定时执行，每天 13:30 自动同步：

```bash
# 查看定时任务
crontab -l

# 输出示例：
30 13 * * * cd /TG/run/scripts && /usr/bin/node sync-products.js >> /TG/run/scripts/sync-products-cron.log 2>&1
```

## 日志文件

- **日志路径**: `/TG/run/scripts/sync-products.log`
- **采集数据**: `/TG/run/data/taikeduo-products.json`

## 同步流程

1. 检查 Chrome 是否运行，未运行则启动
2. 连接到 Chrome 调试端口 (9222)
3. 打开台客多商品列表页面
4. 逐页采集商品数据
5. 过滤排除分类（如"美女教练"）
6. 同步到数据库（新增或更新）
7. 同步分类数据

## 排除分类

以下分类会被过滤，不同步到数据库：
- 美女教练

## 日志状态说明

| 日志标记 | 状态 |
|---------|------|
| `[SUCCESS] ========== 同步完成 ==========` | 同步成功 |
| `商品数据同步结束（异常）` | 同步失败 |
| `商品数据同步开始` | 同步开始 |

## 状态查看 API

后台管理页面可通过 API 查看同步状态：

```
GET /api/admin/sync-status
```

返回示例：
```json
{
  "status": "success",
  "lastSyncTime": "2026-03-25T15:11:32.765Z",
  "message": "同步成功"
}
```

状态值：
- `success` - 同步成功
- `failed` - 同步失败
- `running` - 同步中
- `none` - 从未同步

## 前端显示

在后台商品管理页面 (`/admin/products.html`) 顶部显示同步状态：
- ✅ 绿色 - 同步成功 + 时间
- ❌ 红色 - 同步失败
- ⏳ 黄色 - 同步中
- ○ 灰色 - 从未同步

## 常见问题

### 1. Chrome 启动失败

检查 Chrome 启动脚本：
```bash
bash /root/chrome
```

### 2. 页面加载超时

可能原因：
- 台客多后台服务响应慢
- 网络问题
- Chrome 资源不足

### 3. 需要登录

如果日志显示"需要登录台客多后台"，需要手动在 Chrome 中登录台客多管理后台。

---

*最后更新: 2026-03-26*
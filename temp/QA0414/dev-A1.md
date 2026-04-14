# 开发报告：需求 A1 - 台桌号有效期 30分钟→10分钟

> 开发者：程序员A1 | 日期：2026-04-14 | 需求编号：QA0414-A1

---

## 修改文件

| 序号 | 文件 | 改动说明 |
|------|------|----------|
| 1 | `/TG/tgservice/.config` | `tableAuth.expireMinutes` 从 `30` 改为 `10`，同步更新注释 |

**未修改文件说明**：
- `.config.env`（测试环境）：保持 `expireMinutes: 5` 不变
- `server.js`：从配置动态读取，无需修改
- `TableInfo.vue`：从后端接口获取配置值，无需修改
- `App.vue`：只负责写入时间戳，不涉及有效期计算

---

## 具体改动（diff）

```diff
--- a/.config (tableAuth section)
+++ b/.config (tableAuth section)
   "tableAuth": {
-    "expireMinutes": 30,
-    "_comment": "台桌扫码授权有效期（分钟）。测试环境建议5分钟，生产环境建议30分钟"
+    "expireMinutes": 10,
+    "_comment": "台桌扫码授权有效期（分钟）。测试环境建议5分钟，生产环境建议10分钟"
   },
```

---

## Git 提交

| 项 | 值 |
|---|---|
| **Commit ID** | `24d12fc5c8b449bf1088168daa277e66a441b903` |
| **Commit Message** | `feat(QA0414-A1): 生产环境台桌扫码授权有效期从30分钟改为10分钟` |
| **备份 Commit** | `b8f4e06` (修改前状态备份) |

> ⚠️ 注意：`.config` 文件在 `.gitignore` 中，此次使用 `git add -f` 强制提交。

---

## 生效方式

配置在 `server.js` 启动时一次性读取（`fs.readFileSync`），**不是热加载**。

修改后需要**重启后端服务**才能生效：
- 生产环境：`docker restart tgservice`（需用户确认）
- 测试环境：`pm2 restart tgservice-dev`

前端通过 `/api/front-config` 接口动态获取配置值，新页面/新会话自动使用新值。

---

## 影响范围

- **仅影响 H5 端**：小程序端 `TableInfo.vue` 第98-99行有 `#ifndef H5` 条件编译，小程序端不过期检查
- **已授权用户**：下次页面加载时 `checkAuth()` 会用新的10分钟重新计算，自动适应新值

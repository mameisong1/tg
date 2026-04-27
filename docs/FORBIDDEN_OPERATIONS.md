# 天宫国际 - 禁止事项清单

## 🚫 禁止使用 PM2 重启
服务已在 Docker 容器内运行。
- ✅ `docker restart tgservice` / `docker logs -f tgservice`
- ❌ `pm2 restart tgservice`（宿主机无效）

## 🚫 禁止删除的目录
| 目录 | 路径 | 后果 |
|------|------|------|
| admin | `/TG/tgservice/admin/` | 后台无法访问 |
| qrcode | `/TG/tgservice/qrcode/` | 二维码失效 |
| db | `/TG/tgservice/db/` | 数据全丢 |
| backend | `/TG/tgservice/backend/` | 后端崩溃 |

## 🚫 禁止手动部署 H5
- ❌ `cp -r dist/build/h5/* frontend/`
- ✅ `cd /TG/tgservice && ./deploy-h5.sh`

## 🚫 禁止克隆新仓库
- ❌ 在其他目录 `git clone`，会导致代码不同步
- ✅ 直接在 `/TG/tgservice` 和 `/TG/tgservice-uniapp` 修改

## 🚫 禁止直改数据库
- ❌ `sqlite3 /TG/tgservice/db/tgservice.db "DELETE..."`
- ✅ 通过 API 或后台界面修改

## 🚫 修改后必须更新向量库
```bash
/DB/rag-venv/bin/python3 /TG/docs/build_doc_index.py
/DB/rag-venv/bin/python3 /TG/docs/build_code_index.py
```

## ⚠️ 删除前必须确认
- 执行 `rm -rf`、清空目录、覆盖关键文件前，**必须检查是否涉及核心目录**
- 涉及核心目录 → 停止，向用户确认

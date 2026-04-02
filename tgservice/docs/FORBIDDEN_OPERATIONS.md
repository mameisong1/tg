# 天宫国际 - 禁止事项清单

> ⚠️ 本文档列出所有绝对禁止的操作，违反将导致系统故障

---

## 🚫 禁止使用 PM2 重启（2026-04-01 变更）

**服务已装入 Docker 容器运行，禁止直接使用 PM2！**

| ❌ 禁止 | ✅ 正确 |
|---------|---------|
| `pm2 restart tgservice` | `docker restart tgservice` |
| `pm2 restart tgservice-uniapp` | `docker restart tgservice` |
| `pm2 logs tgservice` | `docker logs -f tgservice` |

**原因**：PM2 在 Docker 容器内运行，宿主机执行 PM2 命令无效。

**正确做法**：
```bash
✅ docker restart tgservice
✅ docker logs -f tgservice
✅ docker exec tgservice pm2 list  # 查看容器内 PM2 状态
```

---

## 🚫 禁止删除的目录

| 目录 | 路径 | 用途 | 删除后果 |
|------|------|------|----------|
| **admin** | `/TG/tgservice/admin/` | 后台管理页面 | 后台无法访问 |
| **qrcode** | `/TG/tgservice/qrcode/` | 台桌二维码图片 | 二维码无法显示 |
| **db** | `/TG/tgservice/db/` | SQLite 数据库 | 数据全部丢失 |

**禁止命令**：
```bash
❌ rm -rf /TG/tgservice/db
```

---

## 🚫 禁止手动部署

**禁止手动复制 H5 文件**：

```bash
❌ cp -r /TG/tgservice-uniapp/dist/build/h5/* /TG/tgservice/frontend/
❌ rm -rf /TG/tgservice/frontend/* && cp -r ...
```

**正确做法**：
```bash
✅ cd /TG/tgservice && ./deploy-h5.sh
```

---

## 🚫 禁止克隆新仓库

**禁止在其他目录克隆项目**：

```bash
❌ git clone https://github.com/mameisong1/tgservice.git /somewhere/else
❌ cd /root && git clone ...
```

**原因**：项目已有本地仓库，克隆会导致代码不同步

**正确做法**：
```bash
✅ 直接在 /TG/tgservice 和 /TG/tgservice-uniapp 修改代码
```

---

## 🚫 禁止修改数据库文件

**禁止直接修改 SQLite 文件**：

```bash
❌ sqlite3 /TG/tgservice/db/tgservice.db "DELETE FROM ..."
❌ 手动编辑 .db 文件
```

**正确做法**：
```bash
✅ 通过 API 修改数据
✅ 通过后台管理界面修改
```

---

## 🚫 禁止跳过向量库更新

**代码或文档修改后必须更新向量库**：

```bash
❌ 修改代码后不更新向量库
```

**正确做法**：
```bash
✅ /DB/rag-venv/bin/python3 /TG/tgservice/docs/build_doc_index.py
✅ /DB/rag-venv/bin/python3 /TG/tgservice/docs/build_code_index.py
```

---

## 📋 重要目录对照表

| 目录 | 路径 | 用途 | 可删除？ |
|------|------|------|----------|
| backend | /TG/tgservice/backend/ | 后端代码 | ❌ 不可删除 |
| admin | /TG/tgservice/admin/ | 后台管理页面 | ❌ 不可删除 |
| qrcode | /TG/tgservice/qrcode/ | 台桌二维码 | ❌ 不可删除 |
| frontend | /TG/tgservice/frontend/ | H5 前端 | ✅ 可被H5构建覆盖 |
| db | /TG/tgservice/db/ | 数据库 | ❌ 不可删除 |
| docs | /TG/tgservice/docs/ | 文档 | ✅ 可重建 |

---

## ⚠️ 部署流程（必须遵守）

### H5 部署

```bash
# 1. 构建前端
cd /TG/tgservice-uniapp && npm run build:h5

# 2. 使用部署脚本
cd /TG/tgservice && ./deploy-h5.sh

# 3. 验证
curl http://localhost:8081/admin/login.html
```

### 小程序部署

```bash
# 1. 构建
cd /TG/tgservice-uniapp && npm run build:mp-weixin

# 2. 上传
npx miniprogram-ci upload --pp ./dist/build/mp-weixin --pkp ./private.xxx.key --appid wx9bba9dfb6c6792a9 -r 1 --uv 1.2.1 -d "描述"
```

---

## 📝 记忆要点

1. **H5 部署必须使用 deploy-h5.sh 脚本**
2. **禁止手动复制或 rm -rf frontend 目录**
3. **修改代码后必须更新向量库**
4. **admin 和 qrcode 已移至项目根目录，不会被 H5 构建覆盖**

---

## ⚠️ rm -rf / 清空 / 删除前必须检查

**执行任何包含以下操作的命令前，必须检查并确认：**

| 操作 | 示例命令 |
|------|----------|
| rm -rf | `rm -rf /path/to/dir` |
| 清空目录 | 删除目录下所有文件 |
| 覆盖文件 | 覆盖关键配置文件 |

**检查流程：**

### 步骤 1：识别操作目标
命令要删除/清空/覆盖的是哪个目录或文件？

### 步骤 2：检查是否为核心目录

| 目录 | 路径 | 删除后果 |
|------|------|----------|
| admin | /TG/tgservice/admin/ | 后台无法访问 |
| qrcode | /TG/tgservice/qrcode/ | 二维码无法显示 |
| db | /TG/tgservice/db/ | 数据全部丢失 |
| backend | /TG/tgservice/backend/ | 后端无法运行 |

### 步骤 3：决策
- **涉及核心目录** → 停止，向用户确认
- **不涉及核心目录** → 可以执行，但仍建议告知用户

**示例**：

```bash
# ❌ 错误：直接执行
rm -rf /TG/tgservice/frontend/*

# ✅ 正确：先检查
# frontend 不是核心目录，但清空前应确认
# → 向用户确认后再执行
```

**禁止事项**：
```bash
❌ 未经确认执行 rm -rf
❌ 未经确认清空任何项目目录
❌ 未经确认覆盖核心文件
```

---

_本文档是强制性的，违反将导致系统故障。_
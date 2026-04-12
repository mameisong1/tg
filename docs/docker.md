# 天宫国际 Docker 部署文档

## 容器信息

| 项目 | 信息 |
|------|------|
| **容器名称** | tgservice |
| **镜像名称** | mameisong/tgservice |
| **基础镜像** | node:22-bookworm-slim (glibc) |
| **端口映射** | 8081→80, 8083→81 |

## 目录结构

```
/app/
├── tgservice/           # 后端服务 (端口 80)
│   ├── backend/
│   │   ├── server.js
│   │   └── db/
│   │       └── tgservice.db
│   └── frontend/
│       └── admin/       # 后台管理页面
│
├── tgservice-uniapp/    # 前端 H5 (端口 81)
│   └── dist/build/h5/
│
├── data/                # 数据目录
├── tmp/                 # 临时文件
├── logs/                # PM2 日志
│   ├── tgservice-error.log
│   ├── tgservice-out.log
│   ├── tgservice-uniapp-error.log
│   └── tgservice-uniapp-out.log
│
└── ecosystem.config.js  # PM2 配置
```

## 构建命令

```bash
# 在 /TG 目录下执行
cd /TG

# 构建镜像（约3分钟，镜像大小约500MB）
docker build -t mameisong/tgservice:latest .
```

### 构建注意事项

1. **构建时间较长**：TG目录约500MB，首次构建约3分钟
2. **镜像大小**：约500MB（包含Node.js、PM2、项目文件）
3. **构建缓存**：修改代码后重新构建会利用缓存，速度较快

## 发布命令

```bash
# 推送到 Docker Hub
docker push mameisong/tgservice:latest
```

## 启动命令

### 快速启动

```bash
/TG/docker-start.sh
```

### 手动启动

```bash
docker run -d \
  --name tgservice \
  --restart unless-stopped \
  -v /TG:/app \
  -v /root/.openclaw:/root/.openclaw \
  -p 8081:80 \
  -p 8083:81 \
  mameisong/tgservice:latest
```

### 参数说明

| 参数 | 说明 |
|------|------|
| `-v /TG:/app` | 挂载宿主目录，方便修改代码 |
| `-v /root/.openclaw:/root/.openclaw` | **凭证文件挂载（短信服务商配置）** |
| `-p 8081:80` | 后端 API 端口映射 |
| `-p 8083:81` | H5 前端端口映射 |
| `--restart unless-stopped` | 自动重启策略 |

### ⚠️ 重要：凭证文件挂载

**凭证文件 `/root/.openclaw/credentials.json` 包含短信服务商配置，必须挂载到容器内才能发送短信验证码。**

如果不挂载，会出现以下错误：
```
加载 kltx 凭证失败: ENOENT: no such file or directory
短信发送失败: 凭证加载失败
```

## 常用操作

```bash
# 查看容器状态
docker ps | grep tgservice

# 查看日志
docker logs -f tgservice

# 进入容器
docker exec -it tgservice bash

# 重启容器（修改代码后）
docker restart tgservice

# 查看 PM2 状态（在容器内）
docker exec tgservice pm2 list

# 停止容器
docker stop tgservice

# 删除容器
docker rm tgservice
```

## 服务端口

| 服务 | 容器端口 | 宿主端口 | 说明 |
|------|----------|----------|------|
| tgservice | 80 | 8081 | 后端 API |
| tgservice-uniapp | 81 | 8083 | H5 前端 |

## 定时任务（容器内）

容器内已配置 cron 定时任务：

| 任务 | 时间 | 说明 |
|------|------|------|
| 台桌状态同步 | 多时段 | 0-2点每20分、2-14点每小时、14-20点每20分、20-24点每10分 |
| 商品同步 | 每天13:30 | 同步台客多商品数据 |

crontab配置：`/etc/cron.d/tgservice`（系统级，已指定用户名）

### 手动触发同步

> ⚠️ **2026-04-12 更新**：同步脚本已改为宿主机运行（依赖宿主机 Chrome），不再在容器内执行。

```bash
# 台桌状态同步
node /TG/run/scripts/sync-tables-status.js

# 商品同步
node /TG/run/scripts/sync-products.js
```

## nginx 配置

容器启动后，nginx 配置需要指向容器端口：

```nginx
# 后端 API
location /api/ {
    proxy_pass http://127.0.0.1:8081;
}

# 后台管理
location /admin/ {
    proxy_pass http://127.0.0.1:8081;
}

# H5 前台
location / {
    proxy_pass http://127.0.0.1:8083;
}
```

## 修改代码流程

1. 修改代码（宿主机 `/TG` 目录）
2. 重启容器：`docker restart tgservice`
3. 测试验证

## 发布新版本流程

1. 构建新镜像：`docker build -t mameisong/tgservice:latest .`
2. 推送镜像：`docker push mameisong/tgservice:latest`
3. 停止旧容器：`docker stop tgservice && docker rm tgservice`
4. 启动新容器（使用上面的启动命令）

---
_创建时间: 2026-04-01_
# 天宫国际 - 部署文档

本文档描述系统的部署架构、部署流程和运维命令。

---

## 1. 服务器信息

### 1.1 服务器配置

| 项目 | 配置 |
|------|------|
| **操作系统** | Ubuntu / CentOS |
| **域名** | www.tiangong.club / tiangong.club |
| **旧管理域名** | tg.tiangong.club |
| **SSL** | Let's Encrypt / 阿里云证书 |

### 1.2 端口分配

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | Nginx | HTTP（重定向到HTTPS） |
| 443 | Nginx | HTTPS |
| 8081 | Node.js 后端 | API 服务 |
| 8082 | 短视频系统 | 短视频创作（cz.tiangong.club） |
| 8083 | uni-app H5 前端 | 静态资源服务（开发热更新） |

### 1.3 进程列表

```bash
# 查看运行中的服务
pm2 list

# 预期输出
┌─────┬──────────────────┬─────────┬─────────┬───────────┐
│ id  │ name             │ mode    │ status  │ cpu       │
├─────┼──────────────────┼─────────┼─────────┼───────────┤
│ 0   │ tgservice        │ fork    │ online  │ 0.1%      │
│ 1   │ tgservice-uniapp │ fork    │ online  │ 0.1%      │
└─────┴──────────────────┴─────────┴─────────┴───────────┘
```

---

## 2. 后端部署

### 2.1 目录结构

```
/TG/tgservice/
├── backend/
│   ├── server.js           # 主入口
│   ├── package.json         # 依赖
│   ├── db/                  # 数据库目录
│   │   └── tgservice.db     # SQLite 数据库
│   ├── logs/                # 日志目录
│   │   ├── error.log
│   │   ├── access.log
│   │   └── operation.log
│   └── images/              # 本地图片（备用）
├── .config                  # 配置文件
└── docs/                    # 文档
```

### 2.2 首次部署

```bash
# 1. 进入后端目录
cd /TG/tgservice/backend

# 2. 安装依赖
npm install

# 3. 创建必要目录
mkdir -p db logs images

# 4. 检查配置文件
cat ../.config

# 5. 使用 PM2 启动
pm2 start server.js --name tgservice

# 6. 保存 PM2 配置
pm2 save

# 7. 设置开机自启
pm2 startup
```

### 2.3 启动命令

```bash
# 方式一：直接启动（调试用）
cd /TG/tgservice/backend
node server.js

# 方式二：PM2 启动（生产环境）
pm2 start server.js --name tgservice

# 方式三：使用 ecosystem 文件
pm2 start ecosystem.config.js
```

### 2.4 PM2 进程管理

```bash
# 启动服务
pm2 start tgservice

# 停止服务
pm2 stop tgservice

# 重启服务
pm2 restart tgservice

# 重载服务（零停机）
pm2 reload tgservice

# 查看日志
pm2 logs tgservice

# 查看实时日志
pm2 logs tgservice --lines 100

# 查看状态
pm2 status

# 监控
pm2 monit
```

### 2.5 ecosystem.config.js 示例

```javascript
// /TG/tgservice/backend/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tgservice',
    script: 'server.js',
    cwd: '/TG/tgservice/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

---

## 3. 前端部署

### 3.1 H5 部署

> ⚠️ **重要**：H5 部署必须使用 `deploy-h5.sh` 脚本，禁止手动复制文件！详见 [禁止事项清单](./FORBIDDEN_OPERATIONS.md)

#### 构建

```bash
# 进入前端项目目录
cd /TG/tgservice-uniapp

# 安装依赖
npm install

# 构建 H5 版本
npm run build:h5

# 输出目录：dist/build/h5
```

#### 部署脚本

> ⚠️ **必须使用 `/TG/tgservice/deploy-h5.sh` 脚本部署！禁止手动复制文件！**
>
> admin 和 qrcode 目录已移至项目根目录，不会被 H5 构建覆盖。
>
> 详见 [禁止事项清单](./FORBIDDEN_OPERATIONS.md)

#### 运行部署

```bash
# 1. 构建前端
cd /TG/tgservice-uniapp && npm run build:h5

# 2. 使用部署脚本（必须！）
cd /TG/tgservice && ./deploy-h5.sh

# 禁止手动复制！
# ❌ rm -rf /TG/tgservice/frontend/*
# ❌ cp -r /TG/tgservice-uniapp/dist/build/h5/* /TG/tgservice/frontend/
```

### 3.2 开发模式（H5热更新）

```bash
# 进入前端项目
cd /TG/tgservice-uniapp

# 启动开发服务器
npm run dev:h5

# 使用 PM2 守护（可选）
pm2 start "npm run dev:h5" --name tgservice-uniapp
```

### 3.3 小程序部署

#### 构建

```bash
cd /TG/tgservice-uniapp

# 构建微信小程序
npm run build:mp-weixin

# 输出目录：dist/build/mp-weixin
```

#### 上传到微信

**方式一：微信开发者工具**
1. 打开微信开发者工具
2. 导入项目 → 选择 `dist/build/mp-weixin` 目录
3. 点击"上传"
4. 填写版本号和备注
5. 在微信公众平台提交审核

**方式二：命令行上传（需配置密钥）**
```bash
# 需要先配置 miniprogram.privateKeyPath
# 使用 miniprogram-ci 工具
npx miniprogram-ci upload \
  --pp dist/build/mp-weixin \
  --pkp /TG/tgservice-uniapp/private.wx9bba9dfb6c6792a9.key \
  --appid wx9bba9dfb6c6792a9 \
  --uv 1.0.0 \
  --ud "版本描述"
```

### 3.4 ecosystem.config.js（前端）

```javascript
// /TG/tgservice-uniapp/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'tgservice-uniapp',
    script: 'npm',
    args: 'run dev:h5',
    cwd: '/TG/tgservice-uniapp',
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'development'
    }
  }]
};
```

---

## 4. Nginx 配置

### 4.1 完整配置文件

```nginx
# /etc/nginx/sites-available/tiangong.conf

# 天宫国际 UniApp版 - www.tiangong.club (HTTPS)
server {
    listen 443 ssl;
    server_name www.tiangong.club tiangong.club;
    
    # SSL 证书
    ssl_certificate /etc/nginx/ssl/www.tiangong.club.pem;
    ssl_certificate_key /etc/nginx/ssl/www.tiangong.club.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 上传大小限制
    client_max_body_size 50M;
    
    # API 代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 前端静态文件 / 开发服务器
    location / {
        proxy_pass http://127.0.0.1:8083;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name www.tiangong.club tiangong.club;
    return 301 https://$host$request_uri;
}

# 旧管理后台 - tg.tiangong.club
server {
    listen 443 ssl;
    server_name tg.tiangong.club;
    
    ssl_certificate /etc/nginx/ssl/tg.tiangong.club.pem;
    ssl_certificate_key /etc/nginx/ssl/tg.tiangong.club.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name tg.tiangong.club;
    return 301 https://$host$request_uri;
}
```

### 4.2 配置要点

1. **SSL 证书路径**
   ```nginx
   ssl_certificate /etc/nginx/ssl/www.tiangong.club.pem;
   ssl_certificate_key /etc/nginx/ssl/www.tiangong.club.key;
   ```

2. **API 代理**
   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:8081;
   }
   ```

3. **上传大小限制**
   ```nginx
   client_max_body_size 50M;  # 允许上传 50MB 文件
   ```

4. **WebSocket 支持**（前端热更新需要）
   ```nginx
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection 'upgrade';
   ```

### 4.3 Nginx 常用命令

```bash
# 测试配置语法
nginx -t

# 重载配置（平滑重启）
nginx -s reload

# 启动 Nginx
systemctl start nginx

# 停止 Nginx
systemctl stop nginx

# 重启 Nginx
systemctl restart nginx

# 查看状态
systemctl status nginx

# 查看错误日志
tail -f /var/log/nginx/error.log

# 查看访问日志
tail -f /var/log/nginx/access.log
```

### 4.4 启用配置

```bash
# 创建软链接
ln -s /etc/nginx/sites-available/tiangong.conf /etc/nginx/sites-enabled/

# 测试并重载
nginx -t && nginx -s reload
```

---

## 5. 常用运维命令

### 5.1 服务管理

```bash
# === PM2 服务管理 ===
pm2 list                    # 查看所有服务
pm2 start tgservice         # 启动后端
pm2 restart tgservice       # 重启后端
pm2 stop tgservice          # 停止后端
pm2 logs tgservice          # 查看日志
pm2 monit                   # 实时监控

# === Nginx 管理 ===
nginx -t                    # 测试配置
nginx -s reload             # 重载配置
systemctl restart nginx     # 重启 Nginx

# === 系统服务 ===
systemctl status nginx      # Nginx 状态
systemctl status pm2-root   # PM2 服务状态（假设以 root 运行）
```

### 5.2 日志查看

```bash
# 后端日志
tail -f /TG/tgservice/backend/logs/error.log      # 错误日志
tail -f /TG/tgservice/backend/logs/access.log     # 访问日志
tail -f /TG/tgservice/backend/logs/operation.log  # 操作日志

# PM2 日志
pm2 logs tgservice --lines 200

# Nginx 日志
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### 5.3 数据库操作

```bash
# 进入数据库目录
cd /TG/tgservice/backend/db

# 使用 SQLite CLI
sqlite3 tgservice.db

# 常用 SQL 命令
.tables                          # 查看所有表
.schema coaches                  # 查看表结构
SELECT * FROM coaches LIMIT 10;  # 查询数据
.quit                            # 退出
```

### 5.4 备份与恢复

```bash
# 备份数据库
cp /TG/tgservice/backend/db/tgservice.db /backup/tgservice_$(date +%Y%m%d).db

# 备份配置
cp /TG/tgservice/.config /backup/config_$(date +%Y%m%d).json

# 恢复数据库
cp /backup/tgservice_20240322.db /TG/tgservice/backend/db/tgservice.db

# 定时备份（添加到 crontab）
crontab -e
# 每天凌晨 3 点备份
0 3 * * * cp /TG/tgservice/backend/db/tgservice.db /backup/tgservice_$(date +\%Y\%m\%d).db
```

### 5.5 问题排查

```bash
# 检查端口占用
netstat -tlnp | grep -E '8081|8082|8083'
lsof -i :8081

# 检查进程
ps aux | grep node
ps aux | grep nginx

# 检查磁盘空间
df -h

# 检查内存
free -m

# 检查 CPU
top

# 测试 API
curl http://localhost:8081/api/products
curl https://www.tiangong.club/api/products
```

### 5.6 完整部署流程

```bash
#!/bin/bash
# 完整部署脚本

echo "=== 天宫国际完整部署 ==="

# 1. 拉取最新代码（如果使用 Git）
# cd /TG/tgservice && git pull

# 2. 部署后端
cd /TG/tgservice/backend
npm install
pm2 restart tgservice

# 3. 构建前端 H5
cd /TG/tgservice-uniapp
npm install
npm run build:h5

# 4. 重启前端服务
pm2 restart tgservice-uniapp

# 5. 检查服务状态
pm2 list

echo "=== 部署完成 ==="
```

---

## 6. SSL 证书管理

### 6.1 证书位置

```
/etc/nginx/ssl/
├── www.tiangong.club.pem
├── www.tiangong.club.key
├── tg.tiangong.club.pem
└── tg.tiangong.club.key
```

### 6.2 证书更新

使用阿里云证书时，下载后替换文件并重载 Nginx：

```bash
# 上传新证书
scp www.tiangong.club.pem server:/etc/nginx/ssl/
scp www.tiangong.club.key server:/etc/nginx/ssl/

# 重载 Nginx
nginx -t && nginx -s reload
```

### 6.3 Let's Encrypt（可选）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d www.tiangong.club -d tiangong.club

# 自动续期（已自动配置）
certbot renew --dry-run
```

---

## 7. 故障恢复

### 7.1 后端服务挂掉

```bash
# 检查原因
pm2 logs tgservice --lines 100

# 重启服务
pm2 restart tgservice

# 如果 PM2 也挂了
cd /TG/tgservice/backend
pm2 start server.js --name tgservice
```

### 7.2 Nginx 502 错误

```bash
# 检查后端是否运行
curl http://localhost:8081/api/products

# 如果后端挂了，重启
pm2 restart tgservice

# 检查 Nginx 日志
tail -f /var/log/nginx/error.log
```

### 7.3 数据库损坏

```bash
# 恢复最近的备份
cp /backup/tgservice_latest.db /TG/tgservice/backend/db/tgservice.db

# 重启服务
pm2 restart tgservice
```

---

## 8. 监控与告警

### 8.1 PM2 监控

```bash
# 实时监控
pm2 monit

# Web 监控面板
pm2 plus  # 需要注册 PM2 Plus 账号
```

### 8.2 简易健康检查脚本

```bash
#!/bin/bash
# /TG/tgservice/healthcheck.sh

API_URL="http://localhost:8081/api/products"

response=$(curl -s -o /dev/null -w "%{http_code}" $API_URL)

if [ "$response" != "200" ]; then
    echo "API 异常，正在重启..."
    pm2 restart tgservice
    # 发送告警（可选）
    # curl -X POST "钉钉webhook" -d '{"msgtype":"text","text":{"content":"天宫国际后端重启"}}'
fi
```

添加到 crontab：
```bash
# 每 5 分钟检查一次
*/5 * * * * /TG/tgservice/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

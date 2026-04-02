# 天宫国际 Docker 镜像
# 基于 Node.js LTS (glibc)

FROM node:22-bookworm-slim

# 安装必要工具
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 PM2 和 serve
RUN npm install -g pm2 serve

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY tgservice /app/tgservice
COPY tgservice-uniapp /app/tgservice-uniapp
COPY data /app/data
COPY scripts /app/scripts
COPY tmp /app/tmp

# 复制 PM2 配置
COPY ecosystem.config.js /app/ecosystem.config.js

# 设置环境变量
ENV NODE_ENV=production

# 初始化数据库（如果不存在）
RUN if [ ! -f /app/tgservice/db/tgservice.db ]; then \
        sqlite3 /app/tgservice/db/tgservice.db ".databases"; \
    fi

# 暴露端口
EXPOSE 80 81

# 启动命令
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
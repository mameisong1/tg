# 天宫国际 Docker 镜像
# 基于 Node.js LTS (glibc)

FROM node:22-bookworm-slim

# 安装必要工具 + tzdata
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# 设置时区为北京时间
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 安装 PM2 和 serve
RUN npm install -g pm2 serve

# 创建工作目录
WORKDIR /app

# 复制项目文件（.dockerignore 会排除 node_modules 等）
COPY tgservice /app/tgservice
COPY tgservice-uniapp /app/tgservice-uniapp
COPY data /app/data

# 复制 PM2 配置
COPY ecosystem.config.js /app/ecosystem.config.js

# 设置环境变量
ENV TGSERVICE_ENV=production
ENV NODE_ENV=production

# 安装后端生产依赖（node_modules 已被 .dockerignore 排除）
RUN cd /app/tgservice/backend && npm install --production

# H5 前端只需 serve 静态文件，不需要 node_modules

# 初始化数据库（如果不存在）
RUN if [ ! -f /app/tgservice/db/tgservice.db ]; then \
        sqlite3 /app/tgservice/db/tgservice.db ".databases"; \
    fi

# 暴露端口
EXPOSE 80 81

# 启动命令
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
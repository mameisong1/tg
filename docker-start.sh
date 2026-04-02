#!/bin/bash
# Docker 启动脚本 - 生产环境
# 包含凭证文件挂载（短信服务商配置）

set -e

echo "=========================================="
echo "天宫国际 Docker 启动脚本"
echo "=========================================="

# 配置
IMAGE_NAME="mameisong/tgservice:latest"
CONTAINER_NAME="tgservice"
TG_DIR="/TG"
CREDENTIALS_DIR="/root/.openclaw"

# 检查凭证文件
if [ ! -f "$CREDENTIALS_DIR/credentials.json" ]; then
    echo "❌ 错误: 凭证文件不存在: $CREDENTIALS_DIR/credentials.json"
    echo "请先创建凭证文件后再启动"
    exit 1
fi

echo "✅ 凭证文件检查通过"

# 停止并删除旧容器（如果存在）
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "停止并删除旧容器..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
fi

# 启动新容器
echo "启动新容器..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 8081:80 \
    -p 8083:81 \
    -v $TG_DIR:/app \
    -v $CREDENTIALS_DIR:$CREDENTIALS_DIR \
    $IMAGE_NAME

# 检查启动状态
echo ""
echo "等待容器启动..."
sleep 5

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ 容器启动成功"
    echo ""
    echo "端口映射:"
    echo "  - 8081 → 80 (后端 API)"
    echo "  - 8083 → 81 (H5 前端)"
    echo ""
    echo "挂载目录:"
    echo "  - $TG_DIR → /app"
    echo "  - $CREDENTIALS_DIR → $CREDENTIALS_DIR (凭证文件)"
    echo ""
    echo "查看日志: docker logs -f $CONTAINER_NAME"
else
    echo "❌ 容器启动失败"
    docker logs $CONTAINER_NAME 2>&1 | tail -20
    exit 1
fi
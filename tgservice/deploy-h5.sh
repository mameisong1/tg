#!/bin/bash
# H5部署脚本
# 将 uni-app 构建的 H5 文件部署到 frontend 目录
set -e

FRONTEND_DIR="/TG/tgservice/frontend"
BUILD_DIR="/TG/tgservice-uniapp/dist/build/h5"

echo "=== H5 部署开始 ==="

# 检查构建目录是否存在
if [ ! -d "$BUILD_DIR" ]; then
    echo "❌ 错误: 构建目录不存在，请先运行 npm run build:h5"
    exit 1
fi

# 清空 frontend 目录
echo "📁 清空 frontend 目录..."
rm -rf "$FRONTEND_DIR"/*

# 复制构建文件
echo "📦 复制 H5 构建文件..."
cp -r "$BUILD_DIR"/* "$FRONTEND_DIR"/

# 设置权限
chmod -R 755 "$FRONTEND_DIR"

echo "✅ H5 部署完成！"
echo "   目录: $FRONTEND_DIR"
ls -la "$FRONTEND_DIR"
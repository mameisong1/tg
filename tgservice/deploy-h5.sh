#!/bin/bash
# H5部署脚本
# 注意：admin和qrcode目录已移至项目根目录，不会被H5构建覆盖
set -e

FRONTEND_DIR="/TG/tgservice/frontend"
H5_BUILD_DIR="/TG/tgservice-uniapp/dist/build/h5"

echo "=== H5 部署 ==="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 检查构建目录
if [ ! -d "$H5_BUILD_DIR" ]; then
    echo "错误: 请先执行 npm run build:h5"
    exit 1
fi

# 检查构建目录是否为空
if [ -z "$(ls -A $H5_BUILD_DIR)" ]; then
    echo "错误: H5构建目录为空，请先执行 npm run build:h5"
    exit 1
fi

# 清空 frontend 目录
rm -rf "$FRONTEND_DIR"/*

# 复制 H5 文件
cp -r "$H5_BUILD_DIR"/* "$FRONTEND_DIR/"

echo "✓ H5 部署完成"
echo "部署目录: $FRONTEND_DIR"
echo "部署时间: $(date '+%Y-%m-%d %H:%M:%S')"
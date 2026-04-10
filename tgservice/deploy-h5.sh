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

# 备份 admin 和 qrcode 目录
BACKUP_DIR="/tmp/h5-deploy-backup-$$"
echo "💾 备份 admin 和 qrcode 目录..."
mkdir -p "$BACKUP_DIR"
[ -d "$FRONTEND_DIR/admin" ] && cp -r "$FRONTEND_DIR/admin" "$BACKUP_DIR/admin"
[ -d "$FRONTEND_DIR/qrcode" ] && cp -r "$FRONTEND_DIR/qrcode" "$BACKUP_DIR/qrcode"

# 清空 frontend 目录
echo "📁 清空 frontend 目录..."
rm -rf "$FRONTEND_DIR"/*

# 复制构建文件
echo "📦 复制 H5 构建文件..."
cp -r "$BUILD_DIR"/* "$FRONTEND_DIR"/

# 恢复 admin 和 qrcode 目录
if [ -d "$BACKUP_DIR/admin" ]; then
  echo "💾 恢复 admin 目录..."
  cp -r "$BACKUP_DIR/admin" "$FRONTEND_DIR/admin"
fi
if [ -d "$BACKUP_DIR/qrcode" ]; then
  echo "💾 恢复 qrcode 目录..."
  cp -r "$BACKUP_DIR/qrcode" "$FRONTEND_DIR/qrcode"
fi

# 清理备份
rm -rf "$BACKUP_DIR"

# 设置权限
chmod -R 755 "$FRONTEND_DIR"

echo "✅ H5 部署完成！"
echo "   目录: $FRONTEND_DIR"
ls -la "$FRONTEND_DIR"
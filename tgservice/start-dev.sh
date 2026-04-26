#!/bin/bash
# 开发环境启动脚本
# 设置 Turso 云端数据库环境变量并启动 PM2

export TGSERVICE_ENV=test
export TURSO_DATABASE_URL="libsql://tgservicedev-mameisong.aws-ap-northeast-1.turso.io"
export TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzcxODA5NjgsImlkIjoiMDE5ZGM4M2MtZGIwMS03YmYyLTg5MDUtZmQ5ODlkMjMwYjhlIiwicmlkIjoiNjU5NTJkNWUtZGVjYS00MTJiLThlMmQtZThhNDA0Yjc2NTU1In0.bAk5MtI4iHxyxUDT9D_q_F8V0QIhxjUoV86RxXyqb_oeGo2iu528xW9D42Izbp67KoVT1ab7tNYEkIXHgu_7Dg"

cd /TG/tgservice/backend

# 重启 PM2 服务
pm2 restart tgservice-dev

echo "✅ 开发环境已启动，使用 Turso 云端数据库"
echo "环境变量:"
echo "  TGSERVICE_ENV=$TGSERVICE_ENV"
echo "  TURSO_DATABASE_URL=$TURSO_DATABASE_URL"
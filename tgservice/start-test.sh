#!/bin/bash
# 启动测试环境（通过 PM2）
cd /TG/tgservice
pm2 stop tgservice
TGSERVICE_ENV=test pm2 start tgservice --update-env
echo "测试环境已启动，配置文件: .config.env"
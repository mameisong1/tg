#!/bin/bash
# 启动生产环境（通过 PM2）
cd /TG/tgservice
pm2 stop tgservice
TGSERVICE_ENV=production pm2 start tgservice --update-env
echo "生产环境已启动，配置文件: .config"
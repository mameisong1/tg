#!/bin/bash
# Docker 容器内启动脚本 - H5 前端服务
# 端口 81

cd /app/tgservice-uniapp/dist/build/h5
exec serve -s -l 81
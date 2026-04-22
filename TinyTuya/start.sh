#!/bin/bash
# 中山台球厅空调控制系统启动脚本

echo "========================================"
echo "TinyTuya + MQTT 空调控制系统"
echo "中山台球厅本地部署"
echo "========================================"

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker未安装"
    echo "请先安装Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查镜像是否存在
if ! docker images | grep -q "tinytuya-controller"; then
    echo "警告: 镜像不存在，请先加载镜像文件"
    echo "命令: docker load -i tinytuya-controller.tar"
    exit 1
fi

# 停止并删除旧容器（如果存在）
docker stop tinytuya-controller 2>/dev/null
docker rm tinytuya-controller 2>/dev/null

echo ""
echo "启动容器..."
echo ""

# 启动容器（host网络模式，确保能访问局域网设备）
docker run -d \
    --name tinytuya-controller \
    --restart unless-stopped \
    --network host \
    tinytuya-controller:latest

sleep 3

echo "========================================"
echo "服务已启动"
echo "========================================"
echo ""
echo "查看日志:"
echo "  docker logs -f tinytuya-controller"
echo ""
echo "扫描设备（发现网关IP）:"
echo "  docker exec tinytuya-controller python scan_devices.py"
echo ""
echo "测试连接:"
echo "  docker exec tinytuya-controller python test_connection.py"
echo ""
echo "停止服务:"
echo "  docker stop tinytuya-controller"
echo ""
echo "========================================"
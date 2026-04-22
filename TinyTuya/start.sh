#!/bin/bash
echo "========================================"
echo "启动 TinyTuya 空调控制系统"
echo "订阅主题: tiangongguojikongtiao"
echo "========================================"

docker stop tinytuya-controller 2>/dev/null
docker rm tinytuya-controller 2>/dev/null

# 网关配置（使用变量避免特殊字符问题）
DEFAULT_IP="192.168.110.62"
DEFAULT_KEY="k[BxEj?<'^;cu|]1"

GW_IP="${GATEWAY_IP:-$DEFAULT_IP}"
GW_KEY="${GATEWAY_KEY:-$DEFAULT_KEY}"

echo "网关IP: $GW_IP"
echo "网关Key: (已设置)"
echo "订阅主题: tiangongguojikongtiao"
echo ""

# 启动容器
docker run -d \
    --name tinytuya-controller \
    --restart unless-stopped \
    --network host \
    -e MQTT_HOST=8.134.248.240 \
    -e MQTT_PORT=1883 \
    -e MQTT_USERNAME=admin \
    -e MQTT_PASSWORD=mms6332628 \
    -e "GATEWAY_IP=$GW_IP" \
    -e "GATEWAY_KEY=$GW_KEY" \
    tinytuya-controller:latest

# 检查启动结果
sleep 3

if docker ps | grep -q tinytuya-controller; then
    echo ""
    echo "========================================"
    echo "✓ 容器启动成功!"
    echo "========================================"
    echo ""
    echo "查看日志:"
    echo "  docker logs -f tinytuya-controller"
    echo ""
    echo "测试命令:"
    echo '  mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 -t tiangongguojikongtiao -m "{\"node_id\":\"3\",\"switch\":true}"'
    echo ""
else
    echo ""
    echo "========================================"
    echo "✗ 容器启动失败!"
    echo "========================================"
    echo ""
    echo "检查错误:"
    docker logs tinytuya-controller 2>&1 | tail -20
fi
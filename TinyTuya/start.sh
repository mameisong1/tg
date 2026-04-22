#!/bin/bash
echo "========================================"
echo "启动 TinyTuya 控制器"
echo "========================================"

docker stop tinytuya-controller 2>/dev/null
docker rm tinytuya-controller 2>/dev/null

# 默认网关配置
DEFAULT_IP="192.168.110.10"
DEFAULT_KEY="k[BxEj?<'^;cu|]1"

# 使用环境变量或默认值
GW_IP="${GATEWAY_1_IP:-$DEFAULT_IP}"
GW_KEY="${GATEWAY_1_KEY:-$DEFAULT_KEY}"

echo "网关IP: $GW_IP"
echo "网关Key: $GW_KEY"
echo ""

docker run -d \
    --name tinytuya-controller \
    --restart unless-stopped \
    --network host \
    -e MQTT_HOST=8.134.248.240 \
    -e MQTT_PORT=1883 \
    -e MQTT_USERNAME=admin \
    -e MQTT_PASSWORD=mms6332628 \
    -e "GATEWAY_1_IP=$GW_IP" \
    -e "GATEWAY_1_KEY=$GW_KEY" \
    tinytuya-controller:latest

sleep 3
echo ""
echo "========================================"
echo "已启动! 查看日志:"
echo "docker logs -f tinytuya-controller"
echo "========================================"
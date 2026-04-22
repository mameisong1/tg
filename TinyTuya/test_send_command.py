"""
发送测试MQTT控制命令
"""
import json
import time
import paho.mqtt.client as mqtt

MQTT_HOST = "8.134.248.240"
MQTT_PORT = 1883
MQTT_USERNAME = "admin"
MQTT_PASSWORD = "mms6332628"

# 测试设备：室内机16
TEST_DEVICE = "6c1d7f15376d6f2a82elsf"

print("发送测试命令到室内机16...")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-command-sender")
client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
client.connect(MQTT_HOST, MQTT_PORT, keepalive=10)
client.loop_start()

time.sleep(1)

# 发送控制命令：开空调，制冷24度
topic = f"tuya/device/{TEST_DEVICE}/command"
payload = json.dumps({"switch": True, "temp_set": 24, "mode": "cold"})

result = client.publish(topic, payload)
if result.rc == mqtt.MQTT_ERR_SUCCESS:
    print(f"✓ 命令发送成功")
    print(f"  主题: {topic}")
    print(f"  内容: {payload}")
else:
    print(f"✗ 命令发送失败: 错误码 {result.rc}")

# 等待处理
time.sleep(3)

client.loop_stop()
client.disconnect()
print("测试完成")
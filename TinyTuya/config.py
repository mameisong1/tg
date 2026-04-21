"""
TinyTuya + MQTT 控制器配置
本地控制涂鸦设备
"""
import os

# MQTT 配置
MQTT_HOST = os.getenv("MQTT_HOST", "8.134.248.240")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mms6332628")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "tinytuya-mqtt-controller")

# 涂鸦设备配置
# local_key 需要通过涂鸦IoT平台或TinyTuya Wizard获取
TUYA_DEVICES = {
    "6c1d7f15376d6f2a82elsf": {
        "name": "空调-室内机16",
        "product": "室内机（WiFi）",
        "local_key": os.getenv("TUYA_LOCAL_KEY", ""),  # 需要填入
        "ip": os.getenv("TUYA_DEVICE_IP", "auto"),  # 自动发现
        "version": "3.3",
        # 子设备信息（通过网关控制）
        "is_sub_device": True,
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",  # 中央空调集控网关
    },
    # 网关设备
    "6cedfa65e9e0d2f95bv8dw": {
        "name": "中央空调集控网关",
        "product": "中央空调集控网关（WiFi）",
        "local_key": os.getenv("TUYA_GATEWAY_LOCAL_KEY", ""),  # 网关的local_key
        "ip": os.getenv("TUYA_GATEWAY_IP", "auto"),
        "version": "3.3",
        "is_gateway": True,
    }
}

# MQTT 主题配置
MQTT_TOPIC_PREFIX = "tuya/device"

# 设备控制参数映射
DEVICE_PARAMS = {
    "switch": {"type": "bool", "values": [True, False]},
    "temp_set": {"type": "int", "min": 16, "max": 32},
    "mode": {"type": "str", "values": ["hot", "cold", "wind", "wet"]},
    "fan_speed_enum": {"type": "str", "values": ["auto", "low", "middle", "high"]},
}
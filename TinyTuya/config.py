"""
TinyTuya MQTT 控制器配置
"""
import os

# MQTT 配置
MQTT_HOST = os.getenv("MQTT_HOST", "8.134.248.240")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mms6332628")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "tinytuya-controller")

# 涂鸦设备配置
# 格式: {"设备ID": {"name": "设备名称", "local_key": "本地密钥"}}
# local_key 需要通过 tinytuya scan 或涂鸦云API获取
TUYA_DEVICES = {
    "6c1d7f15376d6f2a82elsf": {
        "name": "空调",
        "local_key": os.getenv("TUYA_LOCAL_KEY", ""),  # 需要填入
        "ip": os.getenv("TUYA_DEVICE_IP", ""),  # 可选，自动发现
        "version": "3.3",  # 涂鸦协议版本
    }
}

# MQTT 主题配置
MQTT_TOPIC_PREFIX = "tuya/device"
# 订阅主题: tuya/device/{device_id}/command
# 发布主题: tuya/device/{device_id}/status

# 设备控制参数映射
DEVICE_PARAMS = {
    "switch": {"type": "bool", "values": [True, False]},
    "temp_set": {"type": "int", "min": 16, "max": 30},
    "mode": {"type": "str", "values": ["hot", "cold", "wind", "wet"]},
    "fan_speed_enum": {"type": "str", "values": ["auto", "low", "middle", "high"]},
}
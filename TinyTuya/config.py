"""
TinyTuya + MQTT 控制器配置
本地控制涂鸦设备（天宫国际台球厅空调系统）
"""
import os

# MQTT 配置（外网服务器）
MQTT_HOST = os.getenv("MQTT_HOST", "8.134.248.240")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mms6332628")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "tinytuya-mqtt-tiangong")

# 涂鸦设备 local_key（所有设备共享）
TUYA_LOCAL_KEY = os.getenv("TUYA_LOCAL_KEY", "k[BxEj?<'^;cu|]1")

# 网关设备信息（中央空调集控网关）
GATEWAY_ID = "6cedfa65e9e0d2f95bv8dw"
GATEWAY_IP = os.getenv("GATEWAY_IP", "auto")  # 自动发现或指定IP

# 室内机设备列表（19台子设备，通过网关控制）
TUYA_DEVICES = {
    # 网关设备
    "6cedfa65e9e0d2f95bv8dw": {
        "name": "中央空调集控网关",
        "product": "中央空调集控网关（WiFi）",
        "model": "UACC-B-XX-TW",
        "local_key": TUYA_LOCAL_KEY,
        "ip": GATEWAY_IP,
        "version": "3.3",
        "is_gateway": True,
        "mac": "38:a5:c9:14:8f:ac",
        "sn": "100166266001DD",
    },
    # 室内机1
    "6c6222ab98a674b474wzba": {
        "name": "室内机1",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "1",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机2
    "6c5f64a1f1c06845480zec": {
        "name": "室内机2",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "18",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机3
    "6cdf8d7b5b477c0029twev": {
        "name": "室内机3",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "17",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机4
    "6cd5d312f1477108c5oakp": {
        "name": "室内机4",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "16",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机5
    "6c793e4c179e36f8c78o6c": {
        "name": "室内机5",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "15",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机6
    "6ce46f266709a6bb72iwvo": {
        "name": "室内机6",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "14",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机7
    "6cd30259b2300268eak3hi": {
        "name": "室内机7",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "13",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机8
    "6c080de917e5874cadnyr8": {
        "name": "室内机8",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "12",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机9
    "6cd285cec9884dd573y891": {
        "name": "室内机9",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "11",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机10
    "6cb4c1d32e37da7974akjt": {
        "name": "室内机10",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "10",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机11
    "6cbbba7716ddafbac1mmlw": {
        "name": "室内机11",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "9",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机12
    "6cdbd07fefe5d7dc78qe0t": {
        "name": "室内机12",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "8",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机13
    "6c84ec9582a300a32dirox": {
        "name": "室内机13",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "7",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机14
    "6cc27f00393cee54ccmgey": {
        "name": "室内机14",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "6",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机15
    "6c9a267a8af9044c5cmlou": {
        "name": "室内机15",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "5",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机16
    "6c1d7f15376d6f2a82elsf": {
        "name": "室内机16",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "3",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机16（WiFi版本）
    "6cfb71b5aaa54daae8swgo": {
        "name": "室内机16-WiFi",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "4",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
    # 室内机18
    "6cd1fa5d89f77a12bblxf8": {
        "name": "室内机18",
        "product": "室内机（WiFi）",
        "model": "UACC-B-XX-TW-N",
        "local_key": TUYA_LOCAL_KEY,
        "node_id": "2",
        "is_sub_device": True,
        "gateway_id": GATEWAY_ID,
    },
}

# MQTT 主题配置
MQTT_TOPIC_PREFIX = "tuya/device"

# 设备控制参数映射（DPS编号）
DEVICE_PARAMS = {
    "switch": {"dps": 1, "type": "bool", "desc": "开关"},
    "temp_set": {"dps": 2, "type": "int", "min": 16, "max": 32, "desc": "设定温度"},
    "temp_current": {"dps": 3, "type": "int", "desc": "当前温度"},
    "mode": {"dps": 4, "type": "str", "values": ["hot", "cold", "wind", "wet"], "desc": "工作模式"},
    "fan_speed_enum": {"dps": 5, "type": "str", "values": ["auto", "low", "middle", "high"], "desc": "风速模式"},
}

# 工作模式说明
MODE_DESC = {
    "hot": "制热",
    "cold": "制冷",
    "wind": "送风",
    "wet": "除湿",
}

# 风速说明
FAN_SPEED_DESC = {
    "auto": "自动",
    "low": "低速",
    "middle": "中速",
    "high": "高速",
}
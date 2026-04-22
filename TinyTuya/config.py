"""
TinyTuya + MQTT 空调控制系统配置
支持多网关，通过dev_id区分
"""
import os

# ==================== MQTT 配置 ====================
MQTT_HOST = os.getenv("MQTT_HOST", "8.134.248.240")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mms6332628")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "tinytuya-mqtt")

# ==================== 网关配置 ====================
# ★ 支持多个网关，每个网关有独立的IP和Key
# 消息中的 dev_id 决定使用哪个网关

GATEWAYS = {
    # 网关1（已验证）
    "6cedfa65e9e0d2f95bv8dw": {
        "name": "中央空调网关-包房区",
        "ip": os.getenv("GW1_IP", "192.168.110.62"),
        "key": os.getenv("GW1_KEY", "k[BxEj?<'^;cu|]1"),
        "version": 3.3,
    },
    
    # 网关2（示例，请替换为实际配置）
    # "新网关ID": {
    #     "name": "中央空调网关-大堂区",
    #     "ip": os.getenv("GW2_IP", "192.168.110.xxx"),
    #     "key": os.getenv("GW2_KEY", "新的key"),
    #     "version": 3.3,
    # },
    
    # 更多网关继续添加...
}

# ==================== 子设备映射 ====================
# ★ 子设备通过 node_id 控制
# 不同网关可能有相同的node_id，所以必须指定dev_id

# 子设备信息（可选，仅用于名称显示）
SUB_DEVICE_NAMES = {
    # 网关1的子设备
    ("6cedfa65e9e0d2f95bv8dw", "1"): "室内机1",
    ("6cedfa65e9e0d2f95bv8dw", "2"): "室内机18",
    ("6cedfa65e9e0d2f95bv8dw", "3"): "室内机16",
    ("6cedfa65e9e0d2f95bv8dw", "4"): "室内机16-WiFi",
    ("6cedfa65e9e0d2f95bv8dw", "5"): "室内机15",
    ("6cedfa65e9e0d2f95bv8dw", "6"): "室内机14",
    ("6cedfa65e9e0d2f95bv8dw", "7"): "室内机13",
    ("6cedfa65e9e0d2f95bv8dw", "8"): "室内机12",
    ("6cedfa65e9e0d2f95bv8dw", "9"): "室内机11",
    ("6cedfa65e9e0d2f95bv8dw", "10"): "室内机10",
    ("6cedfa65e9e0d2f95bv8dw", "11"): "室内机9",
    ("6cedfa65e9e0d2f95bv8dw", "12"): "室内机8",
    ("6cedfa65e9e0d2f95bv8dw", "13"): "室内机7",
    ("6cedfa65e9e0d2f95bv8dw", "14"): "室内机6",
    ("6cedfa65e9e0d2f95bv8dw", "15"): "室内机5",
    ("6cedfa65e9e0d2f95bv8dw", "16"): "室内机4",
    ("6cedfa65e9e0d2f95bv8dw", "17"): "室内机3",
    ("6cedfa65e9e0d2f95bv8dw", "18"): "室内机2",
    
    # 网关2的子设备（示例）
    # ("新网关ID", "1"): "大堂室内机1",
}

# ==================== MQTT 主题 ====================
MQTT_TOPIC = "tiangongguojikongtiao"
MQTT_RESPONSE_TOPIC = "tiangongguojikongtiao/response"

# ==================== DPS 参数 ====================
DEVICE_PARAMS = {
    "switch": {"dps": "1", "type": "bool", "desc": "开关"},
    "temp_set": {"dps": "2", "type": "int", "min": 16, "max": 32, "desc": "设定温度"},
    "temp_current": {"dps": "3", "type": "int", "desc": "当前温度"},
    "mode": {"dps": "4", "type": "str", "values": ["hot", "cold", "wind", "wet"], "desc": "模式"},
    "fan_speed_enum": {"dps": "5", "type": "str", "values": ["auto", "low", "middle", "high"], "desc": "风速"},
}

# ==================== 辅助函数 ====================

def get_gateway_config(dev_id: str) -> dict:
    """获取网关配置"""
    return GATEWAYS.get(dev_id)

def get_sub_device_name(dev_id: str, node_id: str) -> str:
    """获取子设备名称"""
    key = (dev_id, node_id)
    if key in SUB_DEVICE_NAMES:
        return SUB_DEVICE_NAMES[key]
    return f"node_{node_id}"

def print_config():
    """打印配置摘要"""
    print("=" * 60)
    print("配置摘要")
    print("=" * 60)
    print(f"\n网关数量: {len(GATEWAYS)}")
    for gw_id, gw_cfg in GATEWAYS.items():
        print(f"  [{gw_id[:16]}...] {gw_cfg['name']}")
        print(f"    IP: {gw_cfg['ip']}")
    print(f"\nMQTT主题: {MQTT_TOPIC}")
    print(f"MQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
    print("=" * 60)


if __name__ == "__main__":
    print_config()
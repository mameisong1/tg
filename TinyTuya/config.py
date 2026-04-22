"""
TinyTuya + MQTT 控制器配置
支持多网关、多local_key配置
"""
import os

# ==================== MQTT 配置 ====================
MQTT_HOST = os.getenv("MQTT_HOST", "8.134.248.240")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "admin")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "mms6332628")
MQTT_CLIENT_ID = os.getenv("MQTT_CLIENT_ID", "tinytuya-mqtt-tiangong")

# ==================== 网关配置 ====================
# 支持多个网关，每个网关有独立的 IP 和 local_key
# 格式：网关ID -> {ip, local_key, name, ...}

GATEWAYS = {
    # 网关1：中央空调集控网关（包房）
    "6cedfa65e9e0d2f95bv8dw": {
        "name": "中央空调网关-包房",
        "ip": os.getenv("GATEWAY_1_IP", "192.168.110.10"),  # 网关IP
        "local_key": os.getenv("GATEWAY_1_KEY", "k[BxEj?<'^;cu|]1"),  # 网关local_key
        "mac": "38:a5:c9:14:8f:ac",
        "sn": "100166266001DD",
        "model": "UACC-B-XX-TW",
        "version": 3.3,
    },
    
    # 网关2：新增空调网关（示例）
    # 取消注释并填写实际配置
    # "新网关ID": {
    #     "name": "中央空调网关-大堂",
    #     "ip": os.getenv("GATEWAY_2_IP", "192.168.110.11"),
    #     "local_key": os.getenv("GATEWAY_2_KEY", "另一个local_key"),
    #     "model": "UACC-B-XX-TW",
    #     "version": 3.3,
    # },
    
    # 更多网关继续添加...
}

# ==================== 子设备配置 ====================
# 子设备必须指定所属网关ID（gateway_id）
# local_key 通常与网关共享，也可以单独指定

SUB_DEVICES = {
    # ===== 网关1的子设备（包房区域） =====
    
    # 室内机1
    "6c6222ab98a674b474wzba": {
        "name": "室内机1",
        "node_id": "1",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",  # 所属网关
        "local_key": None,  # None表示继承网关的local_key
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机2
    "6c5f64a1f1c06845480zec": {
        "name": "室内机2",
        "node_id": "18",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机3
    "6cdf8d7b5b477c0029twev": {
        "name": "室内机3",
        "node_id": "17",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机4
    "6cd5d312f1477108c5oakp": {
        "name": "室内机4",
        "node_id": "16",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机5
    "6c793e4c179e36f8c78o6c": {
        "name": "室内机5",
        "node_id": "15",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机6
    "6ce46f266709a6bb72iwvo": {
        "name": "室内机6",
        "node_id": "14",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机7
    "6cd30259b2300268eak3hi": {
        "name": "室内机7",
        "node_id": "13",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机8
    "6c080de917e5874cadnyr8": {
        "name": "室内机8",
        "node_id": "12",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机9
    "6cd285cec9884dd573y891": {
        "name": "室内机9",
        "node_id": "11",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机10
    "6cb4c1d32e37da7974akjt": {
        "name": "室内机10",
        "node_id": "10",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机11
    "6cbbba7716ddafbac1mmlw": {
        "name": "室内机11",
        "node_id": "9",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机12
    "6cdbd07fefe5d7dc78qe0t": {
        "name": "室内机12",
        "node_id": "8",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机13
    "6c84ec9582a300a32dirox": {
        "name": "室内机13",
        "node_id": "7",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机14
    "6cc27f00393cee54ccmgey": {
        "name": "室内机14",
        "node_id": "6",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机15
    "6c9a267a8af9044c5cmlou": {
        "name": "室内机15",
        "node_id": "5",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机16
    "6c1d7f15376d6f2a82elsf": {
        "name": "室内机16",
        "node_id": "3",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机16-WiFi版本
    "6cfb71b5aaa54daae8swgo": {
        "name": "室内机16-WiFi",
        "node_id": "4",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # 室内机18
    "6cd1fa5d89f77a12bblxf8": {
        "name": "室内机18",
        "node_id": "2",
        "gateway_id": "6cedfa65e9e0d2f95bv8dw",
        "local_key": None,
        "model": "UACC-B-XX-TW-N",
    },
    
    # ===== 网关2的子设备（新增区域） =====
    # 取消注释并配置实际设备
    # "新设备ID": {
    #     "name": "室内机19",
    #     "node_id": "1",
    #     "gateway_id": "新网关ID",  # 指向网关2
    #     "local_key": None,
    #     "model": "UACC-B-XX-TW-N",
    # },
}

# ==================== 合并设备列表 ====================
# 自动合并网关和子设备，方便查询
ALL_DEVICES = {}
ALL_DEVICES.update(GATEWAYS)  # 添加网关
ALL_DEVICES.update(SUB_DEVICES)  # 添加子设备

# 为网关添加 is_gateway 标记
for gw_id in GATEWAYS:
    ALL_DEVICES[gw_id]["is_gateway"] = True

# 为子设备添加 is_sub_device 标记，并继承网关local_key
for sub_id, sub_config in SUB_DEVICES.items():
    sub_config["is_sub_device"] = True
    gw_id = sub_config.get("gateway_id")
    
    # 如果子设备没有指定local_key，继承网关的
    if sub_config.get("local_key") is None and gw_id in GATEWAYS:
        sub_config["local_key"] = GATEWAYS[gw_id]["local_key"]

# ==================== MQTT 主题配置 ====================
MQTT_TOPIC_PREFIX = "tuya/device"

# ==================== 设备控制参数 ====================
# DPS编号和参数类型
DEVICE_PARAMS = {
    "switch": {"dps": 1, "type": "bool", "desc": "开关"},
    "temp_set": {"dps": 2, "type": "int", "min": 16, "max": 32, "desc": "设定温度"},
    "temp_current": {"dps": 3, "type": "int", "desc": "当前温度"},
    "mode": {"dps": 4, "type": "str", "values": ["hot", "cold", "wind", "wet"], "desc": "工作模式"},
    "fan_speed_enum": {"dps": 5, "type": "str", "values": ["auto", "low", "middle", "high"], "desc": "风速"},
}

# ==================== 工作模式说明 ====================
MODE_DESC = {
    "hot": "制热",
    "cold": "制冷",
    "wind": "送风",
    "wet": "除湿",
}

FAN_SPEED_DESC = {
    "auto": "自动",
    "low": "低速",
    "middle": "中速",
    "high": "高速",
}


# ==================== 辅助函数 ====================

def get_gateway_config(gateway_id: str) -> dict:
    """获取网关配置"""
    return GATEWAYS.get(gateway_id)


def get_sub_device_config(device_id: str) -> dict:
    """获取子设备配置"""
    return SUB_DEVICES.get(device_id)


def get_device_config(device_id: str) -> dict:
    """获取任意设备配置（网关或子设备）"""
    return ALL_DEVICES.get(device_id)


def get_all_devices_by_gateway(gateway_id: str) -> list:
    """获取某网关下的所有子设备"""
    devices = []
    for sub_id, sub_config in SUB_DEVICES.items():
        if sub_config.get("gateway_id") == gateway_id:
            devices.append({
                "id": sub_id,
                "name": sub_config.get("name"),
                "node_id": sub_config.get("node_id"),
            })
    return devices


def print_config_summary():
    """打印配置摘要"""
    print("=" * 60)
    print("配置摘要")
    print("=" * 60)
    
    print(f"\n网关数量: {len(GATEWAYS)}")
    for gw_id, gw_config in GATEWAYS.items():
        print(f"  - {gw_config.get('name')} (ID: {gw_id})")
        print(f"    IP: {gw_config.get('ip')}")
        print(f"    local_key: {gw_config.get('local_key', '')[:15]}...")
        
        # 显示该网关下的子设备
        sub_devices = get_all_devices_by_gateway(gw_id)
        print(f"    子设备: {len(sub_devices)} 台")
    
    print(f"\n子设备总数: {len(SUB_DEVICES)}")
    
    print(f"\nMQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
    print("=" * 60)


# 启动时打印配置摘要（可选）
if __name__ == "__main__":
    print_config_summary()
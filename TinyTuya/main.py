"""
TinyTuya + MQTT 空调控制系统
支持多网关，通过dev_id区分
订阅主题: tiangongguojikongtiao
"""
import os
import sys
import json
import logging
import signal
from datetime import datetime
from typing import Dict, Any

from config import (
    MQTT_HOST, MQTT_PORT, MQTT_TOPIC, MQTT_RESPONSE_TOPIC,
    get_gateway_config, get_sub_device_name, print_config
)
from mqtt_client import MQTTClient
from tuya_controller import multi_controller

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("main")


# 全局变量
mqtt_client = None


def handle_message(message: Dict[str, Any]):
    """处理MQTT消息
    
    消息格式（支持多网关）:
    {
        "dev_id": "6cedfa65e9e0d2f95bv8dw",  // 网关ID（必填）
        "node_id": "3",                       // 子设备编号（必填）
        "switch": true,                       // 开关
        "temp_set": 24,                       // 温度
        "mode": "cold",                       // 模式
        "fan_speed_enum": "auto"              // 风速
    }
    """
    logger.info(f"收到消息: {json.dumps(message, ensure_ascii=False)}")
    
    # 获取dev_id（网关ID）- 必填
    dev_id = message.get("dev_id")
    if not dev_id:
        logger.error("消息缺少 dev_id（网关ID）")
        mqtt_client.publish_response({
            "success": False,
            "error": "缺少dev_id（网关ID）",
            "hint": "请指定网关ID，例如: dev_id=6cedfa65e9e0d2f95bv8dw",
            "timestamp": datetime.now().isoformat()
        })
        return
    
    # 获取node_id（子设备编号）- 必填
    node_id = message.get("node_id")
    if not node_id:
        logger.error("消息缺少 node_id")
        mqtt_client.publish_response({
            "success": False,
            "error": "缺少node_id（子设备编号）",
            "dev_id": dev_id,
            "timestamp": datetime.now().isoformat()
        })
        return
    
    # 获取网关名称
    gw_cfg = get_gateway_config(dev_id)
    gw_name = gw_cfg.get("name", dev_id[:16]) if gw_cfg else dev_id[:16]
    
    # 获取子设备名称
    sub_name = get_sub_device_name(dev_id, node_id)
    
    logger.info(f"目标: 网关[{gw_name}] 子设备[{sub_name}]")
    
    # 提取控制参数（排除dev_id和node_id）
    params = {}
    for key in ["switch", "temp_set", "mode", "fan_speed_enum"]:
        if key in message:
            params[key] = message[key]
    
    if not params:
        logger.info("消息无控制参数，获取状态")
        # 如果没有控制参数，返回状态
        status = multi_controller.get_status(dev_id, node_id)
        
        response = {
            "success": status.get("success", False),
            "dev_id": dev_id,
            "gateway_name": gw_name,
            "node_id": node_id,
            "sub_device_name": sub_name,
            "timestamp": datetime.now().isoformat()
        }
        
        if "status" in status:
            response["status"] = status["status"]
        if "error" in status:
            response["error"] = status["error"]
        
        mqtt_client.publish_response(response)
        return
    
    # ★ 执行控制命令
    logger.info(f"执行控制: {params}")
    
    result = multi_controller.control(dev_id, node_id, params)
    
    # 发布响应
    response = {
        "success": result.get("success", False),
        "dev_id": dev_id,
        "gateway_name": gw_name,
        "node_id": node_id,
        "sub_device_name": sub_name,
        "params": params,
        "timestamp": datetime.now().isoformat()
    }
    
    if "error" in result:
        response["error"] = result["error"]
    if "result" in result:
        response["result"] = result["result"]
    
    mqtt_client.publish_response(response)
    
    # 日志记录
    if result.get("success"):
        logger.info(f"✓ 控制成功: {gw_name}/{sub_name}")
    else:
        logger.warning(f"✗ 控制失败: {result.get('error')}")


def print_banner():
    """启动横幅"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║       TinyTuya + MQTT 空调控制系统                        ║
║       支持多网关，通过dev_id区分                           ║
║       订阅主题: tiangongguojikongtiao                     ║
╚═══════════════════════════════════════════════════════════╝
""")
    
    print_config()
    
    logger.info("\n消息格式（必填dev_id和node_id）:")
    logger.info("  {")
    logger.info("    \"dev_id\":\"网关ID\",")
    logger.info("    \"node_id\":\"子设备编号\",")
    logger.info("    \"switch\":true,")
    logger.info("    \"temp_set\":24,")
    logger.info("    \"mode\":\"cold\"")
    logger.info("  }")


def signal_handler(signum, frame):
    """信号处理"""
    logger.info("收到退出信号，正在停止...")
    if mqtt_client:
        mqtt_client.stop()
    sys.exit(0)


def main():
    global mqtt_client
    
    print_banner()
    
    # 初始化MQTT客户端
    mqtt_client = MQTTClient(on_message=handle_message)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        logger.info(f"\n启动MQTT客户端，订阅主题: {MQTT_TOPIC}")
        mqtt_client.start()
    except KeyboardInterrupt:
        logger.info("用户中断")
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)
    finally:
        if mqtt_client:
            mqtt_client.stop()


if __name__ == "__main__":
    main()
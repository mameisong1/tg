"""
TinyTuya + MQTT 控制器主程序
本地控制涂鸦设备（天宫国际台球厅空调系统）
"""
import os
import sys
import json
import logging
import signal
from datetime import datetime
from typing import Dict, Any

from config import TUYA_DEVICES, MQTT_TOPIC_PREFIX, MQTT_HOST, MQTT_PORT
from tuya_controller import controller
from mqtt_client import MQTTClient

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("main")


def handle_command(device_id: str, command: str, params: Dict[str, Any]):
    """处理MQTT命令"""
    logger.info(f"收到命令: 设备={device_id}, 命令={command}, 参数={params}")
    
    device_config = TUYA_DEVICES.get(device_id)
    if not device_config:
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": "未知设备",
            "timestamp": datetime.now().isoformat()
        })
        return
    
    device_name = device_config.get("name", device_id)
    
    try:
        if command == "command":
            # 控制设备
            result = controller.control(device_id, params)
            mqtt_client.publish_status(device_id, {
                "success": result.get("success", False),
                "device_name": device_name,
                "params": params,
                "result": result.get("result", {}),
                "timestamp": datetime.now().isoformat()
            })
        elif command == "status":
            # 获取状态
            status = controller.get_status(device_id)
            mqtt_client.publish_status(device_id, {
                "success": "error" not in status,
                "device_name": device_name,
                "status": status.get("status", {}),
                "raw": status.get("raw", {}),
                "timestamp": datetime.now().isoformat()
            })
        else:
            mqtt_client.publish_status(device_id, {
                "success": False,
                "error": f"未知命令: {command}",
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        logger.error(f"命令处理失败: {e}")
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": str(e),
            "device_name": device_name,
            "timestamp": datetime.now().isoformat()
        })


def print_banner():
    """启动横幅"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║       TinyTuya + MQTT 空调控制系统                        ║
║       天宫国际台球厅 - 19台空调远程控制                    ║
╚═══════════════════════════════════════════════════════════╝
""")
    logger.info(f"MQTT服务器: {MQTT_HOST}:{MQTT_PORT}")
    logger.info(f"注册设备: {len(TUYA_DEVICES)} 个")


def show_device_list():
    """显示设备列表"""
    logger.info("=" * 50)
    logger.info("设备列表:")
    
    gateway_count = 0
    sub_device_count = 0
    
    for device_id, config in TUYA_DEVICES.items():
        if config.get("is_gateway"):
            gateway_count += 1
            status = "✓" if controller.gateway else "✗"
            logger.info(f"  {status} [网关] {config.get('name')}")
        elif config.get("is_sub_device"):
            sub_device_count += 1
            # 子设备状态取决于网关
            status = "✓" if controller.gateway else "✗"
            node_id = config.get("node_id", "?")
            logger.info(f"  {status} [子设备] {config.get('name')} (node_id: {node_id})")
    
    logger.info(f"网关: {gateway_count} 个, 室内机: {sub_device_count} 台")
    logger.info("=" * 50)


def check_config():
    """检查配置"""
    issues = []
    
    # 检查网关
    gateway_config = TUYA_DEVICES.get("6cedfa65e9e0d2f95bv8dw")
    if gateway_config and not gateway_config.get("local_key"):
        issues.append("网关缺少 local_key")
    
    # 检查子设备
    for device_id, config in TUYA_DEVICES.items():
        if config.get("is_sub_device") and not config.get("local_key"):
            issues.append(f"{config.get('name')} 缺少 local_key")
    
    if issues:
        logger.warning("=" * 50)
        logger.warning("配置问题:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        logger.warning("=" * 50)
        logger.warning("请检查 config.py 中的 TUYA_LOCAL_KEY 配置")
    else:
        logger.info("配置检查通过 ✓")


def signal_handler(signum, frame):
    """信号处理"""
    logger.info("收到退出信号，正在停止...")
    if mqtt_client:
        mqtt_client.stop()
    sys.exit(0)


mqtt_client = None


def main():
    global mqtt_client
    
    print_banner()
    check_config()
    show_device_list()
    
    # 初始化MQTT客户端
    mqtt_client = MQTTClient(on_command=handle_command)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        logger.info("启动MQTT客户端，开始监听命令...")
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
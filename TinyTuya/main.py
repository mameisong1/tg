"""
TinyTuya + MQTT 控制器主程序
本地控制涂鸦设备
"""
import os
import sys
import json
import logging
import signal
from datetime import datetime
from typing import Dict, Any

from config import TUYA_DEVICES, MQTT_TOPIC_PREFIX
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
    logger.info(f"命令: 设备={device_id}, 命令={command}, 参数={params}")
    
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
            result = controller.control(device_id, params)
            mqtt_client.publish_status(device_id, {
                "success": result.get("success", False),
                "device_name": device_name,
                "params": params,
                "result": result,
                "timestamp": datetime.now().isoformat()
            })
        elif command == "status":
            status = controller.get_status(device_id)
            mqtt_client.publish_status(device_id, {
                "success": "error" not in status,
                "device_name": device_name,
                "status": status,
                "timestamp": datetime.now().isoformat()
            })
        else:
            mqtt_client.publish_status(device_id, {
                "success": False,
                "error": f"未知命令: {command}",
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        logger.error(f"处理失败: {e}")
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })


def print_banner():
    """启动横幅"""
    print("""
╔═══════════════════════════════════════════════════════════╗
║          TinyTuya + MQTT 控制器                           ║
║     本地控制涂鸦设备                                       ║
╚═══════════════════════════════════════════════════════════╝
""")
    logger.info(f"MQTT: {MQTT_HOST}:{MQTT_PORT}")
    logger.info(f"设备: {len(TUYA_DEVICES)} 个")
    
    for device_id, config in TUYA_DEVICES.items():
        status = "✓" if controller.devices.get(device_id) or controller.gateway else "✗"
        logger.info(f"  {status} {config.get('name')} ({device_id})")


def check_config():
    """检查配置"""
    issues = []
    for device_id, config in TUYA_DEVICES.items():
        if not config.get("local_key"):
            issues.append(f"{config.get('name')} 缺少 local_key")
    
    if issues:
        logger.warning("=" * 50)
        logger.warning("配置问题:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        logger.warning("=" * 50)
        logger.warning("获取 local_key: python -m tinytuya wizard")


def signal_handler(signum, frame):
    """信号处理"""
    logger.info("退出...")
    mqtt_client.stop()
    sys.exit(0)


mqtt_client = None


def main():
    global mqtt_client
    
    print_banner()
    check_config()
    
    mqtt_client = MQTTClient(on_command=handle_command)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
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
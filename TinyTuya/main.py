"""
TinyTuya MQTT 控制器主程序

订阅外网 MQTT 消息，通过 TinyTuya 控制涂鸦设备
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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("main")


def handle_command(device_id: str, command: str, params: Dict[str, Any]):
    """
    处理 MQTT 命令
    
    Args:
        device_id: 设备ID
        command: 命令类型 (command/status)
        params: 控制参数
    """
    logger.info(f"处理命令 - 设备: {device_id}, 命令: {command}, 参数: {params}")
    
    # 检查设备是否存在
    if device_id not in TUYA_DEVICES:
        logger.warning(f"未知设备: {device_id}")
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": "未知设备",
            "timestamp": datetime.now().isoformat()
        })
        return
    
    # 获取设备信息
    device_info = TUYA_DEVICES[device_id]
    device_name = device_info.get("name", device_id)
    
    try:
        if command == "command":
            # 控制设备
            result = controller.control(device_id, params)
            
            # 发布状态
            mqtt_client.publish_status(device_id, {
                "success": result.get("success", False),
                "device_name": device_name,
                "params": params,
                "result": result,
                "timestamp": datetime.now().isoformat()
            })
            
        elif command == "status":
            # 获取设备状态
            status = controller.get_status(device_id)
            mqtt_client.publish_status(device_id, {
                "success": "error" not in status,
                "device_name": device_name,
                "status": status,
                "timestamp": datetime.now().isoformat()
            })
        
        else:
            logger.warning(f"未知命令: {command}")
            mqtt_client.publish_status(device_id, {
                "success": False,
                "error": f"未知命令: {command}",
                "timestamp": datetime.now().isoformat()
            })
    
    except Exception as e:
        logger.error(f"命令处理失败: {e}", exc_info=True)
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })


def print_banner():
    """打印启动横幅"""
    banner = """
╔═══════════════════════════════════════════════════════════╗
║          TinyTuya MQTT Controller v1.0                    ║
║     订阅外网 MQTT 消息，控制涂鸦设备                        ║
╚═══════════════════════════════════════════════════════════╝
    """
    print(banner)
    
    logger.info(f"MQTT 服务器: {os.getenv('MQTT_HOST', '8.134.248.240')}:{os.getenv('MQTT_PORT', 1883)}")
    logger.info(f"已配置设备: {len(TUYA_DEVICES)} 个")
    
    for device_id, config in TUYA_DEVICES.items():
        status = "✓ 已初始化" if controller.get_device(device_id) else "✗ 未初始化"
        logger.info(f"  - {config.get('name', device_id)} ({device_id}): {status}")


def check_config():
    """检查配置"""
    issues = []
    
    for device_id, config in TUYA_DEVICES.items():
        if not config.get("local_key"):
            issues.append(f"设备 {device_id} 缺少 local_key")
    
    if issues:
        logger.warning("=" * 50)
        logger.warning("配置问题:")
        for issue in issues:
            logger.warning(f"  - {issue}")
        logger.warning("=" * 50)
        logger.warning("请设置环境变量或修改 config.py")
        logger.warning("获取 local_key: python -m tinytuya wizard")


def signal_handler(signum, frame):
    """信号处理"""
    logger.info("收到停止信号，正在退出...")
    mqtt_client.stop()
    sys.exit(0)


# 全局 MQTT 客户端
mqtt_client = None


def main():
    global mqtt_client
    
    print_banner()
    check_config()
    
    # 创建 MQTT 客户端
    mqtt_client = MQTTClient(on_command=handle_command)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 启动客户端
    try:
        mqtt_client.start()
    except KeyboardInterrupt:
        logger.info("用户中断")
    except Exception as e:
        logger.error(f"启动失败: {e}", exc_info=True)
        sys.exit(1)
    finally:
        if mqtt_client:
            mqtt_client.stop()


if __name__ == "__main__":
    main()
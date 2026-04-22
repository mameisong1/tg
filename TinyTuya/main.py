"""
TinyTuya + MQTT 控制器主程序
支持多网关、多子设备控制
"""
import os
import sys
import json
import logging
import signal
from datetime import datetime
from typing import Dict, Any

from config import (
    MQTT_TOPIC_PREFIX, MQTT_HOST, MQTT_PORT,
    GATEWAYS, SUB_DEVICES, ALL_DEVICES,
    print_config_summary
)
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
    
    config = ALL_DEVICES.get(device_id)
    if not config:
        mqtt_client.publish_status(device_id, {
            "success": False,
            "error": "未知设备",
            "timestamp": datetime.now().isoformat()
        })
        return
    
    device_name = config.get("name", device_id)
    
    try:
        if command == "command":
            # 控制设备
            result = controller.control(device_id, params)
            
            response = {
                "success": result.get("success", False),
                "device_name": device_name,
                "params": params,
                "timestamp": datetime.now().isoformat()
            }
            
            # 添加网关信息（如果是子设备）
            if config.get("is_sub_device"):
                gateway_id = config.get("gateway_id")
                gateway_config = GATEWAYS.get(gateway_id)
                if gateway_config:
                    response["gateway"] = gateway_config.get("name")
            
            # 添加结果详情
            if "result" in result:
                response["result"] = result["result"]
            if "results" in result:
                response["results"] = result["results"]
            if "error" in result:
                response["error"] = result["error"]
            
            mqtt_client.publish_status(device_id, response)
            
        elif command == "status":
            # 获取状态
            status = controller.get_status(device_id)
            
            response = {
                "success": status.get("success", "error" not in status),
                "device_name": device_name,
                "timestamp": datetime.now().isoformat()
            }
            
            if "status" in status:
                response["status"] = status["status"]
            if "raw" in status:
                response["raw"] = status["raw"]
            if "error" in status:
                response["error"] = status["error"]
            
            mqtt_client.publish_status(device_id, response)
            
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
║       支持多网关、多子设备远程控制                         ║
╚═══════════════════════════════════════════════════════════╝
""")
    
    # 打印配置摘要
    print_config_summary()
    
    # 显示网关状态
    logger.info("\n网关状态:")
    gateway_status = controller.get_gateway_status_summary()
    for gw_id, status in gateway_status.items():
        init_status = "✓" if status["initialized"] else "✗"
        logger.info(f"  {init_status} {status['name']} (IP: {status['ip']}, 子设备: {status['sub_device_count']}台)")


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
    
    # 初始化MQTT客户端
    mqtt_client = MQTTClient(on_command=handle_command)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        logger.info("\n启动MQTT客户端，开始监听命令...")
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
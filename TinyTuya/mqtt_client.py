"""
MQTT 客户端
订阅外网 MQTT 消息，控制涂鸦设备
"""
import json
import logging
import paho.mqtt.client as mqtt
from typing import Callable, Dict, Any
from config import (
    MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, MQTT_CLIENT_ID,
    MQTT_TOPIC_PREFIX
)

logger = logging.getLogger(__name__)


class MQTTClient:
    """MQTT 客户端"""
    
    def __init__(self, on_command: Callable[[str, str, Dict], None]):
        """
        初始化 MQTT 客户端
        
        Args:
            on_command: 命令处理回调函数 (device_id, command, params)
        """
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID)
        self.on_command = on_command
        self.connected = False
        
        # 设置认证
        self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        
        # 设置回调
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
    
    def _on_connect(self, client, userdata, flags, reason_code, properties):
        """连接成功回调"""
        if reason_code == 0:
            logger.info(f"MQTT 连接成功: {MQTT_HOST}:{MQTT_PORT}")
            self.connected = True
            
            # 订阅所有设备的命令主题
            topic = f"{MQTT_TOPIC_PREFIX}/+/command"
            client.subscribe(topic)
            logger.info(f"订阅主题: {topic}")
        else:
            logger.error(f"MQTT 连接失败，原因码: {reason_code}")
    
    def _on_disconnect(self, client, userdata, reason_code, properties):
        """断开连接回调"""
        logger.warning(f"MQTT 断开连接，原因码: {reason_code}")
        self.connected = False
    
    def _on_message(self, client, userdata, msg):
        """消息接收回调"""
        try:
            # 解析主题: tuya/device/{device_id}/command
            topic_parts = msg.topic.split("/")
            if len(topic_parts) < 4:
                logger.warning(f"无效主题格式: {msg.topic}")
                return
            
            device_id = topic_parts[2]
            command = topic_parts[3]
            
            # 解析消息体
            payload = msg.payload.decode("utf-8")
            params = json.loads(payload)
            
            logger.info(f"收到命令 - 设备: {device_id}, 命令: {command}, 参数: {params}")
            
            # 调用命令处理回调
            self.on_command(device_id, command, params)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON 解析失败: {e}, 原始消息: {msg.payload}")
        except Exception as e:
            logger.error(f"消息处理失败: {e}")
    
    def connect(self):
        """连接 MQTT 服务器"""
        try:
            logger.info(f"正在连接 MQTT 服务器: {MQTT_HOST}:{MQTT_PORT}")
            self.client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        except Exception as e:
            logger.error(f"MQTT 连接失败: {e}")
            raise
    
    def publish_status(self, device_id: str, status: Dict[str, Any]):
        """
        发布设备状态
        
        Args:
            device_id: 设备ID
            status: 状态信息
        """
        topic = f"{MQTT_TOPIC_PREFIX}/{device_id}/status"
        payload = json.dumps(status, ensure_ascii=False)
        
        result = self.client.publish(topic, payload)
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.info(f"发布状态成功 - 设备: {device_id}")
        else:
            logger.error(f"发布状态失败 - 设备: {device_id}, 错误码: {result.rc}")
    
    def start(self):
        """启动客户端（阻塞）"""
        self.connect()
        logger.info("MQTT 客户端启动，开始监听消息...")
        self.client.loop_forever()
    
    def start_async(self):
        """异步启动客户端（非阻塞）"""
        self.connect()
        self.client.loop_start()
        logger.info("MQTT 客户端异步启动")
    
    def stop(self):
        """停止客户端"""
        self.client.loop_stop()
        self.client.disconnect()
        logger.info("MQTT 客户端已停止")
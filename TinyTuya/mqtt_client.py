"""
MQTT 客户端
订阅主题: tiangongguojikongtiao
"""
import json
import logging
import paho.mqtt.client as mqtt
from typing import Callable, Dict, Any
from config import (
    MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, MQTT_CLIENT_ID,
    MQTT_TOPIC, MQTT_RESPONSE_TOPIC
)

logger = logging.getLogger(__name__)


class MQTTClient:
    """MQTT 客户端"""
    
    def __init__(self, on_message: Callable[[Dict], None]):
        """
        初始化 MQTT 客户端
        
        Args:
            on_message: 消息处理回调函数 (message_dict)
        """
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=MQTT_CLIENT_ID)
        self.on_message = on_message
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
            
            # ★ 订阅主题
            client.subscribe(MQTT_TOPIC)
            logger.info(f"订阅主题: {MQTT_TOPIC}")
        else:
            logger.error(f"MQTT 连接失败，原因码: {reason_code}")
    
    def _on_disconnect(self, client, userdata, reason_code, properties):
        """断开连接回调"""
        logger.warning(f"MQTT 断开连接，原因码: {reason_code}")
        self.connected = False
        
        # 尝试重连
        if reason_code != 0:
            logger.info("尝试重新连接...")
            try:
                client.reconnect()
            except Exception as e:
                logger.error(f"重连失败: {e}")
    
    def _on_message(self, client, userdata, msg):
        """消息接收回调"""
        try:
            # 解析消息体
            payload = msg.payload.decode("utf-8")
            message = json.loads(payload)
            
            logger.info(f"收到消息 [{msg.topic}]: {json.dumps(message, ensure_ascii=False)}")
            
            # 调用消息处理回调
            self.on_message(message)
            
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
    
    def publish_response(self, response: Dict[str, Any]):
        """
        发布响应消息
        
        Args:
            response: 响应信息
        """
        payload = json.dumps(response, ensure_ascii=False)
        
        if self.connected:
            result = self.client.publish(MQTT_RESPONSE_TOPIC, payload)
            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"发布响应成功: {MQTT_RESPONSE_TOPIC}")
            else:
                logger.error(f"发布响应失败，错误码: {result.rc}")
        else:
            logger.warning(f"MQTT未连接，无法发布响应")
    
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
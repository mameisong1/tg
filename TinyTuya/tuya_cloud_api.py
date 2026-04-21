"""
涂鸦云API控制器
手动实现涂鸦开放平台API调用（云开发项目模式）

API认证方式：
1. 获取Token: GET /v1.0/token?grant_type=1
   签名: HMAC_SHA256(client_id + t, client_secret)
2. 业务请求: 签名: HMAC_SHA256(client_id + access_token + t, client_secret)
"""
import hashlib
import hmac
import time
import requests
import json
import logging
from typing import Dict, Any, Optional
from config import TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, TUYA_DEVICES, DEVICE_PARAMS

logger = logging.getLogger(__name__)

# API配置
ENDPOINT = "https://openapi.tuyacn.com"


class TuyaCloudAPI:
    """涂鸦云API控制器"""
    
    def __init__(self):
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expire_time: int = 0
        self._get_token()
    
    def _generate_sign(self, t: str, token: str = "") -> str:
        """
        生成签名
        
        签名规则:
        - 获取token: sign = HMAC_SHA256(client_id + t, secret).upper()
        - 业务请求: sign = HMAC_SHA256(client_id + token + t, secret).upper()
        
        Args:
            t: 时间戳(毫秒)
            token: access_token (获取token时为空)
        
        Returns:
            签名(大写)
        """
        if token:
            message = TUYA_CLIENT_ID + token + t
        else:
            message = TUYA_CLIENT_ID + t
        
        sign = hmac.new(
            TUYA_CLIENT_SECRET.encode('utf-8'),
            message.encode('utf-8'),
            hashlib.sha256
        ).hexdigest().upper()
        
        return sign
    
    def _get_token(self) -> bool:
        """获取access_token"""
        t = str(int(time.time() * 1000))
        sign = self._generate_sign(t)
        
        headers = {
            "client_id": TUYA_CLIENT_ID,
            "sign": sign,
            "t": t,
            "sign_method": "HMAC-SHA256",
        }
        
        url = f"{ENDPOINT}/v1.0/token?grant_type=1"
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            result = response.json()
            
            if result.get("success"):
                self.access_token = result["result"]["access_token"]
                self.refresh_token = result["result"].get("refresh_token")
                expire_time = result["result"]["expire_time"]
                self.token_expire_time = time.time() + expire_time
                logger.info(f"获取Token成功，有效期{expire_time}秒")
                return True
            else:
                logger.error(f"获取Token失败: code={result.get('code')}, msg={result.get('msg')}")
                return False
        except Exception as e:
            logger.error(f"获取Token异常: {e}")
            return False
    
    def _refresh_token_if_needed(self) -> bool:
        """检查并刷新Token"""
        if self.access_token and time.time() < self.token_expire_time - 300:
            return True
        return self._get_token()
    
    def _make_request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict:
        """发送API请求"""
        if not self._refresh_token_if_needed():
            return {"success": False, "msg": "Token获取失败"}
        
        t = str(int(time.time() * 1000))
        sign = self._generate_sign(t, self.access_token)
        
        headers = {
            "client_id": TUYA_CLIENT_ID,
            "access_token": self.access_token,
            "sign": sign,
            "t": t,
            "sign_method": "HMAC-SHA256",
            "Content-Type": "application/json",
        }
        
        url = f"{ENDPOINT}{path}"
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=body, timeout=10)
            else:
                return {"success": False, "msg": "不支持的HTTP方法"}
            
            return response.json()
        except Exception as e:
            logger.error(f"API请求异常: {e}")
            return {"success": False, "msg": str(e)}
    
    def get_device_status(self, device_id: str) -> Dict[str, Any]:
        """获取设备状态"""
        path = f"/v1.0/devices/{device_id}/status"
        result = self._make_request("GET", path)
        
        if result.get("success"):
            status = result.get("result", [])
            logger.info(f"设备 {device_id} 状态: {status}")
            return {"success": True, "status": status}
        else:
            logger.error(f"获取状态失败: {result}")
            return {"success": False, "msg": result.get("msg")}
    
    def send_properties(self, device_id: str, properties: Dict[str, Any]) -> Dict:
        """发送设备属性（标准指令集）"""
        path = f"/v2.0/cloud/thing/{device_id}/shadow/properties/issue"
        body = {"properties": json.dumps(properties)}
        
        result = self._make_request("POST", path, body)
        
        if result.get("success"):
            logger.info(f"设备 {device_id} 属性发送成功: {properties}")
            return {"success": True, "result": result.get("result")}
        else:
            logger.error(f"属性发送失败: {result}")
            return {"success": False, "msg": result.get("msg")}
    
    def validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """验证控制参数"""
        validated = {}
        
        for key, value in params.items():
            if key not in DEVICE_PARAMS:
                logger.warning(f"未知参数: {key}")
                continue
            
            param_config = DEVICE_PARAMS[key]
            
            if param_config["type"] == "bool":
                if isinstance(value, bool):
                    validated[key] = value
                elif isinstance(value, str):
                    validated[key] = value.lower() in ["true", "1", "on"]
            elif param_config["type"] == "int":
                try:
                    int_value = int(value)
                    min_val = param_config.get("min", 0)
                    max_val = param_config.get("max", 100)
                    if min_val <= int_value <= max_val:
                        validated[key] = int_value
                except (ValueError, TypeError):
                    pass
            elif param_config["type"] == "str":
                if value in param_config.get("values", []):
                    validated[key] = value
        
        return validated


# 全局API实例
_api_instance = None

def get_api():
    """获取API实例"""
    global _api_instance
    if _api_instance is None:
        _api_instance = TuyaCloudAPI()
    return _api_instance

api = get_api()
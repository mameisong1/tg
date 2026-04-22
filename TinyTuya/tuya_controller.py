"""
TinyTuya 本地控制器
控制涂鸦设备（支持子设备/网关）
"""
import tinytuya
import json
import logging
import time
from typing import Dict, Any, Optional
from config import TUYA_DEVICES, DEVICE_PARAMS, GATEWAY_ID

logger = logging.getLogger(__name__)


class TuyaLocalController:
    """TinyTuya 本地控制器"""
    
    def __init__(self):
        self.gateway: Optional[tinytuya.Device] = None
        self.sub_devices: Dict[str, dict] = {}  # 子设备配置缓存
        self._init_gateway()
    
    def _init_gateway(self):
        """初始化网关设备"""
        gateway_config = TUYA_DEVICES.get(GATEWAY_ID)
        if not gateway_config:
            logger.error(f"网关配置不存在: {GATEWAY_ID}")
            return
        
        local_key = gateway_config.get("local_key")
        if not local_key:
            logger.error("网关缺少 local_key")
            return
        
        try:
            # 创建网关设备对象
            self.gateway = tinytuya.Device(
                dev_id=GATEWAY_ID,
                address=gateway_config.get("ip", "Auto"),
                local_key=local_key,
                version=float(gateway_config.get("version", "3.3"))
            )
            
            logger.info(f"网关 {gateway_config.get('name')} 初始化成功")
            
            # 缓存子设备配置
            for device_id, config in TUYA_DEVICES.items():
                if config.get("is_sub_device"):
                    self.sub_devices[device_id] = config
                    logger.info(f"子设备 {config.get('name')} 已注册")
            
        except Exception as e:
            logger.error(f"网关初始化失败: {e}")
            self.gateway = None
    
    def control(self, device_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """控制设备"""
        # 验证参数
        validated = self._validate_params(params)
        if not validated:
            return {"success": False, "error": "参数验证失败"}
        
        config = TUYA_DEVICES.get(device_id)
        if not config:
            return {"success": False, "error": "未知设备"}
        
        device_name = config.get("name", device_id)
        
        # 子设备通过网关控制
        if config.get("is_sub_device"):
            return self._control_sub_device(device_id, validated, device_name)
        
        # 网关本身的状态控制
        if device_id == GATEWAY_ID:
            return {"success": False, "error": "网关不支持直接控制"}
        
        return {"success": False, "error": "未知的设备类型"}
    
    def _control_sub_device(self, device_id: str, params: Dict, device_name: str) -> Dict:
        """通过网关控制子设备"""
        if not self.gateway:
            return {"success": False, "error": "网关未初始化"}
        
        try:
            # 构建DPS数据
            dps_data = {}
            for key, value in params.items():
                param_config = DEVICE_PARAMS.get(key)
                if param_config:
                    dps = param_config["dps"]
                    dps_data[str(dps)] = value
            
            if not dps_data:
                return {"success": False, "error": "无有效参数"}
            
            # TinyTuya 子设备控制方式
            # 需要使用网关发送命令，指定子设备ID
            
            sub_config = self.sub_devices.get(device_id)
            node_id = sub_config.get("node_id", "") if sub_config else ""
            
            logger.info(f"控制子设备 {device_name} (node_id={node_id}): {dps_data}")
            
            # 方式1: 使用gateway发送控制命令
            # TinyTuya 会自动处理子设备路由
            
            # 创建子设备控制对象（指向网关IP）
            sub_device = tinytuya.Device(
                dev_id=device_id,
                address=self.gateway.address,
                local_key=sub_config.get("local_key", ""),
                version=3.3
            )
            
            # 发送控制命令
            result = sub_device.set_multiple_values(dps_data)
            
            logger.info(f"控制结果: {result}")
            
            # 检查结果
            if result and "dps" in result:
                return {
                    "success": True,
                    "device_name": device_name,
                    "params": params,
                    "dps": dps_data,
                    "result": result
                }
            
            return {
                "success": True,
                "device_name": device_name,
                "params": params,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"子设备控制失败: {e}")
            return {"success": False, "error": str(e), "device_name": device_name}
    
    def get_status(self, device_id: str) -> Dict[str, Any]:
        """获取设备状态"""
        config = TUYA_DEVICES.get(device_id)
        if not config:
            return {"error": "未知设备"}
        
        device_name = config.get("name", device_id)
        
        if not self.gateway:
            return {"error": "网关未初始化"}
        
        try:
            if config.get("is_sub_device"):
                # 获取子设备状态
                sub_device = tinytuya.Device(
                    dev_id=device_id,
                    address=self.gateway.address,
                    local_key=config.get("local_key", ""),
                    version=3.3
                )
                status = sub_device.status()
                
                if "dps" in status:
                    # 转换DPS为友好名称
                    friendly_status = {}
                    for key, param_config in DEVICE_PARAMS.items():
                        dps = str(param_config["dps"])
                        if dps in status["dps"]:
                            friendly_status[key] = status["dps"][dps]
                    
                    return {
                        "success": True,
                        "device_name": device_name,
                        "status": friendly_status,
                        "raw": status
                    }
                
                return {"success": True, "device_name": device_name, "raw": status}
            
            # 获取网关状态
            if device_id == GATEWAY_ID:
                status = self.gateway.status()
                return {"success": True, "device_name": device_name, "raw": status}
            
            return {"error": "未知的设备类型"}
            
        except Exception as e:
            logger.error(f"获取状态失败: {e}")
            return {"error": str(e), "device_name": device_name}
    
    def _validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """验证参数"""
        validated = {}
        
        for key, value in params.items():
            if key not in DEVICE_PARAMS:
                logger.warning(f"未知参数: {key}")
                continue
            
            param_config = DEVICE_PARAMS[key]
            
            try:
                if param_config["type"] == "bool":
                    validated[key] = bool(value)
                elif param_config["type"] == "int":
                    v = int(value)
                    min_val = param_config.get("min", 0)
                    max_val = param_config.get("max", 100)
                    if min_val <= v <= max_val:
                        validated[key] = v
                    else:
                        logger.warning(f"{key} 值超出范围: {v} (范围: {min_val}-{max_val})")
                elif param_config["type"] == "str":
                    allowed = param_config.get("values", [])
                    if value in allowed:
                        validated[key] = value
                    else:
                        logger.warning(f"{key} 值不在允许列表: {value} (允许: {allowed})")
            except Exception as e:
                logger.warning(f"参数 {key} 验证失败: {e}")
        
        return validated
    
    def scan_devices(self) -> list:
        """扫描局域网涂鸦设备"""
        logger.info("扫描涂鸦设备...")
        try:
            # TinyTuya 1.18 版本使用 scan() 方法
            devices = tinytuya.scan()
            logger.info(f"发现 {len(devices)} 个设备")
            for dev in devices:
                logger.info(f"  - ID: {dev.get('id')}, IP: {dev.get('ip')}, Name: {dev.get('name', 'Unknown')}")
            return devices
        except Exception as e:
            logger.error(f"扫描失败: {e}")
            return []
    
    def discover_gateway_ip(self) -> Optional[str]:
        """发现网关IP"""
        try:
            devices = self.scan_devices()
            for dev in devices:
                if dev.get("id") == GATEWAY_ID:
                    ip = dev.get("ip")
                    logger.info(f"发现网关 IP: {ip}")
                    return ip
        except Exception as e:
            logger.error(f"发现网关失败: {e}")
        return None


# 全局控制器实例
controller = TuyaLocalController()
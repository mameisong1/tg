"""
TinyTuya 本地控制器
控制涂鸦设备（支持子设备/网关）
"""
import tinytuya
import json
import logging
import time
from typing import Dict, Any, Optional
from config import TUYA_DEVICES, DEVICE_PARAMS

logger = logging.getLogger(__name__)


class TuyaLocalController:
    """TinyTuya 本地控制器"""
    
    def __init__(self):
        self.devices: Dict[str, tinytuya.Device] = {}
        self.gateway: Optional[tinytuya.Device] = None
        self._init_devices()
    
    def _init_devices(self):
        """初始化设备"""
        for device_id, config in TUYA_DEVICES.items():
            # 跳过子设备（子设备通过网关控制）
            if config.get("is_sub_device"):
                logger.info(f"子设备 {config.get('name')} 将通过网关控制")
                continue
            
            if not config.get("local_key"):
                logger.warning(f"设备 {config.get('name', device_id)} 缺少 local_key")
                continue
            
            try:
                device = tinytuya.Device(
                    dev_id=device_id,
                    address=config.get("ip", "auto"),
                    local_key=config["local_key"],
                    version=float(config.get("version", "3.3"))
                )
                
                if config.get("is_gateway"):
                    self.gateway = device
                    logger.info(f"网关 {config.get('name')} 初始化成功")
                else:
                    self.devices[device_id] = device
                    logger.info(f"设备 {config.get('name')} 初始化成功")
                    
            except Exception as e:
                logger.error(f"设备 {device_id} 初始化失败: {e}")
    
    def control(self, device_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """控制设备"""
        # 验证参数
        validated = self._validate_params(params)
        if not validated:
            return {"success": False, "error": "参数验证失败"}
        
        config = TUYA_DEVICES.get(device_id)
        if not config:
            return {"success": False, "error": "未知设备"}
        
        # 子设备通过网关控制
        if config.get("is_sub_device"):
            if not self.gateway:
                return {"success": False, "error": "网关未初始化"}
            return self._control_sub_device(device_id, validated)
        
        # 直接控制设备
        device = self.devices.get(device_id)
        if not device:
            return {"success": False, "error": "设备未初始化"}
        
        return self._control_device(device, validated)
    
    def _control_device(self, device: tinytuya.Device, params: Dict) -> Dict:
        """直接控制设备"""
        try:
            # 发送控制命令
            # DPS映射: 1=开关, 2=温度, 4=模式, 5=风速
            dps_map = {
                "switch": 1,
                "temp_set": 2,
                "mode": 4,
                "fan_speed_enum": 5,
            }
            
            results = []
            for key, value in params.items():
                dps = dps_map.get(key)
                if dps:
                    result = device.set_value(dps, value)
                    results.append((key, result))
                    logger.info(f"设置 {key}={value}, DPS={dps}, 结果: {result}")
            
            return {"success": True, "results": results}
            
        except Exception as e:
            logger.error(f"控制失败: {e}")
            return {"success": False, "error": str(e)}
    
    def _control_sub_device(self, device_id: str, params: Dict) -> Dict:
        """通过网关控制子设备"""
        try:
            # 子设备控制需要使用网关的set_multiple_values
            # 或者发送特殊格式的命令
            
            dps_map = {
                "switch": 1,
                "temp_set": 2,
                "mode": 4,
                "fan_speed_enum": 5,
            }
            
            # 构建控制数据
            control_data = {}
            for key, value in params.items():
                dps = dps_map.get(key)
                if dps:
                    control_data[str(dps)] = value
            
            # 通过网关发送（TinyTuya会自动处理子设备）
            # 需要使用gateway的ID和子设备的local_key
            
            gateway_config = TUYA_DEVICES.get("6cedfa65e9e0d2f95bv8dw")
            sub_config = TUYA_DEVICES.get(device_id)
            
            if not gateway_config or not sub_config:
                return {"success": False, "error": "缺少设备配置"}
            
            # 创建子设备控制对象
            sub_device = tinytuya.Device(
                dev_id=device_id,
                address=gateway_config.get("ip", "auto"),
                local_key=sub_config.get("local_key", ""),
                version=3.3
            )
            
            # 发送控制
            result = sub_device.set_multiple_values(control_data)
            logger.info(f"子设备控制: {control_data}, 结果: {result}")
            
            return {"success": True, "result": result}
            
        except Exception as e:
            logger.error(f"子设备控制失败: {e}")
            return {"success": False, "error": str(e)}
    
    def get_status(self, device_id: str) -> Dict[str, Any]:
        """获取设备状态"""
        config = TUYA_DEVICES.get(device_id)
        if not config:
            return {"error": "未知设备"}
        
        device = self.devices.get(device_id) or self.gateway
        if not device:
            return {"error": "设备未初始化"}
        
        try:
            status = device.status()
            return status
        except Exception as e:
            return {"error": str(e)}
    
    def _validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """验证参数"""
        validated = {}
        
        for key, value in params.items():
            if key not in DEVICE_PARAMS:
                continue
            
            param_config = DEVICE_PARAMS[key]
            
            if param_config["type"] == "bool":
                validated[key] = bool(value)
            elif param_config["type"] == "int":
                try:
                    v = int(value)
                    if param_config.get("min", 0) <= v <= param_config.get("max", 100):
                        validated[key] = v
                except:
                    pass
            elif param_config["type"] == "str":
                if value in param_config.get("values", []):
                    validated[key] = value
        
        return validated
    
    def scan_devices(self) -> list:
        """扫描局域网设备"""
        logger.info("扫描涂鸦设备...")
        try:
            devices = tinytuya.deviceScan()
            logger.info(f"发现 {len(devices)} 个设备")
            return devices
        except Exception as e:
            logger.error(f"扫描失败: {e}")
            return []


# 全局控制器
controller = TuyaLocalController()
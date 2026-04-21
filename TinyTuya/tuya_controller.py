"""
涂鸦设备控制器
使用 TinyTuya 本地控制涂鸦设备
"""
import tinytuya
import json
import logging
from typing import Dict, Any, Optional
from config import TUYA_DEVICES, DEVICE_PARAMS

logger = logging.getLogger(__name__)


class TuyaController:
    """涂鸦设备控制器"""
    
    def __init__(self):
        self.devices: Dict[str, tinytuya.Device] = {}
        self._init_devices()
    
    def _init_devices(self):
        """初始化所有涂鸦设备"""
        for device_id, config in TUYA_DEVICES.items():
            if not config.get("local_key"):
                logger.warning(f"设备 {device_id} 缺少 local_key，跳过初始化")
                continue
            
            try:
                device = tinytuya.Device(
                    dev_id=device_id,
                    address=config.get("ip", "auto"),
                    local_key=config["local_key"],
                    version=config.get("version", "3.3")
                )
                self.devices[device_id] = device
                logger.info(f"设备 {config.get('name', device_id)} 初始化成功")
            except Exception as e:
                logger.error(f"设备 {device_id} 初始化失败: {e}")
    
    def get_device(self, device_id: str) -> Optional[tinytuya.Device]:
        """获取设备实例"""
        return self.devices.get(device_id)
    
    def get_status(self, device_id: str) -> Dict[str, Any]:
        """获取设备状态"""
        device = self.get_device(device_id)
        if not device:
            return {"error": "设备未初始化或不存在"}
        
        try:
            status = device.status()
            logger.info(f"设备 {device_id} 状态: {status}")
            return status
        except Exception as e:
            logger.error(f"获取设备状态失败: {e}")
            return {"error": str(e)}
    
    def control(self, device_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        控制设备
        
        Args:
            device_id: 设备ID
            params: 控制参数，如 {"switch": true, "temp_set": 20}
        
        Returns:
            控制结果
        """
        device = self.get_device(device_id)
        if not device:
            return {"success": False, "error": "设备未初始化或不存在"}
        
        # 验证参数
        validated_params = self._validate_params(params)
        if not validated_params:
            return {"success": False, "error": "参数验证失败"}
        
        try:
            # TinyTuya 使用 set_value 方法控制设备
            # 需要将参数转换为 DPS 格式
            result = self._send_command(device, validated_params)
            logger.info(f"设备 {device_id} 控制结果: {result}")
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"控制设备失败: {e}")
            return {"success": False, "error": str(e)}
    
    def _validate_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
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
                    if param_config.get("min", 0) <= int_value <= param_config.get("max", 100):
                        validated[key] = int_value
                except (ValueError, TypeError):
                    pass
            elif param_config["type"] == "str":
                if value in param_config.get("values", []):
                    validated[key] = value
        
        return validated
    
    def _send_command(self, device: tinytuya.Device, params: Dict[str, Any]) -> Any:
        """
        发送控制命令到设备
        
        TinyTuya 需要将参数映射到 DPS (Data Points)
        常见 DPS 映射:
        - switch -> dps 1
        - mode -> dps 2
        - temp_set -> dps 3
        - fan_speed -> dps 4
        """
        # 先获取设备 DPS 映射
        try:
            status = device.status()
            dps = status.get("dps", {})
            logger.debug(f"设备 DPS: {dps}")
        except Exception as e:
            logger.warning(f"无法获取 DPS 映射: {e}")
            dps = {}
        
        # 根据参数发送命令
        results = []
        
        # 开关控制 (通常是 dps 1)
        if "switch" in params:
            result = device.set_value(1, params["switch"])
            results.append(("switch", result))
        
        # 温度设置 (通常是 dps 2 或 3)
        if "temp_set" in params:
            result = device.set_value(2, params["temp_set"])
            results.append(("temp_set", result))
        
        # 模式设置 (通常是 dps 4 或 5)
        if "mode" in params:
            result = device.set_value(4, params["mode"])
            results.append(("mode", result))
        
        # 风速设置
        if "fan_speed_enum" in params:
            result = device.set_value(5, params["fan_speed_enum"])
            results.append(("fan_speed_enum", result))
        
        return results
    
    def scan_devices(self, timeout: float = 5.0) -> list:
        """
        扫描局域网内的涂鸦设备
        
        Returns:
            设备列表，包含 device_id, ip, local_key 等信息
        """
        logger.info("开始扫描涂鸦设备...")
        try:
            devices = tinytuya.deviceScan(timeout=timeout)
            logger.info(f"扫描完成，发现 {len(devices)} 个设备")
            return devices
        except Exception as e:
            logger.error(f"扫描设备失败: {e}")
            return []


# 全局控制器实例
controller = TuyaController()
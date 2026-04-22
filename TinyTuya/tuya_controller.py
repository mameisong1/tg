"""
多网关空调控制器
支持多个涂鸦网关，通过dev_id区分
"""
import tinytuya
import json
import logging
import time
from typing import Dict, Any, Optional

from config import GATEWAYS, DEVICE_PARAMS

logger = logging.getLogger(__name__)


class MultiGatewayController:
    """
    多网关空调控制器
    每个网关独立管理，通过dev_id选择
    """
    
    def __init__(self):
        """初始化所有网关控制器"""
        self.controllers: Dict[str, 'GatewayController'] = {}
        
        # 初始化每个网关
        for gw_id, gw_cfg in GATEWAYS.items():
            try:
                ctrl = GatewayController(
                    gateway_id=gw_id,
                    gateway_ip=gw_cfg['ip'],
                    gateway_key=gw_cfg['key'],
                    version=gw_cfg['version']
                )
                self.controllers[gw_id] = ctrl
                logger.info(f"✓ 网关已初始化: {gw_cfg['name']} ({gw_id[:16]}...)")
            except Exception as e:
                logger.error(f"✗ 网关初始化失败: {gw_id[:16]}... - {e}")
        
        logger.info(f"网关控制器总数: {len(self.controllers)}")
    
    def control(self, dev_id: str, node_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        控制子设备
        
        Args:
            dev_id: 网关ID（决定使用哪个网关）
            node_id: 子设备编号
            params: 控制参数
        
        Returns:
            控制结果
        """
        # 查找网关控制器
        if dev_id not in self.controllers:
            logger.error(f"未知网关: {dev_id}")
            return {
                "success": False,
                "error": f"未知网关ID: {dev_id}",
                "dev_id": dev_id
            }
        
        # 调用对应网关的控制器
        controller = self.controllers[dev_id]
        return controller.control(node_id, params)
    
    def get_status(self, dev_id: str, node_id: str) -> Dict[str, Any]:
        """
        获取子设备状态
        
        Args:
            dev_id: 网关ID
            node_id: 子设备编号
        
        Returns:
            状态数据
        """
        if dev_id not in self.controllers:
            return {
                "success": False,
                "error": f"未知网关ID: {dev_id}",
                "dev_id": dev_id
            }
        
        controller = self.controllers[dev_id]
        return controller.get_status(node_id)


class GatewayController:
    """
    单个网关控制器
    使用cid方式控制子设备（已验证可行）
    """
    
    def __init__(self, gateway_id: str, gateway_ip: str, gateway_key: str, version: float = 3.3):
        """
        初始化网关控制器
        
        Args:
            gateway_id: 网关设备ID
            gateway_ip: 网关IP地址
            gateway_key: 网关local_key
            version: 协议版本
        """
        self.gateway_id = gateway_id
        self.gateway_ip = gateway_ip
        self.gateway_key = gateway_key
        self.version = version
        
        # 子设备缓存
        self.sub_devices: Dict[str, tinytuya.Device] = {}
        
        logger.debug(f"网关对象创建: {gateway_id} @ {gateway_ip}")
    
    def get_sub_device(self, node_id: str) -> tinytuya.Device:
        """
        获取子设备控制对象（cid方式）
        
        Args:
            node_id: 子设备编号
        
        Returns:
            Device对象
        """
        # 使用缓存
        if node_id in self.sub_devices:
            return self.sub_devices[node_id]
        
        # ★ cid方式：dev_id=网关ID, cid=子设备编号
        device = tinytuya.Device(
            dev_id=self.gateway_id,
            address=self.gateway_ip,
            local_key=self.gateway_key,
            version=self.version,
            cid=node_id  # ★ 关键：cid = node_id
        )
        
        self.sub_devices[node_id] = device
        logger.debug(f"子设备对象创建: cid={node_id}")
        
        return device
    
    def control(self, node_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        控制子设备
        
        Args:
            node_id: 子设备编号
            params: 控制参数
        
        Returns:
            控制结果
        """
        device = self.get_sub_device(node_id)
        
        # 参数验证和DPS映射
        validated_dps = self._validate_and_map_dps(params)
        
        if not validated_dps:
            return {"success": False, "error": "无有效参数", "node_id": node_id}
        
        logger.info(f"控制 cid={node_id}: {validated_dps}")
        
        try:
            # 发送控制命令
            if len(validated_dps) == 1:
                # 单个DPS：使用set_value
                dps_num, dps_value = list(validated_dps.items())[0]
                result = device.set_value(dps_num, dps_value)
            else:
                # 多个DPS：使用set_multiple_values
                result = device.set_multiple_values(validated_dps)
            
            logger.debug(f"控制结果: {result}")
            
            # 判断成功
            if result and "Error" in result:
                return {
                    "success": False,
                    "error": result.get("Error"),
                    "error_code": result.get("Err"),
                    "node_id": node_id
                }
            
            return {
                "success": True,
                "node_id": node_id,
                "dps": validated_dps,
                "result": result or {}
            }
            
        except Exception as e:
            logger.error(f"控制异常: {e}")
            return {"success": False, "error": str(e), "node_id": node_id}
    
    def get_status(self, node_id: str) -> Dict[str, Any]:
        """
        获取子设备状态
        
        Args:
            node_id: 子设备编号
        
        Returns:
            状态数据
        """
        device = self.get_sub_device(node_id)
        
        try:
            status = device.status()
            
            if status and "Error" in status:
                return {
                    "success": False,
                    "error": status.get("Error"),
                    "error_code": status.get("Err"),
                    "node_id": node_id
                }
            
            # 转换DPS为友好名称
            friendly_status = {}
            if status and "dps" in status:
                dps_map = {
                    "1": "switch",
                    "2": "temp_set",
                    "3": "temp_current",
                    "4": "mode",
                    "5": "fan_speed_enum"
                }
                for dps_num, dps_value in status["dps"].items():
                    friendly_name = dps_map.get(dps_num, f"dps_{dps_num}")
                    friendly_status[friendly_name] = dps_value
            
            return {
                "success": True,
                "node_id": node_id,
                "status": friendly_status,
                "raw": status.get("dps", {}) if status else {}
            }
            
        except Exception as e:
            logger.error(f"获取状态异常: {e}")
            return {"success": False, "error": str(e), "node_id": node_id}
    
    def _validate_and_map_dps(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证参数并映射到DPS编号
        """
        validated = {}
        
        for param_name, param_value in params.items():
            if param_name not in DEVICE_PARAMS:
                logger.warning(f"未知参数: {param_name}")
                continue
            
            config = DEVICE_PARAMS[param_name]
            dps_num = config["dps"]
            
            # 类型验证
            try:
                if config["type"] == "bool":
                    validated[dps_num] = bool(param_value)
                elif config["type"] == "int":
                    value = int(param_value)
                    if config.get("min", 0) <= value <= config.get("max", 100):
                        validated[dps_num] = value
                    else:
                        logger.warning(f"{param_name} 值超出范围: {value}")
                elif config["type"] == "str":
                    if param_value in config.get("values", []):
                        validated[dps_num] = param_value
                    else:
                        logger.warning(f"{param_name} 值不在允许列表: {param_value}")
            except Exception as e:
                logger.warning(f"参数 {param_name} 验证失败: {e}")
        
        return validated


# 全局多网关控制器
multi_controller = MultiGatewayController()
"""
TinyTuya 网关子设备控制器（使用cid方式）
已验证：cid方式是唯一可用的本地控制方法
"""
import tinytuya
import json
import logging
import time
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class TuyaGatewayController:
    """
    涂鸦网关子设备控制器
    使用cid方式控制子设备（已验证可行）
    """
    
    def __init__(self, gateway_id: str, gateway_ip: str, gateway_key: str):
        """
        初始化网关控制器
        
        Args:
            gateway_id: 网关设备ID
            gateway_ip: 网关IP地址
            gateway_key: 网关local_key
        """
        self.gateway_id = gateway_id
        self.gateway_ip = gateway_ip
        self.gateway_key = gateway_key
        self.version = 3.3
        
        # 子设备缓存
        self.sub_devices: Dict[str, tinytuya.Device] = {}
        
        logger.info(f"网关控制器初始化: {gateway_id} @ {gateway_ip}")
    
    def get_sub_device(self, node_id: str) -> tinytuya.Device:
        """
        获取子设备控制对象（使用cid方式）
        
        Args:
            node_id: 子设备编号（如 "3"）
        
        Returns:
            Device对象
        """
        # 使用缓存
        if node_id in self.sub_devices:
            return self.sub_devices[node_id]
        
        # ★ cid方式：dev_id=网关ID, cid=子设备编号
        device = tinytuya.Device(
            dev_id=self.gateway_id,       # 网关ID
            address=self.gateway_ip,
            local_key=self.gateway_key,
            version=self.version,
            cid=node_id                    # ★ 关键：cid = node_id
        )
        
        self.sub_devices[node_id] = device
        logger.info(f"子设备对象已创建: cid={node_id}")
        
        return device
    
    def control(self, node_id: str, dps_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        控制子设备
        
        Args:
            node_id: 子设备编号
            dps_data: DPS数据，如 {"switch": True, "temp_set": 24}
        
        Returns:
            控制结果
        """
        device = self.get_sub_device(node_id)
        
        # 参数验证和DPS映射
        validated_dps = self._validate_and_map_dps(dps_data)
        
        if not validated_dps:
            return {"success": False, "error": "无有效参数"}
        
        logger.info(f"控制子设备 cid={node_id}: {validated_dps}")
        
        try:
            # 发送控制命令
            if len(validated_dps) == 1:
                # 单个DPS：使用set_value
                dps_num, dps_value = list(validated_dps.items())[0]
                result = device.set_value(dps_num, dps_value)
            else:
                # 多个DPS：使用set_multiple_values
                result = device.set_multiple_values(validated_dps)
            
            logger.info(f"控制结果: {result}")
            
            # 判断成功
            if "Error" in result:
                return {
                    "success": False,
                    "error": result.get("Error"),
                    "error_code": result.get("Err"),
                    "cid": node_id
                }
            
            return {
                "success": True,
                "cid": node_id,
                "dps": validated_dps,
                "result": result
            }
            
        except Exception as e:
            logger.error(f"控制异常: {e}")
            return {"success": False, "error": str(e), "cid": node_id}
    
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
            
            if "Error" in status:
                return {
                    "success": False,
                    "error": status.get("Error"),
                    "error_code": status.get("Err"),
                    "cid": node_id
                }
            
            # 转换DPS为友好名称
            friendly_status = {}
            if "dps" in status:
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
                "cid": node_id,
                "status": friendly_status,
                "raw": status.get("dps", {})
            }
            
        except Exception as e:
            logger.error(f"获取状态异常: {e}")
            return {"success": False, "error": str(e), "cid": node_id}
    
    def _validate_and_map_dps(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        验证参数并映射到DPS编号
        
        Args:
            params: 参数字典，如 {"switch": True, "temp_set": 24}
        
        Returns:
            DPS编号映射，如 {"1": True, "2": 24}
        """
        dps_map = {
            "switch": {"dps": "1", "type": "bool", "range": [True, False]},
            "temp_set": {"dps": "2", "type": "int", "min": 16, "max": 32},
            "mode": {"dps": "4", "type": "str", "values": ["hot", "cold", "wind", "wet"]},
            "fan_speed_enum": {"dps": "5", "type": "str", "values": ["auto", "low", "middle", "high"]},
        }
        
        validated = {}
        
        for param_name, param_value in params.items():
            if param_name not in dps_map:
                logger.warning(f"未知参数: {param_name}")
                continue
            
            config = dps_map[param_name]
            dps_num = config["dps"]
            
            # 类型验证
            try:
                if config["type"] == "bool":
                    validated[dps_num] = bool(param_value)
                elif config["type"] == "int":
                    value = int(param_value)
                    if config["min"] <= value <= config["max"]:
                        validated[dps_num] = value
                    else:
                        logger.warning(f"{param_name} 值超出范围: {value}")
                elif config["type"] == "str":
                    if param_value in config["values"]:
                        validated[dps_num] = param_value
                    else:
                        logger.warning(f"{param_name} 值不在允许列表: {param_value}")
            except Exception as e:
                logger.warning(f"参数 {param_name} 验证失败: {e}")
        
        return validated


# ============================================================
# 测试代码
# ============================================================
if __name__ == "__main__":
    # 配置
    GATEWAY_ID = "6cedfa65e9e0d2f95bv8dw"
    GATEWAY_IP = "192.168.110.62"
    GATEWAY_KEY = "k[BxEj?<'^;cu|]1"
    
    print("=" * 60)
    print("TinyTuya 子设备控制器测试（cid方式）")
    print("=" * 60)
    
    # 创建控制器
    controller = TuyaGatewayController(
        gateway_id=GATEWAY_ID,
        gateway_ip=GATEWAY_IP,
        gateway_key=GATEWAY_KEY
    )
    
    # 测试1: 获取状态
    print("\n[测试1] 获取子设备状态 (cid=3)")
    status = controller.get_status("3")
    print(f"状态: {json.dumps(status, indent=2, ensure_ascii=False)}")
    
    # 测试2: 控制命令
    print("\n[测试2] 控制命令：开关=True, 温度=24")
    result = controller.control("3", {
        "switch": True,
        "temp_set": 24,
        "mode": "cold",
        "fan_speed_enum": "auto"
    })
    print(f"结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    # 测试3: 多DPS同时控制
    print("\n[测试3] 多DPS控制")
    result = controller.control("3", {
        "switch": False
    })
    print(f"结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
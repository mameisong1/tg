"""
TinyTuya 本地控制器
支持多网关、多子设备控制
"""
import tinytuya
import json
import logging
import time
from typing import Dict, Any, Optional
from config import (
    GATEWAYS, SUB_DEVICES, ALL_DEVICES, DEVICE_PARAMS,
    get_gateway_config, get_sub_device_config, get_device_config
)

logger = logging.getLogger(__name__)


class TuyaLocalController:
    """TinyTuya 多网关控制器"""
    
    def __init__(self):
        self.gateways: Dict[str, tinytuya.Device] = {}  # 网关设备对象缓存
        self._init_gateways()
    
    def _init_gateways(self):
        """初始化所有网关"""
        for gateway_id, gateway_config in GATEWAYS.items():
            local_key = gateway_config.get("local_key")
            gateway_ip = gateway_config.get("ip")
            
            if not local_key:
                logger.error(f"网关 {gateway_config.get('name')} 缺少 local_key")
                continue
            
            if not gateway_ip or gateway_ip == "Auto":
                logger.warning(f"网关 {gateway_config.get('name')} IP未配置，将尝试自动发现")
                gateway_ip = "Auto"
            
            try:
                gateway_device = tinytuya.Device(
                    dev_id=gateway_id,
                    address=gateway_ip,
                    local_key=local_key,
                    version=float(gateway_config.get("version", 3.3)),
                    persist=True
                )
                
                self.gateways[gateway_id] = gateway_device
                logger.info(f"网关 {gateway_config.get('name')} 初始化成功 (IP: {gateway_ip})")
                
            except Exception as e:
                logger.error(f"网关 {gateway_config.get('name')} 初始化失败: {e}")
        
        logger.info(f"网关初始化完成: {len(self.gateways)}/{len(GATEWAYS)} 个成功")
    
    def control(self, device_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """控制设备"""
        # 验证参数
        validated = self._validate_params(params)
        if not validated:
            return {"success": False, "error": "参数验证失败"}
        
        config = get_device_config(device_id)
        if not config:
            return {"success": False, "error": "未知设备"}
        
        device_name = config.get("name", device_id)
        
        # 子设备通过网关控制
        if config.get("is_sub_device"):
            return self._control_sub_device(device_id, validated, device_name)
        
        # 网关本身的状态控制
        if config.get("is_gateway"):
            return {"success": False, "error": "网关不支持直接控制"}
        
        return {"success": False, "error": "未知的设备类型"}
    
    def _control_sub_device(self, device_id: str, params: Dict, device_name: str) -> Dict:
        """通过网关控制子设备"""
        sub_config = get_sub_device_config(device_id)
        if not sub_config:
            return {"success": False, "error": "子设备配置不存在"}
        
        gateway_id = sub_config.get("gateway_id")
        if not gateway_id:
            return {"success": False, "error": "子设备未指定网关"}
        
        gateway_device = self.gateways.get(gateway_id)
        if not gateway_device:
            return {"success": False, "error": f"网关 {gateway_id} 未初始化"}
        
        gateway_config = get_gateway_config(gateway_id)
        gateway_ip = gateway_config.get("ip") if gateway_config else "Unknown"
        
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
            
            node_id = sub_config.get("node_id", "")
            local_key = sub_config.get("local_key") or gateway_config.get("local_key", "")
            
            logger.info(f"控制子设备 {device_name} (网关: {gateway_config.get('name')}, node_id={node_id}): {dps_data}")
            
            # 创建子设备控制对象（指向所属网关IP）
            sub_device = tinytuya.Device(
                dev_id=device_id,
                address=gateway_ip,
                local_key=local_key,
                version=3.3,
                persist=True
            )
            
            # 发送控制命令
            result = sub_device.set_multiple_values(dps_data)
            
            logger.info(f"控制结果: {result}")
            
            # 检查结果
            if result and "Error" in result:
                error_code = result.get("Err", "")
                error_msg = result.get("Error", "")
                
                # 如果子设备方式失败，尝试单值设置方式
                if error_code in ["900", "901"]:
                    logger.warning(f"批量设置失败({error_code})，尝试逐个设置...")
                    return self._control_single_values(device_id, dps_data, device_name, params, gateway_ip, local_key)
                
                return {
                    "success": False,
                    "device_name": device_name,
                    "gateway": gateway_config.get("name"),
                    "error": error_msg,
                    "error_code": error_code,
                    "params": params
                }
            
            return {
                "success": "Error" not in result if result else False,
                "device_name": device_name,
                "gateway": gateway_config.get("name"),
                "params": params,
                "dps": dps_data,
                "result": result or {}
            }
            
        except Exception as e:
            logger.error(f"子设备控制失败: {e}")
            return {"success": False, "error": str(e), "device_name": device_name}
    
    def _control_single_values(self, device_id: str, dps_data: Dict, device_name: str, params: Dict, gateway_ip: str, local_key: str) -> Dict:
        """逐个设置DPS值（备用方式）"""
        try:
            sub_device = tinytuya.Device(
                dev_id=device_id,
                address=gateway_ip,
                local_key=local_key,
                version=3.3
            )
            
            results = []
            success_count = 0
            
            for dps_key, dps_value in dps_data.items():
                try:
                    r = sub_device.set_value(int(dps_key), dps_value)
                    has_error = "Error" in r if r else True
                    
                    results.append({
                        "dps": dps_key,
                        "value": dps_value,
                        "success": not has_error,
                        "result": r
                    })
                    
                    if not has_error:
                        success_count += 1
                        logger.info(f"✓ DPS {dps_key}={dps_value} 成功")
                    else:
                        logger.warning(f"✗ DPS {dps_key}={dps_value} 失败: {r}")
                        
                except Exception as ex:
                    results.append({
                        "dps": dps_key,
                        "value": dps_value,
                        "success": False,
                        "error": str(ex)
                    })
                    logger.error(f"✗ DPS {dps_key}={dps_value} 异常: {ex}")
            
            return {
                "success": success_count > 0,
                "device_name": device_name,
                "params": params,
                "dps": dps_data,
                "results": results,
                "success_count": success_count,
                "method": "single_values"
            }
            
        except Exception as e:
            logger.error(f"逐个设置失败: {e}")
            return {"success": False, "error": str(e), "device_name": device_name}
    
    def get_status(self, device_id: str) -> Dict[str, Any]:
        """获取设备状态"""
        config = get_device_config(device_id)
        if not config:
            return {"error": "未知设备"}
        
        device_name = config.get("name", device_id)
        
        try:
            if config.get("is_sub_device"):
                gateway_id = config.get("gateway_id")
                gateway_config = get_gateway_config(gateway_id)
                
                if not gateway_config:
                    return {"error": "网关配置不存在"}
                
                gateway_ip = gateway_config.get("ip")
                local_key = config.get("local_key") or gateway_config.get("local_key", "")
                
                sub_device = tinytuya.Device(
                    dev_id=device_id,
                    address=gateway_ip,
                    local_key=local_key,
                    version=3.3
                )
                
                status = sub_device.status()
                
                if "dps" in status and "Error" not in status:
                    # 转换DPS为友好名称
                    friendly_status = {}
                    for key, param_config in DEVICE_PARAMS.items():
                        dps = str(param_config["dps"])
                        if dps in status["dps"]:
                            friendly_status[key] = status["dps"][dps]
                    
                    return {
                        "success": True,
                        "device_name": device_name,
                        "gateway": gateway_config.get("name"),
                        "status": friendly_status,
                        "raw": status
                    }
                
                return {
                    "success": "Error" not in status,
                    "device_name": device_name,
                    "raw": status
                }
            
            # 获取网关状态
            if config.get("is_gateway"):
                gateway_device = self.gateways.get(device_id)
                if gateway_device:
                    status = gateway_device.status()
                    return {"success": True, "device_name": device_name, "raw": status}
                return {"error": "网关未初始化"}
            
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
                        logger.warning(f"{key} 值超出范围: {v}")
                elif param_config["type"] == "str":
                    allowed = param_config.get("values", [])
                    if value in allowed:
                        validated[key] = value
                    else:
                        logger.warning(f"{key} 值不在允许列表: {value}")
            except Exception as e:
                logger.warning(f"参数 {key} 验证失败: {e}")
        
        return validated
    
    def scan_all_gateways(self) -> Dict[str, str]:
        """扫描并发现所有网关IP"""
        logger.info("扫描涂鸦设备...")
        
        discovered = {}
        
        try:
            # 使用 TinyTuya 扫描
            scanner = tinytuya.DeviceScan()
            scanner.scan()
            
            # 匹配已知网关
            for device_ip, device_info in scanner.devices_found.items():
                device_id = device_info.get("gwId", "")
                
                if device_id in GATEWAYS:
                    gateway_config = GATEWAYS[device_id]
                    discovered[device_id] = device_ip
                    logger.info(f"✓ 发现网关 {gateway_config.get('name')} IP: {device_ip}")
                else:
                    logger.debug(f"发现其他设备: {device_id} IP: {device_ip}")
            
            # 更新网关IP（如果之前是Auto）
            for gateway_id, ip in discovered.items():
                if self.gateways.get(gateway_id):
                    self.gateways[gateway_id].address = ip
                    logger.info(f"网关 {gateway_id} IP已更新为 {ip}")
            
            return discovered
            
        except Exception as e:
            logger.error(f"扫描失败: {e}")
            return {}
    
    def get_gateway_status_summary(self) -> Dict[str, Any]:
        """获取所有网关状态摘要"""
        summary = {}
        
        for gateway_id, gateway_config in GATEWAYS.items():
            gateway_device = self.gateways.get(gateway_id)
            
            summary[gateway_id] = {
                "name": gateway_config.get("name"),
                "ip": gateway_config.get("ip"),
                "initialized": gateway_device is not None,
                "sub_device_count": len([d for d in SUB_DEVICES.values() if d.get("gateway_id") == gateway_id])
            }
        
        return summary


# 全局控制器实例
controller = TuyaLocalController()
"""
诊断脚本：测试网关和子设备通信
"""
import tinytuya
import json
from config import GATEWAY_ID, TUYA_LOCAL_KEY, GATEWAY_IP, TUYA_DEVICES

print("=" * 60)
print("涂鸦设备通信诊断")
print("=" * 60)

# 1. 测试网关连接
print("\n[1] 测试网关连接...")
print(f"网关ID: {GATEWAY_ID}")
print(f"网关IP: {GATEWAY_IP}")
print(f"local_key: {TUYA_LOCAL_KEY[:10]}...")

gateway = tinytuya.Device(
    dev_id=GATEWAY_ID,
    address=GATEWAY_IP,
    local_key=TUYA_LOCAL_KEY,
    version=3.3
)

try:
    print("\n获取网关状态...")
    gw_status = gateway.status()
    print(f"网关状态: {json.dumps(gw_status, indent=2)}")
    
    if "Error" in gw_status:
        print(f"✗ 网关连接失败: {gw_status.get('Error')}")
    else:
        print("✓ 网关连接成功")
except Exception as e:
    print(f"✗ 网关连接异常: {e}")

# 2. 测试子设备通信
print("\n" + "=" * 60)
print("[2] 测试子设备通信...")

# 选择一个子设备测试
sub_device_id = "6c1d7f15376d6f2a82elsf"  # 室内机16
sub_config = TUYA_DEVICES.get(sub_device_id)

print(f"子设备ID: {sub_device_id}")
print(f"子设备名称: {sub_config.get('name')}")
print(f"node_id: {sub_config.get('node_id')}")

# 方式A：直接连接子设备（使用网关IP）
print("\n方式A：子设备直连（address=网关IP）...")
sub_device = tinytuya.Device(
    dev_id=sub_device_id,
    address=GATEWAY_IP,
    local_key=TUYA_LOCAL_KEY,
    version=3.3
)

try:
    print("获取子设备状态...")
    sub_status = sub_device.status()
    print(f"子设备状态: {json.dumps(sub_status, indent=2)}")
    
    if "Error" in sub_status:
        print(f"✗ 子设备直连失败: {sub_status.get('Error')}")
        print(f"错误码: {sub_status.get('Err')}")
        print(f"Payload: {sub_status.get('Payload')}")
    else:
        print("✓ 子设备直连成功")
        if "dps" in sub_status:
            print(f"DPS数据: {json.dumps(sub_status['dps'], indent=2)}")
except Exception as e:
    print(f"✗ 子设备直连异常: {e}")

# 方式B：尝试通过网关发送控制命令
print("\n" + "=" * 60)
print("[3] 尝试控制命令...")

try:
    # 尝试关闭空调（安全操作）
    print("发送命令: switch=False（关空调）...")
    result = sub_device.set_value(1, False)  # DPS 1 = switch
    print(f"结果: {json.dumps(result, indent=2)}")
    
    if "Error" in result:
        print(f"✗ 控制失败: {result.get('Error')}")
    else:
        print("✓ 控制成功")
except Exception as e:
    print(f"✗ 控制异常: {e}")

print("\n" + "=" * 60)
print("诊断完成")
print("=" * 60)

print("\n结论:")
print("如果网关连接成功但子设备失败（错误900: devid not found）")
print("说明子设备需要通过网关路由，当前TinyTuya可能不支持此架构")
print("\n建议：切换到涂鸦云API方案（可远程控制）")
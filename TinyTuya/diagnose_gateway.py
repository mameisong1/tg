"""
网关子设备通信诊断
测试不同寻址方式找出正确控制方法
"""
import tinytuya
import json
import time

# 配置
GATEWAY_ID = "6cedfa65e9e0d2f95bv8dw"
GATEWAY_IP = "192.168.110.62"  # 请替换为实际IP
GATEWAY_KEY = "k[BxEj?<'^;cu|]1"

SUB_DEVICE_ID = "6c1d7f15376d6f2a82elsf"  # 室内机16
NODE_ID = "3"

print("=" * 60)
print("TinyTuya 设备通信诊断")
print("=" * 60)

# ===== 测试1: 网关本身 =====
print("\n[1] 测试网关连接...")
print(f"网关ID: {GATEWAY_ID}")
print(f"网关IP: {GATEWAY_IP}")
print(f"local_key: {GATEWAY_KEY[:10]}...")

gateway = tinytuya.Device(
    dev_id=GATEWAY_ID,
    address=GATEWAY_IP,
    local_key=GATEWAY_KEY,
    version=3.3
)

try:
    print("\n获取网关状态...")
    gw_status = gateway.status()
    print(f"网关状态: {json.dumps(gw_status, indent=2, ensure_ascii=False)}")
    
    if "Error" in gw_status:
        print(f"✗ 网关连接失败: {gw_status.get('Error')}")
    else:
        print("✓ 网关连接成功")
        if "dps" in gw_status:
            print(f"网关DPS: {gw_status['dps']}")
except Exception as e:
    print(f"✗ 网关连接异常: {e}")

# ===== 测试2: 子设备直连 =====
print("\n" + "=" * 60)
print("[2] 测试子设备直连（使用子设备ID）...")
print(f"子设备ID: {SUB_DEVICE_ID}")
print(f"子设备名称: 室内机16")

sub_device = tinytuya.Device(
    dev_id=SUB_DEVICE_ID,
    address=GATEWAY_IP,
    local_key=GATEWAY_KEY,
    version=3.3
)

try:
    print("获取子设备状态...")
    sub_status = sub_device.status()
    print(f"子设备状态: {json.dumps(sub_status, indent=2, ensure_ascii=False)}")
    
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

# ===== 测试3: 尝试控制命令 =====
print("\n" + "=" * 60)
print("[3] 尝试控制命令...")

try:
    # 尝试关闭空调（安全操作）
    print("发送命令: switch=False（关空调）...")
    result = sub_device.set_value(1, False)  # DPS 1 = switch
    print(f"结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if "Error" in result:
        print(f"✗ 控制失败: {result.get('Error')}")
    else:
        print("✓ 控制成功")
except Exception as e:
    print(f"✗ 控制异常: {e}")

# ===== 测试4: 网关本身能否发送子设备命令 =====
print("\n" + "=" * 60)
print("[4] 测试网关发送子设备命令...")

try:
    # 通过网关发送，尝试设置子设备
    print("尝试网关发送...")
    
    # 方法1: 设置网关的某个DPS（可能映射到子设备）
    result1 = gateway.set_value(1, False)
    print(f"网关DPS1结果: {json.dumps(result1, indent=2, ensure_ascii=False)}")
    
except Exception as e:
    print(f"✗ 异常: {e}")

# ===== 结论 =====
print("\n" + "=" * 60)
print("诊断结论")
print("=" * 60)

print("""
错误码 900 (devid not found) 表示:
  → 子设备ID不被网关识别
  → TinyTuya可能不支持这种网关+子设备架构

解决方案:
  → 使用涂鸦云API控制（已验证可用）
  → 不依赖TinyTuya本地控制
""")

print("\n涂鸦云API测试命令（手动运行）:")
print("请使用之前跑通的curl命令测试云API控制")
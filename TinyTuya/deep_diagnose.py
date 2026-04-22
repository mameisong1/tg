"""
TinyTuya 网关子设备深度调查（修正版）
parent参数需要传Device对象，不是字符串ID
"""
import tinytuya
import json
import time

# 网关配置
GATEWAY_ID = "6cedfa65e9e0d2f95bv8dw"
GATEWAY_IP = "192.168.110.62"
GATEWAY_KEY = "k[BxEj?<'^;cu|]1"

# 子设备配置
SUB_DEVICE_ID = "6c1d7f15376d6f2a82elsf"
SUB_NODE_ID = "3"
SUB_NAME = "室内机16"

print("=" * 70)
print("TinyTuya 网关子设备深度调查（修正版）")
print("=" * 70)

print(f"\n设备信息:")
print(f"  网关ID: {GATEWAY_ID}")
print(f"  网关IP: {GATEWAY_IP}")
print(f"  子设备ID: {SUB_DEVICE_ID}")
print(f"  子设备node_id: {SUB_NODE_ID}")

# ============================================================
# 步骤1: 先创建网关对象
# ============================================================
print("\n" + "-" * 70)
print("[步骤1] 创建网关Device对象")
print("-" * 70)

gateway = tinytuya.Device(
    dev_id=GATEWAY_ID,
    address=GATEWAY_IP,
    local_key=GATEWAY_KEY,
    version=3.3
)

print(f"✓ 网关对象已创建 (version={gateway.version})")

# ============================================================
# 测试2: 网关本身通信
# ============================================================
print("\n" + "-" * 70)
print("[测试2] 网关本身通信")
print("-" * 70)

try:
    gw_status = gateway.status()
    print(f"结果: {json.dumps(gw_status, indent=2, ensure_ascii=False)}")
    
    if "dps" in gw_status:
        print("✓ 网关有DPS数据:")
        for k, v in gw_status["dps"].items():
            print(f"    DPS {k}: {v}")
    
    if "Error" in gw_status:
        print(f"✗ 错误: {gw_status.get('Error')} (码: {gw_status.get('Err')})")
        
except Exception as e:
    print(f"✗ 异常: {e}")

# ============================================================
# 测试3: 子设备正确方式（parent=网关对象）
# ============================================================
print("\n" + "-" * 70)
print("[测试3] 子设备正确方式（parent=网关Device对象）")
print("-" * 70)
print("★ 关键: parent参数传入gateway对象，不是字符串ID！")

try:
    sub_device = tinytuya.Device(
        dev_id=SUB_DEVICE_ID,
        parent=gateway,           # ★ 传入网关Device对象
        node_id=SUB_NODE_ID       # ★ 子设备编号
        # 注意: address和local_key会自动从parent继承
    )
    
    print(f"✓ 子设备对象已创建")
    print(f"  address: {sub_device.address} (继承自网关)")
    print(f"  local_key: {sub_device.local_key[:15]}... (继承自网关)")
    
    # 获取状态
    print("\n获取子设备状态...")
    status = sub_device.status()
    print(f"结果: {json.dumps(status, indent=2, ensure_ascii=False)}")
    
    if "dps" in status and "Error" not in status:
        print("✓✓✓ 子设备连接成功！")
        print("DPS数据:")
        for k, v in status["dps"].items():
            print(f"    DPS {k}: {v}")
    
    if "Error" in status:
        print(f"✗ 错误码 {status.get('Err')}: {status.get('Error')}")
        
except Exception as e:
    print(f"✗ 异常: {e}")
    import traceback
    traceback.print_exc()

# ============================================================
# 测试4: cid方式（可能更简单）
# ============================================================
print("\n" + "-" * 70)
print("[测试4] cid方式（dev_id=网关ID, cid=子设备编号）")
print("-" * 70)

try:
    sub_cid = tinytuya.Device(
        dev_id=GATEWAY_ID,        # ★ 网关ID
        address=GATEWAY_IP,
        local_key=GATEWAY_KEY,
        version=3.3,
        cid=SUB_NODE_ID           # ★ cid = 子设备编号
    )
    
    print(f"✓ cid方式对象已创建")
    
    # 获取状态
    print("\n获取状态...")
    status = sub_cid.status()
    print(f"结果: {json.dumps(status, indent=2, ensure_ascii=False)}")
    
    if "dps" in status and "Error" not in status:
        print("✓✓✓ cid方式成功！")
        print("DPS数据:")
        for k, v in status["dps"].items():
            print(f"    DPS {k}: {v}")
    
    if "Error" in status:
        print(f"✗ 错误码 {status.get('Err')}: {status.get('Error')}")
        
except Exception as e:
    print(f"✗ 异常: {e}")

# ============================================================
# 测试5: 控制命令（使用成功的连接方式）
# ============================================================
print("\n" + "-" * 70)
print("[测试5] 发送控制命令")
print("-" * 70)

# 尝试两种方式的控制
for method_name, device_obj in [("parent方式", "sub_device"), ("cid方式", "sub_cid")]:
    try:
        # 检查对象是否存在
        if device_obj not in locals():
            continue
            
        dev = locals()[device_obj]
        print(f"\n{method_name}: 发送 DPS1(开关) = False")
        
        result = dev.set_value(1, False)
        print(f"结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
        
        if "Error" not in result:
            print(f"✓ {method_name}控制成功！")
        else:
            print(f"✗ {method_name}控制失败: {result.get('Error')}")
            
    except Exception as e:
        print(f"✗ {method_name}异常: {e}")

# ============================================================
# 测试6: 尝试不同协议版本（使用正确方式）
# ============================================================
print("\n" + "-" * 70)
print("[测试6] 测试不同协议版本")
print("-" * 70)

for ver in [3.1, 3.2, 3.3, 3.4]:
    print(f"\n协议版本 {ver}:")
    try:
        # 先创建网关对象
        gw_test = tinytuya.Device(
            dev_id=GATEWAY_ID,
            address=GATEWAY_IP,
            local_key=GATEWAY_KEY,
            version=ver
        )
        
        # 创建子设备
        sub_test = tinytuya.Device(
            dev_id=SUB_DEVICE_ID,
            parent=gw_test,
            node_id=SUB_NODE_ID
        )
        
        status = sub_test.status()
        
        if "dps" in status and "Error" not in status:
            print(f"  ✓✓✓ 版本 {ver} 成功！")
            print(f"  DPS: {status['dps']}")
            break  # 找到可用版本就停止
        elif "Error" in status:
            print(f"  ✗ 错误: {status.get('Err')} - {status.get('Error')}")
        else:
            print(f"  ? 结果: {status}")
            
    except Exception as e:
        print(f"  ✗ 异常: {e}")

# ============================================================
# 结论
# ============================================================
print("\n" + "=" * 70)
print("调查结论")
print("=" * 70)

print("""
正确用法总结:

方式1: parent方式（推荐）
  gateway = tinytuya.Device(dev_id=网关ID, ...)
  sub = tinytuya.Device(dev_id=子设备ID, parent=gateway, node_id="编号")

方式2: cid方式（更简洁）
  sub = tinytuya.Device(dev_id=网关ID, cid="子设备编号", ...)

如果仍然报错900 (devid not found):
  → local_key可能不正确
  → 需运行 tinytuya wizard 重新获取凭证
  → 或使用涂鸦云API方案
""")
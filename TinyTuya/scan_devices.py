"""
扫描局域网涂鸦设备
用于发现网关IP地址
"""
import tinytuya
import json
import time
from config import GATEWAY_ID

print("=" * 60)
print("TinyTuya 设备扫描")
print("=" * 60)

print("\n正在扫描局域网涂鸦设备...")
print("注意: 请确保运行此脚本的设备与涂鸦网关在同一局域网\n")

try:
    # TinyTuya 1.18 版本使用 scan() 方法
    print("扫描中...")
    devices = tinytuya.scan(max_attempts=3, timeout=10)
    
    print(f"\n发现 {len(devices)} 个设备:")
    print("-" * 60)
    
    gateway_found = False
    gateway_ip = None
    
    for dev in devices:
        device_id = dev.get('id', 'Unknown')
        ip = dev.get('ip', 'Unknown')
        name = dev.get('name', 'Unknown')
        version = dev.get('version', 'Unknown')
        
        marker = ""
        if device_id == GATEWAY_ID:
            marker = " [★ 网关设备]"
            gateway_found = True
            gateway_ip = ip
        
        print(f"ID: {device_id}{marker}")
        print(f"  IP: {ip}")
        print(f"  Name: {name}")
        print(f"  Version: {version}")
        print()
    
    print("-" * 60)
    
    if gateway_found:
        print(f"\n✓ 网关设备已找到!")
        print(f"  网关ID: {GATEWAY_ID}")
        print(f"  网关IP: {gateway_ip}")
        print(f"\n请更新 config.py 或设置环境变量:")
        print(f"  GATEWAY_IP={gateway_ip}")
        
        # 保存网关IP到文件
        with open("/app/logs/gateway_ip.txt", "w") as f:
            f.write(f"{gateway_ip}\n")
        print(f"\n网关IP已保存到: /app/logs/gateway_ip.txt")
    else:
        print(f"\n⚠ 网关设备未找到")
        print(f"  目标网关ID: {GATEWAY_ID}")
        print(f"  请检查:")
        print(f"    1. 网关是否在线")
        print(f"    2. 是否在同一局域网")
        print(f"    3. 网关ID是否正确")
    
except Exception as e:
    print(f"\n✗ 扫描失败: {e}")
    print("请检查:")
    print("  1. TinyTuya 是否正确安装")
    print("  2. 网络连接是否正常")

print("\n" + "=" * 60)
print("扫描完成")
print("=" * 60)
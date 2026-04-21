"""
扫描涂鸦设备脚本

运行此脚本获取设备的 local_key 和 IP 地址
"""
import tinytuya
import json

def scan_devices():
    """扫描局域网内的涂鸦设备"""
    print("正在扫描涂鸦设备...")
    print("=" * 60)
    
    # 扫描设备
    devices = tinytuya.deviceScan(timeout=10.0)
    
    if not devices:
        print("未发现设备")
        print("\n提示：")
        print("1. 确保设备已通电并连接到 WiFi")
        print("2. 确保设备和此电脑在同一局域网")
        print("3. 运行: python -m tinytuya wizard（需要涂鸦账号）")
        return
    
    print(f"\n发现 {len(devices)} 个设备:")
    print("=" * 60)
    
    for device_id, info in devices.items():
        print(f"\n设备ID: {device_id}")
        print(f"  IP: {info.get('ip', 'unknown')}")
        print(f"  名称: {info.get('name', 'unknown')}")
        print(f"  Key: {info.get('key', 'unknown')}")
        print(f"  版本: {info.get('ver', 'unknown')}")
    
    print("\n" + "=" * 60)
    print("将上述信息复制到 config.py 中的 TUYA_DEVICES 配置")
    print("=" * 60)


def wizard_mode():
    """
    向导模式 - 需要涂鸦账号
    
    运行: python -m tinytuya wizard
    """
    print("\n向导模式需要涂鸦账号密码")
    print("请运行: python -m tinytuya wizard")
    print("\n按提示输入:")
    print("  1. 涂鸦 IoT 平台 API Key (clientId)")
    print("  2. 涂鸦 IoT 平台 API Secret")
    print("  3. 涂鸦账号区域 (cn=中国)")
    print("\n向导会自动:")
    print("  - 获取设备列表")
    print("  - 扫描本地设备")
    print("  - 生成配置文件")


if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════╗
║          涂鸦设备扫描工具                                  ║
╚═══════════════════════════════════════════════════════════╝

方式1: 本地扫描（无需账号）
  python scan_devices.py

方式2: 向导模式（需要涂鸦账号）
  python -m tinytuya wizard

""")
    
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "wizard":
        wizard_mode()
    else:
        scan_devices()
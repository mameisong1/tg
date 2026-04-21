"""
涂鸦云API测试脚本
测试API连接和设备状态查询（不实际控制，只测试连接）
"""
import sys
sys.path.insert(0, '/TG/TinyTuya')

from tuya_cloud_api import api
from config import TUYA_DEVICES, TUYA_CLIENT_ID, TUYA_CLIENT_SECRET, TUYA_API_BASE_URL

def test_api_config():
    """显示API配置"""
    print("\n=== API配置信息 ===\n")
    print(f"API地址: {TUYA_API_BASE_URL}")
    print(f"Client ID: {TUYA_CLIENT_ID}")
    print(f"Client Secret: {TUYA_CLIENT_SECRET[:10]}...")
    print(f"设备数量: {len(TUYA_DEVICES)}")
    
    for device_id, config in TUYA_DEVICES.items():
        print(f"  - {config.get('name')} ({device_id})")


def test_device_status():
    """测试获取设备状态"""
    print("\n=== 测试设备状态查询 ===\n")
    
    for device_id, config in TUYA_DEVICES.items():
        print(f"设备: {config.get('name')} ({device_id})")
        
        result = api.get_device_status(device_id)
        
        if result.get("success"):
            print("✓ 状态查询成功")
            status = result.get("status", {})
            print(f"  状态: {status}")
        else:
            print(f"✗ 状态查询失败: {result.get('msg')}")


def main():
    print("""
╔═══════════════════════════════════════════════════════════╗
║          涂鸦云API连接测试                                 ║
║     测试API认证和设备状态查询（不发送控制命令）              ║
╚═══════════════════════════════════════════════════════════╝
""")
    
    test_api_config()
    test_device_status()
    
    print("\n=== 测试完成 ===")


if __name__ == "__main__":
    main()
"""
测试脚本：验证MQTT连接和TinyTuya基础功能
"""
import sys
import time
import json
import paho.mqtt.client as mqtt
from config import MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, TUYA_LOCAL_KEY

print("=" * 50)
print("TinyTuya + MQTT 连接测试")
print("=" * 50)

# 1. 测试MQTT连接
print("\n[1] 测试MQTT连接...")
try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-client")
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    connected = False
    
    def on_connect(c, userdata, flags, reason_code, properties):
        global connected
        if reason_code == 0:
            print(f"  ✓ MQTT连接成功: {MQTT_HOST}:{MQTT_PORT}")
            connected = True
        else:
            print(f"  ✗ MQTT连接失败: 原因码 {reason_code}")
    
    def on_message(c, userdata, msg):
        print(f"  收到消息: {msg.topic}")
        print(f"  内容: {msg.payload.decode()}")
    
    client.on_connect = on_connect
    client.on_message = on_message
    
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=10)
    client.loop_start()
    
    time.sleep(3)
    
    if not connected:
        print("  ✗ MQTT连接超时")
        sys.exit(1)
    
    client.loop_stop()
    client.disconnect()
    
except Exception as e:
    print(f"  ✗ MQTT连接异常: {e}")
    sys.exit(1)

# 2. 测试TinyTuya导入
print("\n[2] 测试TinyTuya导入...")
try:
    import tinytuya
    print(f"  ✓ TinyTuya版本: {tinytuya.__version__}")
except ImportError as e:
    print(f"  ✗ TinyTuya未安装: {e}")
    print("  安装命令: pip install tinytuya")
    sys.exit(1)

# 3. 测试配置信息
print("\n[3] 检查配置...")
print(f"  MQTT Host: {MQTT_HOST}")
print(f"  MQTT Port: {MQTT_PORT}")
print(f"  MQTT User: {MQTT_USERNAME}")
print(f"  local_key: {TUYA_LOCAL_KEY[:10]}... (已配置)")

if TUYA_LOCAL_KEY == "k[BxEj?<'^;cu|]1":
    print("  ✓ local_key 已正确配置")
else:
    print("  ✗ local_key 可能需要更新")

# 4. 测试MQTT发送命令
print("\n[4] 测试MQTT发送命令...")
try:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-send")
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=10)
    client.loop_start()
    
    time.sleep(1)
    
    # 发送测试命令到室内机16
    test_device = "6c1d7f15376d6f2a82elsf"
    test_topic = f"tuya/device/{test_device}/command"
    test_payload = json.dumps({"switch": False})  # 测试命令（关空调）
    
    result = client.publish(test_topic, test_payload)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"  ✓ 命令发送成功")
        print(f"  主题: {test_topic}")
        print(f"  内容: {test_payload}")
    else:
        print(f"  ✗ 命令发送失败: 错误码 {result.rc}")
    
    client.loop_stop()
    client.disconnect()
    
except Exception as e:
    print(f"  ✗ MQTT发送异常: {e}")

# 5. 扫描本地涂鸦设备（可选）
print("\n[5] 扫描局域网涂鸦设备...")
print("  注意: 此步骤需要服务器在同一局域网内")
try:
    devices = tinytuya.scanDevices(max_attempts=2, timeout=5)
    if devices:
        print(f"  ✓ 发现 {len(devices)} 个设备:")
        for dev in devices:
            print(f"    - ID: {dev.get('id')}")
            print(f"      IP: {dev.get('ip')}")
            print(f"      Name: {dev.get('name', 'Unknown')}")
    else:
        print("  - 未发现设备（可能不在同一局域网）")
        print("  - 这不影响云端MQTT控制功能")
except Exception as e:
    print(f"  - 扫描跳过: {e}")
    print("  - 不在同一局域网，跳过本地扫描")

print("\n" + "=" * 50)
print("测试完成!")
print("=" * 50)
print("\n下一步:")
print("  1. docker build -t tinytuya-controller:latest .")
print("  2. docker run -d --name tinytuya-controller --network host tinytuya-controller:latest")
print("  3. docker logs -f tinytuya-controller")
"""
MQTT 测试脚本 - 测试 MQTT 连接和消息发送
不调用涂鸦设备，只测试 MQTT 通信
"""
import paho.mqtt.client as mqtt
import json
import time
from datetime import datetime

# MQTT 配置
MQTT_HOST = "8.134.248.240"
MQTT_PORT = 1883
MQTT_USERNAME = "admin"
MQTT_PASSWORD = "mms6332628"

# 测试设备ID
DEVICE_ID = "6c1d7f15376d6f2a82elsf"

# 收到的消息
received_messages = []


def on_connect(client, userdata, flags, reason_code, properties):
    if reason_code == 0:
        print(f"✓ MQTT 连接成功: {MQTT_HOST}:{MQTT_PORT}")
        
        # 订阅状态主题
        status_topic = f"tuya/device/{DEVICE_ID}/status"
        client.subscribe(status_topic)
        print(f"✓ 订阅主题: {status_topic}")
    else:
        print(f"✗ MQTT 连接失败，原因码: {reason_code}")


def on_message(client, userdata, msg):
    payload = msg.payload.decode("utf-8")
    print(f"\n收到消息:")
    print(f"  主题: {msg.topic}")
    print(f"  内容: {payload}")
    
    try:
        data = json.loads(payload)
        received_messages.append(data)
    except:
        pass


def test_mqtt_connection():
    """测试 MQTT 连接"""
    print("\n=== 测试 MQTT 连接 ===\n")
    
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-client")
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        time.sleep(2)  # 等待连接
        
        if not client.is_connected():
            print("✗ 连接失败")
            return False
        
        return True
    
    except Exception as e:
        print(f"✗ 连接异常: {e}")
        return False


def test_send_command(switch=True, temp=20, mode="cold"):
    """测试发送控制命令"""
    print(f"\n=== 测试发送命令 ===\n")
    
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="test-pub-client")
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    
    client.on_message = on_message
    
    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_start()
        
        time.sleep(1)
        
        # 订阅状态主题
        status_topic = f"tuya/device/{DEVICE_ID}/status"
        client.subscribe(status_topic)
        
        # 发送命令
        command_topic = f"tuya/device/{DEVICE_ID}/command"
        payload = {
            "switch": switch,
            "temp_set": temp,
            "mode": mode,
            "fan_speed_enum": "auto"
        }
        
        print(f"发送命令:")
        print(f"  主题: {command_topic}")
        print(f"  内容: {json.dumps(payload, ensure_ascii=False)}")
        
        result = client.publish(command_topic, json.dumps(payload))
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print("✓ 命令发送成功")
        else:
            print(f"✗ 命令发送失败，错误码: {result.rc}")
        
        # 等待响应
        print("\n等待状态反馈...")
        time.sleep(5)
        
        if received_messages:
            print(f"\n✓ 收到 {len(received_messages)} 条响应")
        else:
            print("\n⚠ 未收到响应（可能控制器未运行）")
        
        client.loop_stop()
        client.disconnect()
        
    except Exception as e:
        print(f"✗ 测试异常: {e}")


def main():
    print("""
╔═══════════════════════════════════════════════════════════╗
║          MQTT 连接测试工具                                 ║
║     只测试 MQTT 通信，不调用涂鸦设备                        ║
╚═══════════════════════════════════════════════════════════╝
""")
    
    # 测试连接
    if test_mqtt_connection():
        print("\n✓ MQTT 连接测试通过")
        
        # 测试发送命令
        test_send_command(switch=True, temp=20, mode="cold")
    
    else:
        print("\n✗ MQTT 连接测试失败")
        print("\n排查步骤:")
        print("  1. 检查 MQTT 服务器是否运行")
        print("  2. 检查网络连接")
        print("  3. 检查用户名密码")


if __name__ == "__main__":
    main()
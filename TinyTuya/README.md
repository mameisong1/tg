# TinyTuya MQTT Controller

外网控制家庭涂鸦设备，通过 MQTT 消息远程控制空调等智能设备。

## 架构

```
外网设备 → MQTT Broker → Python脚本 → TinyTuya → 涂鸦设备(空调)
                                ↓
                        状态反馈到 MQTT
```

## 快速开始

### 1. 获取涂鸦设备 local_key

**方法一：使用 TinyTuya Wizard**

```bash
# 安装 TinyTuya
pip install tinytuya

# 运行向导（需要涂鸦账号）
python -m tinytuya wizard
```

按提示输入涂鸦账号信息，会自动扫描并显示所有设备的 `local_key`。

**方法二：通过涂鸦云API获取**

参考：https://github.com/jasonacox/tinytuya#get-the-local-key-for-your-devices

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# MQTT 配置
MQTT_HOST=8.134.248.240
MQTT_PORT=1883
MQTT_USERNAME=admin
MQTT_PASSWORD=mms6332628

# 涂鸦设备 local_key（必须）
TUYA_LOCAL_KEY=your_local_key_here

# 设备IP（可选，自动发现）
TUYA_DEVICE_IP=192.168.1.100
```

### 3. Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

### 4. 本地测试

```bash
# 安装依赖
pip install -r requirements.txt

# 运行
python main.py
```

## MQTT 主题

### 订阅主题（发送命令）

```
tuya/device/{device_id}/command
```

消息格式：
```json
{
  "switch": true,
  "temp_set": 20,
  "mode": "cold",
  "fan_speed_enum": "auto"
}
```

### 发布主题（状态反馈）

```
tuya/device/{device_id}/status
```

消息格式：
```json
{
  "success": true,
  "device_name": "空调",
  "params": {"switch": true, "temp_set": 20},
  "timestamp": "2026-04-21T20:30:00"
}
```

## 控制参数

| 参数 | 类型 | 值 |
|------|------|-----|
| `switch` | bool | `true` / `false` |
| `temp_set` | int | 16-30 |
| `mode` | string | `hot` / `cold` / `wind` / `wet` |
| `fan_speed_enum` | string | `auto` / `low` / `middle` / `high` |

## 测试命令

### 使用 MQTT 客户端测试

```bash
# 安装 mosquitto-clients
apt-get install mosquitto-clients

# 开空调
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/6c1d7f15376d6f2a82elsf/command" \
  -m '{"switch": true, "temp_set": 20, "mode": "cold"}'

# 关空调
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/6c1d7f15376d6f2a82elsf/command" \
  -m '{"switch": false}'

# 订阅状态
mosquitto_sub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/+/status"
```

## 故障排除

### 1. 设备未初始化

检查 `local_key` 是否正确：
```bash
python -c "from config import TUYA_DEVICES; print(TUYA_DEVICES)"
```

### 2. 无法连接 MQTT

检查网络和认证：
```bash
mosquitto_sub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 -t "test"
```

### 3. 设备控制失败

检查设备是否在线：
```bash
python -c "
from tuya_controller import controller
import json
print(json.dumps(controller.scan_devices(), indent=2))
"
```

## 文件说明

```
/TG/TinyTuya/
├── main.py              # 主程序入口
├── config.py            # 配置文件
├── tuya_controller.py   # 涂鸦设备控制器
├── mqtt_client.py       # MQTT 客户端
├── requirements.txt     # Python 依赖
├── Dockerfile            # Docker 镜像
├── docker-compose.yml   # Docker 编排
└── README.md             # 使用说明
```

## 注意事项

1. **local_key 是必须的**：TinyTuya 需要设备的 local_key 才能本地控制
2. **局域网访问**：设备需要在同一局域网内，或使用 host 网络模式
3. **设备发现**：首次运行建议扫描设备获取正确的 DPS 映射
4. **调试模式**：设置日志级别为 DEBUG 可查看详细通信过程
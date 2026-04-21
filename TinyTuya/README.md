# 涂鸦云API + MQTT 控制器

外网控制家庭涂鸦设备，通过MQTT消息远程控制空调等智能设备。

## 架构

```
外网设备 → MQTT Broker → Python脚本 → 涂鸦云API → 涂鸦设备(空调)
                                ↓
                        状态反馈到 MQTT
```

**关键区别：使用涂鸦云API而非TinyTuya本地控制**
- ✅ 不需要设备在同一局域网
- ✅ 支持远程控制（服务器在香港，设备在中山）
- ✅ 使用涂鸦开放平台标准API

## 快速开始

### 1. 配置信息

已配置好的凭证：

| 项目 | 值 |
|------|-----|
| **MQTT Host** | 8.134.248.240:1883 |
| **MQTT User** | admin / mms6332628 |
| **涂鸦 Client ID** | ggjpr955fqu5fmytj5cr |
| **涂鸦 Client Secret** | 4d2192515238432f8b3d849656bf3669 |
| **设备 ID** | 6c1d7f15376d6f2a82elsf |

### 2. Docker 部署

```bash
# 构建镜像
cd /TG/TinyTuya && docker build -t tuya-mqtt-controller:latest .

# 启动容器
docker run -d --name tuya-mqtt-controller --restart unless-stopped \
  tuya-mqtt-controller:latest

# 查看日志
docker logs -f tuya-mqtt-controller
```

### 3. 本地测试

```bash
# 测试MQTT连接
docker run --rm tuya-mqtt-controller:latest python test_mqtt.py

# 测试涂鸦API
docker run --rm tuya-mqtt-controller:latest python test_tuya_api.py
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
  "device_name": "空调-室内机16",
  "params": {"switch": true, "temp_set": 20},
  "timestamp": "2026-04-21T21:05:00"
}
```

## 控制参数

| 参数 | 类型 | 值 |
|------|------|-----|
| `switch` | bool | `true` / `false` |
| `temp_set` | int | 16-32 |
| `mode` | string | `hot` / `cold` / `wind` / `wet` |
| `fan_speed_enum` | string | `auto` / `low` / `middle` / `high` |

## 测试命令

### 使用 MQTT 客户端测试

```bash
# 安装 mosquitto-clients
apt-get install mosquitto-clients

# 开空调（制冷模式，20度）
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

## 涂鸦云API

本项目使用涂鸦开放平台API：

- **获取Token**: `GET /v1.0/token?grant_type=1`
- **设备状态**: `GET /v1.0/devices/{device_id}/status`
- **控制设备**: `POST /v2.0/cloud/thing/{device_id}/shadow/properties/issue`

认证方式：HMAC-SHA256签名

## 文件说明

```
/TG/TinyTuya/
├── main.py              # 主程序入口
├── config.py            # 配置文件（含API密钥）
├── tuya_cloud_api.py    # 涂鸦云API控制器
├── mqtt_client.py       # MQTT客户端
├── test_mqtt.py         # MQTT测试脚本
├── test_tuya_api.py     # 涂鸦API测试脚本
├── requirements.txt     # Python依赖
├── Dockerfile           # Docker镜像
└── README.md            # 使用说明
```

## 注意事项

1. **API签名**：涂鸦API需要正确的签名才能访问
2. **Token刷新**：Token有效期约2小时，程序会自动刷新
3. **数据中心**：使用中国数据中心 `openapi.tuyacn.com`
4. **错误处理**：API错误会通过MQTT状态主题反馈
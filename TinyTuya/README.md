# TinyTuya + MQTT 空调控制系统

外网控制天宫国际台球厅涂鸦空调设备。

## 方案架构

```
外网小程序/APP → MQTT Broker → Python脚本 → TinyTuya本地控制 → 涂鸦网关 → 19台空调
                                        ↓
                                状态反馈到 MQTT
```

### 两种控制方式对比

| 方案 | TinyTuya本地控制 | 涂鸦云API控制 |
|------|-----------------|--------------|
| 网络 | 需要局域网内服务器 | 无需局域网，远程可用 |
| 延迟 | 低（本地直连） | 高（云端转发） |
| 依赖 | 涂鸦开放平台账号 | 涂鸦开放平台账号 |
| 稳定性 | 依赖本地网络 | 依赖云端服务 |
| 适用 | **本方案** | README备选方案 |

---

## 设备信息

### 网关设备
- **名称**: 中央空调集控网关
- **型号**: UACC-B-XX-TW
- **ID**: `6cedfa65e9e0d2f95bv8dw`
- **MAC**: 38:a5:c9:14:8f:ac
- **local_key**: `k[BxEj?<'^;cu|]1`

### 室内机（19台子设备）

| 设备名 | 设备ID | node_id |
|--------|--------|---------|
| 室内机1 | 6c6222ab98a674b474wzba | 1 |
| 室内机2 | 6c5f64a1f1c06845480zec | 18 |
| 室内机3 | 6cdf8d7b5b477c0029twev | 17 |
| ... | ... | ... |

所有设备共享同一个 **local_key**: `k[BxEj?<'^;cu|]1`

---

## 控制参数

| 参数 | DPS | 类型 | 值范围 | 说明 |
|------|-----|------|--------|------|
| `switch` | 1 | bool | true/false | 开关 |
| `temp_set` | 2 | int | 16-32°C | 设定温度 |
| `temp_current` | 3 | int | -99~99°C | 当前温度 |
| `mode` | 4 | enum | hot/cold/wind/wet | 工作模式 |
| `fan_speed_enum` | 5 | enum | auto/low/middle/high | 风速 |

---

## MQTT 通信

### MQTT Broker配置

```
Host: 8.134.248.240
Port: 1883
Username: admin
Password: mms6332628
```

### 主题设计

**发送命令**（订阅）:
```
tuya/device/{device_id}/command
```

消息示例：
```json
{
  "switch": true,
  "temp_set": 24,
  "mode": "cold",
  "fan_speed_enum": "auto"
}
```

**状态反馈**（发布）:
```
tuya/device/{device_id}/status
```

消息示例：
```json
{
  "success": true,
  "device_name": "室内机16",
  "params": {"switch": true, "temp_set": 24},
  "timestamp": "2026-04-22T10:00:00"
}
```

---

## Docker 部署

### 构建镜像

```bash
cd /TG/TinyTuya && docker build -t tinytuya-controller:latest .
```

### 启动容器

```bash
docker run -d \
  --name tinytuya-controller \
  --restart unless-stopped \
  --network host \
  tinytuya-controller:latest
```

**注意**: 使用 `--network host` 模式，确保容器能访问局域网内的涂鸦设备。

### 查看日志

```bash
docker logs -f tinytuya-controller
```

---

## 测试命令

### 测试MQTT连接

```bash
docker exec tinytuya-controller python test_mqtt.py
```

### 使用mosquitto_pub发送控制命令

```bash
# 安装mosquitto-clients（如果没有）
apt-get install mosquitto-clients

# 开空调（室内机16，制冷24度）
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/6c1d7f15376d6f2a82elsf/command" \
  -m '{"switch": true, "temp_set": 24, "mode": "cold"}'

# 关空调
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/6c1d7f15376d6f2a82elsf/command" \
  -m '{"switch": false}'

# 订阅状态反馈
mosquitto_sub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t "tuya/device/+/status" -v
```

---

## 扫描设备IP

如果网关IP未知，运行扫描：

```bash
docker exec tinytuya-controller python -c "from tuya_controller import controller; controller.scan_devices()"
```

或使用 TinyTuya Wizard：

```bash
pip install tinytuya
python -m tinytuya wizard
```

---

## 文件结构

```
/TG/TinyTuya/
├── main.py              # 主程序入口
├── config.py            # 配置（设备列表、MQTT、local_key）
├── tuya_controller.py   # TinyTuya本地控制器
├── mqtt_client.py       # MQTT客户端
├── tuya_cloud_api.py    # 涂鸦云API控制器（备选方案）
├── test_mqtt.py         # MQTT连接测试
├── test_tuya_api.py     # 涂鸦API测试
├── scan_devices.py      # 设备扫描脚本
├── requirements.txt     # Python依赖
├── Dockerfile           # Docker镜像
├── docker-compose.yml   # Docker Compose配置
└── README.md            # 使用说明
```

---

## 常见问题

### 1. 控制失败：设备未初始化

**原因**: 网关IP未找到或local_key错误

**解决**:
```bash
# 扫描设备获取IP
python scan_devices.py

# 检查local_key
# 在config.py中确认 TUYA_LOCAL_KEY = "k[BxEj?<'^;cu|]1"
```

### 2. MQTT连接失败

**检查**:
```bash
# 测试MQTT服务器连通性
mosquitto_sub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 -t "test"
```

### 3. 子设备控制无响应

**原因**: 子设备需要通过网关控制，网关必须在线

**检查**: 网关设备状态和IP地址

---

## 小程序集成示例

在天宫国际小程序中集成MQTT控制：

```javascript
// 使用 mqtt.js 库
const mqtt = require('mqtt')

// 连接MQTT服务器
const client = mqtt.connect('mqtt://8.134.248.240:1883', {
  username: 'admin',
  password: 'mms6332628'
})

// 发送控制命令
client.publish('tuya/device/6c1d7f15376d6f2a82elsf/command', 
  JSON.stringify({switch: true, temp_set: 24, mode: 'cold'}))

// 接收状态反馈
client.subscribe('tuya/device/+/status')
client.on('message', (topic, message) => {
  console.log('状态:', JSON.parse(message.toString()))
})
```

---

## 安全建议

1. MQTT密码建议使用环境变量而非硬编码
2. local_key 属于敏感信息，建议存储在 `.env` 文件中
3. 生产环境建议启用MQTT TLS加密
4. 定期更换MQTT密码

---

## 更新记录

- 2026-04-22: 添加19台室内机完整配置，使用共享local_key
- 2026-04-21: 初始版本，基础TinyTuya + MQTT架构
# 中山台球厅空调控制系统部署指南

## 系统架构

```
中山台球厅局域网:
┌─────────────────────────────────────────────────┐
│  Docker容器 (tinytuya-controller)               │
│  ├── TinyTuya本地控制                           │
│  ├── MQTT客户端 (连接外网8.134.248.240)         │
│  └── Python主程序                               │
└─────────────────────────────────────────────────┘
         │                        │
         │ 本地控制               │ MQTT订阅
         ▼                        ▼
┌─────────────────┐      ┌─────────────────────┐
│ 涂鸦网关        │      │ 外网MQTT服务器      │
│ UACC-B-XX-TW    │      │ 8.134.248.240:1883  │
│ (中央空调集控)  │      │                     │
└─────────────────┘      └─────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────────┐
│ 19台室内机      │      │ 小程序/APP          │
│ (空调末端)      │      │ (发送控制命令)      │
└─────────────────┘      └─────────────────────┘
```

---

## 部署步骤

### 1. 导入Docker镜像

```bash
# 加载镜像文件
docker load -i tinytuya-controller.tar

# 验证镜像
docker images | grep tinytuya
```

### 2. 启动服务

**方式A：使用启动脚本**
```bash
chmod +x start.sh
./start.sh
```

**方式B：手动启动**
```bash
docker run -d \
    --name tinytuya-controller \
    --restart unless-stopped \
    --network host \
    tinytuya-controller:latest
```

### 3. 查看日志

```bash
docker logs -f tinytuya-controller
```

**正常启动日志示例：**
```
╔═══════════════════════════════════════════════════════════╗
║       TinyTuya + MQTT 空调控制系统                        ║
║       天宫国际台球厅 - 19台空调远程控制                    ║
╚═══════════════════════════════════════════════════════════╝

MQTT服务器: 8.134.248.240:1883
注册设备: 19 个
配置检查通过 ✓
...
MQTT 连接成功: 8.134.248.240:1883
订阅主题: tuya/device/+/command
```

### 4. 扫描网关设备（首次部署）

```bash
docker exec tinytuya-controller python scan_devices.py
```

**输出示例：**
```
发现 5 个设备:
ID: 6cedfa65e9e0d2f95bv8dw [★ 网关设备]
  IP: 192.168.1.100
  Name: 中央空调集控网关
...
网关IP已保存到: /app/logs/gateway_ip.txt
```

---

## 测试控制

### 发送MQTT控制命令

使用MQTT客户端或小程序发送命令：

```json
主题: tuya/device/{设备ID}/command

消息内容:
{
  "switch": true,      // 开空调
  "temp_set": 24,      // 温度24度
  "mode": "cold",      // 制冷模式
  "fan_speed_enum": "auto"  // 自动风速
}
```

### Python测试命令

```python
import json, paho.mqtt.client as mqtt

client = mqtt.Client()
client.username_pw_set("admin", "mms6332628")
client.connect("8.134.248.240", 1883)

# 控制室内机16（设备ID: 6c1d7f15376d6f2a82elsf）
topic = "tuya/device/6c1d7f15376d6f2a82elsf/command"
payload = json.dumps({"switch": True, "temp_set": 24, "mode": "cold"})
client.publish(topic, payload)
```

---

## 设备清单

### 网关设备
- **ID**: `6cedfa65e9e0d2f95bv8dw`
- **型号**: UACC-B-XX-TW
- **local_key**: `k[BxEj?<'^;cu|]1`

### 室内机（18台）

| 名称 | 设备ID | node_id |
|------|--------|---------|
| 室内机1 | 6c6222ab98a674b474wzba | 1 |
| 室内机2 | 6c5f64a1f1c06845480zec | 18 |
| 室内机3 | 6cdf8d7b5b477c0029twev | 17 |
| ... | ... | ... |
| 室内机16 | 6c1d7f15376d6f2a82elsf | 3 |
| 室内机18 | 6cd1fa5d89f77a12bblxf8 | 2 |

---

## 控制参数

| 参数 | DPS | 类型 | 值 |
|------|-----|------|-----|
| `switch` | 1 | bool | true/false |
| `temp_set` | 2 | int | 16-32 |
| `mode` | 4 | string | hot/cold/wind/wet |
| `fan_speed_enum` | 5 | string | auto/low/middle/high |

---

## 常见问题

### 1. MQTT连接失败

**检查项**:
- 中山台球厅网络是否正常
- 能否访问 8.134.248.240:1883
- MQTT用户名密码是否正确

**测试命令**:
```bash
docker exec tinytuya-controller python test_connection.py
```

### 2. 无法控制空调

**原因**: 网关IP未发现或配置错误

**解决**:
```bash
# 扫描网关
docker exec tinytuya-controller python scan_devices.py

# 查看网关IP
docker exec tinytuya-controller cat /app/logs/gateway_ip.txt
```

### 3. 设备无响应

**检查项**:
- 网关设备是否在线
- local_key是否正确
- 设备ID是否匹配

---

## 服务管理

```bash
# 查看日志
docker logs -f tinytuya-controller

# 停止服务
docker stop tinytuya-controller

# 启动服务
docker start tinytuya-controller

# 重启服务
docker restart tinytuya-controller

# 删除容器
docker rm -f tinytuya-controller
```

---

## 文件结构

```
tinytuya-controller/
├── config.py            # 配置文件（设备列表、MQTT、local_key）
├── main.py              # 主程序入口
├── tuya_controller.py   # TinyTuya本地控制器
├── mqtt_client.py       # MQTT客户端
├── scan_devices.py      # 设备扫描脚本
├── test_connection.py   # 连接测试脚本
├── requirements.txt     # Python依赖
├── Dockerfile           # Docker镜像构建
├── start.sh             # 启动脚本
├── DEPLOY.md            # 部署说明
└── README.md            # 项目说明
```

---

## 更新记录

- 2026-04-22: 完善本地控制逻辑，添加设备扫描功能
- 2026-04-21: 初始版本
# 添加新网关配置指南

## 配置方式

### 方式1：环境变量（推荐）

启动容器时设置环境变量：

```bash
# 网关1（必配）
export GATEWAY_1_IP=192.168.110.10
export GATEWAY_1_KEY="k[BxEj?<'^;cu|]1"

# 网关2（新增）
export GATEWAY_2_IP=192.168.110.11
export GATEWAY_2_KEY="新的local_key"

# 启动
./start.sh
```

或直接在命令中指定：

```bash
docker run -d \
  --name tinytuya-controller \
  --restart unless-stopped \
  --network host \
  -e GATEWAY_1_IP=192.168.110.10 \
  -e GATEWAY_1_KEY="k[BxEj?<'^;cu|]1" \
  -e GATEWAY_2_IP=192.168.110.11 \
  -e GATEWAY_2_KEY="新网关的key" \
  tinytuya-controller:latest
```

---

### 方式2：修改 config.py

编辑 `/TG/TinyTuya/config.py` 文件：

```python
GATEWAYS = {
    # 网关1（已有）
    "6cedfa65e9e0d2f95bv8dw": {
        "name": "中央空调网关-包房",
        "ip": "192.168.110.10",
        "local_key": "k[BxEj?<'^;cu|]1",
        ...
    },
    
    # 网关2（新增）
    "新网关ID": {
        "name": "中央空调网关-大堂",
        "ip": "192.168.110.11",
        "local_key": "新网关的local_key",
        "model": "UACC-B-XX-TW",
        "version": 3.3,
    },
}

# 子设备也要指定所属网关
SUB_DEVICES = {
    ...
    # 新网关的子设备
    "新设备ID": {
        "name": "室内机19",
        "node_id": "1",
        "gateway_id": "新网关ID",  # 指向新网关
        "local_key": None,  # 继承网关key
        "model": "UACC-B-XX-TW-N",
    },
}
```

修改后重新构建镜像：

```bash
docker build -t tinytuya-controller:latest .
docker restart tinytuya-controller
```

---

## 查看当前配置

```bash
docker exec tinytuya-controller python -c 'from config import print_config_summary; print_config_summary()'
```

**输出示例**：
```
网关数量: 2
  - 中央空调网关-包房 (ID: 6cedfa65e9e0d2f95bv8dw)
    IP: 192.168.110.10
    local_key: k[BxEj?<'^;cu...
    子设备: 18 台
  - 中央空调网关-大堂 (ID: 新网关ID)
    IP: 192.168.110.11
    local_key: 新key...
    子设备: 10 台

子设备总数: 28
```

---

## 获取新网关信息

### 1. 扫描发现

```bash
docker exec tinytuya-controller python scan_devices.py
```

### 2. 涂鸦智能App

- 打开涂鸦智能App
- 进入网关设备详情
- 查看：
  - 设备ID
  - IP地址
  - local_key（需要从涂鸦开放平台获取）

### 3. 涂鸦开放平台

1. 登录 https://iot.tuya.com
2. 进入项目 → 设备管理
3. 找到网关设备
4. 获取设备ID和local_key

---

## 多网关架构

```
┌─────────────────────────────────────────────────────┐
│              TinyTuya Controller                     │
│  ┌─────────────┐  ┌─────────────┐                   │
│  │ 网关1连接   │  │ 网关2连接   │  ...              │
│  │ 包房区域    │  │ 大堂区域    │                   │
│  └─────────────┘  └─────────────┘                   │
└─────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ 网关1 (包房)    │  │ 网关2 (大堂)    │
│ 18台室内机      │  │ 10台室内机      │
└─────────────────┘  └─────────────────┘
```

---

## 子设备归属规则

每个子设备必须指定 `gateway_id`：

| 字段 | 说明 |
|------|------|
| `gateway_id` | 所属网关的设备ID |
| `local_key` | 子设备key（None=继承网关key） |
| `node_id` | 子设备在网关中的编号 |

---

## 测试新网关

```bash
# 查看网关状态
docker exec tinytuya-controller python -c "
from tuya_controller import controller
print(controller.get_gateway_status_summary())
"

# 测试子设备控制
docker exec tinytuya-controller python -c "
from tuya_controller import controller
result = controller.control('新设备ID', {'switch': True, 'temp_set': 24})
print(result)
"
```
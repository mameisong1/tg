# TinyTuya + MQTT 空调控制系统

## ✅ 已验证可行

使用 **cid方式** 控制网关子设备，已成功验证。

---

## MQTT 通信

### 订阅主题

```
tiangongguojikongtiao
```

### 消息格式

```json
{
  "node_id": "3",           // 子设备编号（必填）
  "switch": true,           // 开关：true/false
  "temp_set": 24,           // 温度：16-32
  "mode": "cold",           // 模式：hot/cold/wind/wet
  "fan_speed_enum": "auto"  // 风速：auto/low/middle/high
}
```

### 响应主题

```
tiangongguojikongtiao/response
```

### 响应格式

```json
{
  "success": true,
  "node_id": "3",
  "params": {"switch": true, "temp_set": 24},
  "timestamp": "2026-04-22T18:00:00"
}
```

---

## 控制参数说明

| 参数 | DPS | 类型 | 范围 | 说明 |
|------|-----|------|------|------|
| `switch` | 1 | bool | true/false | 开关 |
| `temp_set` | 2 | int | 16-32 | 设定温度 |
| `temp_current` | 3 | int | -99~99 | 当前温度（只读） |
| `mode` | 4 | str | hot/cold/wind/wet | 工作模式 |
| `fan_speed_enum` | 5 | str | auto/low/middle/high | 风速 |

---

## 子设备编号对照表

| node_id | 设备名称 | 设备ID |
|---------|---------|--------|
| 1 | 室内机1 | 6c6222ab98a674b474wzba |
| 2 | 室内机18 | 6cd1fa5d89f77a12bblxf8 |
| 3 | 室内机16 ★ | 6c1d7f15376d6f2a82elsf |
| 4 | 室内机16-WiFi | 6cfb71b5aaa54daae8swgo |
| 5 | 室内机15 | 6c9a267a8af9044c5cmlou |
| 6 | 室内机14 | 6cc27f00393cee54ccmgey |
| 7 | 室内机13 | 6c84ec9582a300a32dirox |
| 8 | 室内机12 | 6cdbd07fefe5d7dc78qe0t |
| 9 | 室内机11 | 6cbbba7716ddafbac1mmlw |
| 10 | 室内机10 | 6cb4c1d32e37da7974akjt |
| 11 | 室内机9 | 6cd285cec9884dd573y891 |
| 12 | 室内机8 | 6c080de917e5874cadnyr8 |
| 13 | 室内机7 | 6cd30259b2300268eak3hi |
| 14 | 室内机6 | 6ce46f266709a6bb72iwvo |
| 15 | 室内机5 | 6c793e4c179e36f8c78o6c |
| 16 | 室内机4 | 6cd5d312f1477108c5oakp |
| 17 | 室内机3 | 6cdf8d7b5b477c0029twev |
| 18 | 室内机2 | 6c5f64a1f1c06845480zec |

---

## 部署步骤

### 1. 加载Docker镜像

```bash
docker load -i tinytuya-controller.tar.gz
```

### 2. 启动服务

```bash
# 设置网关IP（可选，默认192.168.110.62）
export GATEWAY_IP=你的网关IP

# 启动
./start.sh
```

### 3. 查看日志

```bash
docker logs -f tinytuya-controller
```

---

## 测试命令

### 开空调（node_id=3）

```bash
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t tiangongguojikongtiao \
  -m '{"node_id":"3","switch":true,"temp_set":24,"mode":"cold"}'
```

### 关空调

```bash
mosquitto_pub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t tiangongguojikongtiao \
  -m '{"node_id":"3","switch":false}'
```

### 订阅响应

```bash
mosquitto_sub -h 8.134.248.240 -p 1883 -u admin -P mms6332628 \
  -t tiangongguojikongtiao/response -v
```

---

## 网关配置

| 项目 | 值 |
|------|-----|
| 网关ID | 6cedfa65e9e0d2f95bv8dw |
| 网关IP | 192.168.110.62 |
| local_key | k[BxEj?<'^;cu|]1 |
| 协议版本 | 3.3 |

---

## 工作模式说明

| mode值 | 中文 | 说明 |
|--------|------|------|
| hot | 制热 | 加热模式 |
| cold | 制冷 | 冷却模式 |
| wind | 送风 | 仅送风，不制冷/制热 |
| wet | 除湿 | 除湿模式 |

---

## 风速说明

| fan_speed_enum值 | 中文 |
|-------------------|------|
| auto | 自动 |
| low | 低速 |
| middle | 中速 |
| high | 高速 |

---

## 更新记录

- 2026-04-22: 验证cid方式可行，更新MQTT订阅格式
- 2026-04-21: 初始版本
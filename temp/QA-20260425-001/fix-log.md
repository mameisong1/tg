# 修复记录 - QA-20260425-001 空调控制功能适配

## 修复时间
2026-04-25 22:30 ~ 23:00 GMT+8

## 修复人
程序员A（Coder-tg 子代理）

## Git 提交
- **tgservice 后端**: `257a7ff` feat: 空调控制功能适配
- **tgservice-uniapp 前端**: `4893a46` feat: 新增智能空调管理页面
- 均已 push 到 GitHub master

---

## 修改清单

### 后端新增文件

| 文件 | 说明 | 行数 |
|------|------|------|
| `backend/services/mqtt-ac.js` | 空调MQTT控制模块，包含开/关空调指令发送、批量控制、按标签/台桌控制 | ~250行 |
| `backend/services/auto-off-ac.js` | 自动关空调服务，支持跨午夜时间判断、台桌相关+台桌无关两种模式 | ~130行 |
| `backend/routes/ac-routes.js` | 空调控制API路由，18个API（设备管理CRUD、场景管理CRUD、前台控制） | ~500行 |

### 后端修改文件

| 文件 | 修改内容 |
|------|---------|
| `backend/server.js` | 导入 acRouter 并挂载到 `/api` 路由下（authMiddleware 之后） |
| `backend/routes/switch-routes.js` | `/api/switch/labels` 加 `device_type="灯"` 筛选；`/api/switch/scenes` 加 `device_type="灯"` 筛选；`/api/switch/tables` JOIN 加 `sd.device_type="灯"` |
| `backend/services/auto-off-lighting.js` | 3处 SQL 查询加 `sd.device_type='灯'` 筛选 |
| `backend/services/mqtt-switch.js` | `controlByLabel` 和 `controlByTable` 查询加 `device_type="灯"` 筛选 |

### 前端新增文件

| 文件 | 说明 |
|------|------|
| `src/pages/internal/ac-control.vue` | 智能空调管理页面，包含快捷场景、智能省电、台桌控制、标签控制 |

### 前端修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/pages.json` | 新增 `pages/internal/ac-control` 路由 |
| `src/pages/member/member.vue` | 管理功能板块新增「智能空调」入口（❄️图标） |

### 配置文件

| 文件 | 修改内容 |
|------|---------|
| `backend/.config.env` | 新增 `mqtt_ac` 配置（topic: tiangongguojikongtiao） |

---

## 关键设计决策

### 1. MQTT 指令格式
- **关空调**: `{dev_id, node_id, switch: false}` → Topic: `tiangongguojikongtiao`
- **开空调**: `{dev_id, node_id, switch: true, temp_set, mode:"cold", fan_speed_enum}` → Topic: `tiangongguojikongtiao`

### 2. 测试环境安全
- 所有 MQTT 发送函数在测试环境（`env.name === 'test'`）**只写日志，不发送真实指令**
- 日志格式: `[MQTT-AC][测试环境] 跳过真实发送: ${dev_id} ${node_id} OFF`

### 3. 设备类型筛选
- 灯控制: 所有查询加 `device_type = "灯"` 筛选
- 空调控制: 所有查询加 `device_type = "空调"` 筛选
- 防止灯和空调数据互相干扰

### 4. 空调配置
- 从 `system_config` 表读取 `ac_control` 键
- 默认配置: `{temp_set: 23, fan_speed_enum: 'auto'}`
- 温度范围: 16-30℃，风速: auto/low/middle/high

### 5. 自动关空调
- 检查 `system_settings` 表中 `ac_auto_off_enabled` 键
- 逻辑: 可能要关的空调 - 不能关的空调 = 要关的空调
- 支持台桌相关和台桌无关两种模式

---

## API 清单（空调新增 18 个）

### 后台管理 API（/api/admin/）
| API | 方法 | 用途 |
|-----|------|------|
| `/admin/ac-devices` | GET | 获取空调设备列表 |
| `/admin/ac-devices` | POST | 新增空调设备 |
| `/admin/ac-devices/:id` | PUT | 更新空调设备 |
| `/admin/ac-devices/:id` | DELETE | 删除空调设备 |
| `/admin/ac-scenes` | GET | 获取空调场景列表 |
| `/admin/ac-scenes` | POST | 新增空调场景 |
| `/admin/ac-scenes/:id` | PUT | 更新空调场景 |
| `/admin/ac-scenes/:id` | DELETE | 删除空调场景 |

### 前台控制 API（/api/ac/）
| API | 方法 | 用途 |
|-----|------|------|
| `/ac/auto-status` | GET | 获取自动关空调状态 |
| `/ac/auto-off-toggle` | POST | 切换自动关空调启停 |
| `/ac/auto-off-manual` | POST | 手动执行一次自动关空调 |
| `/ac/scene/:id` | POST | 执行空调场景 |
| `/ac/label-control` | POST | 按标签批量控制空调 |
| `/ac/labels` | GET | 获取空调标签列表 |
| `/ac/scenes` | GET | 获取空调场景列表 |
| `/ac/tables` | GET | 获取台桌列表及关联空调 |
| `/ac/table-control` | POST | 按台桌控制空调 |

---

## 编码规范遵守情况

| 规范 | 状态 |
|------|------|
| 时间: 使用 TimeUtil.nowDB() | ✅ |
| 数据库: 使用 {all, get, run, runInTransaction, enqueueRun} | ✅ |
| 写入: 使用 runInTransaction 或 enqueueRun | ✅ |
| 禁止: datetime('now') | ✅ 未使用 |
| 禁止: new sqlite3.Database() | ✅ 未使用 |
| 禁止: 裸开事务 | ✅ 使用 runInTransaction |
| 页面: 禁止显示 coach_no | ✅ 前端未引用 |
| MQTT: 测试环境只写日志 | ✅ 所有发送函数检查 isTestEnv |

---

## 待测试事项

1. 空调设备 CRUD 功能
2. 空调场景管理
3. 前台空调控制（场景/标签/台桌）
4. 自动关空调功能
5. 灯控制 device_type 筛选是否正确（不返回空调数据）

# 设计稿：需求1 - 台桌号有效期从30分钟改为10分钟

> 设计者：程序员A1 | 日期：2026-04-14 | 需求来源：QA0414

---

## 一、现有架构分析

### 1.1 数据流

```
配置文件(.config) → server.js启动时读取 → /api/front-config 接口返回
                                                    ↓
                                          TableInfo.vue 组件加载
                                                    ↓
                                localStorage 中 tableAuth.time + 有效期 对比当前时间
                                                    ↓
                                    tableStatus: 'valid' | 'expired' | 'empty'
```

### 1.2 涉及的文件

| 文件 | 作用 | 与有效期的关系 |
|------|------|----------------|
| `/TG/tgservice/.config` | **生产环境配置文件** | 定义 `tableAuth.expireMinutes: 30`，是有效期的唯一源头 |
| `/TG/tgservice/.config.env` | 测试环境配置文件 | 定义 `tableAuth.expireMinutes: 5`，**无需修改** |
| `/TG/tgservice/backend/server.js` | 后端服务 | 第396行读取 `config.tableAuth?.expireMinutes`，通过 `/api/front-config` 接口返回给前端 |
| `/TG/tgservice-uniapp/src/components/TableInfo.vue` | 前端台桌信息组件 | 第50行默认值30分钟、第112行从后端接口获取并更新、第71行用此值判断授权是否过期 |
| `/TG/tgservice-uniapp/src/App.vue` | 前端应用入口 | 第119-127行扫码时将 `Date.now()` 写入 `tableAuth.time`，作为过期计算的基准时间 |

---

## 二、需要修改的文件

### 修改1：生产环境配置文件（唯一需要修改的位置）

**文件路径**：`/TG/tgservice/.config`

**修改理由**：这是生产环境台桌授权有效期的唯一数据源。后端启动时从此文件读取 `expireMinutes`，前端通过 `/api/front-config` 接口动态获取此值。

**旧代码（第74-76行）**：
```json
  "tableAuth": {
    "expireMinutes": 30,
    "_comment": "台桌扫码授权有效期（分钟）。测试环境建议5分钟，生产环境建议30分钟"
  },
```

**新代码**：
```json
  "tableAuth": {
    "expireMinutes": 10,
    "_comment": "台桌扫码授权有效期（分钟）。测试环境建议5分钟，生产环境建议10分钟"
  },
```

**变更说明**：
- 仅修改两处数字：`30` → `10`，注释中 `30` → `10`
- 测试环境配置文件 `.config.env` 保持 `5` 不变

---

## 三、无需修改的文件（说明原因）

### 3.1 `/TG/tgservice/backend/server.js` — 无需修改

```javascript
// 第396行：config.tableAuth?.expireMinutes || 30
```
该行从配置文件动态读取值，配置改为10后自动生效。fallback `|| 30` 是防御性默认值，当配置文件缺少 `tableAuth` 字段时兜底，**不需要改**（且兜底值与需求无关，因为配置文件始终存在）。

### 3.2 `/TG/tgservice-uniapp/src/components/TableInfo.vue` — 无需修改

```javascript
// 第50行：const tableAuthExpireMinutes = ref(30) // 默认30分钟，可从后端获取
// 第111-112行：从后端接口获取并覆盖
if (data.tableAuthExpireMinutes) {
  tableAuthExpireMinutes.value = data.tableAuthExpireMinutes
}
```
- 第50行的 `30` 只是一个**本地默认值**（接口获取失败时的兜底）
- 正常情况下，组件在 `onMounted` 时会先调用 `loadFrontConfig()` 从后端获取真实值并覆盖默认值
- 即使兜底场景触发（接口失败），30分钟的兜底只是临时保护，不影响核心功能
- **建议不修改**，理由见"潜在风险"部分

### 3.3 `/TG/tgservice-uniapp/src/App.vue` — 无需修改

App.vue 只负责在扫码时写入 `tableAuth.time = Date.now()`，不涉及有效期计算。过期判断完全由 `TableInfo.vue` 负责。

---

## 四、生效方式

### 4.1 后端生效

修改 `.config` 文件后，**必须重启后端服务**才能生效，因为配置在 `server.js` 启动时一次性读取（server.js 第101行）：

```javascript
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
```

配置不是热加载的，进程运行期间不会重新读取配置文件。

### 4.2 前端生效

- **新页面/新会话**：前端每次进入时调用 `/api/front-config`，自动获取最新值
- **已在页面中的用户**：如果用户已经打开页面且在有效期内，不会主动刷新配置。但当页面重新加载（刷新/进入其他页面再回来）时会重新获取

---

## 五、潜在风险和注意事项

### 5.1 线上用户已存在的 tableAuth 记录

**风险**：修改配置前已经扫码的用户，其 `tableAuth.time` 记录的时间戳不会改变。

**影响分析**：
- 如果某用户5分钟前扫的码，旧规则下还能用25分钟，新规则下5分钟后即过期
- 这属于**预期行为**：有效期缩短后，已授权用户会在更短的时间内过期
- **无需额外处理**：`TableInfo.vue` 的 `checkAuth()` 函数每次加载页面都会重新计算，`Date.now() - auth.time > new_expire * 60 * 1000`，自动适应新值

### 5.2 前端默认值30分钟的兜底

**场景**：如果 `/api/front-config` 接口返回失败（网络问题/后端异常），`TableInfo.vue` 会使用默认值30分钟。

**建议**：
- **当前不改**：兜底值只是临时保护，接口恢复后会自动修正。改为10的兜底意义不大。
- 如果希望严格兜底也为10分钟，可额外修改 `TableInfo.vue` 第50行：
  ```javascript
  const tableAuthExpireMinutes = ref(10) // 默认10分钟，可从后端获取
  ```
  但这是一个**可选的防御性修改**，不影响核心功能。

### 5.3 用户体验影响

- 有效期从30分钟缩短到10分钟，意味着用户在台球厅期间可能需要**重新扫码的频率更高**
- 如果用户离店10分钟以上再回来，需要重新扫码
- 建议在H5页面过期提示文案中说明原因（当前已有"台桌授权已过期，请用手机相机重新扫码"提示）

### 5.4 小程序端不受影响

`TableInfo.vue` 第98-99行：
```javascript
// #ifndef H5
tableAuthExpired.value = false // 小程序不过期
// #endif
```
小程序端不过期检查，此修改仅影响H5端。

### 5.5 部署注意事项

修改 `.config` 后：
- **生产环境**：需要重启 Docker 容器 `docker restart tgservice`（⚠️ 需用户确认）
- **测试环境**：需要重启 PM2 进程 `pm2 restart tgservice-dev`
- 重启前确保代码已提交到 Git

---

## 六、修改总结

| 序号 | 文件 | 修改内容 | 类型 | 优先级 |
|------|------|----------|------|--------|
| 1 | `/TG/tgservice/.config` | `expireMinutes: 30` → `expireMinutes: 10`，更新注释 | **必须修改** | P0 |
| 2 | `TableInfo.vue` 第50行 | 默认值 `30` → `10` | 可选（防御性） | P2 |

**核心修改只有1处**：配置文件 `.config` 中的 `expireMinutes` 从 `30` 改为 `10`。其余代码通过动态读取配置自动适配。

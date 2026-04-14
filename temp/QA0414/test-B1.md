# 测试用例 - 需求1：生产环境台桌号有效期从30分钟改为10分钟

> 测试员：B1 | 日期：2026-04-14 | 对应设计稿：design-A1.md

---

## 配置验证

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-01 | 生产环境配置文件 expireMinutes 验证 | 生产环境配置文件 `/TG/tgservice/.config` 存在且未被修改 | 1. 打开 `/TG/tgservice/.config`<br>2. 搜索 `tableAuth` 配置块<br>3. 检查 `expireMinutes` 的值 | `expireMinutes` 值为 `10`，注释中写明"生产环境建议10分钟" | 待执行 |
| TC1-02 | 测试环境配置文件 expireMinutes 隔离验证 | 测试环境配置文件 `/TG/tgservice/.config.env` 存在 | 1. 打开 `/TG/tgservice/.config.env`<br>2. 搜索 `tableAuth` 配置块<br>3. 检查 `expireMinutes` 的值 | `expireMinutes` 值仍为 `5`，未被修改，测试环境不受影响 | 待执行 |
| TC1-03 | 后端 /api/front-config 接口返回值验证 | 生产环境 Docker 容器已重启（`docker restart tgservice`），后端进程重新加载了配置 | 1. 执行 `curl https://www.tiangong.club/api/front-config`<br>2. 解析返回 JSON 中的 `tableAuthExpireMinutes` 字段 | 返回值为 `10`（而非 `30`） | 待执行 |

---

## 功能测试

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-04 | 扫码台桌号后授权有效期验证（H5端） | 1. 生产环境已重启并生效<br>2. 用户未扫码，localStorage 中无 `tableAuth` 记录<br>3. 使用手机浏览器访问 `https://www.tiangong.club` | 1. 用手机扫描台桌二维码<br>2. 扫码成功后页面跳转并记录 `tableAuth.time = Date.now()`<br>3. 打开浏览器开发者工具 → Application → Local Storage<br>4. 查看 `tableAuth` 中的 `time` 值和后端返回的 `tableAuthExpireMinutes`<br>5. 等待 5 分钟，刷新页面 | 1. `tableAuth` 正确写入，包含 `tableName`、`tableId`、`time`<br>2. 前端 `tableAuthExpireMinutes` 值为 `10`（来自 `/api/front-config` 接口）<br>3. 5分钟后刷新页面，`tableStatus` 仍为 `valid`（台桌授权有效） | 待执行 |
| TC1-05 | 前端默认值兜底场景（接口异常） | 1. 生产环境后端服务异常或网络中断<br>2. `/api/front-config` 接口不可达 | 1. 用户扫码进入 H5 页面<br>2. 在浏览器控制台执行 `uni.getStorageSync('tableAuth')`<br>3. 检查 `TableInfo.vue` 中 `tableAuthExpireMinutes` 的值 | `tableAuthExpireMinutes` 回退为默认值 `30`（TableInfo.vue 第50行初始值，**当前代码仍为30，未改为10**），页面仍可正常使用但有效期兜底为30分钟。<br>**注：此预期仅在「后端接口异常且前端默认值未修改为10」的情况下成立。若后续将默认值改为10，则兜底为10分钟。** | 待执行 |

---

## 过期测试

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-06 | 超过10分钟后台桌号过期验证 | 1. 生产环境已生效<br>2. 用户刚完成扫码，`tableAuth.time` 已写入 localStorage<br>3. 使用手机浏览器 | 1. 扫码成功后记录当前时间 T0<br>2. 等待 11 分钟（T0 + 11min）<br>3. 刷新页面或切换到其他页面后再返回<br>4. 观察台桌状态显示 | 1. `checkAuth()` 计算：`(Date.now() - auth.time) > 10 * 60 * 1000` → `true`<br>2. `tableAuthExpired` 变为 `true`<br>3. 页面显示"台桌授权已过期，请用手机相机重新扫码"<br>4. `tableStatus` 为 `'expired'` | 待执行 |

---

## 边界测试

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-07 | 9分钟时台桌号仍有效（边界内） | 1. 生产环境已生效<br>2. 用户刚完成扫码，`tableAuth.time` 已写入 | 1. 扫码成功后记录当前时间 T0<br>2. 等待 9 分钟（T0 + 9min）<br>3. 刷新页面<br>4. 检查台桌状态 | 1. `checkAuth()` 计算：`(Date.now() - auth.time) = 9min < 10min` → 未过期<br>2. `tableAuthExpired` 为 `false`<br>3. 台桌状态为 `valid`，可正常显示台桌信息 | 待执行 |
| TC1-08 | 10分钟整点边界验证 | 1. 生产环境已生效<br>2. 用户刚完成扫码，`tableAuth.time` 已写入 | 1. 扫码成功后记录当前时间 T0<br>2. 在 T0 + 10min 整点（尽可能精确）刷新页面<br>3. 检查台桌状态 | 1. `checkAuth()` 计算：`(Date.now() - auth.time) === 10 * 60 * 1000`，使用严格大于（`>`）判定 → **10分钟整时仍有效，不触发过期**<br>2. `tableAuthExpired` 为 `false`<br>3. 台桌状态为 `valid`<br>**注：只有超过10分钟（如10分1秒）时 `(Date.now() - auth.time) > 10 * 60 * 1000` 才为 `true`，台桌号才会过期。** | 待执行 |
| TC1-09 | 11分钟时台桌号已过期（边界外） | 1. 生产环境已生效<br>2. 用户刚完成扫码，`tableAuth.time` 已写入 | 1. 扫码成功后记录当前时间 T0<br>2. 等待 11 分钟（T0 + 11min）<br>3. 刷新页面<br>4. 检查台桌状态 | 1. `checkAuth()` 计算：`(Date.now() - auth.time) = 11min > 10min` → 已过期<br>2. `tableAuthExpired` 为 `true`<br>3. 页面显示过期提示 | 待执行 |

---

## 环境隔离测试

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-10 | 测试环境 H5 不受生产配置变更影响 | 1. 测试环境 PM2 进程已重启（`pm2 restart tgservice-dev`）<br>2. 测试环境域名 `https://tg.tiangong.club` 可访问 | 1. 执行 `curl https://tg.tiangong.club/api/front-config`<br>2. 解析返回 JSON 中的 `tableAuthExpireMinutes` 字段<br>3. 在测试环境 H5 中扫码，等待 6 分钟后刷新页面 | 1. 接口返回 `tableAuthExpireMinutes = 5`（测试环境保持5分钟）<br>2. 5分钟后测试环境台桌号过期<br>3. 测试环境与生产环境有效期互不干扰 | 待执行 |

---

## 回归测试

| 用例ID | 测试场景 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|--------|---------|---------|---------|---------|---------|
| TC1-11 | 小程序端不受影响验证 | 1. 微信小程序已安装并可运行 | 1. 在微信小程序中扫码台桌二维码<br>2. 等待 15 分钟<br>3. 返回小程序查看台桌状态 | 1. 小程序端 `tableAuthExpired` 始终为 `false`（TableInfo.vue 第98-99行 `#ifndef H5` 分支）<br>2. 台桌状态保持有效，不受有效期变更影响 | 待执行 |
| TC1-12 | 已有授权用户在配置变更后自动适应新有效期 | 1. 用户在配置变更前 5 分钟完成扫码<br>2. 后端已重启并加载新配置（expireMinutes=10） | 1. 用户在配置变更后刷新 H5 页面<br>2. 观察 `checkAuth()` 行为 | 1. `checkAuth()` 使用新值 10 分钟计算：已用5分钟 < 10分钟 → 仍有效<br>2. 5分钟后（即扫码后10分钟），台桌号过期<br>3. 无需额外清理 localStorage | 待执行 |

---

## 测试环境准备清单

- [ ] 生产环境 `.config` 中 `expireMinutes` 已改为 `10`
- [ ] 测试环境 `.config.env` 中 `expireMinutes` 仍为 `5`
- [ ] 生产环境 Docker 容器已重启
- [ ] 测试环境 PM2 进程已重启
- [ ] 准备两台手机（一台测试 H5，一台测试小程序）
- [ ] 准备计时工具（手机计时器或秒表）
- [ ] 确保台桌二维码可正常扫描

---

## 备注

1. **过期时间计算逻辑**（TableInfo.vue 第71行）：
   ```javascript
   tableAuthExpired.value = (Date.now() - auth.time) > tableAuthExpireMinutes.value * 60 * 1000
   ```
   判断条件是 **严格大于（`>`）**，因此恰好10分钟时 `Date.now() - auth.time === 10 * 60 * 1000` 不会触发过期，**只有超过10分钟（如10分1秒）才会判定为过期**。TC1-08 的预期：**10分钟整时仍有效，超过10分钟才过期**。TC1-06/TC1-09 等过期用例使用11分钟，不受此边界影响。

2. **前端默认值30分钟**（TableInfo.vue 第50行）：当前代码为 `ref(30)`，**未改为10**。设计稿标注此项为 P2 可选修改。TC1-05 验证兜底行为：当后端接口异常时，`tableAuthExpireMinutes` 回退为默认值30分钟。**若后续将默认值改为10，TC1-05的预期需同步更新。**

3. **所有边界测试用例的实际执行时间需精确到秒**，建议在操作时记录 `Date.now()` 精确时间戳，以便验证计算结果。

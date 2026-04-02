# 台桌状态同步脚本

## 概述

定时同步台客多后台的台桌状态到数据库。

## 文件位置

- 脚本：`/TG/tgservice/scripts/sync-tables-status.js`
- 日志：`/TG/tgservice/scripts/sync-tables-status.log`

## 依赖

- `ws` - WebSocket 客户端，用于 CDP (Chrome DevTools Protocol) 通信
- `better-sqlite3` - SQLite 数据库操作

## 工作流程

1. **检测并启动 mychrome**（如需要）
   - 检查 CDP 端口 9222 是否可用
   - 若不可用则执行 `bash /root/chrome` 启动

2. **打开或刷新台桌概览页面**
   - 优先复用已打开的台桌概览页面
   - 次选导航现有台客多页面到目标 URL
   - 最后尝试创建新标签页

3. **等待页面加载完成**
   - 使用 CDP `Page.loadEventFired` 事件监听
   - 轮询检查关键元素（台桌区域、状态文字）
   - 最长等待 30 秒，超时则报错退出

4. **采集台桌状态数据**
   - 获取页面文本内容
   - 解析区域（大厅区、TV区、包厢区、棋牌区、虚拟区、斯诺克区）
   - 识别状态：空闲、计费中、已暂停

5. **更新数据库**
   - 更新 `tables` 表的 `status` 字段
   - 更新 `vip_rooms` 表的 `status` 字段（按名称前缀匹配）

6. **关闭标签页**
   - 关闭本次打开的台桌概览标签页

7. **写入日志文件**
   - 记录操作过程和结果

## Cron 配置

```bash
# 台桌状态同步 - 2:00~14:00每小时，14:00~2:00每10分钟
0 2-14 * * * /usr/bin/node /TG/tgservice/scripts/sync-tables-status.js >> /TG/tgservice/scripts/sync-tables-status.log 2>&1
*/10 14-23 * * * /usr/bin/node /TG/tgservice/scripts/sync-tables-status.js >> /TG/tgservice/scripts/sync-tables-status.log 2>&1
*/10 0-2 * * * /usr/bin/node /TG/tgservice/scripts/sync-tables-status.js >> /TG/tgservice/scripts/sync-tables-status.log 2>&1
```

**说明**：
- 凌晨 2:00 到下午 14:00：每小时执行一次（营业低峰期）
- 下午 14:00 到凌晨 2:00：每 10 分钟执行一次（营业高峰期）

## 日志格式

日志文件路径：`/TG/tgservice/scripts/sync-tables-status.log`

```
[2024/03/24 17:00:00] 开始同步...
[2024/03/24 17:00:01] 页面 load 事件触发
[2024/03/24 17:00:02] 页面加载完成，耗时 1234ms
[2024/03/24 17:00:03] 采集到 20 个台桌
[2024/03/24 17:00:04] tables 表更新: 20 条
[2024/03/24 17:00:04] vip_rooms 表更新: 5 条
[2024/03/24 17:00:05] 同步完成
```

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| Chrome 启动失败 | 报错退出，记录日志 |
| 页面加载超时（30秒） | 报错退出，不更新数据库 |
| 解析结果为空 | 报错退出，不更新数据库 |
| 数据库操作失败 | 报错退出，记录日志 |

## 配置参数

脚本内部配置（位于文件顶部）：

```javascript
const CDP_PORT = 9222;                                          // Chrome DevTools 端口
const TARGET_URL = 'https://admin.taikeduo.com/#/storeOverview/tableOverview';  // 目标页面
const AREAS = ['大厅区', 'TV区', '包厢区', '棋牌区', '虚拟区', '斯诺克区'];      // 区域列表
const DB_PATH = '/TG/tgservice/db/tgservice.db';               // 数据库路径
const LOG_PATH = '/TG/tgservice/scripts/sync-tables-status.log'; // 日志路径
const CHROME_START_CMD = 'bash /root/chrome';                  // Chrome 启动命令
```

## 手动执行

```bash
# 直接执行
node /TG/tgservice/scripts/sync-tables-status.js

# 查看日志
tail -f /TG/tgservice/scripts/sync-tables-status.log
```

## 状态转换规则

从台客多后台采集的状态会按以下规则转换后存入数据库：

| 台客多状态 | 数据库状态 | 说明 |
|-----------|-----------|------|
| 空闲 | 空闲 | 保持不变 |
| 已暂停 | 已暂停 | 保持不变 |
| 计费中 | 接待中 | 统一转为"接待中" |
| 其他状态 | 接待中 | 未知状态统一为"接待中" |

**实现逻辑**：
```javascript
function convertStatus(status) {
  if (status === '空闲') return '空闲';
  if (status === '已暂停') return '已暂停';
  return '接待中';
}
```

## 注意事项

1. 确保 mychrome 已正确配置并可以访问台客多后台
2. 需要提前登录台客多后台，脚本不会自动登录
3. 数据库路径和表结构需与脚本配置一致
4. 日志文件会持续追加，建议定期清理或配置 logrotate
5. Chrome 启动时需要 DISPLAY=:1 环境变量，脚本已自动设置
## 设计摘要（用户已确认）

### P0优先级
- authMiddleware：添加401日志（无token、token无效）
- permission.js：添加403日志（权限拒绝）
- 教练登录失败：添加失败日志

### P1优先级  
- 会员资料更新/登出 catch 块

### P2优先级
- 约40处其他 catch 块

### 日志规范
- 认证失败用 logger.warn()
- 系统异常用 logger.error()
- 日志输出到 /TG/run/logs（生产挂载目录）

### 保持静默（不改）
- JSON解析失败（使用默认值）
- 配置表不存在（使用默认值）
- 数据库列已存在（跳过）

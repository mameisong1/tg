你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# QA-20260429-3 测试用例

## 项目：台桌状态同步和系统通知相关改造

**测试策略**：仅API/curl测试，无浏览器测试  
**测试地址**：http://127.0.0.1:8088  
**数据库验证**：Node.js脚本（禁止sqlite3 CLI）

---

## 一、前置准备

### P0 - 获取管理员Token
```bash
# 后台管理员登录
curl -X POST http://127.0.0.1:8088/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tgadmin","password":"mayining633"}'
```
**预期**：返回 `{success:true, data:{token:"..."}}`  
**保存**：`ADMIN_TOKEN=返回的token值`

### P1 - 获取普通员工Token（用于验证权限）
```bash
# 前台员工登录（需要已有员工手机号）
curl -X POST http://127.0.0.1:8088/api/auth/sms-login \
  -H "Content-Type: application/json" \
  -d '{"phone":"员工手机号","code":"888888"}'
```
**预期**：返回 `{success:true, data:{token:"..."}}`  
**用途**：验证非管理员不应收到系统通知

---

## 二、台桌同步成功测试

### P0 - TC-01：台桌同步成功写入Cron日志
**优先级**：P0  
**步骤**：
```bash
# 1. 调用台桌同步接口
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tables": [
      {"name": "1号桌", "status": "空闲"},
      {"name": "2号桌", "status": "使用中"},
      {"name": "3号桌", "status": "空闲"}
    ]
  }'
```

**预期结果**：
1. 接口返回成功：
   ```json
   {
     "success": true,
     "data": {
       "tablesUpdated": 3,
       "vipRoomsUpdated": 0,
       "tablesCount": 3,
       "elapsedMs": 150
     }
   }
   ```

2. 验证Cron日志写入：
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
dbGet('SELECT * FROM cron_log WHERE task_name=\"table_sync\" ORDER BY created_at DESC LIMIT 1')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

**预期日志内容**：
- `task_name`: "table_sync"
- `status`: "success"
- `details` 包含：
  - 开台数量（tablesUpdated或openCount）
  - 自动关灯数量（autoLightsOff）
  - 自动关空调数量（autoAcOff）

---

### P1 - TC-02：台桌同步成功（空数据）
**优先级**：P1  
**步骤**：
```bash
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tables": []}'
```

**预期**：
- 返回成功
- Cron日志记录空同步

---

### P2 - TC-03：台桌同步成功（大量数据）
**优先级**：P2  
**步骤**：构造20+台桌数据同步，验证性能

---

## 三、台桌同步失败测试

### P0 - TC-04：台桌同步失败写入Cron日志+系统通知
**优先级**：P0  
**步骤**：
```bash
# 1. 调用台桌同步失败接口
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables/error \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "error": "连接台桌控制器超时",
    "details": "Controller IP: 192.168.1.100, Timeout: 30000ms"
  }'
```

**预期结果**：
1. 接口返回成功：
   ```json
   {"success": true}
   ```

2. 验证Cron日志写入（status=failed）：
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
dbGet('SELECT * FROM cron_log WHERE task_name=\"table_sync\" AND status=\"failed\" ORDER BY created_at DESC LIMIT 1')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

**预期日志内容**：
- `task_name`: "table_sync"
- `status`: "failed"
- `error_message`: "连接台桌控制器超时"
- `details`: 包含详细信息

3. 验证系统通知发送给所有管理员：
```bash
# 查询通知表，确认管理员收到系统通知
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
dbAll('SELECT n.*, u.username FROM notifications n JOIN admin_users u ON n.user_id = u.id WHERE n.notification_type=\"system\" AND n.error_type=\"table_sync\" ORDER BY n.created_at DESC LIMIT 5')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

**预期通知内容**：
- `notification_type`: "system"
- `error_type`: "table_sync" 或类似类型
- `title`: 包含"台桌同步"字样
- `user_id`: 对应管理员用户ID

---

### P1 - TC-05：台桌同步失败（无详细错误）
**优先级**：P1  
**步骤**：
```bash
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables/error \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"error": "未知错误"}'
```

**预期**：成功写入日志并发送通知

---

## 四、Cron日志过滤测试

### P0 - TC-06：按task_type过滤台桌同步日志
**优先级**：P0  
**步骤**：
```bash
# 查询台桌同步日志
curl -X GET "http://127.0.0.1:8088/api/system-report/cron-logs?task_type=table_sync&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**：
- 返回成功
- 返回数据仅包含task_name或task_type为"table_sync"的记录
- 包含成功和失败记录

---

### P0 - TC-07：按status过滤台桌同步日志
**优先级**：P0  
**步骤**：
```bash
# 查询失败的台桌同步日志
curl -X GET "http://127.0.0.1:8088/api/system-report/cron-logs?task_type=table_sync&status=failed&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期**：仅返回失败的台桌同步日志

---

### P1 - TC-08：Cron日志列表（无过滤）
**优先级**：P1  
**步骤**：
```bash
curl -X GET "http://127.0.0.1:8088/api/system-report/cron-logs?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期**：返回所有类型的Cron日志，包含table_sync记录

---

## 五、系统通知测试

### P0 - TC-09：管理员收到系统通知
**优先级**：P0  
**前提**：已执行TC-04（触发系统通知）  
**步骤**：
```bash
# 获取通知列表
curl -X GET "http://127.0.0.1:8088/api/notifications?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期结果**：
- 返回成功
- 包含`notification_type="system"`的通知
- 包含台桌同步异常的通知内容

---

### P0 - TC-10：系统通知详情正确
**优先级**：P0  
**步骤**：
```bash
# 获取通知列表，检查详细信息
curl -X GET "http://127.0.0.1:8088/api/notifications?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期字段**：
- `id`: 通知ID
- `notification_type`: "system"
- `error_type`: "table_sync" 或 "cron_scheduler" 或 "timer_task"
- `title`: 通知标题
- `content`: 通知内容
- `is_read`: 0（未读）
- `created_at`: 创建时间

---

### P1 - TC-11：未读系统通知计数
**优先级**：P1  
**步骤**：
```bash
curl -X GET "http://127.0.0.1:8088/api/notifications/unread-count" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期**：未读数量包含系统通知

---

### P1 - TC-12：标记系统通知已读
**优先级**：P1  
**步骤**：
```bash
# 获取通知ID后标记已读
curl -X PUT "http://127.0.0.1:8088/api/notifications/{通知ID}/read" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**预期**：返回成功，该通知变为已读

---

### P1 - TC-13：非管理员不应收到系统通知
**优先级**：P1  
**前提**：已执行TC-04（触发系统通知）  
**步骤**：
```bash
# 使用普通员工Token查询通知
curl -X GET "http://127.0.0.1:8088/api/notifications?limit=10" \
  -H "Authorization: Bearer $EMPLOYEE_TOKEN"
```

**预期**：
- 不包含`notification_type="system"`的通知
- 或返回空列表

---

## 六、权限验证测试

### P2 - TC-14：台桌同步接口权限验证
**优先级**：P2  
**步骤**：
```bash
# 无Token调用
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables \
  -H "Content-Type: application/json" \
  -d '{"tables": [{"name":"1号桌","status":"空闲"}]}'
```

**预期**：返回401未授权

---

### P2 - TC-15：台桌同步失败接口权限验证
**优先级**：P2  
**步骤**：
```bash
# 无Token调用
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables/error \
  -H "Content-Type: application/json" \
  -d '{"error":"测试错误"}'
```

**预期**：返回401未授权

---

## 七、异常场景测试

### P2 - TC-16：重复台桌同步
**优先级**：P2  
**步骤**：连续调用两次同步接口
```bash
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tables": [{"name":"1号桌","status":"空闲"}]}'

# 立即再次调用
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tables": [{"name":"1号桌","status":"使用中"}]}'
```

**预期**：两次都成功，生成两条Cron日志

---

### P2 - TC-17：台桌同步失败接口参数验证
**优先级**：P2  
**步骤**：
```bash
# 缺少error参数
curl -X POST http://127.0.0.1:8088/api/admin/sync/tables/error \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}'
```

**预期**：返回参数错误

---

## 八、数据库验证脚本汇总

### 查询最新台桌同步Cron日志
```bash
node -e "
const{dbGet}=require('/TG/tgservice/backend/db/index');
dbGet('SELECT * FROM cron_log WHERE task_name=\"table_sync\" ORDER BY created_at DESC LIMIT 1')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

### 查询所有管理员账号
```bash
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
dbAll('SELECT id, username, role FROM admin_users WHERE role IN (\"店长\",\"助教管理\",\"管理员\")')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

### 查询系统通知发送记录
```bash
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
dbAll('SELECT n.*, u.username FROM notifications n JOIN admin_users u ON n.user_id = u.id WHERE n.notification_type=\"system\" ORDER BY n.created_at DESC LIMIT 10')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

### 查询Cron日志表结构
```bash
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
dbAll('PRAGMA table_info(cron_log)')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

### 查询通知表结构
```bash
node -e "
const{dbAll}=require('/TG/tgservice/backend/db/index');
dbAll('PRAGMA table_info(notifications)')
  .then(r=>console.log(JSON.stringify(r,null,2)));
"
```

---

## 九、测试执行顺序

**推荐执行顺序**：
1. TC-01 → TC-06 → TC-07（验证成功场景）
2. TC-04 → TC-09 → TC-10 → TC-11（验证失败+通知场景）
3. TC-12 → TC-13（验证通知功能）
4. TC-02, TC-03, TC-05（边界场景）
5. TC-14 ~ TC-17（异常和权限场景）

---

## 十、验收标准

| 序号 | 验收项 | 对应测试用例 | 优先级 |
|------|--------|--------------|--------|
| 1 | 台桌同步成功写入Cron日志 | TC-01 | P0 |
| 2 | 台桌同步失败写入Cron日志 | TC-04 | P0 |
| 3 | Cron日志可按task_type过滤 | TC-06, TC-07 | P0 |
| 4 | 系统异常自动发通知给管理员 | TC-04, TC-09 | P0 |
| 5 | 管理员能在通知列表看到系统通知 | TC-09, TC-10 | P0 |
| 6 | 非管理员不应收到系统通知 | TC-13 | P1 |

---

## 十一、注意事项

1. **测试地址**：仅使用 http://127.0.0.1:8088，严禁使用8081/8083
2. **数据库验证**：必须使用Node.js脚本，禁止sqlite3 CLI
3. **Token管理**：管理员Token需先获取并保存为环境变量
4. **通知时间差**：触发系统通知后可能有延迟，建议等待1-2秒再查询
5. **并发测试**：如有并发场景，注意检查日志和通知的幂等性

---

**编写人**：测试员B  
**编写时间**：2026-04-29  
**版本**：v1.0
```

## 审计要点
1. 是否覆盖QA需求的所有功能点
2. 是否包含API接口真实测试操作（curl测试）
3. 测试步骤是否可执行
4. 是否有明确的预期结果
5. 是否区分了正常流程和异常流程

这是第 1/3 次审计。

## 输出要求
1. 审计结果：通过/不通过
2. 如不通过，列出具体问题
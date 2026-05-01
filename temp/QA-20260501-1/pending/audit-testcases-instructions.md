你是QA审计员。请审计以下测试用例。

## 测试用例内容
```
# 测试用例：强制钉钉打卡翻牌

## 需求概述

上班打卡时强制要求先在钉钉打卡，系统查询到钉钉打卡记录后才能翻牌。

### 核心逻辑
1. 上班打卡前必须先在钉钉打卡
2. 系统后台查询钉钉考勤API，获取5分钟内的打卡记录
3. 查到钉钉打卡时间 → 写入 `dingtalk_in_time`，允许翻牌
4. 超时5分钟未查到 → 提示用户"未检测到钉钉打卡"

### 特殊场景
- **乐捐归来打卡**：同样强制钉钉打卡，写入 `lejuan_records.dingtalk_return_time`
- **下班打卡**：维持现状，无钉钉强制要求

---

## 一、API/curl 测试用例

### 测试环境
- 后端地址：`http://127.0.0.1:8088`
- 认证方式：管理员 JWT Token（需先登录获取）

### 前置条件
1. 测试助教已配置 `dingtalk_user_id`（钉钉用户ID）
2. 钉钉开放平台配置正确（appKey、appSecret、callbackToken、callbackAESKey）
3. 测试助教当前水牌状态为「下班」或「乐捐」

### API 测试用例表

| 用例ID | 测试项 | 优先级 | curl 命令 | 预期结果 | 验证点 |
|--------|--------|--------|-----------|----------|--------|
| API-001 | 上班打卡-无钉钉记录 | P0 | `curl -X POST "http://127.0.0.1:8088/api/coaches/{coach_no}/clock-in" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"force_dingtalk": true}'` | 返回 `success: false, error: "未检测到钉钉打卡记录，请先在钉钉打卡"` | 1. HTTP 400<br>2. 水牌状态不变<br>3. attendance_records 无新增 |
| API-002 | 上班打卡-有钉钉记录 | P0 | `curl -X POST "http://127.0.0.1:8088/api/coaches/{coach_no}/clock-in" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"force_dingtalk": true}'` （前置：手动在钉钉打卡） | 返回 `success: true, data: {coach_no, stage_name, status: "早班空闲"}` | 1. HTTP 200<br>2. 水牌状态变为空闲<br>3. attendance_records 有 dingtalk_in_time<br>4. clock_in_time 为空或 null |
| API-003 | 上班打卡-钉钉记录5分钟外 | P1 | 同 API-001（前置：钉钉打卡时间 > 5分钟前） | 返回 `success: false, error: "未检测到钉钉打卡记录"` | 1. HTTP 400<br>2. 只接受5分钟内的钉钉记录 |
| API-004 | 上班打卡-重复打卡 | P1 | `curl -X POST ".../clock-in"` （前置：已在班状态） | 返回 `success: false, error: "助教已在班状态,无需重复上班"` | 1. HTTP 400<br>2. 状态不变 |
| API-005 | 上班打卡-助教无钉钉ID | P2 | `curl -X POST ".../clock-in"` （前置：coach.dingtalk_user_id 为空） | 返回 `success: false, error: "助教未绑定钉钉账号"` | 1. HTTP 400<br>2. 提示绑定钉钉 |
| API-006 | 乐捐归来-无钉钉记录 | P0 | `curl -X POST "http://127.0.0.1:8088/api/lejuan-records/{id}/return" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"operator": "测试员", "force_dingtalk": true}'` （前置：水牌状态为「乐捐」） | 返回 `success: false, error: "未检测到钉钉打卡记录"` | 1. HTTP 400<br>2. 乐捐状态不变 |
| API-007 | 乐捐归来-有钉钉记录 | P0 | `curl -X POST ".../return"` （前置：钉钉打卡 + 水牌为「乐捐」） | 返回 `success: true, data: {lejuan_status: "returned", dingtalk_return_time: "2026-05-01 08:00:00"}` | 1. HTTP 200<br>2. lejuan_records.dingtalk_return_time 有值<br>3. 水牌变为空闲 |
| API-008 | 下班打卡-无强制钉钉 | P0 | `curl -X POST "http://127.0.0.1:8088/api/coaches/{coach_no}/clock-out" -H "Authorization: Bearer {token}"` （前置：水牌为「早班空闲」） | 返回 `success: true, data: {coach_no, status: "下班"}` | 1. HTTP 200<br>2. 无需钉钉打卡<br>3. clock_out_time 有值 |
| API-009 | 钉钉考勤API查询 | P1 | `curl "http://127.0.0.1:8088/api/dingtalk/callback/test-attendance?userid={dingtalk_user_id}&date=2026-05-01" -H "Authorization: Bearer {token}"` | 返回 `success: true, records: [{userCheckTime: timestamp, ...}]` | 1. 能获取钉钉打卡记录<br>2. 时间戳格式正确 |
| API-010 | 打卡记录查询-钉钉时间 | P1 | `curl "http://127.0.0.1:8088/api/attendance-review?period=today" -H "Authorization: Bearer {token}"` | 返回包含 `dingtalk_in_time` 的记录 | 1. dingtalk_in_time 有值<br>2. clock_in_time 可能为空 |

### 数据库验证 SQL

```sql
-- 验证上班打卡记录
SELECT id, coach_no, date, clock_in_time, dingtalk_in_time, is_late 
FROM attendance_records 
WHERE coach_no = ? AND date = '2026-05-01';

-- 验证乐捐归来记录
SELECT id, coach_no, lejuan_status, dingtalk_return_time, return_time 
FROM lejuan_records 
WHERE id = ?;

-- 验证水牌状态
SELECT coach_no, stage_name, status, clock_in_time 
FROM water_boards 
WHERE coach_no = ?;

-- 验证助教钉钉绑定
SELECT coach_no, stage_name, dingtalk_user_id, shift 
FROM coaches 
WHERE coach_no = ?;
```

---

## 二、浏览器自动化测试用例

### 测试环境
- Chrome 端口：9222（VNC 日常使用）
- 前端地址：`http://127.0.0.1:8089`
- 测试账号：助教账号（需配置钉钉绑定）

### 前置条件
1. Chrome 已启动（`bash /root/chrome`）
2. 测试助教已登录前端
3. 测试助教已绑定钉钉账号
4. 钉钉 APP 已安装并可正常打卡

### 浏览器测试用例表

| 用例ID | 测试项 | 优先级 | 浏览器操作步骤 | 颅期结果 |
|--------|--------|--------|----------------|----------|
| WEB-001 | 上班打卡页-提示展示 | P0 | 1. 水牌状态设为「下班」<br>2. 打开「上班/下班」页面 `/pages/internal/clock`<br>3. 观察页面内容 | 1. 页面顶部显示红色提示框："⚠️ 上班打卡需先在钉钉打卡"<br>2. 提示框包含勾选框"我已在钉钉打卡"<br>3. 打卡截图上传区域隐藏（不显示） |
| WEB-002 | 上班打卡-未勾选禁止 | P0 | 1. 打开上班打卡页面<br>2. 不勾选"我已在钉钉打卡"<br>3. 点击「上班」按钮 | 1. 按钮点击无效<br>2. 弹框提示："请先勾选'我已在钉钉打卡'"<br>3. 水牌状态不变 |
| WEB-003 | 上班打卡-确认后等待 | P0 | 1. 打开上班打卡页面<br>2. 勾选"我已在钉钉打卡"<br>3. 点击「上班」按钮 | 1. 显示沙漏等待对话框<br>2. 对话框内容："正在检测钉钉打卡记录..."<br>3. 显示倒计时（最长5分钟）<br>4. 上班按钮禁用状态 |
| WEB-004 | 上班打卡-钉钉检测成功 | P0 | 1. 前置：在钉钉 APP 打卡<br>2. 打开上班打卡页面<br>3. 勾选"我已在钉钉打卡"<br>4. 点击「上班」按钮<br>5. 等待检测结果 | 1. 等待对话框显示"检测成功"<br>2. 2秒后自动关闭对话框<br>3. 页面显示"上班成功" Toast<br>4. 水牌状态变为「早班空闲」或「晚班空闲」 |
| WEB-005 | 上班打卡-超时失败 | P0 | 1. 打开上班打卡页面<br>2. 勾选"我已在钉钉打卡"（但实际未在钉钉打卡）<br>3. 点击「上班」按钮<br>4. 等待超时 | 1. 等待对话框显示倒计时<br>2. 5分钟后显示"检测失败"<br>3. 弹框提示："未检测到钉钉打卡记录，请先在钉钉打卡后重试"<br>4. 水牌状态不变<br>5. 勾选框自动取消勾选 |
| WEB-006 | 上班打卡-中途取消 | P1 | 1. 打开上班打卡页面<br>2. 勾选"我已在钉钉打卡"<br>3. 点击「上班」按钮<br>4. 在等待对话框中点击「取消」 | 1. 等待对话框关闭<br>2. 水牌状态不变<br>3. 勾选框取消勾选<br>4. 上班按钮恢复可用 |
| WEB-007 | 上班打卡-重复检测 | P1 | 1. 第一次检测失败后<br>2. 在钉钉 APP 打卡<br>3. 重新勾选"我已在钉钉打卡"<br>4. 再次点击「上班」按钮 | 1. 第二次检测成功<br>2. 水牌正常翻牌 |
| WEB-008 | 乐捐归来-强制钉钉 | P0 | 1. 前置：水牌状态为「乐捐」<br>2. 打开上班打卡页面<br>3. 观察页面提示 | 1. 页面顶部显示红色提示框："⚠️ 乐捐归来需先在钉钉打卡"<br>2. 打卡截图上传区域隐藏<br>3. 勾选框"我已在钉钉打卡"显示 |
| WEB-009 | 乐捐归来-检测成功 | P0 | 1. 前置：在钉钉 APP 打卡 + 水牌为「乐捐」<br>2. 打开上班打卡页面<br>3. 勾选"我已在钉钉打卡"<br>4. 点击「上班」按钮 | 1. 等待对话框显示"检测成功"<br>2. 页面显示"上班成功"<br>3. 水牌状态变为「早班空闲」或「晚班空闲」<br>4. 乐捐记录自动结算 |
| WEB-010 | 下班打卡-无强制钉钉 | P0 | 1. 前置：水牌状态为「早班空闲」<br>2. 打开上班打卡页面<br>3. 观察下班区域 | 1. 下班按钮区域无钉钉提示<br>2. 无勾选框<br>3. 点击下班按钮直接生效（无等待对话框） |
| WEB-011 | 下班打卡-正常流程 | P0 | 1. 前置：水牌为「早班空闲」<br>2. 打开上班打卡页面<br>3. 点击「下班」按钮<br>4. 确认弹框点击「确定」 | 1. 显示确认弹框"确定要下班吗？"<br>2. 点击确定后直接下班成功<br>3. 无钉钉检测等待<br>4. 水牌状态变为「下班」 |
| WEB-012 | 上班打卡-无钉钉绑定 | P2 | 1. 前置：助教 dingtalk_user_id 为空<br>2. 打开上班打卡页面 | 1. 页面提示："您未绑定钉钉账号，请联系管理员绑定"<br>2. 上班按钮禁用状态<br>3. 无勾选框显示 |
| WEB-013 | 打卡截图上传-隐藏验证 | P1 | 1. 前置：水牌为「下班」<br>2. 打开上班打卡页面<br>3. 检查页面元素 | 1. 打卡截图上传区域不渲染（v-if="false"）<br>2. DOM 中无 `.photo-section` 元素 |
| WEB-014 | 等待对话框-倒计时显示 | P1 | 1. 打开上班打卡页面<br>2. 勾选并点击上班<br>3. 观察等待对话框 | 1. 显示倒计时秒数（如"剩余 299 秒"）<br>2. 倒计时每秒递减<br>3. 进度条同步更新 |
| WEB-015 | 等待对话框-样式验证 | P2 | 1. 打开上班打卡页面<br>2. 勾选并点击上班<br>3. 观察等待对话框样式 | 1. 沙漏图标旋转动画<br>2. 对话框背景半透明遮罩<br>3. 内容居中显示 |

---

## 三、集成测试场景

### 场景1：完整上班流程（正常）

**步骤：**
1. 助教水牌状态为「下班」
2. 助教在钉钉 APP 打卡上班
3. 打开前端「上班/下班」页面
4. 勾选"我已在钉钉打卡"
5. 点击「上班」按钮
6. 系统检测钉钉记录
7. 等待对话框显示"检测成功"
8. 水牌翻牌成功

**验证点：**
- API：`attendance_records.dingtalk_in_time` 有值
- API：`attendance_records.clock_in_time` 为空或当前时间
- 前端：水牌状态变为「早班空闲」或「晚班空闲」
- 前端：无打卡截图上传

### 场景2：完整上班流程（超时失败→重试成功）

**步骤：**
1. 助教水牌状态为「下班」
2. 打开前端页面，勾选并点击上班（未在钉钉打卡）
3. 等待5分钟超时
4. 弹框提示"未检测到钉钉打卡记录"
5. 在钉钉 APP 打卡
6. 重新勾选并点击上班
7. 检测成功，翻牌成功

**验证点：**
- 第一次请求返回失败
- 第二次请求返回成功
- 最终 `dingtalk_in_time` 有值

### 场景3：乐捐归来完整流程

**步骤：**
1. 助教水牌状态为「乐捐」
2. 在钉钉 APP 打卡
3. 打开前端页面
4. 勾选"我已在钉钉打卡"
5. 点击「上班」按钮
6. 系统检测钉钉记录
7. 乐捐自动结算，水牌翻牌

**验证点：**
- API：`lejuan_records.dingtalk_return_time` 有值
- API：`lejuan_records.lejuan_status` = 'returned'
- API：`lejuan_records.lejuan_hours` 计算正确
- 前端：水牌状态变为空闲

### 场景4：下班流程（无钉钉强制）

**步骤：**
1. 助教水牌状态为「早班空闲」
2. 打开前端页面
3. 点击「下班」按钮
4. 确认弹框点击「确定」
5. 直接下班成功

**验证点：**
- 无钉钉检测等待
- API：`attendance_records.clock_out_time` 有值
- 前端：水牌状态变为「下班」

---

## 四、边界测试

### 边界1：钉钉记录时间边界

| 场景 | 钉钉打卡时间 | 预期结果 |
|------|--------------|----------|
| 4分59秒前 | now - 299秒 | ✅ 检测成功 |
| 5分00秒前 | now - 300秒 | ❌ 检测失败 |
| 5分01秒前 | now - 301秒 | ❌ 检测失败 |

### 边界2：凌晨下班跨日

| 场景 | 上班时间 | 下班时间 | 预期结果 |
|------|----------|----------|----------|
| 早班凌晨下班 | 14:00 当日 | 02:00 次日 | ✅ 正常记录下班时间 |
| 晚班凌晨下班 | 18:00 当日 | 03:00 次日 | ✅ 正常记录下班时间 |

### 边界3：助教状态边界

| 水牌状态 | 上班按钮 | 下班按钮 | 钉钉强制 |
|----------|----------|----------|----------|
| 下班 | 可用 | 禁用 | 是 |
| 早班空闲 | 禁用 | 可用 | 下班无强制 |
| 早班上桌 | 禁用 | 禁用 | - |
| 乐捐 | 可用 | 禁用 | 是（乐捐归来） |
| 休息 | 可用 | 禁用 | 是 |
| 公休 | 可用 | 禁用 | 是 |
| 请假 | 可用 | 禁用 | 是 |

---

## 五、性能测试

### 性能1：钉钉API响应时间

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| 钉钉考勤API响应 | < 3秒 | curl 计时 |
| 后端检测总耗时 | < 5秒 | API 日志 |
| 前端等待对话框 | < 5分钟 | 前端倒计时 |

### 性能2：并发测试

| 场景 | 并发数 | 预期结果 |
|------|--------|----------|
| 多助教同时打卡 | 10人 | 全部正常处理 |
| 同一助教重复请求 | 5次 | 后4次返回"已在班状态" |

---

## 六、异常测试

### 异常1：钉钉API异常

| 场景 | 模拟方法 | 预期结果 |
|------|----------|----------|
| 钉钉API超时 | 网络延迟 > 10秒 | 返回"钉钉服务异常，请稍后重试" |
| 钉钉API错误 | errcode != 0 | 返回"钉钉服务异常" |
| access_token失效 | 过期token | 自动刷新token后重试 |

### 异常2：数据异常

| 场景 | 模拟方法 | 预期结果 |
|------|----------|----------|
| coach_no不存在 | 请求无效coach_no | 返回404 "助教不存在" |
| dingtalk_user_id无效 | 配置错误ID | 钉钉API返回空记录 |
| attendance_records冲突 | 同一天多条记录 | 合并重复记录 |

---

## 七、测试脚本示例

### curl 登录获取 Token

```bash
# 管理员登录
curl -X POST "http://127.0.0.1:8088/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "tgadmin", "password": "mayining633"}'

# 返回：{"success": true, "data": {"token": "xxx", "name": "管理员"}}
```

### curl 上班打卡（强制钉钉）

```bash
# 上班打卡（需先在钉钉打卡）
curl -X POST "http://127.0.0.1:8088/api/coaches/101/clock-in" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"force_dingtalk": true}'
```

### curl 查询钉钉打卡记录

```bash
# 查询钉钉考勤记录（调试用）
curl "http://127.0.0.1:8088/api/dingtalk/callback/test-attendance?userid={dingtalk_user_id}&date=2026-05-01" \
  -H "Authorization: Bearer {token}"
```

---

## 八、验收标准

### 必须通过（P0）
- [ ] API-001: 上班打卡-无钉钉记录返回失败
- [ ] API-002: 上班打卡-有钉钉记录返回成功
- [ ] API-006: 乐捐归来-无钉钉记录返回失败
- [ ] API-007: 乐捐归来-有钉钉记录返回成功
- [ ] API-008: 下班打卡-无强制钉钉
- [ ] WEB-001: 上班打卡页-提示展示正确
- [ ] WEB-002: 上班打卡-未勾选禁止
- [ ] WEB-003: 上班打卡-确认后等待对话框
- [ ] WEB-004: 上班打卡-钉钉检测成功
- [ ] WEB-005: 上班打卡-超时失败提示
- [ ] WEB-008: 乐捐归来-强制钉钉提示
- [ ] WEB-009: 乐捐归来-检测成功
- [ ] WEB-010: 下班打卡-无强制钉钉
- [ ] WEB-011: 下班打卡-正常流程

### 应该通过（P1）
- [ ] API-003: 上班打卡-钉钉记录5分钟外失败
- [ ] API-004: 上班打卡-重复打卡失败
- [ ] API-009: 钉钉考勤API查询正常
- [ ] API-010: 打卡记录查询-钉钉时间显示
- [ ] WEB-006: 上班打卡-中途取消
- [ ] WEB-007: 上班打卡-重复检测成功
- [ ] WEB-013: 打卡截图上传-隐藏验证
- [ ] WEB-014: 等待对话框-倒计时显示

### 可选通过（P2）
- [ ] API-005: 上班打卡-助教无钉钉ID提示
- [ ] WEB-012: 上班打卡-无钉钉绑定提示
- [ ] WEB-015: 等待对话框-样式验证

---

_测试用例编写完成，等待程序员A 完成开发后执行测试。_
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
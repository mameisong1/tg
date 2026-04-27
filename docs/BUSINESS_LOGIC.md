# 天宫国际 - 核心业务逻辑

## 1. 订单流程
扫码选台 → 浏览商品 → 加购物车 → 下单 → 后台处理

### 员工免扫码下单
员工定义：手机号匹配 coaches.phone 或 admin_users.username
- 跳过扫码检查，手动选台（页面顶部「切换台桌」）
- 已上桌助教打开台桌选择器默认高亮当前台桌
- 无台桌号时提示「请先选择台桌号」

### 下单校验
- 非员工必须先扫码绑定台桌
- 台桌号必须存在且有效
- 购物车不能混多个台桌
- 订单号: TG + yyyyMMddHHmmss + 3位序号
- 下单后自动清空购物车，发送钉钉通知
- 订单状态: 待处理 → 已完成/已取消

### 服务单
- 服务下单页提供5组快捷需求按钮（账务/挂烟/配件/酒具/其它，共11个）
- 助教、教练和所有后台用户都可下服务单
- `POST /api/service-orders` 仅需 auth.required 认证

## 2. 助教系统
- **登录**: employee_id + stage_name + id_card_last6（三要素）
- **人气投票**: 同session同助教只能投一次，间隔≥30秒
- **照片**: 最多9张，上传到OSS后更新 coaches.photos（JSON数组）

## 3. 会员系统
- **微信登录**: wx.login() → code → 后端换取openid → 创建/更新会员 → JWT(30天)
- **短信登录**: 手机号 + 6位验证码（5分钟有效，60秒限发）
- **Token**: HS256，30天有效，Bearer认证

## 4. H5授权机制
- 扫码URL: `?table=台桌拼音`，30分钟有效（测试5分钟）
- `table=clear` 清空授权+购物车session
- 关键操作前检查授权状态，过期提示重新扫码

## 5. 购物车逻辑
- sessionId 关联用户，同一session+商品合并数量
- H5端: 台桌号来自授权信息；小程序: 来自 selectedTable
- 切换台桌: 更新 localStorage + `PUT /api/cart/table` + 刷新显示
- 员工模式: 跳过授权检查，直接选台

## 6. 水牌状态管理
**状态**: 早班上桌/早班空闲/晚班上桌/晚班空闲/早加班/晚加班/休息/公休/请假/乐捐/下班

- 创建助教时自动创建水牌记录(初始"下班")
- 点上班 → 根据班次变为空闲，写入 clock_in_time
- 点下班 → 变为"下班"，清空 clock_in_time
- 上班/下班按钮根据班次自动判断最终状态（早班→早班上桌/空闲/加班，晚班同理）
- table_no 支持逗号分隔多桌（如"A1,A3,B2"）

### 打卡逻辑
- 上班: `POST /api/coaches/:coach_no/clock-in`
- 下班: `POST /api/coaches/:coach_no/clock-out`，查询 `date IN (今天, 昨天)` 处理凌晨下班
- attendance_records: clock_in_time(系统) + dingtalk_in_time(钉钉) 双来源

## 7. 智能开关
- MQTT协议，topic: `tiangongguoji`，payload: `{"id": "switch_id", "state_l1": "ON/OFF"}`
- **自动关灯**: 台桌同步触发(更新≥40条)或手动按钮，关空闲台桌灯
- **台桌无关关灯**: LEFT JOIN table_device WHERE table_name_en IS NULL，每5分钟cron
- 匹配: `LOWER(td.table_name_en) = LOWER(t.name_pinyin)`

## 8. 乐捐流程
- 助教预约整点时间 → pending → 到时间自动变active → 水牌显示"乐捐"
- **结束机制**:
  - 助教自己点"上班"按钮 → 自动计算时长 → returned → 水牌恢复空闲
  - 早班23:00自动结束(水牌下班)，晚班02:00自动结束
- 时长计算: `(endTime - scheduled_start_time) / 60min`，余数>10min+1h，最少1h
- 付款截图: 近2天可提交/修改，乐捐一览可预览
- 定时器: lejuan-timer.js 每分钟检查 pending→active
- 记录排序: active > pending > returned，同状态按预约时间倒序

## 9. 约客审查
- 早班16:00/晚班20:00自动锁定应约客人员（水牌空闲的助教）
- Cron任务: lock_guest_invitation_morning/evening
- 手动"开始审查"按钮作为兜底
- 门迎排序: 14:00早班/18:00晚班排序，00:00清空

## 10. 奖罚管理
- 表: reward_penalties(id, type, confirm_date, phone, name, amount, remark, exec_status)
- name 统一取 stage_name（艺名），避免真实姓名导致重复
- 唯一约束: (confirm_date, type, phone, remark)
- 数据来源: 批处理自动(stage_name) / 前台H5手动(stage_name优先) / 后台Admin录入
- 同步: 每天12:00自动同步去重

## 11. 申请管理
- **休息申请**: 每月限制4天（按休息日所在月份计算）
- **请假申请**: 无天数限制
- API: `GET /api/applications/my-month-count` 查询当月已用配额

## 12. 钉钉打卡
- **推送**: 打卡机推送事件(attendance_check_record) → 实时写入
- **主动查询**: 系统打卡时调用钉钉API，查询5分钟内记录
- 水牌状态为"乐捐"时打上班卡 → 乐捐归来（结束乐捐+计算时长+恢复空闲）
- 上桌状态在下班时间段收到推送 → 判定为下班打卡
- 打卡审查今日定义: 今天12:00 到 明天11:59（按工作时间段，非自然日）

## 13. Cron 批处理任务
调度器: `cron-scheduler.js`

| 任务 | 时间 | 说明 |
|------|------|------|
| auto_off_table_independent_light/ac | */5 * | 每5分钟关无关灯/空调 |
| reset_water_board_status | 03:00 | 休息/请假/公休→下班 |
| sync_reward_penalty | 12:00 | 奖罚自动同步 |
| guest_ranking_morning | 14:00 | 早班门迎排序 |
| lock_guest_invitation_morning | 16:00 | 锁定早班应约客 |
| guest_ranking_evening | 18:00 | 晚班门迎排序 |
| lock_guest_invitation_evening | 20:00 | 锁定晚班应约客 |
| end_lejuan_morning | 23:00 | 结束早班乐捐 |
| end_lejuan_evening | 02:00 | 结束晚班乐捐 |
| guest_ranking_midnight | 00:00 | 清空门迎排序 |

## 14. 业务规则汇总
| 规则 | 值 |
|------|-----|
| H5授权有效期 | 生产30分钟 / 测试5分钟 |
| Token有效期 | 30天 |
| 短信验证码 | 5分钟有效，60秒限发 |
| 人气投票 | 同session同助教1次，间隔30秒 |
| 下单必须选台 | 是 |
| 助教照片上限 | 9张 |
| 休息申请配额 | 每月4天 |

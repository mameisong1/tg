果盘和奶茶任务统计功能设计方案（已更新）：
【数据库变更】无新增字段（members表已有device_fingerprint）
【后端API】新增4个API：my-stats、admin-stats、coach-detail、repair-data
【核心逻辑】奶茶：category='奶茶店'，30杯/月；果盘：name含'果盘'=1个，单份水果3份=1个，5个/月
【前端页面】新增3个Vue页面：助教端、管理端列表、管理端明细
【权限】助教看自己；管理员/店长/助教管理看全部
【数据修复】通过coaches.phone找members对应会员，写入device_fingerprint
【关联逻辑】订单device_fingerprint→members.device_fingerprint→members.phone→coaches.phone
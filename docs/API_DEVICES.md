# API 设备与钉钉接口文档（IoT、钉钉、系统配置）

## 设备访问记录
| POST | `/api/device-visits` | 记录设备访问(device_fp, visit_date) |

## 设备指纹黑名单
| GET | `/api/device-fp/blacklist` | 黑名单列表 |
| POST | `/api/device-fp/blacklist` | 添加黑名单(device_fp, reason) |
| DELETE | `/api/device-fp/blacklist/:id` | 移除黑名单 |

## 前端配置
| GET | `/api/front-config` | 前端配置(无限制白名单) |

## 系统配置
| GET | `/api/system-config` | 系统配置列表 |
| GET | `/api/system-config/:key` | 获取单个配置 |
| PUT | `/api/system-config/:key` | 更新配置 |

## 日志
| GET | `/api/logs` | 日志列表(可筛选级别/日期) |

## 智能开关
| GET | `/api/switches` | 开关列表 |
| POST | `/api/switches/:id/state` | 控制开关(state_l1: ON/OFF) |
| POST | `/api/switches/auto-off` | 智能省电自动(更新≥40条时触发) |
| POST | `/api/switches/auto-off-manual` | 智能省电手动 |
| POST | `/api/switches/all-on` | 全部开灯 |
| POST | `/api/switches/all-off` | 全部关灯 |
| GET | `/api/switches/config` | 开关配置 |
| PUT | `/api/switches/config` | 更新开关配置 |

## 智能空调（2026-04-25新增）
| GET | `/api/ac-units` | 空调列表 |
| POST | `/api/ac-units/:id/state` | 控制空调 |
| POST | `/api/ac-units/auto-off` | 智能省电自动关空调 |
| POST | `/api/ac-units/auto-off-manual` | 智能省电手动关空调 |

## 系统报告
| GET | `/api/system-report` | 系统报告列表 |
| POST | `/api/system-report/cron/:name/trigger` | 手动触发Cron |

## 活跃计时器（2026-04-20新增）
| POST | `/api/active-timer` | 记录活跃时间 |
| GET | `/api/active-timer/stats` | 活跃统计 |

## 助教休假日历（2026-04-21新增）
| GET | `/api/coach-calendar/:coach_no?month=` | 获取助教月历 |
| POST | `/api/coach-calendar/:coach_no` | 创建日历记录 |
| DELETE | `/api/coach-calendar/:id` | 删除日历记录 |

## 鉴权配置（QA-20260422-3）
| GET | `/api/auth/config` | 获取鉴权配置 |
| PUT | `/api/auth/config` | 更新鉴权配置 |

## 前端错误上报（2026-04-23）
| POST | `/api/frontend-error` | 上报前端错误(page, error, userAgent) |
| GET | `/api/frontend-errors` | 错误列表 |

## 钉钉打卡
| POST | `/api/dingtalk/callback` | 钉钉打卡回调 |
| POST | `/api/dingtalk/check-in` | 主动查询钉钉打卡(5分钟内) |
| POST | `/api/dingtalk/process` | 处理钉钉打卡数据 |
| POST | `/api/dingtalk/identify` | 钉钉打卡识别(2026-04-26更新) |
| GET | `/api/dingtalk/review/today` | 今日打卡审查 |
| GET | `/api/dingtalk/review/yesterday` | 昨日打卡审查 |

### 钉钉打卡规则
- 推送方式: attendance_check_record 事件
- 主动查询: 5分钟阈值(可配置)
- 双写: clock_in_time + dingtalk_in_time(不覆盖已有)
- 今日定义: 今天12:00 到 明天11:59(按工作时间段)
- 昨日定义: 昨天12:00 到 今天11:59

### 状态处理
| 水牌状态 | 操作 |
|----------|------|
| 下班 | 上班打卡 |
| 空闲 | 判断上班/乐捐归来/下班 |
| 乐捐 | 乐捐归来打卡 |
| 服务中 | 忽略 |
| 早/晚加班 | 上班打卡 |
| 休息/请假/公休 | 上班打卡 |

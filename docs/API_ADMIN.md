# API 后台管理与业务接口文档

> 需要 `Authorization: Bearer <admin-token>`

## 管理员登录
| POST | `/api/admin/login` | 密码登录(username, password) |
| POST | `/api/admin/login/sms` | 验证码登录(phone, code, 2026-04-23新增) |

## 数据统计
| GET | `/api/admin/stats` | 订单/会员/设备统计概览 |
| GET | `/api/admin/stats/orders` | 订单统计 |
| GET | `/api/admin/stats/members` | 会员统计 |
| GET | `/api/admin/stats/device-visits` | 设备访问统计(12周趋势) |
| GET | `/api/admin/stats/revenue` | 营收统计 |

## 商品管理
| GET | `/api/admin/products` | 商品列表(可搜索/分页) |
| POST | `/api/admin/products` | 创建商品 |
| PUT | `/api/admin/products/:name` | 更新商品 |
| DELETE | `/api/admin/products/:name` | 删除商品 |
| GET | `/api/admin/product-categories` | 分类列表 |
| POST | `/api/admin/product-categories` | 创建分类 |
| PUT | `/api/admin/product-categories/:name` | 更新分类 |
| DELETE | `/api/admin/product-categories/:name` | 删除分类 |

## 助教管理
| GET | `/api/admin/coaches` | 助教列表 |
| POST | `/api/admin/coaches` | 创建助教 |
| PUT | `/api/admin/coaches/:coach_no` | 更新助教 |
| DELETE | `/api/admin/coaches/:coach_no` | 删除助教 |
| PUT | `/api/admin/coaches/batch-shift` | 批量更新班次 |

## 水牌管理
| GET | `/api/admin/water-boards` | 水牌列表 |
| PUT | `/api/admin/water-boards/:coach_no/status` | 更新水牌状态 |

## 会员管理
| GET | `/api/admin/members` | 会员列表(可搜索/分页) |
| PUT | `/api/admin/members/:member_no` | 更新会员 |
| DELETE | `/api/admin/members/:member_no` | 删除会员 |

## 台桌管理
| GET | `/api/admin/tables` | 台桌列表 |
| POST | `/api/admin/tables` | 创建台桌 |
| PUT | `/api/admin/tables/:id` | 更新台桌 |
| DELETE | `/api/admin/tables/:id` | 删除台桌 |
| POST | `/api/admin/tables/sync` | 同步台桌(从台客多) |

## VIP包房管理
| GET | `/api/admin/vip-rooms` | 包房列表 |
| POST | `/api/admin/vip-rooms` | 创建包房 |
| PUT | `/api/admin/vip-rooms/:id` | 更新包房 |
| DELETE | `/api/admin/vip-rooms/:id` | 删除包房 |

## 订单管理
| GET | `/api/admin/orders` | 订单列表(可筛选状态/台桌/日期) |
| GET | `/api/admin/orders/:id` | 订单详情 |
| PUT | `/api/admin/orders/:id/status` | 更新订单状态 |

## 服务单管理
| GET | `/api/admin/service-orders` | 服务单列表 |
| PUT | `/api/admin/service-orders/:id/status` | 更新服务单状态 |

## 首页配置
| GET | `/api/admin/home-config` | 获取首页配置 |
| PUT | `/api/admin/home-config` | 更新首页配置 |

## 操作日志
| GET | `/api/admin/operation-logs` | 操作日志列表(可筛选) |

## 用户管理
| GET | `/api/admin/users` | 后台用户列表 |
| POST | `/api/admin/users` | 创建用户 |
| PUT | `/api/admin/users/:username` | 更新用户 |
| DELETE | `/api/admin/users/:username` | 删除用户 |

## 约客管理
| GET | `/api/admin/guest-invitations` | 约客列表 |
| PUT | `/api/admin/guest-invitations/:id/status` | 更新状态 |
| POST | `/api/admin/guest-invitations/internal/lock` | 内部锁定(系统自动) |
| POST | `/api/admin/guest-invitations/internal/review` | 内部审查 |

## 乐捐管理
| GET | `/api/admin/lejuan-records` | 乐捐列表 |
| GET | `/api/admin/lejuan-records/:id/proof` | 获取付款截图 |

## 奖罚管理
| GET | `/api/admin/reward-penalties` | 奖罚列表 |
| POST | `/api/admin/reward-penalties` | 创建奖罚记录 |
| PUT | `/api/admin/reward-penalties/:id` | 更新奖罚 |
| DELETE | `/api/admin/reward-penalties/:id` | 删除奖罚 |
| GET | `/api/admin/reward-penalties/targets` | 奖罚目标列表 |
| POST | `/api/admin/reward-penalties/sync` | 同步奖罚数据 |

## 申请管理
| GET | `/api/admin/applications` | 申请列表 |
| GET | `/api/admin/applications/my-month-count` | 当月申请配额 |
| POST | `/api/admin/applications` | 创建申请 |
| PUT | `/api/admin/applications/:id/status` | 审批(通过/拒绝) |
| POST | `/api/admin/applications/:id/review` | 审查处理 |

## 系统配置
| GET | `/api/admin/system-config` | 系统配置列表 |
| PUT | `/api/admin/system-config/:key` | 更新配置 |

## 系统报告
| GET | `/api/system-report` | 系统报告列表 |
| GET | `/api/system-report/cron-logs` | Cron日志列表(taskName/taskType/status/limit) |
| GET | `/api/system-report/cron-tasks` | Cron任务列表 |
| POST | `/api/system-report/cron/:name/trigger` | 手动触发Cron任务 |
| POST | `/api/system-report/cron/:name/toggle` | 启用/禁用Cron任务 |
| GET | `/api/system-report/timer-logs` | 计时器日志(type/action/limit) |
| GET | `/api/system-report/active-timers` | 活跃计时器详情 |
| GET | `/api/system-report/sql-audit` | SQL审计日志 |
| DELETE | `/api/system-report/sql-audit` | 清空SQL审计日志 |

## 台桌状态同步
| POST | `/api/admin/sync/tables` | 同步台桌状态(写cron_log) |
| POST | `/api/admin/sync/tables/error` | 同步失败上报(无需认证,写cron_log+发通知) |
| GET | `/api/admin/sync-tables-status` | 获取最近同步状态 |

## 通知管理
| POST | `/api/notifications/manage/send` | 发送通知(店长/助教管理/管理员) |
| GET | `/api/notifications/manage/list` | 已发送通知列表 |
| GET | `/api/notifications/manage/:id/recipients` | 通知接收者详情 |
| GET | `/api/notifications/manage/employees` | 可选员工列表 |

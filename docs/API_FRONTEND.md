# API 前端接口文档（用户端）

> 基础URL: `http://localhost:` | 响应格式: JSON

## 公共
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |

## 首页
| GET | `/api/home?t=台桌拼音` | 首页数据(banner/公告/热门商品/人气助教/台桌信息) |

## 商品选项
| GET | `/api/product-options?category=&product_name=` | 商品可选项(温度/糖度)，无选项返回null |

## 商品
| GET | `/api/categories` | 商品分类列表 |
| GET | `/api/products?category=` | 商品列表(可筛选) |
| GET | `/api/products/:name` | 商品详情 |

## 购物车
| POST | `/api/cart` | 添加商品(sessionId, tableNo, productName, quantity, options) |
| GET | `/api/cart/:sessionId` | 获取购物车 |
| PUT | `/api/cart` | 更新数量(sessionId, productName, quantity, options) |
| DELETE | `/api/cart` | 删除商品(sessionId, productName, options) |
| DELETE | `/api/cart/:sessionId` | 清空购物车 |
| PUT | `/api/cart/table` | 更新台桌号(sessionId, tableNo) |

## 服务单
| POST | `/api/service-orders` | 创建服务单(需auth:助教/后台用户) |
| POST | `/api/service-orders/guest` | 游客创建(邀请助教上桌,无需认证) |
| GET | `/api/service-orders` | 服务单列表(admin角色) |
| PUT | `/api/service-orders/:id/status` | 更新状态(待处理/处理中/已完成/已取消) |

## 订单
| POST | `/api/order` | 提交订单(sessionId, tableNo) |
| GET | `/api/orders/:sessionId` | 获取订单列表 |

## 助教
| GET | `/api/coaches` | 助教列表(可筛选level/is_popular) |
| GET | `/api/coaches/:coach_no` | 助教详情 |
| POST | `/api/coaches/login` | 助教登录(coach_no, id_card_last6) |
| PUT | `/api/coaches/:coach_no/profile` | 更新资料(需coach token) |
| GET | `/api/coaches/:coach_no/popularity` | 获取人气值 |
| POST | `/api/coaches/:coach_no/popularity` | 人气投票(sessionId) |

## 台桌
| GET | `/api/tables` | 台桌列表 |
| GET | `/api/tables/:name` | 台桌详情 |
| GET | `/api/table/:pinyin` | 通过拼音获取台桌 |

## VIP包房
| GET | `/api/vip-rooms` | 包房列表 |
| GET | `/api/vip-rooms/:id` | 包房详情 |

## 会员
| POST | `/api/sms/send` | 发送短信验证码(phone) |
| POST | `/api/member/login-sms` | 短信登录(phone, code) |
| POST | `/api/member/login` | 微信登录(code, phoneCode) |
| GET | `/api/member/profile` | 会员信息(需member token) |
| PUT | `/api/member/profile` | 更新会员信息 |
| GET | `/api/member/orders` | 会员订单列表 |

## 约客（助教专用）
| GET | `/api/guest-invitations/my-records` | 获取最近10天约客记录(需coach token) |
| POST | `/api/guest-invitations` | 提交约客记录(coach_no, date, shift, images) |

## 通知
| GET | `/api/notifications` | 我的通知列表(page/pageSize, 未阅优先) |
| GET | `/api/notifications/unread-count` | 未阅通知数量 |
| PUT | `/api/notifications/:id/read` | 标记已阅 |

# API 公共文档

## 基本信息
- 基础URL: `http://localhost:8081`
- 响应格式: JSON
- 认证: JWT Token（后台管理需要）

## 限流
| 类型 | 限制 |
|------|------|
| API接口 | 60次/分钟/IP |
| 后台管理 | 120次/分钟/IP |
| 白名单(/api/health, /api/front-config, /api/agreement/) | 无限制 |

超出返回 429: `{ "error": "请求太频繁，请稍后再试" }`

## 爬虫拦截
以下 UA 返回 403: semrush, ahrefs, mj12bot, dotbot, baiduspider, yandexbot, sogou, 360spider, bytespider, petalbot, spider, crawler, scraper

## 文件上传
- `POST /api/upload/image` → `{ "url": "/uploads/images/xxx.jpg" }`
- `POST /api/upload/video` → `{ "url": "/uploads/videos/xxx.mp4" }`
- `GET /api/oss/sts?type=&ext=&dir=` → OSS签名URL（前端直传）
- `POST /api/oss/upload` → `{ "url": "https://xxx.oss.../xxx.jpg" }`

### OSS目录分配
| 页面 | dir |
|------|-----|
| 助教/包房 | `coaches/` |
| 约客/加班/公休申请 | `TgTemp/` |

## 协议
- `GET /api/agreement/user` - 用户协议
- `GET /api/agreement/privacy` - 隐私政策

## 错误响应
统一格式 `{ "error": "描述" }`，常见状态码: 200/400/401/403/404/500

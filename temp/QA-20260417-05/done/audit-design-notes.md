# 设计审计报告

## 审计结果：有条件通过（1个P1问题）

### ✅ 通过项

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 编码规范-时间处理 | ✅ | 无 datetime('now')、手动时区偏移 |
| 编码规范-DB连接 | ✅ | 使用 require('../db') 复用单连接 |
| 编码规范-DB写入 | ✅ | 只读查询，无写入操作 |
| API参数校验 | ✅ | 检查 period 必填和有效值 |
| SQL参数化查询 | ✅ | 使用 ? 占位符，防SQL注入 |
| 权限校验 | ✅ | invitationStats 权限已配置（管理员/店长/助教管理=true） |
| 错误处理 | ✅ | try/catch + 500 响应 |
| 约课率算法 | ✅ | valid/(notInvited+invalid+valid)，除零保护 |
| 漏约排序 | ✅ | ORDER BY missed_count DESC, coach_no ASC |
| 前端页面结构 | ✅ | 时间标签、统计卡片、约课率、漏约列表 |
| 入口注册 | ✅ | member.vue 新增按钮 + pages.json 路由 + api-v2.js 方法 |
| 边界情况 | ✅ | 空数据、除零、无工号、跨月、1月查上月 |
| Git提交 | ✅ | 代码已提交 (16d975e + e4a5176) |

### ⚠️ P1 问题：头像URL硬编码生产环境地址

**文件**: `tgservice/backend/routes/guest-invitations.js` 第708行

```javascript
photoUrl = photos[0].startsWith('http') ? photos[0] : 'http://47.238.80.12:8081' + photos[0];
```

**问题**: 硬编码了生产环境 IP 和端口，开发环境（tg.tiangong.club:8088）无法正确显示头像。

**建议修复**: 使用动态基础 URL（如从环境变量或请求头获取）:
```javascript
const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
photoUrl = photos[0].startsWith('http') ? photos[0] : baseUrl + photos[0];
```

**影响**: 开发环境测试时助教头像可能无法显示。可后续修复，不阻塞 QA 流程。

### ℹ️ 备注

- 设计文档中写的是 LEFT JOIN coaches，实际代码是 INNER JOIN coaches。INNER JOIN 更正确（漏约列表只需要已关联教练的数据）。
- 日期计算使用原生 Date 而非 TimeUtil，但服务器时区已设为 Asia/Shanghai，功能上无问题。

# QA 报告：申请提交接口 Bug 修复

**QA编号**: QA-20260416-01  
**日期**: 2026-04-16  
**状态**: ✅ 全部通过  

---

## 一、Bug 概述

- **文件**: `/TG/tgservice/backend/routes/applications.js`
- **错误**: `ReferenceError: status is not defined`（第64行）
- **影响**: 所有通过 POST `/api/applications` 提交的申请均失败（500 错误）
- **根因**: 提交 `bb4d5bc`（2026-04-15 14:49）清理乐捐代码时误删了 `status` 变量定义

---

## 二、修复方案

在 validTypes 验证后、INSERT 语句前添加：

```javascript
const status = 0; // 新申请状态为待处理
```

---

## 三、代码变更

| 文件 | 变更 |
|------|------|
| `tgservice/backend/routes/applications.js` | 第50行新增 `const status = 0;` |

**Git 提交**: `f825d5f` - "fix: 恢复 applications.js 中 status 变量定义，修复 ReferenceError"

---

## 四、测试结果

| 类别 | 用例数 | 通过 | 失败 |
|------|--------|------|------|
| 正常流程 | 5 | 5 | 0 |
| 异常流程 | 4 | 4 | 0 |
| 数据库验证 | 1 | 1 | 0 |
| **合计** | **10** | **10** | **0** |

### 测试用例详情

| 用例 | 测试项 | 结果 |
|------|--------|------|
| TC-01 | 提交晚加班申请 | ✅ |
| TC-02 | 提交早加班申请 | ✅ |
| TC-03 | 提交公休申请 | ✅ |
| TC-04 | 提交约客记录 | ✅ |
| TC-05 | 助教身份提交申请 | ✅ |
| TC-06 | 缺少 applicant_phone | ✅ |
| TC-07 | 缺少 application_type | ✅ |
| TC-08 | 无效的申请类型 | ✅ |
| TC-09 | 无认证 Token | ✅ |
| TC-10 | 数据库 status 验证 | ✅ |

---

## 五、编码规范验证

| 规则 | 状态 |
|------|------|
| 时间处理使用 TimeUtil | ✅ |
| 数据库复用 db/index.js 连接 | ✅ |
| 数据库写入使用 runInTransaction | ✅ |

---

## 六、结论

✅ **Bug 修复验证通过**，可以发布到生产环境。

### 发布步骤

1. 构建 Docker 镜像
2. 重启生产容器 `docker restart tgservice`
3. 验证申请提交功能

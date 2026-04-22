# 测试摘要 - API 文件合并

## 任务信息
- **测试员**: B
- **任务**: 编写编译验证和功能验证测试用例
- **时间**: 2026-04-22 22:00

## 输出文件
| 文件 | 说明 |
|------|------|
| test-cases.md | 详细测试用例文档（8.9KB） |
| run-tests.sh | 可执行测试脚本（3.2KB） |

## 测试用例清单

### 1. 编译测试
- **TC-1.1**: H5 开发版本编译
  - 命令: `npm run build:h5:dev`
  - 验收: 无错误，输出目录存在

### 2. 文件检查
- **TC-2.1**: api-v2.js 文件删除验证
  - 命令: `ls src/utils/api-v2.js`
  - 验收: 文件不存在

- **TC-2.2**: 编译产物中无 api-v2 引用
  - 命令: `find dist -name "*api-v2*"`
  - 验收: 无输出

### 3. Import 检查
- **TC-3.1**: 源代码中无 api-v2 引用
  - 命令: `grep -r "api-v2" src/`
  - 验收: 无输出

- **TC-3.2**: api.js 包含合并的功能
  - 命令: `grep` 检查 10 个模块
  - 验收: 所有模块都存在

## 受影响的文件（26 个）

需要修改 import 语句的页面：

```
src/pages/internal/table-action.vue
src/pages/internal/guest-invitation-stats.vue
src/pages/internal/clock.vue
src/pages/internal/rest-approval.vue
src/pages/internal/service-order.vue
src/pages/internal/lejuan.vue
src/pages/internal/leave-request-apply.vue
src/pages/internal/overtime-apply.vue
src/pages/internal/shift-change-approval.vue
src/pages/internal/invitation-upload.vue
src/pages/internal/leave-approval.vue
src/pages/internal/shift-change-apply.vue
src/pages/internal/missing-table-out-stats.vue
src/pages/internal/leave-calendar.vue
src/pages/internal/lejuan-list.vue
src/pages/internal/attendance-review.vue
src/pages/internal/rest-apply.vue
src/pages/internal/leave-request-approval.vue
src/pages/internal/leave-apply.vue
src/pages/internal/lejuan-proof.vue
src/pages/internal/water-board.vue
src/pages/internal/water-board-view.vue
src/pages/internal/overtime-approval.vue
src/pages/internal/cashier-dashboard.vue
src/pages/internal/invitation-review.vue
src/pages/member/member.vue
```

## 运行测试

程序员 A 完成合并后，执行：

```bash
/TG/temp/QA-20260422-04/run-tests.sh
```

测试结果将输出到：
- `/TG/temp/QA-20260422-04/build.log` - 编译日志
- 终端输出 - 测试结果汇总

---

**测试员 B 已完成测试用例编写。**
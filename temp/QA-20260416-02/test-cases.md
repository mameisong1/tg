# 测试用例 - login-sms coachInfo 完整返回验证

## QA需求
修改 `/api/member/login-sms` 接口，让 coachInfo 返回完整数据（phone、employeeId、shift、status）。

## 测试环境
| 服务 | 地址 |
|------|------|
| 后端API | http://127.0.0.1:8088 |
| 前端H5 | http://127.0.0.1:8089 |

## 测试账号
- 手机号：18680174119
- 验证码：888888

---

## TC-01: API 验证 login-sms 返回完整 coachInfo

**目标**：验证 login-sms 接口返回的 coachInfo 包含 phone、employeeId、shift、status 字段

**步骤**：
1. 调用 POST /api/member/login-sms，传入手机号和验证码
2. 检查返回的 coachInfo 对象
3. 验证包含字段：phone、employeeId、shift、status

**预期结果**：
- coachInfo.phone 存在且不为空
- coachInfo.employeeId 存在
- coachInfo.shift 存在
- coachInfo.status 存在

---

## TC-02: API 对比 profile 接口 coachInfo 字段一致性

**目标**：对比 login-sms 和 profile 接口返回的 coachInfo 字段是否一致

**步骤**：
1. 调用 login-sms 接口获取 coachInfo
2. 调用 profile 接口获取 coachInfo
3. 对比两者的字段

**预期结果**：
- 两个接口返回的 coachInfo 包含相同的字段

---

## TC-03: 浏览器登录 - coachInfo 写入 localStorage

**目标**：验证浏览器登录后 coachInfo 正确写入 localStorage

**步骤**：
1. 打开 H5 页面 http://127.0.0.1:8089
2. 输入手机号 18680174119
3. 输入验证码 888888
4. 点击登录
5. 检查 localStorage 中 coachInfo 字段

**预期结果**：
- 登录成功，页面跳转到首页
- localStorage.coachInfo 包含 phone 字段

---

## TC-04: 登录后立即进行加班申请（核心验收）⭐

**目标**：验证登录后立刻进入加班申请页面能成功提交

**步骤**：
1. 登录成功后，进入加班申请页面 http://127.0.0.1:8089/#/pages/internal/overtime-apply
2. 填写加班时长
3. 填写备注
4. 上传图片
5. 提交申请
6. 截图保存提交成功页面

**预期结果**：
- 加班申请提交成功
- 页面显示提交成功提示

---

## 测试时间
2026-04-16

## 测试人员
阿天（测试员B）

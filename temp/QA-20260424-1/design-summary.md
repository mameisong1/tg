## 邀请助教上桌功能设计摘要

### 修改文件
- （前端）

### 功能实现
1. **按钮改名**：预约教练 → 邀请上桌
2. **按钮状态**：根据水牌状态（早班空闲/晚班空闲）控制可用/禁用
3. **台桌号检测**：进入页面时检查Storage失效，点击时再次检查
4. **对话框**：复用BeautyModal组件，保持样式一致
5. **服务单**：调用现有API POST /api/service-orders，内容格式：助教上桌邀请函（工号 艺名）

### API调用
- GET /api/coaches/:coachNo → 助教信息+水牌状态
- GET /api/water-boards/:coachNo → 水牌原始状态
- POST /api/service-orders → 创建邀请服务单

### 数据库变更
无需新增表或字段
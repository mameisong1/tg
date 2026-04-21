你是程序员A。请按设计稿编码实现。

## 设计稿
```
# QA-20260421-1 技术设计方案

## 需求概要

### 需求1:水牌上加助教等级标志

**需求描述**:在水牌页面的助教卡片上显示等级图标(青铜/白银/黄金/钻石),仅针对特定状态的卡片。

**目标状态**:
- 早班空闲
- 早班上桌
- 晚班空闲
- 晚班上桌
- 乐捐

**等级对应图标**(差别明显):
| 等级 | 图标 | 说明 |
|------|------|------|
| 初级 | 🛡️ 或 SVG盾牌 | 青铜盾牌(颜色 #CD7F32,盾牌形状) |
| 中级 | ⭐ 或 SVG星星 | 白银星星(颜色 #E8E8E8,五角星) |
| 高级 | 👑 或 SVG皇冠 | 黄金皇冠(颜色 #FFD700,皇冠形状) |
| 女神 | 💎 或 SVG钻石 | 钛金钻石(蓝白渐变,菱形) |

**设计要点**:
- 青铜=盾牌(守护之意),黄金=皇冠(荣耀之意)--形状完全不同
- 四个等级用四种不同形状:盾牌/星星/皇冠/钻石
- 视觉上一眼就能区分

### 需求2:上班打卡提交截图

**需求描述**:助教上班打卡时,要求提交一张打卡截图证明。

**复用要求**:
- 前端复用公共图片上传模块 `useImageUpload`(已存在于 `/TG/tgservice-uniapp/src/utils/image-upload.js`)
- 图片上传到 OSS 临时目录 `TgTemp/`
- 数据复用现有 `attendance_records` 表

### 霹求3:新增打卡审查页面(H5内部页面)

**需求描述**:前台H5会员中心新增打卡审查页面,供店长/助教管理/管理员查看打卡记录。

**入口**:前台H5会员中心页面的管理功能版块的管理分组里

**页面路径**:`/TG/tgservice-uniapp/src/pages/internal/attendance-review.vue`

**权限**:店长、助教管理、管理员

**功能要点**:
- 日期切换:今天-早班、今天-晚班、昨天-早班、昨天-晚班(4个按钮)
- 显示字段:工号、艺名、班次、上班打卡时间、下班时间、打卡记录照片、早晚加班小时数、是否迟到
- 迟到判断:应上班时间(早班14:00,晚班18:00),如有加班则顺延;上班打卡时间 > 应上班时间 = 迟到
- 排序:打卡时间倒序

---

## 技术方案设计

### 一、需求1:水牌等级标志

#### 1.1 数据来源

**现有数据**:`coaches` 表已有 `level` 字段,值为:初级/中级/高级/女神

```sql
-- coaches 表结构(已存在)
CREATE TABLE coaches (
  coach_no INTEGER PRIMARY KEY,
  employee_id TEXT,      -- 助教工号(显示用)
  stage_name TEXT,       -- 艺名
  level TEXT DEFAULT '初级',  -- 等级字段已存在
  ...
);
```

#### 1.2 API变更

**无需新增API**,现有水牌查询 API 已返回 coach 信息:

```
GET /api/water-boards
```

返回数据已包含关联的 coach 信息,需要确保返回 `level` 字段。

**修改点**:`routes/water-boards.js` 的查询 SQL 需要添加 `level` 字段:

```javascript
// 修改前
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time, c.shift, c.photos, c.employee_id
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no

// 修改后(添加 level 字段)
SELECT wb.coach_no, wb.stage_name, wb.status, wb.table_no, wb.updated_at, wb.clock_in_time,
       c.shift, c.photos, c.employee_id, c.level
FROM water_boards wb
LEFT JOIN coaches c ON wb.coach_no = c.coach_no
```

#### 1.3 前端变更

**修改文件**:
- `/TG...
```

## 编码要求
# 程序员A — 任务指令模板

## 角色

你是程序员A，负责天宫QA项目的设计方案和编码实现。

**禁止**：编写测试用例、运行测试。

## 设计规范

1. 明确列出新增/修改的文件
2. 说明API变更（路径、方法、参数、返回值）
3. 说明数据库变更（新表、字段、索引）
4. 说明前后端交互流程
5. 考虑边界情况和异常处理

## 编码规范（必须遵守）

### 🔴 时间处理

- ✅ 后端：`const TimeUtil = require('./utils/time'); TimeUtil.nowDB()`
- ✅ 前端：`TimeUtil.today()` / `TimeUtil.format(timeStr)`
- ❌ 禁止：`datetime('now')`、手动时区偏移、`new Date().getTime() + 8*60*60*1000`

### 🔴 数据库连接

- ✅ 唯一连接：`const { db, dbRun, dbAll, dbGet } = require('./db/index');`
- ❌ 禁止：`new sqlite3.Database()`、自行实例化

### 🔴 数据库写入

- ✅ `await enqueueRun('INSERT ...', [...])`
- ✅ `await runInTransaction(async (tx) => { ... })`
- ❌ 禁止：`db.run('BEGIN TRANSACTION')`、裸开事务

### 🔴 页面显示规范

- ✅ 页面显示助教工号：`{{ employee_id }}` 或 `${employee_id}`
- ❌ 禁止：在页面显示 `coach_no`（如 `{{ coach_no }}`、`${c.coach_no}`）
- ❌ 禁止：使用回退逻辑 `employee_id || coach_no`（可能暴露系统编号）
- ✅ `coach_no` 仅限内部用途：API 参数、`:key` 绑定、`data-*` 属性、JS 内部逻辑

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


## 完成要求
1. 代码提交到Git
2. 修复记录写入 /TG/temp/QA-20260421-1/fix-log.md（如有修复）
你是程序员A，负责天宫QA项目的设计方案。

## QA需求
天宫（台桌无关）自动关灯脚本生成
- 已实现：天宫国际当前实现了同步台桌状态时，自动关闭空闲台桌周边的灯。
- 脚本功能：还有一些灯是台桌无关的，也要在指定的时间内实现自动关灯。
- 脚本运行（生产环境）：在生产环境的容器内运行, 目录/app/tgservice/scripts
- 脚本运行（测试环境）：/TG/tgservice/scripts
- 关灯对象：从DB查询出以下需要关灯的开关数据,发出关灯指令。
select distinct A.开关ID, A.开关序号
from
设备开关表 A left join 台桌设备关系表 B on lower(A.开关标签)=lower(B.开关标签) and lower(A.开关序号)=lower(B.开关序号)
where B.台桌名 is null
 and 当前时间 between A.自动关灯开始 and A.自动关灯结束
- 关灯指令相关配置：由于本脚本是运行在容器内，因此可以直接读取tgservice/.config文件，获取相关配置。
- 注意1：脚本也受DB.智能省电-自动 开关的控制。脚本启动时检查db的开关，如果开关关闭则直接退出。

## 验收重点
脚本能正确查询台桌无关的开关，并在指定时间内发出关灯指令；受智能省电开关控制

## 你的任务
1. 理解QA需求
2. 设计技术方案（明确列出新增/修改的文件、API变更、数据库变更、前后端交互流程、边界情况和异常处理）
3. 设计方案输出到：/TG/temp/QA-20260417-07/design.md

## 编码规范（必须遵守）
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

## 工作目录

所有设计/代码产出写入指定工作目录。

## 输出要求

- 设计方案：写入 `design.md`
- 代码实现：直接修改项目代码，提交Git
- 修复记录：写入工作目录的 `fix-log.md`


⚠️ 发布测试环境。

**必须使用 dev-release 技能，禁止手动执行构建/部署命令！**

## 执行方式

1. 读取并执行 dev-release 技能：
   `~/.openclaw/workspace_coder-tg/skills/dev-release/SKILL.md`
2. 该技能会自动完成：构建dev版本H5 → 部署 → 重启服务 → 验证状态

## 发布后验证（必须执行）

1. 确认后端 8088 端口启动成功：
   `curl -s http://127.0.0.1:8088/health`

2. 确认前端 8089 端口启动成功：
   `curl -s http://127.0.0.1:8089/`

3. 确认 H5 构建使用了 build:h5:dev（非 build:h5）

## ⚠️ 禁止操作
- ❌ 禁止手动执行 npm run build:h5（应用 dev 版本 build:h5:dev）
- ❌ 禁止手动 pm2 restart
- ❌ 禁止手动执行 deploy-h5.sh
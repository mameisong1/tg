#!/bin/bash
cd /root/.openclaw/workspace_coder-tg/skills/tiangong-qa

echo "===== 测试1: init 步骤 ====="
mkdir -p /TG/temp/QA-test-001
echo '{"qaRequirement":"测试runner.js流程","acceptanceFocus":"验证前置条件检查"}' > /TG/temp/QA-test-001/state.json
node steps/runner.js init /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试2: parallel-design 步骤 ====="
node steps/runner.js parallel-design /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试3: audit-design 步骤 ====="
touch /TG/temp/QA-test-001/design.md
echo "# 测试设计稿" > /TG/temp/QA-test-001/design.md
node steps/runner.js audit-design /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试4: audit-testcases（无user-confirmed，应该报错） ====="
touch /TG/temp/QA-test-001/test-cases.md
echo "# 测试用例" > /TG/temp/QA-test-001/test-cases.md
echo "touch done/audit-design.done" > /dev/null
mkdir -p /TG/temp/QA-test-001/done
echo '{"auditPass":true}' > /TG/temp/QA-test-001/done/audit-design.done
node steps/runner.js audit-testcases /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json
TEST4_EXIT=$?
if [ $TEST4_EXIT -eq 2 ]; then
  echo "✅ 测试4通过：没有 user-confirmed 时报错退出"
else
  echo "❌ 测试4失败：应该报错但没有"
fi

echo ""
echo "===== 测试5: audit-testcases（有user-confirmed，应该通过） ====="
touch /TG/temp/QA-test-001/done/user-confirmed
node steps/runner.js audit-testcases /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试6: coding 步骤 ====="
node steps/runner.js coding /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试7: deploy 步骤 ====="
node steps/runner.js deploy /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试8: testing 步骤 ====="
node steps/runner.js testing /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 测试9: report 步骤 ====="
node steps/runner.js report /TG/temp/QA-test-001 /TG/temp/QA-test-001/state.json

echo ""
echo "===== 清理 ====="
rm -rf /TG/temp/QA-test-001

echo ""
echo "===== 所有测试完成 ====="

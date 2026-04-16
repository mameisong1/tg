#!/bin/bash
cd /root/.openclaw/workspace_coder-tg/skills/tiangong-qa

echo "===== 测试1: init ====="
rm -rf /TG/temp/QA-test-002
mkdir -p /TG/temp/QA-test-002
echo '{"qaRequirement":"测试runner.js流程","acceptanceFocus":"验证前置条件检查"}' > /TG/temp/QA-test-002/state.json
node steps/runner.js init /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "===== 测试2: parallel-design ====="
node steps/runner.js parallel-design /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "===== 测试3: audit-design（不自动写done标记）====="
echo "# 测试设计稿" > /TG/temp/QA-test-002/design.md
node steps/runner.js audit-design /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "--- 验证: audit-design.done 不应该被自动创建 ---"
if [ -f /TG/temp/QA-test-002/done/audit-design.done ]; then
  echo "❌ 失败：audit-design.done 被自动创建了"
else
  echo "✅ 通过：audit-design.done 没有被自动创建"
fi

echo ""
echo "--- 模拟: 协调者完成审计，手动创建标记 ---"
echo '{"auditResult":"通过"}' > /TG/temp/QA-test-002/done/audit-design.done
touch /TG/temp/QA-test-002/done/user-confirmed

echo ""
echo "===== 测试4: audit-testcases ====="
echo "# 测试用例" > /TG/temp/QA-test-002/test-cases.md
node steps/runner.js audit-testcases /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "--- 验证: audit-testcases.done 不应该被自动创建 ---"
if [ -f /TG/temp/QA-test-002/done/audit-testcases.done ]; then
  echo "❌ 失败：audit-testcases.done 被自动创建了"
else
  echo "✅ 通过：audit-testcases.done 没有被自动创建"
fi

echo ""
echo "--- 模拟: 协调者完成审计测试用例，手动创建标记 ---"
echo '{"auditResult":"通过"}' > /TG/temp/QA-test-002/done/audit-testcases.done

echo ""
echo "===== 测试5: coding ====="
node steps/runner.js coding /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "--- 模拟: 协调者完成编码 ---"
echo '{"codingResult":"通过"}' > /TG/temp/QA-test-002/done/coding.done

echo ""
echo "===== 测试6: deploy ====="
node steps/runner.js deploy /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "--- 模拟: 协调者完成发布 ---"
echo '{"deployResult":"通过"}' > /TG/temp/QA-test-002/done/deploy.done

echo ""
echo "===== 测试7: testing ====="
node steps/runner.js testing /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "--- 模拟: 协调者完成测试 ---"
echo '{"testingResult":"通过"}' > /TG/temp/QA-test-002/done/testing.done

echo ""
echo "===== 测试8: report ====="
node steps/runner.js report /TG/temp/QA-test-002 /TG/temp/QA-test-002/state.json

echo ""
echo "===== 清理 ====="
rm -rf /TG/temp/QA-test-002

echo ""
echo "===== 所有测试完成 ====="

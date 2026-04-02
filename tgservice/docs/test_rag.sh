#!/bin/bash
# TGSERVICE RAG 系统测试脚本

echo "=========================================="
echo "TGSERVICE RAG 系统测试"
echo "=========================================="

# 1. 检查RAG服务
echo ""
echo "[1/4] 检查RAG服务..."
curl -s http://localhost:8085/health | python3 -m json.tool

# 2. 测试代码检索
echo ""
echo "[2/4] 测试代码检索..."
curl -s -X POST http://localhost:8085/search/code \
  -H "Content-Type: application/json" \
  -d '{"query": "下单", "top_k": 2}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'找到 {d[\"count\"]} 个结果')"

# 3. 测试文档检索
echo ""
echo "[3/4] 测试文档检索..."
curl -s -X POST http://localhost:8085/search/docs \
  -H "Content-Type: application/json" \
  -d '{"query": "数据表", "top_k": 2}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'找到 {d[\"count\"]} 个结果')"

# 4. 检查向量库
echo ""
echo "[4/4] 检查向量库..."
ls -la /DB/.chroma/

echo ""
echo "=========================================="
echo "✓ 测试完成"
echo "=========================================="
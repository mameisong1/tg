#!/usr/bin/env python3
"""
TGSERVICE 代码切片索引构建脚本 (增量更新版)
- 新文件: 添加切片
- 变化文件: 更新切片  
- 删除文件: 删除切片
- 未变化文件: 跳过
"""

import os
import sys
import re
import hashlib
from pathlib import Path

# 添加虚拟环境路径
venv_path = "/DB/rag-venv/lib/python3.12/site-packages"
if venv_path not in sys.path:
    sys.path.insert(0, venv_path)

import chromadb
from chromadb.config import Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# 配置
CHROMA_PATH = "/DB/.chroma"
COLLECTION_NAME = "tgservice_code"
PROJECTS = [
    {"path": "/TG/tgservice/backend", "name": "tgservice-backend"},
    {"path": "/TG/tgservice-uniapp/src", "name": "tgservice-uniapp"},
]

# 支持的文件扩展名
EXTENSIONS = [".js", ".vue"]

def get_file_hash(filepath):
    """计算文件MD5哈希"""
    with open(filepath, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def extract_js_functions(code):
    """使用正则表达式从JS代码中提取函数"""
    functions = []
    
    # 1. 普通函数 function xxx(...) { ... }
    pattern1 = r'(function\s+(\w+)\s*\([^)]*\)\s*\{)'
    for match in re.finditer(pattern1, code):
        start = match.start()
        func_name = match.group(2)
        brace_count = 1
        pos = match.end()
        while pos < len(code) and brace_count > 0:
            if code[pos] == '{':
                brace_count += 1
            elif code[pos] == '}':
                brace_count -= 1
            pos += 1
        func_code = code[start:pos]
        start_line = code[:start].count('\n') + 1
        end_line = code[:pos].count('\n') + 1
        functions.append({
            "type": "function",
            "name": func_name,
            "code": func_code[:2000],
            "start_line": start_line,
            "end_line": end_line
        })
    
    # 2. 箭头函数 const xxx = (...) => { ... }
    pattern2 = r'(const\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)'
    for match in re.finditer(pattern2, code):
        start = match.start()
        func_name = match.group(2)
        brace_count = 1
        pos = match.end()
        while pos < len(code) and brace_count > 0:
            if code[pos] == '{':
                brace_count += 1
            elif code[pos] == '}':
                brace_count -= 1
            pos += 1
        func_code = code[start:pos]
        start_line = code[:start].count('\n') + 1
        end_line = code[:pos].count('\n') + 1
        functions.append({
            "type": "arrow_function",
            "name": func_name,
            "code": func_code[:2000],
            "start_line": start_line,
            "end_line": end_line
        })
    
    # 3. async函数 async function xxx(...) { ... }
    pattern3 = r'(async\s+function\s+(\w+)\s*\([^)]*\)\s*\{)'
    for match in re.finditer(pattern3, code):
        start = match.start()
        func_name = match.group(2)
        brace_count = 1
        pos = match.end()
        while pos < len(code) and brace_count > 0:
            if code[pos] == '{':
                brace_count += 1
            elif code[pos] == '}':
                brace_count -= 1
            pos += 1
        func_code = code[start:pos]
        start_line = code[:start].count('\n') + 1
        end_line = code[:pos].count('\n') + 1
        functions.append({
            "type": "async_function",
            "name": func_name,
            "code": func_code[:2000],
            "start_line": start_line,
            "end_line": end_line
        })
    
    # 4. 对象方法 xxx(...) { ... } (在class或对象内部)
    pattern4 = r'(?:^|\n)(\s+)(async\s+)?(\w+)\s*\([^)]*\)\s*\{'
    for match in re.finditer(pattern4, code):
        indent = match.group(1)
        is_async = match.group(2)
        func_name = match.group(3)
        if func_name in ['if', 'for', 'while', 'switch', 'catch', 'function', 'class']:
            continue
        start = match.start()
        brace_count = 1
        pos = match.end()
        while pos < len(code) and brace_count > 0:
            if code[pos] == '{':
                brace_count += 1
            elif code[pos] == '}':
                brace_count -= 1
            pos += 1
        func_code = code[start:pos]
        start_line = code[:start].count('\n') + 1
        end_line = code[:pos].count('\n') + 1
        if not any(f['name'] == func_name and f['start_line'] == start_line for f in functions):
            functions.append({
                "type": "method",
                "name": func_name,
                "code": func_code[:2000],
                "start_line": start_line,
                "end_line": end_line
            })
    
    return functions

def process_file(filepath, project_name):
    """处理单个文件，提取代码片段"""
    chunks = []
    
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return chunks
    
    rel_path = os.path.relpath(filepath, "/TG")
    file_hash = get_file_hash(filepath)
    
    # Vue文件特殊处理
    if filepath.endswith(".vue"):
        script_match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
        if script_match:
            script_content = script_match.group(1)
            functions = extract_js_functions(script_content)
            for func in functions:
                chunks.append({
                    "id": f"{rel_path}#{func['name']}#{func['start_line']}",
                    "text": func["code"],
                    "metadata": {
                        "file": rel_path,
                        "type": func["type"],
                        "name": func["name"],
                        "start_line": func["start_line"],
                        "end_line": func["end_line"],
                        "project": project_name,
                        "hash": file_hash
                    }
                })
        
        template_match = re.search(r'<template[^>]*>(.*?)</template>', content, re.DOTALL)
        if template_match:
            template_content = template_match.group(1)[:1500]
            chunks.append({
                "id": f"{rel_path}#template",
                "text": f"<!-- Template -->\n{template_content}",
                "metadata": {
                    "file": rel_path,
                    "type": "template",
                    "name": "template",
                    "project": project_name,
                    "hash": file_hash
                }
            })
    else:
        functions = extract_js_functions(content)
        for func in functions:
            chunks.append({
                "id": f"{rel_path}#{func['name']}#{func['start_line']}",
                "text": func["code"],
                "metadata": {
                    "file": rel_path,
                    "type": func["type"],
                    "name": func["name"],
                    "start_line": func["start_line"],
                    "end_line": func["end_line"],
                    "project": project_name,
                    "hash": file_hash
                }
            })
    
    if not chunks and len(content) > 100:
        chunks.append({
            "id": f"{rel_path}#file",
            "text": content[:3000],
            "metadata": {
                "file": rel_path,
                "type": "file",
                "name": os.path.basename(filepath),
                "project": project_name,
                "hash": file_hash
            }
        })
    
    seen_ids = set()
    unique_chunks = []
    for chunk in chunks:
        if chunk["id"] not in seen_ids:
            seen_ids.add(chunk["id"])
            unique_chunks.append(chunk)
    
    return unique_chunks

def main():
    print("=" * 60)
    print("TGSERVICE 代码切片索引构建 (增量更新模式)")
    print("=" * 60)
    
    # 初始化embedding模型
    print("\n[1/5] 加载Embedding模型...")
    embed_model = HuggingFaceEmbedding(
        model_name="BAAI/bge-small-zh-v1.5",
        cache_folder="/DB/.cache/huggingface"
    )
    print("  ✓ BGE-small-zh 加载完成")
    
    # 初始化Chroma - 使用 get_or_create，不删除现有数据
    print("\n[2/5] 连接Chroma向量库...")
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    
    # 获取或创建集合（不删除现有数据！）
    collection = chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )
    print(f"  ✓ 集合: {COLLECTION_NAME}")
    print(f"  ✓ 现有切片数: {collection.count()}")
    
    # 获取现有数据的文件哈希映射
    print("\n[3/5] 获取现有索引状态...")
    existing_data = collection.get(include=["metadatas"])
    
    # 构建 file -> hash 映射
    existing_file_hashes = {}
    existing_ids_by_file = {}  # file -> [id1, id2, ...]
    
    for i, metadata in enumerate(existing_data.get("metadatas", [])):
        file_path = metadata.get("file", "")
        file_hash = metadata.get("hash", "")
        chunk_id = existing_data["ids"][i]
        
        if file_path:
            existing_file_hashes[file_path] = file_hash
            if file_path not in existing_ids_by_file:
                existing_ids_by_file[file_path] = []
            existing_ids_by_file[file_path].append(chunk_id)
    
    print(f"  ✓ 已索引文件数: {len(existing_file_hashes)}")
    
    # 扫描所有项目文件
    print("\n[4/5] 扫描文件并检测变化...")
    current_files = {}  # file -> (hash, chunks)
    new_count = 0
    changed_count = 0
    unchanged_count = 0
    
    for project in PROJECTS:
        project_path = project["path"]
        project_name = project["name"]
        
        if not os.path.exists(project_path):
            print(f"  跳过不存在的项目: {project_path}")
            continue
        
        for ext in EXTENSIONS:
            for filepath in Path(project_path).rglob(f"*{ext}"):
                if "node_modules" in str(filepath) or ".git" in str(filepath):
                    continue
                
                rel_path = os.path.relpath(str(filepath), "/TG")
                file_hash = get_file_hash(str(filepath))
                
                # 检查文件状态
                if rel_path not in existing_file_hashes:
                    status = "新增"
                    new_count += 1
                elif existing_file_hashes[rel_path] != file_hash:
                    status = "变化"
                    changed_count += 1
                else:
                    status = "跳过"
                    unchanged_count += 1
                    continue
                
                print(f"  [{status}] {rel_path}")
                
                # 处理文件
                chunks = process_file(str(filepath), project_name)
                current_files[rel_path] = (file_hash, chunks)
    
    print(f"\n  统计: 新增 {new_count}, 变化 {changed_count}, 跳过 {unchanged_count}")
    
    # 检测已删除的文件
    deleted_files = []
    for file_path in existing_file_hashes:
        found = False
        for project in PROJECTS:
            full_path = os.path.join("/TG", file_path)
            if os.path.exists(full_path):
                found = True
                break
        if not found:
            deleted_files.append(file_path)
    
    if deleted_files:
        print(f"\n  检测到删除文件: {len(deleted_files)} 个")
        for f in deleted_files:
            print(f"  [删除] {f}")
    
    # 执行增量更新
    print("\n[5/5] 执行增量更新...")
    updated_count = 0
    deleted_count = 0
    
    # 更新新增和变化的文件
    if current_files:
        batch_size = 50
        all_chunks = []
        
        for rel_path, (file_hash, chunks) in current_files.items():
            all_chunks.extend(chunks)
        
        for i in range(0, len(all_chunks), batch_size):
            batch = all_chunks[i:i+batch_size]
            
            texts = [chunk["text"] for chunk in batch]
            ids = [chunk["id"] for chunk in batch]
            metadatas = [chunk["metadata"] for chunk in batch]
            
            embeddings = [embed_model.get_text_embedding(t) for t in texts]
            
            # 使用 upsert：存在则更新，不存在则添加
            collection.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=texts,
                metadatas=metadatas
            )
            
            updated_count += len(batch)
            print(f"  更新切片 {i+1}-{min(i+batch_size, len(all_chunks))} / {len(all_chunks)}")
    
    # 删除已不存在文件的切片
    if deleted_files:
        for file_path in deleted_files:
            if file_path in existing_ids_by_file:
                collection.delete(ids=existing_ids_by_file[file_path])
                deleted_count += len(existing_ids_by_file[file_path])
    
    # 最终统计
    print(f"\n{'=' * 60}")
    print(f"✓ 增量更新完成!")
    print(f"  - 向量库路径: {CHROMA_PATH}")
    print(f"  - 集合名称: {COLLECTION_NAME}")
    print(f"  - 更新切片数: {updated_count}")
    print(f"  - 删除切片数: {deleted_count}")
    print(f"  - 当前总切片数: {collection.count()}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
TGSERVICE 文档索引构建脚本 (增量更新版)
- 新文档: 添加切片
- 变化文档: 更新切片
- 删除文档: 删除切片
- 未变化文档: 跳过
"""

import os
import sys
import hashlib
from pathlib import Path

# 添加虚拟环境路径
venv_path = "/DB/rag-venv/lib/python3.12/site-packages"
if venv_path not in sys.path:
    sys.path.insert(0, venv_path)

import chromadb
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

# 配置
CHROMA_PATH = "/DB/.chroma"
COLLECTION_NAME = "tgservice_docs"
DOCS_PATH = "/TG/tgservice/docs"

def get_file_hash(filepath):
    """计算文件MD5哈希"""
    with open(filepath, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def split_markdown(content, max_chunk_size=1500):
    """将Markdown文档按段落分割成chunks"""
    chunks = []
    lines = content.split('\n')
    current_chunk = []
    current_size = 0
    current_heading = ""
    
    for line in lines:
        if line.startswith('#'):
            if current_chunk and current_size + len(line) > max_chunk_size:
                chunk_text = '\n'.join(current_chunk)
                if chunk_text.strip():
                    chunks.append({
                        "text": chunk_text,
                        "heading": current_heading
                    })
                current_chunk = []
                current_size = 0
            
            current_heading = line.lstrip('#').strip()
        
        current_chunk.append(line)
        current_size += len(line)
        
        if current_size > max_chunk_size:
            chunk_text = '\n'.join(current_chunk)
            if chunk_text.strip():
                chunks.append({
                    "text": chunk_text,
                    "heading": current_heading
                })
            current_chunk = []
            current_size = 0
    
    if current_chunk:
        chunk_text = '\n'.join(current_chunk)
        if chunk_text.strip():
            chunks.append({
                "text": chunk_text,
                "heading": current_heading
            })
    
    return chunks

def main():
    print("=" * 60)
    print("TGSERVICE 文档索引构建 (增量更新模式)")
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
        file_name = metadata.get("file", "")
        file_hash = metadata.get("hash", "")
        chunk_id = existing_data["ids"][i]
        
        if file_name:
            existing_file_hashes[file_name] = file_hash
            if file_name not in existing_ids_by_file:
                existing_ids_by_file[file_name] = []
            existing_ids_by_file[file_name].append(chunk_id)
    
    print(f"  ✓ 已索引文件数: {len(existing_file_hashes)}")
    
    # 扫描文档文件
    print("\n[4/5] 扫描文档并检测变化...")
    docs_dir = Path(DOCS_PATH)
    md_files = list(docs_dir.glob("*.md"))
    
    # 过滤掉构建脚本自身
    md_files = [f for f in md_files if not f.name.startswith("build_")]
    
    current_files = {}  # file -> (hash, chunks)
    new_count = 0
    changed_count = 0
    unchanged_count = 0
    
    for md_file in md_files:
        file_hash = get_file_hash(md_file)
        file_name = md_file.name
        
        # 检查文件状态
        if file_name not in existing_file_hashes:
            status = "新增"
            new_count += 1
        elif existing_file_hashes[file_name] != file_hash:
            status = "变化"
            changed_count += 1
        else:
            status = "跳过"
            unchanged_count += 1
            continue
        
        print(f"  [{status}] {file_name}")
        
        # 处理文档
        with open(md_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        chunks = split_markdown(content)
        chunk_list = []
        
        for i, chunk in enumerate(chunks):
            chunk_list.append({
                "id": f"{md_file.stem}#chunk{i}",
                "text": chunk["text"],
                "metadata": {
                    "file": file_name,
                    "heading": chunk["heading"],
                    "chunk_index": i,
                    "hash": file_hash
                }
            })
        
        current_files[file_name] = (file_hash, chunk_list)
    
    print(f"\n  统计: 新增 {new_count}, 变化 {changed_count}, 跳过 {unchanged_count}")
    
    # 检测已删除的文件
    deleted_files = []
    for file_name in existing_file_hashes:
        file_path = docs_dir / file_name
        if not file_path.exists():
            deleted_files.append(file_name)
    
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
        
        for file_name, (file_hash, chunks) in current_files.items():
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
        for file_name in deleted_files:
            if file_name in existing_ids_by_file:
                collection.delete(ids=existing_ids_by_file[file_name])
                deleted_count += len(existing_ids_by_file[file_name])
    
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
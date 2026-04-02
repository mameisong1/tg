#!/usr/bin/env python3
"""
彻底修复后台管理页面的导航栏
移除所有旧格式的导航链接
"""

import os
import re

ADMIN_DIR = '/TG/tgservice/frontend/admin'

# 统一的侧边栏HTML
SIDEBAR_TEMPLATE = '''  <div class="sidebar">
    <div class="sidebar-logo">
      <img src="/images/logo.png" alt="Logo">
      <div>
        <div class="sidebar-title">天宫国际</div>
        <div class="sidebar-sub">后台管理系统</div>
      </div>
    </div>
    <a href="index.html" class="nav-item{active_index}"><span class="nav-icon">📊</span> 数据概览</a>
    <a href="products.html" class="nav-item{active_products}"><span class="nav-icon">📦</span> 商品管理</a>
    <a href="categories.html" class="nav-item{active_categories}"><span class="nav-icon">📁</span> 分类管理</a>
    <a href="coaches.html" class="nav-item{active_coaches}"><span class="nav-icon">👩</span> 助教管理</a>
    <a href="orders.html" class="nav-item{active_orders}"><span class="nav-icon">🛒</span> 订单管理</a>
    <a href="tables.html" class="nav-item{active_tables}"><span class="nav-icon">🎱</span> 台桌管理</a>
    <a href="vip-rooms.html" class="nav-item{active_vip}"><span class="nav-icon">🛋️</span> 包房管理</a>
    <a href="home.html" class="nav-item{active_home}"><span class="nav-icon">🏠</span> 首页配置</a>
    <a href="users.html" class="nav-item{active_users}"><span class="nav-icon">👤</span> 用户管理</a>
  </div>'''

PAGE_ACTIVE_MAP = {
    'index.html': 'index',
    'products.html': 'products',
    'categories.html': 'categories',
    'coaches.html': 'coaches',
    'orders.html': 'orders',
    'tables.html': 'tables',
    'vip-rooms.html': 'vip',
    'home.html': 'home',
    'users.html': 'users'
}

def get_sidebar_for_page(filename):
    active_key = PAGE_ACTIVE_MAP.get(filename, '')
    result = SIDEBAR_TEMPLATE
    for key in PAGE_ACTIVE_MAP.values():
        if key == active_key:
            result = result.replace('{active_' + key + '}', ' active')
        else:
            result = result.replace('{active_' + key + '}', '')
    return result

def fix_html_file(filepath, filename):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到body标签
    body_match = re.search(r'<body[^>]*>', content)
    if not body_match:
        print(f"  未找到body标签: {filename}")
        return
    
    body_start = body_match.end()
    
    # 找到main内容区域（<div class="main">）
    main_match = re.search(r'<div class="main">', content[body_start:])
    if not main_match:
        print(f"  未找到main区域: {filename}")
        return
    
    main_pos = body_start + main_match.start()
    
    # 构建新内容：body标签 + 新sidebar + main区域
    new_sidebar = get_sidebar_for_page(filename)
    new_content = content[:body_start] + '\n' + new_sidebar + '\n  \n  ' + content[main_pos:]
    
    # 对于非index.html页面，移除退出登录按钮
    if filename != 'index.html':
        new_content = re.sub(r'<button[^>]*class="[^"]*logout-btn[^"]*"[^>]*>.*?</button>', '', new_content, flags=re.DOTALL)
        new_content = re.sub(r'<button[^>]*onclick="logout\(\)"[^>]*>.*?</button>', '', new_content, flags=re.DOTALL)
        new_content = re.sub(r'\.logout-btn\s*\{[^}]*\}', '', new_content)
        new_content = re.sub(r'function logout\(\)\s*\{[^}]*\}', '', new_content)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"  ✓ 已修复: {filename}")

def main():
    print("开始修复后台管理页面...\n")
    
    for filename in PAGE_ACTIVE_MAP.keys():
        filepath = os.path.join(ADMIN_DIR, filename)
        if os.path.exists(filepath):
            fix_html_file(filepath, filename)
        else:
            print(f"  文件不存在: {filename}")
    
    print("\n修复完成!")

if __name__ == '__main__':
    main()
#!/usr/bin/env python3
"""
修复后台管理页面的导航栏
1. 统一侧边栏样式
2. 只在index.html保留退出登录按钮
"""

import os
import re

ADMIN_DIR = '/TG/tgservice/frontend/admin'

# 统一的侧边栏HTML（不包含active状态）
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

# 页面文件名到active标记的映射
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
    """生成指定页面的侧边栏HTML"""
    active_key = PAGE_ACTIVE_MAP.get(filename, '')
    result = SIDEBAR_TEMPLATE
    
    # 设置所有active标记
    for key in PAGE_ACTIVE_MAP.values():
        if key == active_key:
            result = result.replace('{active_' + key + '}', ' active')
        else:
            result = result.replace('{active_' + key + '}', '')
    
    return result

def fix_html_file(filepath, filename):
    """修复单个HTML文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 移除旧的sidebar（从<div class="sidebar">到</div>，包含所有nav-item）
    # 找到sidebar开始和结束位置
    sidebar_start = content.find('<div class="sidebar">')
    if sidebar_start == -1:
        print(f"  未找到sidebar: {filename}")
        return
    
    # 找到sidebar结束位置（匹配</div>）
    depth = 0
    sidebar_end = -1
    i = sidebar_start
    while i < len(content):
        if content[i:i+5] == '<div ':
            depth += 1
        elif content[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                sidebar_end = i + 6
                break
        i += 1
    
    if sidebar_end == -1:
        print(f"  未找到sidebar结束: {filename}")
        return
    
    # 替换侧边栏
    new_sidebar = get_sidebar_for_page(filename)
    new_content = content[:sidebar_start] + new_sidebar + content[sidebar_end:]
    
    # 对于非index.html页面，移除退出登录按钮
    if filename != 'index.html':
        # 移除logout-btn按钮
        new_content = re.sub(r'<button[^>]*class="[^"]*logout-btn[^"]*"[^>]*>.*?</button>', '', new_content, flags=re.DOTALL)
        new_content = re.sub(r'<button[^>]*onclick="logout\(\)"[^>]*>.*?</button>', '', new_content, flags=re.DOTALL)
    
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
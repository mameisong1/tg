#!/bin/bash
# 统一更新所有后台页面的导航栏

NAV_BAR='
  <div class="sidebar">
    <div class="sidebar-logo">
      <img src="/images/logo.png" alt="Logo">
      <div>
        <div class="sidebar-title">天宫国际</div>
        <div class="sidebar-sub">后台管理系统</div>
      </div>
    </div>
    <a href="index.html" class="nav-item"><span class="nav-icon">📊</span> 数据概览</a>
    <a href="products.html" class="nav-item"><span class="nav-icon">📦</span> 商品管理</a>
    <a href="categories.html" class="nav-item"><span class="nav-icon">📁</span> 分类管理</a>
    <a href="coaches.html" class="nav-item"><span class="nav-icon">👩</span> 助教管理</a>
    <a href="orders.html" class="nav-item"><span class="nav-icon">🛒</span> 订单管理</a>
    <a href="tables.html" class="nav-item"><span class="nav-icon">🎱</span> 台桌管理</a>
    <a href="vip-rooms.html" class="nav-item"><span class="nav-icon">🛋️</span> 包房管理</a>
    <a href="home.html" class="nav-item"><span class="nav-icon">🏠</span> 首页配置</a>
    <a href="users.html" class="nav-icon">👤</span> 用户管理</a>
  </div>'

cd /TG/tgservice/frontend/admin

for file in index.html products.html categories.html coaches.html orders.html tables.html vip-rooms.html home.html users.html; do
  echo "Processing $file..."
  # 使用Python脚本来处理
done
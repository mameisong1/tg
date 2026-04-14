# 设计稿 A3：前台H5商品一览 - 搜索功能 + 分类筛选优化

> **需求**：商品一览增加搜索功能，优化分类筛选按钮版面（减少占用空间）
> **设计日期**：2026-04-14
> **设计人**：程序员 A3

---

## 一、现状分析

### 1.1 当前页面结构（H5）

```
┌──────────────────────────────┐
│      商品点单  (标题栏 44px)   │
├──────────────────────────────┤
│ 📋全部  🍺酒水  🧋奶茶  🥤饮料 │  ← 第1行：5个按钮
│ 🍪零食  🍜泡面  🌿槟榔  🍟小吃 │  ← 第2行：5个按钮（"其他"在第1行或溢出）
│ 📦其他                        │
├──────────────────────────────┤
│ 台桌信息区域                   │
├──────────────────────────────┤
│ ┌────────┐  ┌────────┐       │
│ │ 图片    │  │ 图片    │       │
│ │ 名称    │  │ 名称    │       │
│ │ ¥价格 [+]│  │ ¥价格 [+]│       │
│ └────────┘  └────────┘       │
│ ┌────────┐  ┌────────┐       │
│ │ ...    │  │ ...    │       │
│ └────────┘  └────────┘       │
└──────────────────────────────┘
```

### 1.2 问题分析

| 问题 | 说明 |
|------|------|
| 分类按钮占2行 | 当前有 9 个分类 + "全部" = 10 个按钮，5列 grid 排成 2 行 |
| 每个按钮含图标+数量徽章+文字 | 垂直布局（flex-direction: column），按钮高度约 45px |
| 分类栏总高度 | 约 100px（含 padding） |
| 无搜索功能 | 用户无法通过关键词查找商品 |

### 1.3 当前分类列表（共9个）

```
全部、酒水、奶茶店、饮料、高汤、零食、泡面、槟榔、小吃、其他
```

### 1.4 现有后端 API

| API | 方法 | 功能 | 是否已有搜索 |
|-----|------|------|-------------|
| `GET /api/products` | GET | 获取商品列表，支持 `category` 参数筛选 | ❌ 无搜索 |
| `GET /api/categories` | GET | 获取分类列表 | - |
| `GET /api/categories/counts` | GET | 获取各分类商品数量 | - |

### 1.5 商品表字段

```sql
products 表关键字段：
- name        TEXT  -- 商品名称
- category    TEXT  -- 分类
- image_url   TEXT  -- 图片
- price       REAL  -- 价格
- stock_available INTEGER  -- 库存
- status      TEXT  -- 状态（上架/下架）
- created_at  TEXT  -- 创建时间
```

---

## 二、搜索功能设计

### 2.1 搜索字段

**只搜索商品名称（`name` 字段）**，理由：
- 商品表没有 description 等富文本字段
- 商品名称是最核心、最精确的搜索目标
- 分类已有按钮筛选，不需要重复搜索

### 2.2 搜索方式：**前端实时过滤 + 后端兜底**

#### 方案：前端实时过滤（推荐）

**理由**：
1. 当前商品总数不多（从页面设计来看是台球厅零食饮料类商品，预计 < 100 个）
2. 已全量加载到前端 `products.value` 数组中
3. 前端过滤即时响应，无网络延迟
4. 无需新增后端 API

**实现逻辑**：

```javascript
// products.vue 新增
const searchKeyword = ref('')

// 过滤后的商品列表
const filteredProducts = computed(() => {
  if (!searchKeyword.value.trim()) {
    return products.value
  }
  const keyword = searchKeyword.value.trim().toLowerCase()
  return products.value.filter(p => 
    p.name.toLowerCase().includes(keyword)
  )
})
```

**模板改动**：将商品列表渲染从 `products` 改为 `filteredProducts`

#### 后端兜底方案（商品量增大时）

如果后续商品数量超过 200 个，后端新增搜索参数：

```
GET /api/products?category=&keyword=关键词
```

后端 SQL 改动：
```javascript
if (keyword) {
  sql += ' AND name LIKE ?';
  params.push(`%${keyword}%`);
}
```

### 2.3 UI 交互设计

#### 搜索框设计

```
┌──────────────────────────────┐
│  🔍 [输入商品名称搜索...]  ✕  │
└──────────────────────────────┘
```

- 搜索框默认收起为 🔍 图标，点击后展开为全宽搜索框
- 输入时实时过滤（300ms 防抖）
- 搜索框右侧显示 ✕ 清除按钮（有搜索词时）
- 输入框失焦 + 无搜索词时，自动收起为图标

#### 搜索状态提示

| 状态 | 显示 |
|------|------|
| 无搜索词 | 显示全部商品 |
| 有匹配 | 显示匹配商品，顶部显示 "找到 X 件商品" |
| 无匹配 | 显示空状态 "未找到「xxx」相关商品" + "清除搜索" 按钮 |

---

## 三、分类筛选按钮优化方案（⭐核心）

### 3.1 推荐方案：横向滚动标签栏

**设计理念**：将 2 行固定网格改为 1 行横向滚动标签，大幅压缩高度。

#### 优化前 vs 优化后对比

```
【优化前】（当前）
┌──────────────────────────────┐  ~100px
│ 📋全部  🍺酒水  🧋奶茶  🥤饮料 │
│ 🍪零食  🍜泡面  🌿槟榔  🍟小吃 │
│ 📦其他                       │
└──────────────────────────────┘

【优化后】（推荐）
┌──────────────────────────────┐  ~40px
│ ← 🔍 [搜索] →                 │  搜索栏
├──────────────────────────────┤  ~36px
│ [全部] 酒水 奶茶 饮料 零食 ...→│  横向滚动分类
└──────────────────────────────┘  总高度 ~76px（vs 原100px+）
```

### 3.2 详细设计

#### 3.2.1 分类标签样式

```
┌─ 横向滚动容器 ──────────────────────┐
│                                      │
│  ┌─────┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐       │
│  │ 全部 │ │酒水│ │奶茶│ │饮料│ │零食│→│
│  └─────┘ └──┘ └──┘ └──┘ └──┘       │
│   ↑选中态（金色边框+背景）             │
└──────────────────────────────────────┘
```

**样式规范**：

```css
/* 横向滚动容器 */
.category-scroll {
  display: flex;
  overflow-x: auto;
  white-space: nowrap;
  padding: 8px 12px;
  gap: 8px;
  /* 隐藏滚动条 */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.category-scroll::-webkit-scrollbar {
  display: none;
}

/* 单个标签 */
.category-tag {
  flex-shrink: 0;  /* 不压缩 */
  padding: 6px 14px;
  border-radius: 16px;  /* 胶囊形状 */
  font-size: 13px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(218,175,32,0.15);
  color: rgba(255,255,255,0.7);
  transition: all 0.2s;
}

/* 选中态 */
.category-tag.active {
  background: rgba(212,175,55,0.2);
  border-color: rgba(218,165,32,0.5);
  color: #d4af37;
  font-weight: 600;
}
```

#### 3.2.2 简化点

| 简化项 | 优化前 | 优化后 | 效果 |
|--------|--------|--------|------|
| 布局 | 5列 grid，2行 | flex 横向滚动，1行 | 高度减少 ~60% |
| 图标 | emoji 图标（20px） | 移除图标 | 更简洁，节省空间 |
| 数量徽章 | 每个按钮显示数量 | 移除 | 减少视觉噪音 |
| 按钮高度 | 图标+文字 约45px | 文字标签 约30px | 高度减少 ~33% |
| 按钮间距 | grid gap 6px | flex gap 8px | 保持舒适间距 |

#### 3.2.3 保留数量的替代方案

如果用户仍需要知道各分类商品数量，可以在标签文字后用小字显示：

```
[全部(128)] [酒水(23)] [奶茶(15)] →
```

但这会增加标签宽度，可能导致更多横向滚动。**建议第一版不做数量显示**，后续根据用户反馈再决定是否添加。

---

## 四、整体版面设计

### 4.1 最终版面结构

```
┌──────────────────────────────┐
│      商品点单  (标题栏 44px)   │  ← 保持不变
├──────────────────────────────┤
│  🔍 输入商品名称搜索...  ✕     │  ← 新增搜索栏 ~40px
├──────────────────────────────┤
│ [全部] 酒水 奶茶 饮料 零食 ...→│  ← 优化后分类栏 ~36px
├──────────────────────────────┤
│ 当前台桌：A01                 │  ← 台桌信息（保持不变）
├──────────────────────────────┤
│ ┌────────┐  ┌────────┐       │
│ │ 图片    │  │ 图片    │       │
│ │ 名称    │  │ 名称    │       │
│ │ ¥价格 [+]│  │ ¥价格 [+]│       │
│ └────────┘  └────────┘       │
│         商品列表...           │
│                               │
│            🛒3    ↑          │  ← 浮动按钮（保持不变）
└──────────────────────────────┘
```

### 4.2 空间对比

| 区域 | 优化前高度 | 优化后高度 | 节省 |
|------|-----------|-----------|------|
| 标题栏 | 44px | 44px | 0 |
| 分类筛选 | ~100px | ~36px | ~64px ⬇️ |
| 搜索栏 | 0 | ~40px | +40px |
| 台桌信息 | ~50px | ~50px | 0 |
| **筛选区域总计** | **~144px** | **~130px** | **~14px ⬇️** |

虽然净节省不多（新增了搜索栏），但视觉层次更清晰，分类筛选不再占据 2 行的大块面积。

### 4.3 视觉层次优化建议

1. **搜索栏**：使用稍深的背景色区分，暗示可交互
2. **分类标签**：胶囊形状 + 选中态金色高亮，与项目整体风格统一
3. **分隔线**：搜索栏和分类栏之间用极淡的分隔线（`rgba(255,255,255,0.05)`）区分层级

---

## 五、需要修改的文件列表

### 5.1 前端修改（仅1个文件）

| 文件 | 改动内容 | 改动量 |
|------|---------|--------|
| `/TG/tgservice-uniapp/src/pages/products/products.vue` | 模板、script、样式 | ~150行改动 |

**无需条件编译改动**：当前 `#ifdef H5` 区域已经独立，新组件只影响 H5 区域。

### 5.2 后端修改

**❌ 无需修改后端**

采用前端实时过滤方案，不需要新增或修改后端 API。

> 备选方案（商品量 > 200 时启用）：
> 修改 `/TG/tgservice/backend/server.js` 的 `/api/products` 路由，增加 `keyword` 查询参数
> 修改 `/TG/tgservice-uniapp/src/utils/api.js` 的 `getProducts` 方法，增加 `keyword` 参数

---

## 六、具体改动方案

### 6.1 products.vue 模板改动

#### 改动 1：替换 H5 分类筛选区域

**原代码**（`#ifdef H5` 区域）：
```html
<!-- 分类按钮（不固定） -->
<view class="h5-filter-area">
  <view class="category-bar">
    <view class="category-grid">
      <!-- 5列grid布局的分类按钮 -->
    </view>
  </view>
  <view class="table-info-wrapper">...</view>
</view>
```

**新代码**：
```html
<!-- #ifdef H5 -->
<!-- H5 标题栏 -->
<view class="h5-title-bar">
  <text class="h5-title-text">商品点单</text>
</view>

<!-- 搜索 + 分类筛选区域 -->
<view class="h5-filter-area">
  <!-- 搜索栏 -->
  <view class="search-bar">
    <text class="search-icon">🔍</text>
    <input 
      class="search-input" 
      v-model="searchKeyword" 
      placeholder="输入商品名称搜索"
      placeholder-class="search-placeholder"
      confirm-type="search"
      @confirm="onSearchConfirm"
      @input="onSearchInput"
    />
    <text class="search-clear" v-if="searchKeyword" @click="clearSearch">✕</text>
  </view>

  <!-- 搜索结果提示 -->
  <view class="search-result-tip" v-if="searchKeyword">
    <text>找到 {{ filteredProducts.length }} 件商品</text>
  </view>

  <!-- 横向滚动分类标签 -->
  <scroll-view class="category-scroll" scroll-x>
    <view class="category-scroll-inner">
      <view 
        class="category-tag" 
        :class="{ active: currentCategory === '全部' }" 
        @click="selectCategory('全部')"
      >
        <text>全部</text>
      </view>
      <view 
        class="category-tag" 
        v-for="cat in categories" 
        :key="cat"
        :class="{ active: currentCategory === cat }"
        @click="selectCategory(cat)"
      >
        <text>{{ cat }}</text>
      </view>
    </view>
  </scroll-view>

  <!-- 台桌信息显示 -->
  <view class="table-info-wrapper">
    <view v-if="isEmployee" class="table-info employee-mode">
      <text class="table-label">当前台桌：</text>
      <text class="table-value">{{ tableName || '未选择' }}</text>
    </view>
    <TableInfo v-else ref="tableInfoRef" hideWhenValid />
  </view>
</view>
<!-- #endif -->
```

#### 改动 2：商品列表改用 filteredProducts

**原代码**：
```html
v-for="(item, index) in products"
```

**新代码**：
```html
v-for="(item, index) in filteredProducts"
```

同时空状态判断也要改：
```html
<view class="empty-tip" v-if="filteredProducts.length === 0 && !loading">
  <text v-if="searchKeyword">未找到「{{ searchKeyword }}」相关商品</text>
  <text v-else>暂无商品</text>
</view>
```

### 6.2 products.vue script 改动

#### 新增数据和方法：

```javascript
// 新增状态
const searchKeyword = ref('')
let searchDebounceTimer = null

// 新增计算属性
const filteredProducts = computed(() => {
  if (!searchKeyword.value.trim()) {
    return products.value
  }
  const keyword = searchKeyword.value.trim().toLowerCase()
  return products.value.filter(p => 
    p.name.toLowerCase().includes(keyword)
  )
})

// 搜索输入（防抖）
const onSearchInput = () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    // 搜索词变化时，如果当前分类下无结果，自动切到"全部"再搜索
    if (searchKeyword.value.trim()) {
      // 不在全部模式下且当前分类无匹配时，自动切到全部
      if (currentCategory.value !== '全部' && 
          !products.value.some(p => p.name.toLowerCase().includes(searchKeyword.value.trim().toLowerCase()))) {
        currentCategory.value = '全部'
        loadProducts().then(() => {
          // 切到全部后，filteredProducts 会自动重新计算
        })
      }
    }
  }, 300)
}

// 搜索确认
const onSearchConfirm = () => {
  clearTimeout(searchDebounceTimer)
  // 确保在全部模式下搜索
  if (searchKeyword.value.trim() && currentCategory.value !== '全部') {
    currentCategory.value = '全部'
    loadProducts()
  }
}

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = ''
}
```

**注意**：`selectCategory` 方法不需要改动，因为 `filteredProducts` 是基于 `products` 计算的，分类切换时 `loadProducts` 会更新 `products`，`filteredProducts` 会自动重新计算。

### 6.3 products.vue 样式改动

#### 新增样式（仅 H5 区域 `#ifdef H5` 内）：

```css
/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin: 8px 12px 0;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
}

.search-icon {
  font-size: 16px;
  margin-right: 8px;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  font-size: 14px;
  color: #fff;
  background: transparent;
  border: none;
  padding: 4px 0;
}

.search-placeholder {
  color: rgba(255,255,255,0.3);
}

.search-clear {
  font-size: 16px;
  color: rgba(255,255,255,0.4);
  padding: 4px 8px;
  cursor: pointer;
}

/* 搜索结果提示 */
.search-result-tip {
  padding: 6px 16px;
  font-size: 12px;
  color: rgba(212,175,55,0.7);
}

/* 横向滚动分类标签 */
.category-scroll {
  padding: 8px 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-scroll-inner {
  display: inline-flex;
  gap: 8px;
  white-space: nowrap;
}

.category-tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(218,175,32,0.15);
  color: rgba(255,255,255,0.7);
  transition: all 0.2s ease;
  cursor: pointer;
  user-select: none;
}

.category-tag:active {
  transform: scale(0.95);
}

.category-tag.active {
  background: rgba(212,175,55,0.2);
  border-color: rgba(218,165,32,0.5);
  color: #d4af37;
  font-weight: 600;
}
```

#### 可删除的旧样式（H5 不再使用）：

```css
/* 可以保留不删除（小程序仍在使用），但 H5 不再引用： */
/* .category-grid - grid 布局样式 */
/* .category-btn - 旧的卡片式按钮样式 */
/* .icon-wrapper - 图标包装器 */
/* .count-badge - 数量徽章 */
```

> **注意**：上述旧样式不要删除，因为小程序端（`#ifndef H5`）仍在使用。

---

## 七、后端 API 设计（备选方案）

> 以下方案在第一版不实现，当商品数量 > 200 时启用。

### 7.1 修改现有 `/api/products` 接口

**当前**：
```
GET /api/products?category=分类名
```

**修改后**：
```
GET /api/products?category=分类名&keyword=搜索关键词
```

### 7.2 后端代码改动（server.js）

```javascript
app.get('/api/products', async (req, res) => {
  try {
    const { category, keyword } = req.query;  // 新增 keyword
    let sql = "SELECT name, category, image_url, price, stock_available, status FROM products WHERE status = '上架'";
    const params = [];

    if (category && category !== '全部') {
      sql += ' AND category = ?';
      params.push(category);
    }

    // 新增：关键词搜索
    if (keyword && keyword.trim()) {
      sql += ' AND name LIKE ?';
      params.push(`%${keyword.trim()}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const products = await dbAll(sql, params);
    res.json(products);
  } catch (err) {
    logger.error(`获取商品失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 7.3 前端 API 改动（api.js）

```javascript
// 修改 getProducts 方法
getProducts: (category, keyword) => request({ 
  url: '/products', 
  data: { category, keyword } 
}),
```

### 7.4 前端调用改动（products.vue）

```javascript
const loadProducts = async () => {
  loading.value = true
  try {
    const keyword = searchKeyword.value.trim() || undefined
    let data = await api.getProducts(
      currentCategory.value === '全部' ? '' : currentCategory.value,
      keyword
    )
    data = data.filter(p => p.status === '上架')
    products.value = data
  } catch (e) {}
  loading.value = false
}
```

---

## 八、小程序端兼容性

| 区域 | 改动 | 说明 |
|------|------|------|
| 小程序标题栏 | ❌ 不改动 | 保持在 `#ifndef H5` 区块外 |
| 小程序分类按钮 | ❌ 不改动 | 使用旧的 grid 布局（代码在 `#ifndef H5` 内） |
| 搜索栏 | ❌ 不添加 | 只加在 `#ifdef H5` 区块内 |
| 商品列表 | ✅ 共用 | 改用 `filteredProducts`，小程序也受益 |

> 搜索功能只在 H5 端添加。小程序端的 `filteredProducts` 计算属性同样生效，只是没有搜索框 UI。

---

## 九、测试要点

| 测试项 | 说明 |
|--------|------|
| 搜索功能 | 输入关键词，商品列表实时过滤 |
| 搜索+分类组合 | 切换分类后，搜索词仍然生效 |
| 清除搜索 | 点击 ✕ 清除搜索词，恢复全部商品 |
| 无结果提示 | 搜索无结果时显示友好提示 |
| 分类滚动 | 分类标签可横向滚动，选中项可见 |
| 选中态 | 当前选中的分类标签高亮显示 |
| 小程序兼容 | 小程序端分类按钮不受影响 |
| 空搜索 | 搜索框为空时显示全部商品 |

---

## 十、实施建议

### 10.1 优先级

1. **P0（必须）**：搜索栏 + 前端实时过滤 + 分类横向滚动
2. **P1（建议）**：搜索结果数量提示
3. **P2（可选）**：后端 keyword 搜索支持
4. **P3（未来）**：搜索历史记录

### 10.2 预估工作量

| 任务 | 预估时间 |
|------|---------|
| 前端模板改动 | 30min |
| 前端脚本改动 | 20min |
| 前端样式改动 | 30min |
| 测试调试 | 30min |
| **合计** | **约 2 小时** |

### 10.3 风险提示

| 风险 | 应对 |
|------|------|
| 商品名称含特殊字符 | `toLowerCase()` 已处理大小写，特殊字符不做额外处理 |
| 商品量过多导致前端过滤卡顿 | 当前预计 < 100 商品，无性能问题；超过 200 时启用后端搜索 |
| 小程序端样式异常 | 新样式只在 `#ifdef H5` 区块内添加，不影响小程序 |

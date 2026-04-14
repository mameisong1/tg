# 开发报告 A3：H5 商品页搜索功能 + 分类筛选优化

> **开发日期**：2026-04-14
> **开发人**：程序员 A3

---

## 修改文件

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `tgservice-uniapp/src/pages/products/products.vue` | +186 行 | 唯一修改的文件 |

---

## 具体改动

### 1. 模板改动（H5 区域）

#### 1.1 新增搜索栏

```html
<!-- 搜索栏 -->
<view class="search-bar">
  <text class="search-icon">🔍</text>
  <input 
    class="search-input" 
    v-model="searchKeyword" 
    placeholder="输入商品名称搜索"
    placeholder-class="search-placeholder"
    confirm-type="search"
    @input="onSearchInput"
    @confirm="onSearchConfirm"
  />
  <text class="search-clear" v-if="searchKeyword" @click="clearSearch">✕</text>
</view>
```

- 🔍 搜索图标 + 输入框 + ✕ 清除按钮
- 有搜索词时显示清除按钮

#### 1.2 新增搜索结果提示

```html
<view class="search-result-tip" v-if="searchKeyword && !loading">
  <text>找到 {{ filteredProducts.length }} 件商品</text>
</view>
```

#### 1.3 分类筛选改为横向滚动胶囊标签

**原结构**（5列 grid，2行，含图标+数量徽章）：
```html
<view class="category-bar">
  <view class="category-grid">
    <view class="category-btn">
      <view class="icon-wrapper">
        <text class="category-icon">📋</text>
        <view class="count-badge">12</view>
      </view>
      <text class="category-text">全部</text>
    </view>
    <!-- ...更多分类 -->
  </view>
</view>
```

**新结构**（1行横向滚动，纯文字胶囊标签）：
```html
<scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
  <view class="category-scroll-inner">
    <view class="category-tag" :class="{ active: currentCategory === '全部' }" @click="selectCategory('全部')">
      <text>全部</text>
    </view>
    <view class="category-tag" v-for="cat in categories" :key="cat" @click="selectCategory(cat)">
      <text>{{ cat }}</text>
    </view>
  </view>
</scroll-view>
```

#### 1.4 商品列表改用 filteredProducts

- `v-for="(item, index) in products"` → `v-for="(item, index) in filteredProducts"`
- 空状态提示增加搜索无匹配情况：

```html
<view class="empty-tip" v-if="filteredProducts.length === 0 && !loading">
  <text v-if="searchKeyword">未找到「{{ searchKeyword }}」相关商品</text>
  <text v-else>暂无商品</text>
</view>
```

### 2. Script 改动

#### 新增状态

```javascript
const searchKeyword = ref('')
let searchDebounceTimer = null
```

#### 新增计算属性

```javascript
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

#### 新增方法

| 方法 | 说明 |
|------|------|
| `onSearchInput()` | 300ms 防抖输入，当前分类无匹配时自动切换到"全部" |
| `onSearchConfirm()` | 搜索确认（键盘回车），确保在全部模式下搜索 |
| `clearSearch()` | 清除搜索词 |

### 3. 样式改动（仅 #ifdef H5 内）

新增样式类：

| 样式类 | 说明 |
|--------|------|
| `.search-bar` | 搜索栏容器，圆角12px，半透明背景 |
| `.search-icon` | 🔍 图标样式 |
| `.search-input` | 输入框，flex: 1 自适应 |
| `.search-placeholder` | 占位文字，半透明白色 |
| `.search-clear` | ✕ 清除按钮 |
| `.search-result-tip` | 搜索结果数量提示，金色小字 |
| `.category-scroll` | 横向滚动容器，隐藏滚动条 |
| `.category-scroll-inner` | inline-flex 布局，gap 8px |
| `.category-tag` | 胶囊标签，圆角16px，半透明背景+金色边框 |
| `.category-tag.active` | 选中态，金色背景+加粗文字 |
| `.category-tag:active` | 点击缩小动画（scale 0.95） |

---

## 关键设计点

### 分类筛选优化

| 对比项 | 优化前 | 优化后 |
|--------|--------|--------|
| 布局 | 5列 grid，2行 | flex 横向滚动，1行 |
| 图标 | emoji 图标（20px） | 移除 |
| 数量徽章 | 显示 | 移除 |
| 按钮样式 | 垂直布局（图标+文字），约45px高 | 纯文字胶囊，约30px高 |
| 视觉噪音 | 高（图标+徽章+文字） | 低（纯文字） |

### 搜索交互

1. **实时过滤**：输入即搜索（300ms 防抖）
2. **自动切换全部**：当前分类下无匹配时自动切到"全部"再搜索
3. **清除按钮**：有搜索词时显示 ✕，点击清除
4. **空状态友好提示**：未找到「xxx」相关商品

### 小程序兼容性

- 搜索栏和横向滚动标签只在 `#ifdef H5` 区域内
- 小程序端仍使用原有的 grid 布局分类按钮
- `filteredProducts` 计算属性对所有端生效（但小程序无搜索框 UI）

---

## Git 提交

```
commit 16db7a8312a6807f4accec8693ef4511c3f9fb30
Author: mameisong <mameisong@gmail.com>
Date:   Tue Apr 14 09:45:27 2026 +0800

    feat(QA0414-A3): H5商品页新增搜索功能 + 分类筛选改为横向滚动胶囊标签
```

**注意**：本地 commit 成功，push 被拒绝（repository rule violations，可能因分支保护规则）。需要管理员权限或创建 PR 合并。

---

## 未执行的操作

| 操作 | 原因 |
|------|------|
| 重启 Docker/PM2 | 按任务要求不重启 |
| 后端修改 | 采用前端过滤方案，无需后端改动 |
| Git push | 被仓库规则拒绝，需手动处理 |

# 水牌页面版面调整设计方案

## QA需求

前台H5的水牌查看页面和水牌管理页面的版面需要调整：
1. **筛选按钮**太小了，要放大到原来的 **1.5倍**。
2. **助教卡片**太小了，要放大到原来的 **1.5倍**。

## 涉及文件

| 文件 | 说明 |
|------|------|
| `tgservice-uniapp/src/pages/internal/water-board-view.vue` | 水牌**查看**页面（只读） |
| `tgservice-uniapp/src/pages/internal/water-board.vue` | 水牌**管理**页面（可修改状态） |

> ⚠️ 只需修改以上 2 个前端文件，不涉及后端代码、数据库或时间处理。

## 当前状态分析

### 筛选按钮 (`.filter-item`)

两个页面的筛选按钮当前样式基本一致：

```css
/* 当前（两个页面相同） */
.filter-bar  { padding: 8px; gap: 6px; }  /* view页: padding: 8px 12px */
.filter-item { padding: 6px 12px; font-size: 12px; border-radius: 16px; }
```

- 按钮高度约 24px（6+12 内边距 + 12px 字号）
- 11 个筛选按钮（全部 + 10 种状态），在 375px 屏上挤成 2 行

### 助教卡片 (`.coach-chip`)

两个页面的基础样式一致，响应式断点略有差异：

| 属性 | 基础样式 (≥421px) | 420px 断点 | 360px 断点 |
|------|-------------------|------------|------------|
| 卡片宽度 | 80px | 68px (view) / 64px (mgr) | 60px (view) / 56px (mgr) |
| 头像尺寸 | 48px | 40px (view) / 38px (mgr) | 34px (view) / 30px (mgr) |
| 字号 | 12px | 11px | 10px |
| 圆角 | 50% | 50% | 50% |

- 卡片为**圆形**（`border-radius: 50%`）
- 内容：头像 → 工号 → 姓名 → 台桌标签（纵向排列）

## CSS 变更详情

### 变更策略

将所有相关 CSS 属性值 **乘以 1.5**，并统一两个页面的响应式断点值（取较大值以保证一致性）。

---

### 修改 1：筛选按钮放大 1.5 倍

**影响文件**：两个页面的 `/* 状态筛选 */` 样式块

#### 基础样式（≥421px）

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.filter-bar` padding | `8px`（上下） | `12px`（上下） | 8 × 1.5 = 12 |
| `.filter-bar` gap | `6px` | `9px` | 6 × 1.5 = 9 |
| `.filter-item` padding | `6px 12px` | `9px 18px` | 6×1.5=9, 12×1.5=18 |
| `.filter-item` font-size | `12px` | `18px` | 12 × 1.5 = 18 |
| `.filter-item` border-radius | `16px` | `24px` | 16 × 1.5 = 24 |

#### 响应式 ≤420px

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.filter-bar` gap | `4px` | `6px` | 4 × 1.5 = 6 |
| `.filter-bar` padding | `6px` / `6px 8px` | `9px` / `9px 12px` | 6×1.5=9, 8×1.5=12 |
| `.filter-item` padding | `5px 8px` | `8px 12px` | 5×1.5≈8, 8×1.5=12 |
| `.filter-item` font-size | `11px` | `17px` | 11 × 1.5 ≈ 17 |

#### 响应式 ≤360px

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.filter-bar` gap | `3px` | `5px` | 3 × 1.5 ≈ 5 |
| `.filter-bar` padding | `4px` / `4px 6px` | `6px` / `6px 9px` | 4×1.5=6, 6×1.5=9 |
| `.filter-item` padding | `4px 6px` | `6px 9px` | 4×1.5=6, 6×1.5=9 |
| `.filter-item` font-size | `10px` | `15px` | 10 × 1.5 = 15 |
| `.filter-item` border-radius | `12px` | `18px` | 12 × 1.5 = 18 |

---

### 修改 2：助教卡片放大 1.5 倍

**影响文件**：两个页面的 `/* 助教圆形卡片 */` 样式块

#### 基础样式（≥421px）— 两个页面统一

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.coach-chips` gap | `10px`/`12px` | `15px` | 取中间值 10×1.5 |
| `.coach-chip` width | `80px` | `120px` | 80 × 1.5 = 120 |
| `.coach-chip` padding | `8px 4px` | `12px 6px` | 8×1.5=12, 4×1.5=6 |
| `.coach-avatar`/`.coach-chip-avatar` | `48px` | `72px` | 48 × 1.5 = 72 |
| `.coach-avatar` border | `2px` | `3px` | 2 × 1.5 = 3 |
| `.coach-avatar` margin-bottom | `4px` | `6px` | 4 × 1.5 = 6 |
| `.coach-id`/`.coach-chip-id` font-size | `12px` | `18px` | 12 × 1.5 = 18 |
| `.coach-name`/`.coach-chip-name` font-size | `12px` | `18px` | 12 × 1.5 = 18 |
| `.coach-name`/`.coach-chip-name` max-width | `72px` | `108px` | 72 × 1.5 = 108 |
| `.coach-chip-table-tags` gap | `3px` | `5px` | 3 × 1.5 ≈ 5 |
| `.coach-chip-table-tag` font-size | `9px`/`10px` | `14px` | 10 × 1.5 ≈ 14 |
| `.coach-chip-table-tag` padding | `1px 4px` | `2px 6px` | 1×1.5≈2, 4×1.5=6 |
| `.status-section` padding | `10px` | `15px` | 10 × 1.5 = 15 |
| `.status-section` margin-bottom | `12px` | `18px` | 12 × 1.5 = 18 |
| `.section-header` margin-bottom | `8px` | `12px` | 8 × 1.5 = 12 |
| `.section-header` padding-bottom | `6px` | `9px` | 6 × 1.5 = 9 |
| `.section-title` font-size | `14px` | `21px` | 14 × 1.5 = 21 |
| `.section-count` font-size | `12px` | `18px` | 12 × 1.5 = 18 |

#### 响应式 ≤420px

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.coach-chips` gap | `6px` | `9px` | 6 × 1.5 = 9 |
| `.coach-chip` width | `64px`/`68px` → 统一 | `96px` | 64 × 1.5 = 96 |
| `.coach-chip` padding | `6px 2px` | `9px 3px` | 6×1.5=9, 2×1.5=3 |
| `.coach-avatar` | `38px`/`40px` → 统一 | `57px` | 38 × 1.5 = 57 |
| `.coach-id` font-size | `11px` | `17px` | 11 × 1.5 ≈ 17 |
| `.coach-name` font-size | `11px` | `17px` | 11 × 1.5 ≈ 17 |
| `.coach-name` max-width | `56px`/`60px` | `84px` | 56 × 1.5 = 84 |
| `.coach-table-tag` font-size | `8px` | `12px` | 8 × 1.5 = 12 |
| `.status-section` padding | `8px`/`8px 6px` | `12px` | 8 × 1.5 = 12 |
| `.status-section` margin-bottom | `8px` | `12px` | 8 × 1.5 = 12 |

#### 响应式 ≤360px

| 属性 | 旧值 | 新值 | 计算 |
|------|------|------|------|
| `.coach-chips` gap | `4px` | `6px` | 4 × 1.5 = 6 |
| `.coach-chip` width | `56px`/`60px` → 统一 | `84px` | 56 × 1.5 = 84 |
| `.coach-chip` padding | `4px 2px` | `6px 3px` | 4×1.5=6, 2×1.5=3 |
| `.coach-avatar` | `30px`/`34px` → 统一 | `45px` | 30 × 1.5 = 45 |
| `.coach-avatar` border | `1px` | `2px` | 1 × 1.5 ≈ 2 |
| `.coach-id` font-size | `10px` | `15px` | 10 × 1.5 = 15 |
| `.coach-name` font-size | `10px` | `15px` | 10 × 1.5 = 15 |
| `.coach-name` max-width | `48px`/`52px` | `72px` | 48 × 1.5 = 72 |
| `.coach-table-tag` font-size | `7px` | `11px` | 7 × 1.5 ≈ 11 |
| `.status-section` padding | `6px 4px` | `9px 6px` | 6×1.5=9, 4×1.5=6 |
| `.status-section` margin-bottom | `6px` | `9px` | 6 × 1.5 = 9 |
| `.board-list` padding | `0 2px 8px`/`0 4px 12px` | `0 6px 12px` | 取中间值 |

---

### 修改 3：响应式断点统一

两个页面的 `≤420px` 和 `≤360px` 断点值当前有微小差异（管理页面略小）。放大 1.5 倍后，**两个页面使用相同的断点值**（取较小值的 1.5 倍），确保视觉一致性。

---

## 布局合理性保障

### 筛选按钮

- **flex-wrap: wrap** 已启用，11 个按钮会自动换行
- 放大后按钮更大，但行高增加（gap 6→9px），行间距更清晰
- 预期每行显示 **3-4 个**按钮（375px 屏），共 3 行（原为 4 行），反而更整洁
- `overflow-x: hidden` 防止水平溢出（管理页面已有，查看页面同步添加）

### 助教卡片

- 卡片为圆形（`border-radius: 50%`），宽度从 80px→120px
- 计算验证圆形完整性（基础样式）：
  - padding-top(12) + avatar(72) + avatar-border(3×2) + margin-bottom(6) + id(18) + name(18) + padding-bottom(12) = **127px**
  - 卡片宽度 120px，高度 127px，差异仅 6%，视觉上仍为完美圆形
- 每行可容纳卡片数：375px 屏约 **2-3 个**（原为 3-4 个），单卡片信息量更大
- `.status-section` 的 padding 和 margin 同步放大，保持内容呼吸感

### 响应式降级

- 三个断点（基础 / 420px / 360px）均按比例缩放，视觉一致性有保障
- 两个页面的响应式值统一，避免查看页和管理页切换时的跳动感

## 代码修改清单

### 文件 1：`water-board-view.vue`（水牌查看页面）

需要修改的 CSS 选择器及属性：

```css
/* 1. 筛选按钮 */
.filter-bar           → padding: 12px 18px, gap: 9px
.filter-item          → padding: 9px 18px, font-size: 18px, border-radius: 24px
@media (max-width: 420px)
  .filter-bar         → padding: 9px 12px, gap: 6px
  .filter-item        → padding: 8px 12px, font-size: 17px
@media (max-width: 360px)
  .filter-bar         → padding: 6px 9px, gap: 5px
  .filter-item        → padding: 6px 9px, font-size: 15px, border-radius: 18px

/* 2. 助教卡片 */
.coach-chips          → gap: 15px
.coach-chip           → width: 120px, padding: 12px 6px
.coach-avatar         → width: 72px, height: 72px, border: 3px, margin-bottom: 6px
.coach-id             → font-size: 18px
.coach-name           → font-size: 18px, max-width: 108px
.coach-table-tags     → gap: 5px
.coach-table-tag      → font-size: 14px, padding: 2px 6px
.status-section       → padding: 15px, margin-bottom: 18px
.section-header       → margin-bottom: 12px, padding-bottom: 9px
.section-title        → font-size: 21px
.section-count        → font-size: 18px
.board-list           → padding: 0 18px 18px
@media (max-width: 420px) → 全部对应缩小
@media (max-width: 360px) → 全部对应缩小
```

### 文件 2：`water-board.vue`（水牌管理页面）

修改内容与查看页面类似，但类名有 `coach-chip-` 前缀（管理页面）：

```css
/* 1. 筛选按钮（同查看页） */
.filter-bar           → padding: 12px, gap: 9px
.filter-item          → padding: 9px 18px, font-size: 18px, border-radius: 24px
@media (max-width: 420px) → 同上
@media (max-width: 360px) → 同上

/* 2. 助教卡片（注意类名差异） */
.coach-chips          → gap: 15px
.coach-chip           → width: 120px, padding: 12px 6px
.coach-chip-avatar    → width: 72px, height: 72px, border: 3px, margin-bottom: 6px
.coach-chip-id        → font-size: 18px
.coach-chip-name      → font-size: 18px, max-width: 108px
.coach-chip-table-tags → gap: 5px
.coach-chip-table-tag → font-size: 14px, padding: 2px 6px
.status-section       → padding: 15px, margin-bottom: 18px
/* ... 响应式断点同上 ... */
```

## 注意事项

1. **不涉及后端代码**：此需求为纯前端样式调整，不修改任何后端逻辑
2. **不涉及数据库**：无数据操作，无需使用 TimeUtil / db / writeQueue
3. **不影响模板结构**：只修改 `<style scoped>` 中的 CSS 值，`<template>` 和 `<script>` 完全不变
4. **弹窗内卡片无需调整**：需求只提及页面中的卡片，expand-overlay 内的放大卡片已经足够大（100px/64px avatar），不需改动
5. **构建部署**：修改后需 `npm run build:h5` 并使用 `deploy-h5.sh` 部署

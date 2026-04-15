# 修复记录 - 水牌页面版面调整

## 日期
2026-04-15

## 任务
水牌查看页面和水牌管理页面的筛选按钮、助教卡片放大 1.5 倍。

## 修改文件
1. `tgservice-uniapp/src/pages/internal/water-board-view.vue` — 水牌查看页面
2. `tgservice-uniapp/src/pages/internal/water-board.vue` — 水牌管理页面

## 修改内容（纯CSS，不改动模板和脚本）

### 筛选按钮 1.5 倍
| 选择器 | 属性 | 旧值 | 新值 |
|--------|------|------|------|
| `.filter-bar` | padding | `8px` / `8px 12px` | `12px` / `12px 18px` |
| `.filter-bar` | gap | `6px` | `9px` |
| `.filter-item` | padding | `6px 12px` | `9px 18px` |
| `.filter-item` | font-size | `12px` | `18px` |
| `.filter-item` | border-radius | `16px` | `24px` |

### 助教卡片 1.5 倍
| 选择器 | 属性 | 旧值 | 新值 |
|--------|------|------|------|
| `.coach-chips` | gap | `10px`/`12px` | `15px` |
| `.coach-chip` | width | `80px` | `120px` |
| `.coach-chip` | padding | `8px 4px` | `12px 6px` |
| `.coach-avatar` / `.coach-chip-avatar` | width/height | `48px` | `72px` |
| `.coach-avatar` | border | `2px` | `3px` |
| `.coach-avatar` | margin-bottom | `4px` | `6px` |
| `.coach-id` / `.coach-chip-id` | font-size | `12px` | `18px` |
| `.coach-name` / `.coach-chip-name` | font-size | `12px` | `18px` |
| `.coach-name` / `.coach-chip-name` | max-width | `72px` | `108px` |
| `.coach-table-tags` | gap | `3px` | `5px` |
| `.coach-table-tag` | font-size | `9px`/`10px` | `14px` |
| `.coach-table-tag` | padding | `1px 4px` | `2px 6px` |

### 区块标题/状态分段
| 选择器 | 属性 | 旧值 | 新值 |
|--------|------|------|------|
| `.status-section` | padding | `10px` | `15px` |
| `.status-section` | margin-bottom | `12px` | `18px` |
| `.section-header` | margin-bottom | `8px` | `12px` |
| `.section-header` | padding-bottom | `6px` | `9px` |
| `.section-title` | font-size | `14px` | `21px` |
| `.section-count` | font-size | `12px` | `18px` |
| `.board-list` | padding | `0 12px 12px` | `0 18px 18px` |

### 响应式断点统一
两个页面的 `≤420px` 和 `≤360px` 断点值已统一：

**≤420px**:
- filter-bar: gap 6px, padding 9px 12px
- filter-item: padding 8px 12px, font-size 17px
- coach-chip: width 96px, padding 9px 3px
- coach-avatar: 57px
- coach-id/name: font-size 17px, max-width 84px
- coach-table-tag: font-size 12px
- status-section: padding 12px, margin-bottom 12px

**≤360px**:
- filter-bar: gap 5px, padding 6px 9px
- filter-item: padding 6px 9px, font-size 15px, border-radius 18px
- coach-chip: width 84px, padding 6px 3px
- coach-avatar: 45px, border-width 2px
- coach-id/name: font-size 15px, max-width 72px
- coach-table-tag: font-size 11px
- board-list: padding 0 6px 12px
- status-section: padding 9px 6px, margin-bottom 9px

## Git 提交
- 仓库: tgservice-uniapp
- Commit: `877cbd2`
- 消息: `feat: 水牌页面版面调整 - 筛选按钮和助教卡片放大1.5倍`
- 已推送到 origin/master

## 注意事项
- 纯CSS修改，未改动任何模板(`<template>`)和脚本(`<script>`)
- 弹窗内的放大卡片（expand-overlay）未做调整，已有足够尺寸
- 两个页面的响应式断点值已统一，避免切换时的跳动感

# QA-20260416-05 修复/修改记录

## 代码修改

| 文件 | 修改内容 |
|------|---------|
| `backend/db/v2.1.sql` | 新增：数据库迁移脚本 `ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0` |
| `backend/server.js` | 1. `/api/products` 增加 popularity 字段，排序改为 `ORDER BY popularity DESC, created_at DESC` |
| | 2. `POST /api/cart` 首次加车时 `popularity + 1` |
| | 3. `PUT /api/cart` 删除时（quantity<=0）`popularity = MAX(popularity - 1, 0)` |
| | 4. `DELETE /api/cart` 删除时 `popularity = MAX(popularity - 1, 0)` |

## 重要保护规则

### 商品同步接口不修改 popularity（用户明确要求）

**文件**：`backend/server.js` → `/api/admin/sync/products`

- UPDATE 语句中**不包含** popularity 字段 → 已存在商品人气值不会被覆盖
- INSERT 语句中**不包含** popularity 字段 → 新商品自动使用默认值 0
- **规则**：今后修改同步接口时，不得将 popularity 加入 SET 或 INSERT 字段

## 数据库变更

```sql
ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;
```

已执行于开发环境数据库。

-- v2.1: 商品热度字段
ALTER TABLE products ADD COLUMN popularity INTEGER DEFAULT 0;

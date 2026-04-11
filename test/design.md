# 商品选项功能设计文档

## 一、数据库设计

### 1. 新建 product_options 表

```sql
CREATE TABLE IF NOT EXISTS product_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    temperature TEXT,
    sugar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_product_options_category_product 
ON product_options(category, product_name);
```

### 2. carts 表新增 options 列

```sql
ALTER TABLE carts ADD COLUMN options TEXT DEFAULT '';
```

### 3. 数据导入脚本

文件路径：`/TG/test/import-product-options.js`

```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const xlsx = require('xlsx');

// 从Excel读取数据
const workbook = xlsx.readFile('/TG/docs/商品选项（奶茶店）.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

function importDB(dbPath) {
    const db = new sqlite3.Database(dbPath);
    
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS product_options (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            product_name TEXT NOT NULL,
            temperature TEXT,
            sugar TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_options_category_product 
                ON product_options(category, product_name)`);
        
        const stmt = db.prepare(`INSERT OR REPLACE INTO product_options 
            (category, product_name, temperature, sugar) VALUES (?, ?, ?, ?)`);
        
        data.forEach(row => {
            const category = row['分类'] || row.category || '';
            const productName = row['商品名'] || row.product_name || '';
            const temperature = row['温度'] || row.temperature || '';
            const sugar = row['糖度'] || row.sugar || '';
            
            if (category && productName) {
                stmt.run(category, productName, temperature, sugar);
            }
        });
        
        stmt.finalize(() => {
            console.log(`导入完成: ${dbPath}`);
            db.close();
        });
    });
}

// 导入开发环境
importDB('/TG/tgservice/tgservice.db');

// 导入生产环境（通过Docker挂载路径）
importDB('/TG/run/db/tgservice.db');
```

运行方式：
```bash
cd /TG/test && node import-product-options.js
```

## 二、后端API设计

### 1. 启动时加载 product_options 到内存

在 server.js 启动时（数据库初始化后），加载所有选项到内存缓存：

```javascript
// 全局缓存
let productOptionsCache = [];

function loadProductOptionsCache() {
    return new Promise((resolve) => {
        db.all('SELECT * FROM product_options', [], (err, rows) => {
            if (err) {
                console.error('加载商品选项缓存失败:', err);
                productOptionsCache = [];
            } else {
                productOptionsCache = rows || [];
                console.log(`商品选项缓存加载完成: ${productOptionsCache.length} 条`);
            }
            resolve();
        });
    });
}

// 在数据库初始化后调用
loadProductOptionsCache();
```

### 2. 匹配函数

```javascript
function matchProductOptions(category, productName) {
    if (!category || !productName) return null;
    
    // 1. 优先精确匹配
    const exact = productOptionsCache.find(
        opt => opt.category === category && opt.product_name === productName
    );
    if (exact) return exact;
    
    // 2. 通配匹配：product_name='所有商品'
    const wildcard = productOptionsCache.find(
        opt => opt.category === category && opt.product_name === '所有商品'
    );
    if (wildcard) return wildcard;
    
    return null;
}
```

### 3. GET /api/product-options

```javascript
app.get('/api/product-options', (req, res) => {
    const { category, product_name } = req.query;
    const options = matchProductOptions(category, product_name);
    res.json({ options });
});
```

### 4. POST /api/cart 改造

原逻辑：匹配 session_id + product_name，存在则累加数量
新逻辑：匹配 session_id + product_name + options，存在则累加

```javascript
app.post('/api/cart', (req, res) => {
    const { session_id, product_name, price, quantity = 1, category, options = '' } = req.body;
    
    if (!session_id || !product_name) {
        return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 查询是否已存在（匹配 options）
    db.get(
        'SELECT * FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ''))',
        [session_id, product_name, options, options],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            
            if (row) {
                // 已存在，累加数量
                db.run(
                    'UPDATE carts SET quantity = quantity + ? WHERE id = ?',
                    [quantity, row.id],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: '购物车更新成功' });
                    }
                );
            } else {
                // 不存在，插入新行
                db.run(
                    'INSERT INTO carts (session_id, product_name, price, quantity, category, options) VALUES (?, ?, ?, ?, ?, ?)',
                    [session_id, product_name, price, quantity, category, options],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: '已加入购物车' });
                    }
                );
            }
        }
    );
});
```

### 5. PUT /api/cart 改造

```javascript
app.put('/api/cart', (req, res) => {
    const { session_id, product_name, quantity, options = '' } = req.body;
    
    db.run(
        'UPDATE carts SET quantity = ? WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ''))',
        [quantity, session_id, product_name, options, options],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: '购物车更新成功', changes: this.changes });
        }
    );
});
```

### 6. DELETE /api/cart 改造

```javascript
app.delete('/api/cart', (req, res) => {
    const { session_id, product_name, options = '' } = req.body;
    
    db.run(
        'DELETE FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ''))',
        [session_id, product_name, options, options],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: '已从购物车移除', changes: this.changes });
        }
    );
});
```

### 7. GET /api/cart/:sessionId 改造

返回数据中需要包含 options 字段：

```javascript
app.get('/api/cart/:sessionId', (req, res) => {
    db.all(
        'SELECT * FROM carts WHERE session_id = ? ORDER BY id',
        [req.params.sessionId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ items: rows });
        }
    );
});
```

### 8. POST /api/order 改造

订单 items JSON 中需要保存 options：

```javascript
// 序列化购物车到订单时
const items = cartItems.map(item => ({
    name: item.product_name,
    quantity: item.quantity,
    price: item.price,
    category: item.category,
    options: item.options || ''
}));

const itemsJson = JSON.stringify(items);
```

## 三、前端组件设计

### 1. ProductOptionsModal.vue

路径：`/TG/tgservice-uniapp/src/components/ProductOptionsModal.vue`

```vue
<template>
    <view v-if="visible" class="modal-mask" @click="close">
        <view class="modal-content" @click.stop>
            <view class="modal-header">
                <text class="modal-title">选择{{ productName }}</text>
                <view class="modal-close" @click="close">✕</view>
            </view>

            <!-- 温度选项 -->
            <view class="option-group" v-if="temperatureOptions.length > 0">
                <text class="option-label">温度</text>
                <view class="option-list">
                    <view 
                        v-for="temp in temperatureOptions" 
                        :key="temp"
                        class="option-item"
                        :class="{ active: selectedTemperature === temp }"
                        @click="selectedTemperature = temp"
                    >
                        {{ temp }}
                    </view>
                </view>
            </view>

            <!-- 糖度选项 -->
            <view class="option-group" v-if="sugarOptions.length > 0">
                <text class="option-label">糖度</text>
                <view class="option-list">
                    <view 
                        v-for="sugar in sugarOptions" 
                        :key="sugar"
                        class="option-item"
                        :class="{ active: selectedSugar === sugar }"
                        @click="selectedSugar = sugar"
                    >
                        {{ sugar }}
                    </view>
                </view>
            </view>

            <view class="modal-footer">
                <view class="btn-confirm" @click="confirm">确定</view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { getProductOptions } from '@/utils/api.js';

const props = defineProps({
    visible: Boolean,
    product: Object
});

const emit = defineEmits(['confirm', 'close']);

const productName = computed(() => props.product?.name || '');
const temperatureOptions = ref([]);
const sugarOptions = ref([]);
const selectedTemperature = ref('');
const selectedSugar = ref('');

// 加载选项
async function loadOptions() {
    if (!props.product) return;
    const result = await getProductOptions(props.product.category, props.product.name);
    if (result && result.options) {
        const opt = result.options;
        temperatureOptions.value = opt.temperature ? opt.temperature.split('+').filter(t => t) : [];
        sugarOptions.value = opt.sugar ? opt.sugar.split('+').filter(s => s) : [];
        // 默认选中第一个
        selectedTemperature.value = temperatureOptions.value[0] || '';
        selectedSugar.value = sugarOptions.value[0] || '';
    }
}

// 确定
function confirm() {
    const options = [];
    if (selectedTemperature.value) options.push(selectedTemperature.value);
    if (selectedSugar.value) options.push(selectedSugar.value);
    emit('confirm', {
        product: props.product,
        options: options.join('')
    });
}

function close() {
    emit('close');
}

// 每次显示时重新加载
import { watch } from 'vue';
watch(() => props.visible, (val) => {
    if (val) loadOptions();
});
</script>

<style scoped>
.modal-mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
    display: flex;
    align-items: flex-end;
}
.modal-content {
    background: #fff;
    border-radius: 20rpx 20rpx 0 0;
    padding: 40rpx;
    width: 100%;
}
.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30rpx;
}
.modal-title {
    font-size: 32rpx;
    font-weight: bold;
}
.modal-close {
    font-size: 40rpx;
    color: #999;
}
.option-group {
    margin-bottom: 30rpx;
}
.option-label {
    font-size: 28rpx;
    color: #333;
    margin-bottom: 15rpx;
    display: block;
}
.option-list {
    display: flex;
    flex-wrap: wrap;
    gap: 15rpx;
}
.option-item {
    padding: 12rpx 24rpx;
    border: 1rpx solid #ddd;
    border-radius: 30rpx;
    font-size: 26rpx;
}
.option-item.active {
    background: #e6553a;
    color: #fff;
    border-color: #e6553a;
}
.modal-footer {
    margin-top: 30rpx;
}
.btn-confirm {
    background: #e6553a;
    color: #fff;
    text-align: center;
    padding: 20rpx;
    border-radius: 40rpx;
    font-size: 30rpx;
}
</style>
```

### 2. products.vue 改造

在 products.vue 中：
1. 引入 ProductOptionsModal 组件
2. 改造 quickAdd 函数：先获取选项，无选项直接加车，有选项弹窗

```vue
<!-- 在 template 底部添加 -->
<ProductOptionsModal 
    :visible="showOptionsModal" 
    :product="currentProduct"
    @confirm="handleOptionsConfirm"
    @close="showOptionsModal = false"
/>

<!-- 在 script 中添加 -->
import ProductOptionsModal from '@/components/ProductOptionsModal.vue';
import { addToCart, getProductOptions } from '@/utils/api.js';

const showOptionsModal = ref(false);
const currentProduct = ref(null);

// 改造 quickAdd
async function quickAdd(product) {
    const result = await getProductOptions(product.category, product.name);
    if (!result || !result.options || (!result.options.temperature && !result.options.sugar)) {
        // 没有选项，直接加入购物车
        await addToCart({
            session_id: sessionId.value,
            product_name: product.name,
            price: product.price,
            quantity: 1,
            category: product.category,
            options: ''
        });
        uni.showToast({ title: '已加入购物车', icon: 'success' });
    } else {
        // 有选项，弹窗选择
        currentProduct.value = product;
        showOptionsModal.value = true;
    }
}

// 选项确认回调
async function handleOptionsConfirm({ product, options }) {
    await addToCart({
        session_id: sessionId.value,
        product_name: product.name,
        price: product.price,
        quantity: 1,
        category: product.category,
        options: options
    });
    showOptionsModal.value = false;
    uni.showToast({ title: '已加入购物车', icon: 'success' });
}
```

### 3. cart.vue 改造

在购物车中显示 options，并支持带选项商品的增减和删除：

```vue
<!-- 在商品名下方显示选项 -->
<view class="item-name">{{ item.product_name }}</view>
<view v-if="item.options" class="item-options">{{ item.options }}</view>

<!-- 在删除和增减数量时传递 options -->
<button @click="changeQty(item, -1)">-</button>
<button @click="changeQty(item, 1)">+</button>
<button @click="deleteItem(item)">删除</button>

<script>
// 增减数量
async function changeQty(item, delta) {
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        await deleteItem(item);
        return;
    }
    await updateCartItem({
        session_id: sessionId.value,
        product_name: item.product_name,
        quantity: newQty,
        options: item.options || ''
    });
    item.quantity = newQty;
}

// 删除
async function deleteItem(item) {
    await removeFromCart({
        session_id: sessionId.value,
        product_name: item.product_name,
        options: item.options || ''
    });
    cartItems.value = cartItems.value.filter(i => i.id !== item.id);
}
</script>

<style>
.item-options {
    font-size: 24rpx;
    color: #e6553a;
    margin-top: 5rpx;
}
</style>
```

### 4. api.js 新增函数

```javascript
// 获取商品选项
export function getProductOptions(category, productName) {
    return request({
        url: '/api/product-options',
        method: 'GET',
        data: { category, product_name: productName }
    });
}

// 加入购物车（支持options）
export function addToCart(data) {
    return request({
        url: '/api/cart',
        method: 'POST',
        data
    });
}

// 更新购物车（支持options）
export function updateCartItem(data) {
    return request({
        url: '/api/cart',
        method: 'PUT',
        data
    });
}

// 从购物车移除（支持options）
export function removeFromCart(data) {
    return request({
        url: '/api/cart',
        method: 'DELETE',
        data
    });
}
```

## 四、收银看板改造

### cashier-dashboard.html

在渲染购物车项时，options 显示在商品名后：

找到渲染逻辑（通常在 renderCart 或类似函数中），修改为：

```javascript
// 原代码：
// html += `<td>${item.name} × ${item.quantity}</td>`;

// 改为：
const displayName = item.options ? `${item.name} (${item.options})` : item.name;
html += `<td>${displayName} × ${item.quantity}</td>`;
```

---

## 五、修改文件清单

| 文件 | 操作 |
|------|------|
| 数据库 | 执行 CREATE TABLE + ALTER TABLE |
| /TG/test/import-product-options.js | 新建（数据导入脚本） |
| /TG/tgservice/backend/server.js | 修改（新增接口、修改cart/order逻辑） |
| /TG/tgservice-uniapp/src/components/ProductOptionsModal.vue | 新建 |
| /TG/tgservice-uniapp/src/pages/products/products.vue | 修改 |
| /TG/tgservice-uniapp/src/pages/cart/cart.vue | 修改 |
| /TG/tgservice-uniapp/src/utils/api.js | 修改 |
| /TG/tgservice/admin/cashier-dashboard.html | 修改 |

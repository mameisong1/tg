# 商品选项功能设计文档

> **版本**: v1.0  
> **编写**: 开发团队A  
> **日期**: 2026-04-12  
> **适用范围**: 奶茶店分类商品（温度、糖度选项）

---

## 一、数据库设计

### 1.1 product_options 表（新建）

```sql
-- 商品选项配置表
CREATE TABLE IF NOT EXISTS product_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,              -- 商品分类（如"奶茶店"）
  product_name TEXT NOT NULL,          -- 商品名称（精确匹配，"所有商品"为分类通配）
  option_type TEXT NOT NULL,           -- 选项类型（temperature/sugar等）
  option_values TEXT NOT NULL,         -- 可选值JSON数组，如["热","温","冷"]
  default_value TEXT,                  -- 默认值（如"温"）
  is_required INTEGER DEFAULT 0,       -- 是否必选（0=可选，1=必选）
  sort_order INTEGER DEFAULT 0,        -- 排序顺序
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 索引：按分类+商品名查询
CREATE INDEX idx_product_options_category ON product_options(category);
CREATE INDEX idx_product_options_product ON product_options(product_name);
CREATE INDEX idx_product_options_type ON product_options(option_type);
```

**字段说明**：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| category | TEXT | 商品分类 | "奶茶店" |
| product_name | TEXT | 商品名，"所有商品"为通配 | "珍珠奶茶"、"所有商品" |
| option_type | TEXT | 选项类型 | "temperature"(温度)、"sugar"(糖度) |
| option_values | TEXT | JSON数组格式的可选值 | `["热","温","冷"]` |
| default_value | TEXT | 默认选中值 | "温" |
| is_required | INTEGER | 是否必选 | 1=必选，0=可选 |
| sort_order | INTEGER | 显示顺序 | 0=温度在前，1=糖度在后 |

**数据示例**：

```sql
-- 奶茶店分类的通用选项（product_name='所有商品'）
INSERT INTO product_options (category, product_name, option_type, option_values, default_value, is_required, sort_order) VALUES
('奶茶店', '所有商品', 'temperature', '["热","温","冷","冰"]', '温', 1, 0),
('奶茶店', '所有商品', 'sugar', '["全糖","七分糖","半糖","三分糖","无糖"]', '半糖', 1, 1);

-- 特定商品的个性化选项（精确匹配优先）
INSERT INTO product_options (category, product_name, option_type, option_values, default_value, is_required, sort_order) VALUES
('奶茶店', '招牌奶茶', 'temperature', '["热","温","冷"]', '温', 1, 0),
('奶茶店', '招牌奶茶', 'sugar', '["全糖","半糖","无糖"]', '半糖', 1, 1);
```

### 1.2 carts 表（已有 options 列）

根据检查，carts 表已存在 `options TEXT DEFAULT NULL` 列。

如需确认或补充：

```sql
-- 检查列是否存在
SELECT sql FROM sqlite_master WHERE name='carts';

-- 如果不存在，添加列
ALTER TABLE carts ADD COLUMN options TEXT DEFAULT '';

-- 更新索引（options参与唯一性判断）
-- SQLite不支持复合索引包含NULL，需在应用层处理
```

### 1.3 orders 表（无需修改）

orders 表的 items 字段已是 JSON 格式，只需在保存时增加 options 字段即可。

---

## 二、后端 API 设计

### 2.1 GET /api/product-options 接口

**功能**：根据商品分类和名称获取选项配置

**请求参数**：

```
GET /api/product-options?category=奶茶店&productName=珍珠奶茶
```

| 参数 | 必填 | 说明 |
|------|------|------|
| category | 是 | 商品分类 |
| productName | 是 | 商品名称 |

**匹配算法**（优先级从高到低）：

1. **精确匹配**：`product_name = productName`（如"珍珠奶茶"）
2. **分类通配**：`product_name = '所有商品' AND category = category`（分类通用配置）
3. **无配置**：返回空数组（商品无选项）

**实现代码**（添加到 server.js）：

```javascript
// ========== 商品选项配置 API ==========

// 获取商品选项配置
app.get('/api/product-options', async (req, res) => {
  try {
    const { category, productName } = req.query;
    
    if (!category || !productName) {
      return res.status(400).json({ error: '缺少参数' });
    }
    
    // 匹配算法：精确匹配优先，分类通配兜底
    // 1. 先查精确匹配
    const exactMatch = await dbAll(
      `SELECT option_type, option_values, default_value, is_required, sort_order
       FROM product_options 
       WHERE category = ? AND product_name = ?
       ORDER BY sort_order ASC`,
      [category, productName]
    );
    
    if (exactMatch.length > 0) {
      // 有精确匹配，直接返回
      const options = exactMatch.map(row => ({
        type: row.option_type,
        values: JSON.parse(row.option_values),
        default: row.default_value || '',
        required: row.is_required === 1,
        order: row.sort_order
      }));
      return res.json({ options, source: 'exact' });
    }
    
    // 2. 无精确匹配，查分类通配（product_name='所有商品'）
    const categoryMatch = await dbAll(
      `SELECT option_type, option_values, default_value, is_required, sort_order
       FROM product_options 
       WHERE category = ? AND product_name = '所有商品'
       ORDER BY sort_order ASC`,
      [category]
    );
    
    if (categoryMatch.length > 0) {
      const options = categoryMatch.map(row => ({
        type: row.option_type,
        values: JSON.parse(row.option_values),
        default: row.default_value || '',
        required: row.is_required === 1,
        order: row.sort_order
      }));
      return res.json({ options, source: 'category' });
    }
    
    // 3. 无任何配置，返回空
    res.json({ options: [], source: 'none' });
    
  } catch (err) {
    logger.error(`获取商品选项失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

**响应格式**：

```json
{
  "options": [
    {
      "type": "temperature",
      "values": ["热", "温", "冷", "冰"],
      "default": "温",
      "required": true,
      "order": 0
    },
    {
      "type": "sugar",
      "values": ["全糖", "七分糖", "半糖", "三分糖", "无糖"],
      "default": "半糖",
      "required": true,
      "order": 1
    }
  ],
  "source": "category"
}
```

### 2.2 POST /api/cart 接口修改

**修改点**：添加商品时支持 options 参数，不同 options 视为独立行

**修改代码**：

```javascript
// 原代码位置：约 line 530-560
// 修改后的代码：

app.post('/api/cart', async (req, res) => {
  try {
    const { sessionId, tableNo, productName, quantity = 1, options = '' } = req.body;

    if (!sessionId || !productName) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 统一处理：空字符串或未传时为 ''
    const optionsStr = options || '';

    // 检查是否已存在（匹配 session_id + product_name + options）
    const existing = await dbGet(
      'SELECT id, quantity FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ""))',
      [sessionId, productName, optionsStr, optionsStr]
    );

    if (existing) {
      // 更新数量（同一选项组合合并）
      await dbRun(
        'UPDATE carts SET quantity = quantity + ?, table_no = ? WHERE id = ?',
        [quantity, tableNo || null, existing.id]
      );
    } else {
      // 新增（不同选项视为独立行）
      await dbRun(
        'INSERT INTO carts (session_id, table_no, product_name, quantity, options) VALUES (?, ?, ?, ?, ?)',
        [sessionId, tableNo || null, productName, quantity, optionsStr]
      );
    }

    operationLog.info(`购物车操作: sessionId=${sessionId}, tableNo=${tableNo}, product=${productName}, qty=${quantity}, options=${optionsStr}`);
    res.json({ success: true, message: '已添加到购物车' });
  } catch (err) {
    logger.error(`购物车操作失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.3 GET /api/cart/:sessionId 接口修改

**修改点**：返回时包含 options 字段

**修改代码**：

```javascript
// 原代码位置：约 line 565-590
// 修改后的代码：

app.get('/api/cart/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const items = await dbAll(
      `SELECT c.product_name, c.quantity, c.table_no, c.options, p.price, p.image_url, p.category
       FROM carts c
       LEFT JOIN products p ON c.product_name = p.name
       WHERE c.session_id = ?`,
      [sessionId]
    );

    const tableNo = items.length > 0 ? items[0].table_no : null;
    const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

    // 格式化 options（确保返回空字符串而非 null）
    items.forEach(item => {
      item.options = item.options || '';
    });

    res.json({ items, tableNo, totalPrice });
  } catch (err) {
    logger.error(`获取购物车失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.4 PUT /api/cart 接口修改

**修改点**：更新数量时匹配 options

**修改代码**：

```javascript
// 原代码位置：约 line 595-610
// 修改后的代码：

app.put('/api/cart', async (req, res) => {
  try {
    const { sessionId, productName, quantity, options = '' } = req.body;
    const optionsStr = options || '';

    if (quantity <= 0) {
      // 数量为0时删除
      await dbRun(
        'DELETE FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ""))',
        [sessionId, productName, optionsStr, optionsStr]
      );
    } else {
      // 更新数量（匹配 options）
      await dbRun(
        'UPDATE carts SET quantity = ? WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ""))',
        [quantity, sessionId, productName, optionsStr, optionsStr]
      );
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(`更新购物车失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.5 DELETE /api/cart 接口修改

**修改点**：删除时匹配 options

**修改代码**：

```javascript
// 原代码位置：约 line 615-625
// 修改后的代码：

app.delete('/api/cart', async (req, res) => {
  try {
    const { sessionId, productName, options = '' } = req.body;
    const optionsStr = options || '';
    
    await dbRun(
      'DELETE FROM carts WHERE session_id = ? AND product_name = ? AND (options = ? OR (options IS NULL AND ? = ""))',
      [sessionId, productName, optionsStr, optionsStr]
    );
    res.json({ success: true });
  } catch (err) {
    logger.error(`删除购物车商品失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### 2.6 POST /api/order 接口修改

**修改点**：订单 items JSON 中保存 options 字段

**修改代码**：

```javascript
// 原代码位置：约 line 680-730
// 修改后的代码（关键部分）：

app.post('/api/order', async (req, res) => {
  try {
    const { sessionId, deviceFingerprint } = req.body;

    // ... 黑名单检查、台桌验证等逻辑不变 ...

    // 获取购物车（包含 options）
    const items = await dbAll(
      `SELECT c.product_name, c.quantity, c.table_no, c.options, p.price, p.category
       FROM carts c
       LEFT JOIN products p ON c.product_name = p.name
       WHERE c.session_id = ?`,
      [sessionId]
    );

    if (items.length === 0) {
      return res.status(400).json({ error: '购物车为空' });
    }

    // ... 台桌验证逻辑不变 ...

    const totalPrice = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const orderNo = `TG${Date.now()}`;

    // 准备订单信息（增加 options 字段）
    const orderItems = items.map(item => ({
      name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      category: item.category,
      options: item.options || ''  // 保存选项
    }));

    // 发送钉钉消息（显示选项）
    const message = `【天宫国际 - 新订单】\n\n台桌号: ${tableNo}\n商品:\n${orderItems.map(i => {
      const optStr = i.options ? `（${i.options}）` : '';
      return `  • ${i.name}${optStr} x${i.quantity} = ¥${(i.price * i.quantity).toFixed(2)}`;
    }).join('\n')}\n\n合计: ¥${totalPrice.toFixed(2)}\n订单号: ${orderNo}\n时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    // ... 发送钉钉、保存订单、清空购物车等逻辑不变 ...

    // 保存订单时 items 包含 options
    await dbRun(
      `INSERT INTO orders (order_no, table_no, items, total_price, status, device_fingerprint, created_at) VALUES (?, ?, ?, ?, '待处理', ?, datetime('now'))`,
      [orderNo, tableNo, JSON.stringify(orderItems), totalPrice, deviceFingerprint || null]
    );

    // 清空购物车
    await dbRun('DELETE FROM carts WHERE session_id = ?', [sessionId]);

    res.json({
      success: true,
      orderNo,
      message: '下单成功!请等待服务员送餐。'
    });
  } catch (err) {
    logger.error(`下单失败: ${err.message}`);
    res.status(500).json({ error: '服务器错误' });
  }
});
```

---

## 三、前端组件设计

### 3.1 ProductOptionsModal.vue 组件

**功能**：商品选项选择弹窗

**完整代码**：

```vue
<template>
  <view class="options-modal" v-if="visible">
    <view class="modal-mask" @click="close"></view>
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">{{ productName }}</text>
        <text class="modal-close" @click="close">×</text>
      </view>
      
      <view class="options-body">
        <view class="option-group" v-for="(opt, index) in options" :key="index">
          <view class="option-label">
            <text class="label-text">{{ getOptionLabel(opt.type) }}</text>
            <text class="label-required" v-if="opt.required">*</text>
          </view>
          <view class="option-values">
            <view 
              class="value-btn" 
              :class="{ active: selectedOptions[opt.type] === val }"
              v-for="val in opt.values" 
              :key="val"
              @click="selectOption(opt.type, val)"
            >
              <text>{{ val }}</text>
            </view>
          </view>
        </view>
        
        <view class="no-options" v-if="options.length === 0">
          <text>该商品无需选择选项</text>
        </view>
      </view>
      
      <view class="modal-footer">
        <view class="quantity-row">
          <text class="qty-label">数量</text>
          <view class="qty-controls">
            <view class="qty-btn" @click="changeQty(-1)">-</view>
            <text class="qty-num">{{ quantity }}</text>
            <view class="qty-btn" @click="changeQty(1)">+</view>
          </view>
        </view>
        <view class="confirm-btn" @click="confirm">
          <text>确认加入购物车</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import api from '@/utils/api.js'

const props = defineProps({
  visible: Boolean,
  productName: String,
  category: String,
  productPrice: Number
})

const emit = defineEmits(['close', 'confirm'])

// 选项配置
const options = ref([])
const selectedOptions = ref({})
const quantity = ref(1)

// 选项类型中文映射
const optionLabels = {
  temperature: '温度',
  sugar: '糖度',
  size: '规格',
  ice: '冰量'
}

const getOptionLabel = (type) => optionLabels[type] || type

// 加载选项配置
watch(() => props.visible, async (val) => {
  if (val && props.productName && props.category) {
    try {
      const res = await api.getProductOptions(props.category, props.productName)
      options.value = res.options || []
      
      // 初始化选中值（使用默认值）
      selectedOptions.value = {}
      options.value.forEach(opt => {
        selectedOptions.value[opt.type] = opt.default || opt.values[0]
      })
      
      quantity.value = 1
    } catch (e) {
      console.log('加载选项失败', e)
      options.value = []
    }
  }
})

// 选择选项
const selectOption = (type, value) => {
  selectedOptions.value[type] = value
}

// 改变数量
const changeQty = (delta) => {
  const newQty = quantity.value + delta
  if (newQty >= 1 && newQty <= 99) {
    quantity.value = newQty
  }
}

// 关闭弹窗
const close = () => {
  emit('close')
}

// 确认加入购物车
const confirm = () => {
  // 检查必选项
  const missingRequired = options.value.filter(opt => 
    opt.required && !selectedOptions.value[opt.type]
  )
  
  if (missingRequired.length > 0) {
    uni.showToast({
      title: `请选择${getOptionLabel(missingRequired[0].type)}`,
      icon: 'none'
    })
    return
  }
  
  // 生成选项字符串（如："温,半糖"）
  const optionsStr = options.value
    .map(opt => selectedOptions.value[opt.type] || '')
    .filter(v => v)
    .join(',')
  
  emit('confirm', {
    productName: props.productName,
    quantity: quantity.value,
    options: optionsStr
  })
  
  close()
}
</script>

<style scoped>
.options-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  width: 85%;
  max-width: 400px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  z-index: 1;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #000;
}

.modal-close {
  font-size: 28px;
  color: #000;
  cursor: pointer;
}

.options-body {
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.option-group {
  margin-bottom: 20px;
}

.option-label {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.label-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.label-required {
  font-size: 14px;
  color: #e74c3c;
  margin-left: 4px;
}

.option-values {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.value-btn {
  padding: 8px 16px;
  border-radius: 20px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.value-btn.active {
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
  border-color: #d4af37;
  color: #000;
}

.no-options {
  text-align: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
}

.quantity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.qty-label {
  font-size: 14px;
  color: #333;
}

.qty-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.qty-btn {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #333;
  cursor: pointer;
}

.qty-num {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  min-width: 40px;
  text-align: center;
}

.confirm-btn {
  padding: 14px;
  border-radius: 12px;
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: #000;
  cursor: pointer;
}
</style>
```

### 3.2 products.vue 集成修改

**修改点**：
1. 引入 ProductOptionsModal 组件
2. quickAdd 改为打开选项弹窗（有选项时）
3. 添加 API 方法 getProductOptions

**修改代码片段**：

```vue
<!-- 在 template 中添加 -->
<ProductOptionsModal
  v-model:visible="showOptionsModal"
  :productName="selectedProduct?.name"
  :category="selectedProduct?.category"
  :productPrice="selectedProduct?.price"
  @close="showOptionsModal = false"
  @confirm="onOptionsConfirm"
/>

<script setup>
// 引入组件
import ProductOptionsModal from '@/components/ProductOptionsModal.vue'

// 新增状态
const showOptionsModal = ref(false)
const selectedProduct = ref(null)

// 修改 quickAdd 方法
const quickAdd = async (item) => {
  // 员工模式检查台桌（逻辑不变）
  if (isEmployee.value) {
    if (!tableName.value) {
      await loadDefaultTableNo()
      showTableSelector.value = true
      return
    }
  }

  // 非员工模式检查台桌状态（逻辑不变）
  if (!isEmployee.value) {
    const status = tableStatus.value
    if (status === 'empty') {
      tipContent.value = '请用手机相机扫码进入'
      showTipModal.value = true
      return
    }
    if (status === 'expired') {
      tipContent.value = '扫码授权已过期，请用手机相机重新扫码'
      showTipModal.value = true
      return
    }
  }

  // 检查商品是否有选项
  try {
    const res = await api.getProductOptions(item.category, item.name)
    if (res.options && res.options.length > 0) {
      // 有选项，打开弹窗
      selectedProduct.value = item
      showOptionsModal.value = true
    } else {
      // 无选项，直接加入购物车
      await addToCartDirect(item, 1, '')
    }
  } catch (e) {
    // 获取选项失败，直接加入
    await addToCartDirect(item, 1, '')
  }
}

// 直接加入购物车（无选项）
const addToCartDirect = async (item, qty, options) => {
  try {
    await api.addCart({
      sessionId: sessionId.value,
      tableNo: tableName.value,
      productName: item.name,
      quantity: qty,
      options: options
    })
    uni.showToast({ title: '已加入购物车', icon: 'success' })
    loadCart()
  } catch (e) {
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

// 选项确认回调
const onOptionsConfirm = async (data) => {
  await addToCartDirect(selectedProduct.value, data.quantity, data.options)
}
</script>
```

**api.js 新增方法**：

```javascript
// 在 api.js 中添加
getProductOptions: (category, productName) => {
  return request({
    url: `/api/product-options?category=${encodeURIComponent(category)}&productName=${encodeURIComponent(productName)}`,
    method: 'GET'
  })
},

// 修改 addCart 方法，增加 options 参数
addCart: (data) => {
  return request({
    url: '/api/cart',
    method: 'POST',
    data: {
      sessionId: data.sessionId,
      tableNo: data.tableNo,
      productName: data.productName,
      quantity: data.quantity,
      options: data.options || ''  // 新增
    }
  })
},
```

### 3.3 cart.vue 集成修改

**修改点**：
1. 显示选项（商品名后追加）
2. 更新/删除时传递 options 参数

**修改代码片段**：

```vue
<template>
  <!-- 修改商品显示 -->
  <view class="cart-item" v-for="(item, index) in cartItems" :key="index">
    <image class="item-img" :src="getProductImage(item)" mode="aspectFill"></image>
    <view class="item-info">
      <view class="item-name">
        {{ item.product_name }}
        <text class="item-options" v-if="item.options">（{{ item.options }}）</text>
      </view>
      <view class="item-price">¥{{ item.price }}</view>
      <view class="item-actions">
        <view class="qty-btn" @click="changeQty(item, -1)">-</view>
        <text class="qty-num">{{ item.quantity }}</text>
        <view class="qty-btn" @click="changeQty(item, 1)">+</view>
        <text class="delete-btn" @click="deleteItem(item)">删除</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 新增样式 */
.item-options {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
</style>

<script setup>
// 修改 changeQty 方法
const changeQty = async (item, delta) => {
  const newQty = item.quantity + delta
  try {
    if (newQty <= 0) {
      await api.deleteCartItem({
        sessionId: sessionId.value,
        productName: item.product_name,
        options: item.options || ''  // 新增
      })
    } else {
      await api.updateCart({
        sessionId: sessionId.value,
        productName: item.product_name,
        quantity: newQty,
        options: item.options || ''  // 新增
      })
    }
    loadCart()
  } catch (e) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

// 修改 deleteItem 方法
const deleteItem = async (item) => {
  try {
    await api.deleteCartItem({
      sessionId: sessionId.value,
      productName: item.product_name,
      options: item.options || ''  // 新增
    })
    loadCart()
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'none' })
  }
}
</script>
```

**api.js 修改方法**：

```javascript
// 修改 updateCart
updateCart: (data) => {
  return request({
    url: '/api/cart',
    method: 'PUT',
    data: {
      sessionId: data.sessionId,
      productName: data.productName,
      quantity: data.quantity,
      options: data.options || ''  // 新增
    }
  })
},

// 修改 deleteCartItem
deleteCartItem: (data) => {
  return request({
    url: '/api/cart',
    method: 'DELETE',
    data: {
      sessionId: data.sessionId,
      productName: data.productName,
      options: data.options || ''  // 新增
    }
  })
},
```

---

## 四、购物车逻辑详解

### 4.1 不同 options 视为独立行

**业务规则**：
- 同一商品 + 不同选项 = 不同购物车行
- 同一商品 + 相同选项 = 合并数量

**示例**：

| 商品 | 选项 | 数量 | 购物车行 |
|------|------|------|----------|
| 珍珠奶茶 | 温,半糖 | 2 | 行1 |
| 珍珠奶茶 | 冰,全糖 | 1 | 行2 |
| 珍珠奶茶 | 温,半糖 | 3 | 行1（合并为5） |
| 可乐 | （无选项） | 1 | 行3 |

### 4.2 SQL 匹配逻辑

**添加商品时**：

```sql
-- 查找已存在的行（匹配 session_id + product_name + options）
SELECT id, quantity FROM carts 
WHERE session_id = ? 
  AND product_name = ? 
  AND (options = ? OR (options IS NULL AND ? = ""))
```

**处理 NULL 和空字符串的兼容**：

```sql
-- SQLite 中 NULL 和 '' 不相等，需特殊处理
-- 使用 OR 条件：(options = ?) OR (options IS NULL AND ? = "")

-- 更新数量
UPDATE carts SET quantity = ? 
WHERE session_id = ? 
  AND product_name = ? 
  AND (options = ? OR (options IS NULL AND ? = ""))

-- 删除商品
DELETE FROM carts 
WHERE session_id = ? 
  AND product_name = ? 
  AND (options = ? OR (options IS NULL AND ? = ""))
```

### 4.3 前端统一传空字符串

**规则**：前端始终传 `options = ""`，不传 `null` 或 `undefined`

**实现**：

```javascript
// api.js 中统一处理
addCart: (data) => {
  return request({
    url: '/api/cart',
    method: 'POST',
    data: {
      ...data,
      options: data.options || ''  // 确保空字符串
    }
  })
}
```

---

## 五、订单保存详解

### 5.1 items JSON 结构

**原结构**：

```json
[
  { "name": "可乐", "quantity": 2, "price": 5 }
]
```

**新结构（增加 options）**：

```json
[
  { 
    "name": "珍珠奶茶",
    "quantity": 2,
    "price": 12,
    "category": "奶茶店",
    "options": "温,半糖"
  },
  { 
    "name": "珍珠奶茶",
    "quantity": 1,
    "price": 12,
    "category": "奶茶店",
    "options": "冰,全糖"
  },
  { 
    "name": "可乐",
    "quantity": 1,
    "price": 5,
    "category": "饮料",
    "options": ""
  }
]
```

### 5.2 后端保存逻辑

```javascript
// server.js 中
const orderItems = items.map(item => ({
  name: item.product_name,
  quantity: item.quantity,
  price: item.price,
  category: item.category,
  options: item.options || ''  // 确保有值
}));

await dbRun(
  `INSERT INTO orders (order_no, table_no, items, ...) VALUES (?, ?, ?, ...)`,
  [orderNo, tableNo, JSON.stringify(orderItems), ...]
);
```

---

## 六、收银看板显示

### 6.1 cashier-dashboard.html 修改

**修改点**：商品名后追加选项显示

**修改代码**（约 line 693-700）：

```javascript
// 原代码
${items.map(item => `
  <div class="product-order-item">
    <span class="item-info">${item.category ? `<span style="font-size:12px;color:rgba(212,175,55,0.8);margin-right:6px">${item.category}</span>` : ''}${item.name} × ${item.quantity}</span>
    ...
  </div>
`).join('')}

// 修改后
${items.map(item => {
  const optStr = item.options ? ` <span style="font-size:12px;color:rgba(255,255,255,0.5)">(${item.options})</span>` : '';
  return `
    <div class="product-order-item">
      <span class="item-info">
        ${item.category ? `<span style="font-size:12px;color:rgba(212,175,55,0.8);margin-right:6px">${item.category}</span>` : ''}
        ${item.name}${optStr} × ${item.quantity}
      </span>
      <div style="display:flex;align-items:center;gap:8px">
        ${isPending ? `<button class="item-cancel-btn" onclick="openCancelItemModal(${o.id}, '${item.name}', ${item.quantity}, '${item.options || ''}')">取消</button>` : ''}
      </div>
    </div>
  `;
}).join('')}
```

### 6.2 取消商品弹窗修改

**修改点**：取消时需匹配 options

**修改代码**：

```javascript
// 取消商品时，需要显示选项信息
function openCancelItemModal(orderId, itemName, quantity, options) {
  const displayName = options ? `${itemName}（${options}）` : itemName;
  // ... 弹窗显示逻辑 ...
}

// 实际取消操作（后端需支持按选项取消）
// 后端新增 API: POST /api/order/cancel-item
// 参数: orderId, itemName, options
```

---

## 七、数据导入脚本

### 7.1 import-product-options.js

**完整代码**：

```javascript
/**
 * 商品选项数据导入脚本
 * 从 Excel 读取数据并写入 dev/prod 数据库
 * 
 * 运行方式：
 *   node import-product-options.js
 *   node import-product-options.js --env=prod
 */

const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 配置
const EXCEL_PATH = '/TG/docs/商品选项（奶茶店）.xlsx';
const DEV_DB_PATH = '/TG/tgservice/db/tgservice.db';
const PROD_DB_PATH = '/TG/run/db/tgservice.db';  // 生产环境数据库路径

// 解析命令行参数
const args = process.argv.slice(2);
const envArg = args.find(a => a.startsWith('--env='));
const targetEnv = envArg ? envArg.split('=')[1] : 'dev';

// 确定目标数据库
const dbPath = targetEnv === 'prod' ? PROD_DB_PATH : DEV_DB_PATH;

console.log('========================================');
console.log('商品选项数据导入工具');
console.log('========================================');
console.log(`目标环境: ${targetEnv}`);
console.log(`数据库路径: ${dbPath}`);
console.log(`Excel路径: ${EXCEL_PATH}`);
console.log('');

// 检查 Excel 文件
if (!fs.existsSync(EXCEL_PATH)) {
  console.error('❌ Excel 文件不存在:', EXCEL_PATH);
  console.log('');
  console.log('请创建 Excel 文件，格式如下：');
  console.log('');
  console.log('| 分类 | 商品名称 | 选项类型 | 可选值 | 默认值 | 是否必选 | 排序 |');
  console.log('|------|----------|----------|--------|--------|----------|------|');
  console.log('| 奶茶店 | 所有商品 | temperature | 热,温,冷,冰 | 温 | 是 | 0 |');
  console.log('| 奶茶店 | 所有商品 | sugar | 全糖,七分糖,半糖,三分糖,无糖 | 半糖 | 是 | 1 |');
  console.log('| 奶茶店 | 珍珠奶茶 | temperature | 热,温,冷 | 温 | 是 | 0 |');
  console.log('');
  console.log('说明：');
  console.log('  - "所有商品" 表示分类通配，适用于该分类下所有商品');
  console.log('  - 具体商品名表示精确匹配，优先级高于通配');
  console.log('  - 可选值用逗号分隔');
  console.log('  - 是否必选：是/否');
  console.log('');
  process.exit(1);
}

// 连接数据库
console.log('📦 连接数据库...');
const db = new Database(dbPath);
console.log('✅ 数据库已连接');

// 创建表（如不存在）
console.log('');
console.log('📋 创建 product_options 表...');
db.exec(`
  CREATE TABLE IF NOT EXISTS product_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    option_type TEXT NOT NULL,
    option_values TEXT NOT NULL,
    default_value TEXT,
    is_required INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_category ON product_options(category)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_name)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_product_options_type ON product_options(option_type)`);
console.log('✅ 表已创建');

// 读取 Excel
console.log('');
console.log('📊 读取 Excel 文件...');
const workbook = XLSX.readFile(EXCEL_PATH);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`✅ 读取到 ${data.length} 条数据`);

// 清空旧数据
console.log('');
console.log('🗑️  清空旧数据...');
db.exec('DELETE FROM product_options');
console.log('✅ 已清空');

// 准备插入语句
const insertStmt = db.prepare(`
  INSERT INTO product_options 
  (category, product_name, option_type, option_values, default_value, is_required, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// 转换并插入数据
console.log('');
console.log('💾 导入数据...');
let successCount = 0;
let errorCount = 0;

data.forEach((row, index) => {
  try {
    const category = row['分类'] || row['category'] || '';
    const productName = row['商品名称'] || row['product_name'] || '';
    const optionType = row['选项类型'] || row['option_type'] || '';
    const optionValuesRaw = row['可选值'] || row['option_values'] || '';
    const defaultValue = row['默认值'] || row['default_value'] || '';
    const isRequiredRaw = row['是否必选'] || row['is_required'] || '否';
    const sortOrderRaw = row['排序'] || row['sort_order'] || '0';

    // 验证必填字段
    if (!category || !productName || !optionType || !optionValuesRaw) {
      console.log(`⚠️  行 ${index + 1}: 缺少必填字段，跳过`);
      errorCount++;
      return;
    }

    // 转换可选值为 JSON 数组
    const valuesArray = optionValuesRaw.split(',').map(v => v.trim()).filter(v => v);
    const optionValues = JSON.stringify(valuesArray);

    // 转换是否必选
    const isRequired = (isRequiredRaw === '是' || isRequiredRaw === '1' || isRequiredRaw === 'true') ? 1 : 0;

    // 转换排序
    const sortOrder = parseInt(sortOrderRaw) || 0;

    // 插入
    insertStmt.run(category, productName, optionType, optionValues, defaultValue, isRequired, sortOrder);
    successCount++;

    console.log(`✅ 行 ${index + 1}: ${category}/${productName}/${optionType}`);

  } catch (err) {
    console.log(`❌ 行 ${index + 1}: ${err.message}`);
    errorCount++;
  }
});

// 统计
console.log('');
console.log('========================================');
console.log('导入结果');
console.log('========================================');
console.log(`✅ 成功: ${successCount} 条`);
console.log(`❌ 失败: ${errorCount} 条`);

// 查询验证
console.log('');
console.log('📋 数据验证...');
const count = db.prepare('SELECT COUNT(*) as count FROM product_options').get();
console.log(`product_options 表记录数: ${count.count}`);

// 显示导入的数据
const samples = db.prepare('SELECT * FROM product_options LIMIT 5').all();
console.log('');
console.log('示例数据:');
samples.forEach(row => {
  console.log(`  ${row.category}/${row.product_name}/${row.option_type}: ${row.option_values}`);
});

// 关闭数据库
db.close();
console.log('');
console.log('🎉 导入完成！');
```

### 7.2 Excel 文件格式说明

如 Excel 文件不存在，需手动创建，格式如下：

| 分类 | 商品名称 | 选项类型 | 可选值 | 默认值 | 是否必选 | 排序 |
|------|----------|----------|--------|--------|----------|------|
| 奶茶店 | 所有商品 | temperature | 热,温,冷,冰 | 温 | 是 | 0 |
| 奶茶店 | 所有商品 | sugar | 全糖,七分糖,半糖,三分糖,无糖 | 半糖 | 是 | 1 |
| 奶茶店 | 珍珠奶茶 | temperature | 热,温,冷 | 温 | 是 | 0 |

**字段说明**：
- **分类**：商品分类名称
- **商品名称**：`"所有商品"` 为分类通配，其他为具体商品名
- **选项类型**：temperature(温度)、sugar(糖度)等
- **可选值**：逗号分隔的可选项
- **默认值**：默认选中的值
- **是否必选**：是/否
- **排序**：数字，小的先显示

---

## 八、向后兼容策略

### 8.1 无选项商品处理

**规则**：无选项配置的商品，options 字段为空字符串，不影响现有流程

**实现**：

1. **前端**：无选项时直接加入购物车，不打开弹窗
2. **后端**：options 为空时正常处理，SQL 匹配兼容 NULL 和 ''
3. **订单**：options 字段始终存在，空值不影响显示

### 8.2 数据库兼容

```sql
-- carts 表 options 列已有默认值 NULL
-- 新数据写入空字符串 ''，旧数据保持 NULL
-- 查询时用 OR 条件兼容
(options = ? OR (options IS NULL AND ? = ""))
```

### 8.3 API 兼容

```javascript
// 前端始终传空字符串
options: data.options || ''

// 后端统一处理
const optionsStr = options || ''
```

---

## 九、测试要点

### 9.1 后端测试

```bash
# 1. 测试获取选项
curl "http://localhost:8088/api/product-options?category=奶茶店&productName=珍珠奶茶"

# 2. 测试添加购物车（有选项）
curl -X POST http://localhost:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","productName":"珍珠奶茶","quantity":1,"options":"温,半糖"}'

# 3. 测试添加购物车（无选项）
curl -X POST http://localhost:8088/api/cart \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123","productName":"可乐","quantity":1}'

# 4. 测试获取购物车
curl http://localhost:8088/api/cart/test123

# 5. 测试下单
curl -X POST http://localhost:8088/api/order \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test123"}'
```

### 9.2 前端测试

1. 商品列表点击 "+"，有选项商品应弹出选项弹窗
2. 选项弹窗选择后确认，加入购物车
3. 购物车显示商品名 + 选项
4. 修改数量、删除商品正常
5. 下单成功，订单中包含选项信息

---

## 十、开发清单

### 10.1 后端任务

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 1 | 创建 product_options 表 | 数据库 | 待开发 |
| 2 | GET /api/product-options 接口 | server.js | 待开发 |
| 3 | POST /api/cart 增加 options | server.js | 待开发 |
| 4 | GET /api/cart 返回 options | server.js | 待开发 |
| 5 | PUT /api/cart 匹配 options | server.js | 待开发 |
| 6 | DELETE /api/cart 匹配 options | server.js | 待开发 |
| 7 | POST /api/order 保存 options | server.js | 待开发 |

### 10.2 前端任务

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 1 | 创建 ProductOptionsModal.vue | components/ | 待开发 |
| 2 | api.js 增加 getProductOptions | utils/api.js | 待开发 |
| 3 | api.js 修改 addCart/updateCart/deleteCartItem | utils/api.js | 待开发 |
| 4 | products.vue 集成选项弹窗 | pages/products/ | 待开发 |
| 5 | cart.vue 显示选项 | pages/cart/ | 待开发 |

### 10.3 收银看板任务

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 1 | 商品名后显示选项 | cashier-dashboard.html | 待开发 |

---

*文档完成时间：2026-04-12*
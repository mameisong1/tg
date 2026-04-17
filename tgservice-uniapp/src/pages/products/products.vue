<template>
  <view class="page">
    <!-- #ifndef H5 -->
    <!-- 小程序：固定区域 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <text class="header-title">商品点单</text>
      </view>
      <view class="category-bar">
        <view class="category-grid">
          <view
            class="category-btn"
            :class="{ active: currentCategory === '全部' }"
            @click="selectCategory('全部')"
          >
            <view class="icon-wrapper">
              <text class="category-icon">📋</text>
              <view class="count-badge" v-if="categoryCounts['全部']">{{ categoryCounts['全部'] }}</view>
            </view>
            <text class="category-text">全部</text>
          </view>
          <view
            class="category-btn"
            v-for="cat in categories"
            :key="cat"
            :class="{ active: currentCategory === cat }"
            @click="selectCategory(cat)"
          >
            <view class="icon-wrapper">
              <text class="category-icon">{{ getCategoryIcon(cat) }}</text>
              <view class="count-badge" v-if="categoryCounts[cat]">{{ categoryCounts[cat] }}</view>
            </view>
            <text class="category-text">{{ cat }}</text>
          </view>
        </view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44 + categoryBarHeight) + 'px' }"></view>
    <!-- #endif -->

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
          @input="onSearchInput"
          @confirm="onSearchConfirm"
        />
        <text class="search-clear" v-if="searchKeyword" @click="clearSearch">✕</text>
      </view>

      <!-- 搜索结果提示 -->
      <view class="search-result-tip" v-if="searchKeyword && !loading">
        <text>找到 {{ filteredProducts.length }} 件商品</text>
      </view>

      <!-- 分类标签（折行显示） -->
      <view class="category-wrap">
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

      <!-- 台桌信息显示 -->
      <view class="table-info-wrapper">
        <!-- 员工模式 -->
        <view v-if="isEmployee" class="table-info employee-mode">
          <text class="table-label">当前台桌：</text>
          <text class="table-value">{{ tableName || '未选择' }}</text>
        </view>
        <!-- 非员工模式 -->
        <TableInfo v-else ref="tableInfoRef" hideWhenValid />
      </view>
    </view>
    <!-- #endif -->

    <!-- 商品列表 - 两个一行 -->
    <view class="products-section">
      <view class="products-grid">
        <view
          class="product-card"
          :class="{ 'highlight': highlightProductName === item.name }"
          v-for="(item, index) in filteredProducts"
          :key="item.name"
          :id="'product-' + index"
        >
          <view class="product-thumb-wrap" @click.stop="previewProductImage(index)">
            <image class="product-thumb" :src="getProductImage(item)" mode="aspectFill"></image>
          </view>
          <view class="product-detail">
            <text class="product-name">{{ item.name }}</text>
            <text class="product-category">{{ item.category || '-' }}</text>
            <view class="product-bottom">
              <text class="product-price">¥{{ item.price }}</text>
              <view class="add-cart-btn" @click.stop="quickAdd(item)">+</view>
            </view>
          </view>
        </view>
        <view class="empty-tip" v-if="filteredProducts.length === 0 && !loading">
          <text v-if="searchKeyword">未找到「{{ searchKeyword }}」相关商品</text>
          <text v-else>暂无商品</text>
        </view>
        <view class="loading-tip" v-if="loading">
          <text>加载中...</text>
        </view>
      </view>
    </view>

    <!-- 购物车浮动按钮 -->
    <view class="cart-float" v-if="cartCount > 0" :style="{ right: floatPosition === 'left' ? '20px' : 'auto', left: floatPosition === 'right' ? '20px' : 'auto' }" @click="goCart">
      <text class="cart-icon">🛒</text>
      <view class="cart-badge">{{ cartCount }}</view>
    </view>

    <!-- 美化弹框 -->
    <BeautyModal
      v-model:visible="showTipModal"
      title="温馨提示"
      :content="tipContent"
      confirmText="知道了"
      @confirm="showTipModal = false"
    />

    <!-- 商品选项弹窗 -->
    <ProductOptionsModal
      :visible="showOptionsModal"
      :product="currentProduct"
      @confirm="handleOptionsConfirm"
      @close="showOptionsModal = false"
    />
    
    <!-- #ifdef H5 -->
    <!-- 台桌选择器（员工使用） -->
    <TableSelector :visible="showTableSelector" :defaultTable="defaultTableNo" @confirm="onTableSelected" @cancel="showTableSelector = false" />
    <!-- #endif -->

    <!-- 回到顶部按钮 -->
    <view class="back-to-top" v-if="showBackToTop" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="scrollToTop">
      <text>↑</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'
import TableInfo from '@/components/TableInfo.vue'
import TableSelector from '@/components/TableSelector.vue'
import ProductOptionsModal from '@/components/ProductOptionsModal.vue'

// 状态栏高度
const statusBarHeight = ref(0)
// 分类栏高度（两行按钮约100px）
const categoryBarHeight = ref(100)

// 悬浮按钮位置
const floatPosition = ref('left')

// 弹框状态
const showTipModal = ref(false)
const tipContent = ref('')

// 台桌信息组件引用
const tableInfoRef = ref(null)

// 直接从 localStorage 读取台桌信息，不依赖组件传递（解决响应式链断裂问题）
const tableAuthExpireMinutes = ref(5) // 默认5分钟

// 台桌名称 - 用 ref 存储，选择台桌后手动更新（解决 computed 不响应 localStorage 变化问题）
const tableName = ref(uni.getStorageSync('tableName') || '')

// 台桌状态 - 直接计算，不依赖组件
const tableStatus = computed(() => {
  const name = tableName.value
  if (!name) return 'empty'

  const authStr = uni.getStorageSync('tableAuth')
  if (!authStr) return 'empty'

  try {
    const auth = JSON.parse(authStr)
    const isExpired = (Date.now() - auth.time) > tableAuthExpireMinutes.value * 60 * 1000
    return isExpired ? 'expired' : 'valid'
  } catch {
    return 'empty'
  }
})

const categories = ref([])
const currentCategory = ref('全部')
const products = ref([])
const loading = ref(false)
const sessionId = ref('')
const cartCount = ref(0)
const showOptionsModal = ref(false)
const currentProduct = ref(null)
const highlightProductName = ref('') // 高亮商品名
const categoryCounts = ref({}) // 分类商品数量

// 回到顶部
const showBackToTop = ref(false)

// ===== 搜索功能 =====
const searchKeyword = ref('')
let searchDebounceTimer = null

// 过滤后的商品列表（前端实时过滤）
const filteredProducts = computed(() => {
  if (!searchKeyword.value.trim()) {
    return products.value
  }
  const keyword = searchKeyword.value.trim().toLowerCase()
  return products.value.filter(p =>
    p.name.toLowerCase().includes(keyword)
  )
})

// 搜索输入（300ms 防抖）
const onSearchInput = () => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    // 搜索词变化时，如果当前分类下无匹配，自动切到"全部"
    if (searchKeyword.value.trim()) {
      if (currentCategory.value !== '全部' &&
          !products.value.some(p => p.name.toLowerCase().includes(searchKeyword.value.trim().toLowerCase()))) {
        currentCategory.value = '全部'
        loadProducts()
      }
    }
  }, 300)
}

// 搜索确认
const onSearchConfirm = () => {
  clearTimeout(searchDebounceTimer)
  if (searchKeyword.value.trim() && currentCategory.value !== '全部') {
    currentCategory.value = '全部'
    loadProducts()
  }
}

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = ''
}

// 分类图标映射
const categoryIcons = {
  '全部': '📋',
  '酒水': '🍺',
  '奶茶店': '🧋',
  '小吃': '🍟',
  '饮料': '🥤',
  '零食': '🍪',
  '泡面': '🍜',
  '槟榔': '🌿',
  '其他': '📦'
}

const getCategoryIcon = (cat) => categoryIcons[cat] || '📦'

// 放大预览用原图（不压缩）
const allProductImages = computed(() => products.value.map(item => {
  const url = item.image_url
  if (!url) return '/static/avatar-default.png'
  // 直接用原图，不加resize参数
  return url.startsWith('http') ? url : 'http://47.238.80.12:8081' + url
}))

// 预览商品图片
const previewProductImage = (index) => {
  if (allProductImages.value.length === 0) return
  uni.previewImage({
    urls: allProductImages.value,
    current: index
  })
}

const getProductImage = (item) => {
  const url = item.image_url
  if (!url) return '/static/avatar-default.png'

  // OSS图片压缩到400px
  if (url.includes('aliyuncs.com')) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}x-oss-process=image/resize,w_400`
  }

  if (url.startsWith('http')) return url
  return 'http://47.238.80.12:8081' + url
}

const generateSessionId = () => 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

const loadCategories = async () => {
  try { categories.value = await api.getCategories() } catch (e) {}
}

const loadCategoryCounts = async () => {
  try {
    const counts = await api.getCategoryCounts()
    const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)
    categoryCounts.value = { '全部': totalCount, ...counts }
  } catch (e) {
    console.log('获取分类数量失败', e)
  }
}

const loadProducts = async () => {
  loading.value = true
  try {
    let data = await api.getProducts(currentCategory.value === '全部' ? '' : currentCategory.value)
    data = data.filter(p => p.status === '上架')
    products.value = data
  } catch (e) {}
  loading.value = false
}

const loadCart = async () => {
  try {
    const data = await api.getCart(sessionId.value)
    cartCount.value = data.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  } catch (e) {}
}

const selectCategory = (cat) => {
  currentCategory.value = cat
  loadProducts()
}

// 员工识别：有 adminToken 或 coachToken 即为员工
const isEmployee = computed(() => {
  return !!(uni.getStorageSync('adminToken') || uni.getStorageSync('coachToken'))
})

// 台桌选择器
const showTableSelector = ref(false)
const defaultTableNo = ref('')

// 加载默认台桌号（已上桌助教）
// 2026-04-15 修改：不再从水牌加载默认值（需求5）
const loadDefaultTableNo = async () => {
  if (tableName.value) {
    defaultTableNo.value = tableName.value
    return
  }
  // 不再从水牌加载默认值，默认值为空
  defaultTableNo.value = ''
}

// 台桌选择回调（商品页）
const onTableSelected = (tableNo) => {
  showTableSelector.value = false
  uni.setStorageSync('tableName', tableNo)
  // 当作扫码成功：同时写入 tableAuth
  uni.setStorageSync('tableAuth', JSON.stringify({ table: tableNo, time: Date.now() }))
  // 手动更新 ref（让页面立即响应，解决 computed 不响应 localStorage 变化问题）
  tableName.value = tableNo
  tableInfoRef.value?.loadTableInfo()
}

const quickAdd = async (item) => {
  // 员工：无台桌号时先选台桌
  if (isEmployee.value) {
    if (!tableName.value) {
      await loadDefaultTableNo()
      showTableSelector.value = true
      return
    }
    // 检查商品是否有选项
    try {
      const result = await api.getProductOptions(item.category, item.name)
      if (result && result.options && (result.options.temperature || result.options.sugar)) {
        // 有选项，弹窗选择
        currentProduct.value = item
        showOptionsModal.value = true
        return
      }
      // 无选项，直接加车
      await api.addCart({ sessionId: sessionId.value, tableNo: tableName.value, productName: item.name, quantity: 1, options: '' })
      uni.showToast({ title: '已加入购物车', icon: 'success' })
      loadCart()
    } catch (e) {
      // 获取选项失败，直接加车
      try {
        await api.addCart({ sessionId: sessionId.value, tableNo: tableName.value, productName: item.name, quantity: 1, options: '' })
        uni.showToast({ title: '已加入购物车', icon: 'success' })
        loadCart()
      } catch (e2) {
        uni.showToast({ title: '添加失败', icon: 'none' })
      }
    }
    return
  }

  // 非员工：检查台桌状态
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

  // 检查商品是否有选项
  try {
    const result = await api.getProductOptions(item.category, item.name)
    if (result && result.options && (result.options.temperature || result.options.sugar)) {
      // 有选项，弹窗选择
      currentProduct.value = item
      showOptionsModal.value = true
      return
    }
    // 无选项，直接加车
    await api.addCart({ sessionId: sessionId.value, tableNo: tableName.value, productName: item.name, quantity: 1, options: '' })
    uni.showToast({ title: '已加入购物车', icon: 'success' })
    loadCart()
  } catch (e) {
    // 获取选项失败，直接加车
    try {
      await api.addCart({ sessionId: sessionId.value, tableNo: tableName.value, productName: item.name, quantity: 1, options: '' })
      uni.showToast({ title: '已加入购物车', icon: 'success' })
      loadCart()
    } catch (e2) {
      uni.showToast({ title: '添加失败', icon: 'none' })
    }
  }
}

// 选项确认回调
const handleOptionsConfirm = async ({ product, options }) => {
  try {
    await api.addCart({ sessionId: sessionId.value, tableNo: tableName.value, productName: product.name, quantity: 1, options: options })
    showOptionsModal.value = false
    uni.showToast({ title: '已加入购物车', icon: 'success' })
    loadCart()
  } catch (e) {
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

const goCart = () => uni.navigateTo({ url: '/pages/cart/cart' })

// 检测高亮商品并定位
const checkHighlightProduct = async () => {
  const name = uni.getStorageSync('highlightProduct')
  if (!name) return

  // 清除storage
  uni.removeStorageSync('highlightProduct')

  // 查找商品是否存在
  const targetProduct = products.value.find(p => p.name === name)
  if (!targetProduct) {
    // 商品不在当前分类，切到"全部"再找
    if (currentCategory.value !== '全部') {
      currentCategory.value = '全部'
      await loadProducts()
      setTimeout(() => scrollToProduct(name), 300)
    }
    return
  }

  scrollToProduct(name)
}

// 滚动定位到商品
const scrollToProduct = (name) => {
  highlightProductName.value = name

  // 通过商品名找到索引
  const index = products.value.findIndex(p => p.name === name)
  if (index === -1) return

  // 延迟确保DOM渲染完成
  setTimeout(() => {
    const selector = '#product-' + index
    const systemInfo = uni.getSystemInfoSync()
    const screenHeight = systemInfo.windowHeight // 屏幕高度

    uni.createSelectorQuery()
      .select(selector)
      .boundingClientRect((rect) => {
        if (!rect) {
          console.log('未找到元素:', selector)
          return
        }

        // 固定区域高度 = 状态栏 + 标题栏(44) + 分类栏(100)
        const fixedHeight = statusBarHeight.value + 44 + categoryBarHeight.value

        // 目标位置：让商品显示在屏幕中间偏上
        const offset = screenHeight / 3

        // 获取当前滚动位置
        uni.createSelectorQuery()
          .selectViewport()
          .scrollOffset((scrollInfo) => {
            // 计算目标滚动位置
            // rect.top 是元素距离视口顶部的距离
            // 要让元素显示在 offset 位置，需要滚动：scrollTop + rect.top - fixedHeight - offset
            const targetScrollTop = scrollInfo.scrollTop + rect.top - fixedHeight - offset

            console.log('滚动定位:', {
              name,
              index,
              selector,
              rectTop: rect.top,
              scrollTop: scrollInfo.scrollTop,
              fixedHeight,
              offset,
              targetScrollTop
            })

            uni.pageScrollTo({
              scrollTop: Math.max(0, targetScrollTop),
              duration: 400
            })
          })
          .exec()
      })
      .exec()
  }, 350)

  // 3秒后移除高亮
  setTimeout(() => {
    highlightProductName.value = ''
  }, 3000)
}

// 加载前端配置（获取授权过期时间）
const loadFrontConfig = async () => {
  try {
    const data = await api.getFrontConfig()
    if (data.tableAuthExpireMinutes) {
      tableAuthExpireMinutes.value = data.tableAuthExpireMinutes
    }
  } catch (e) {
    console.log('获取前端配置失败，使用默认值')
  }
}

onMounted(() => {
  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20

  sessionId.value = uni.getStorageSync('sessionId') || generateSessionId()
  uni.setStorageSync('sessionId', sessionId.value)

  // 加载前端配置（授权过期时间）
  loadFrontConfig()

  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'

  loadCategories()
  loadCategoryCounts()
  loadProducts()
  loadCart()

  // #ifdef H5
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', updateFullscreenClass)
  updateFullscreenClass()
  // 监听滚动
  window.addEventListener('scroll', () => {
    showBackToTop.value = window.scrollY > 300
  })
  // #endif
})

// #ifdef H5
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenClass)
})

const updateFullscreenClass = () => {
  if (document.fullscreenElement) {
    document.body.classList.add('fullscreen-mode')
  } else {
    document.body.classList.remove('fullscreen-mode')
  }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
// #endif

// 每次显示页面时刷新
onShow(() => {
  // 【新增】员工进入时清空旧台桌号
  if (isEmployee.value) {
    uni.removeStorageSync('tableName')
    uni.removeStorageSync('tableAuth')
    tableName.value = ''
  }
  
  // 原有逻辑
  tableInfoRef.value?.loadTableInfo()
  loadCart()
  loadProducts().then(() => {
    // 检测高亮商品
    checkHighlightProduct()
  })
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 120px; }

/* ===== 小程序：固定区域 ===== */
/* #ifndef H5 */
.fixed-area {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.fixed-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
.header-placeholder { background: #0a0a0f; }
/* #endif */

/* ===== H5 标题栏 ===== */
/* #ifdef H5 */
.h5-title-bar {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
.h5-title-text {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
/* 分类按钮区域（不固定） */
.h5-filter-area {
  background: #0a0a0f;
}
/* 台桌信息容器 */
.table-info-wrapper {
  padding: 12px 16px;
}

/* ===== 搜索栏 ===== */
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

/* ===== 分类标签（折行显示） ===== */
.category-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
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

/* 员工模式台桌信息 */
.table-info.employee-mode {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
}
.table-info.employee-mode .table-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}
.table-info.employee-mode .table-value {
  font-size: 16px;
  color: #d4af37;
  font-weight: 600;
}
/* #endif */

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}

/* 第3块：分类按钮 */
.category-bar {
  background: rgba(10,10,15,0.98);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding: 10px 8px 6px;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.category-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(218,175,32,0.1);
  border-radius: 8px;
}
.category-btn.active {
  background: rgba(212,175,55,0.15);
  border-color: rgba(218,165,32,0.3);
}
.category-btn.active .category-text { color: #d4af37; }
.category-icon { font-size: 20px; }
.category-text { font-size: 12px; color: rgba(255,255,255,0.7); }

/* 图标包装器 - 用于定位徽章 */
.icon-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 数量徽章 */
.count-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  background: rgba(212, 175, 55, 0.5);
  border-radius: 7px;
  font-size: 9px;
  font-weight: 600;
  color: #d4af37;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* 商品列表 - 两个一行 */
.products-section { padding: 12px; overflow-x: hidden; }
.products-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.product-card {
  background: rgba(255,255,255,0.12);
  border-radius: 12px;
  border: 1px solid rgba(218,175,32,0.1);
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.product-card.highlight {
  border-color: #d4af37;
  box-shadow: 0 0 20px rgba(212,175,55,0.5), inset 0 0 10px rgba(212,175,55,0.1);
}
.product-thumb-wrap {
  aspect-ratio: 1;
  overflow: hidden;
  padding: 10px 10px 0 10px;
  box-sizing: border-box;
  /* 银灰色背景，让白色背景图片融入深色主题 */
  background: rgba(192,192,192,0.1);
  border-radius: 8px;
}
.product-thumb {
  width: 100%;
  height: 100%;
  border-radius: 8px;
}
.product-detail { padding: 10px; }
.product-name {
  font-size: 13px;
  color: #fff;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.product-category {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 6px;
  display: block;
}
.product-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.product-price { color: #d4af37; font-size: 15px; font-weight: 600; }
.add-cart-btn {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 50%;
  color: #000;
  font-size: 20px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 购物车浮动按钮 */
.cart-float {
  position: fixed;
  bottom: 100px;
  right: 20px;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(212,175,55,0.4);
  z-index: 99;
}
.cart-icon { font-size: 24px; }
.cart-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  background: #e74c3c;
  border-radius: 10px;
  font-size: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.empty-tip, .loading-tip {
  grid-column: span 2;
  text-align: center;
  padding: 40px;
  color: rgba(255,255,255,0.3);
  font-size: 14px;
}

/* 全屏模式样式保留 */
:global(.fullscreen-mode) .h5-title-bar {
  /* 保持一致 */
}

/* 回到顶部按钮 */
.back-to-top {
  position: fixed;
  bottom: 80px;
  width: 44px;
  height: 44px;
  background: rgba(212, 175, 55, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  z-index: 100;
}
.back-to-top text {
  font-size: 20px;
  color: #000;
  font-weight: bold;
}
</style>



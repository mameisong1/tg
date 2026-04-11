<template>
  <view class="page">
    <!-- #ifdef H5 -->
    <!-- 员工模式：顶部台桌号 + 切换按钮 -->
    <view v-if="isEmployee" class="employee-table-bar">
      <text class="table-label">台桌：</text>
      <text class="table-value">{{ tableName || '未选择' }}</text>
      <view class="switch-btn" @click="openTableSelector">
        <text>切换台桌</text>
      </view>
    </view>
    <!-- 非员工：使用统一台桌组件 -->
    <TableInfo v-else ref="tableInfoRef" />
    <!-- #endif -->
    
    <!-- #ifndef H5 -->
    <TableInfo ref="tableInfoRef" />
    <!-- #endif -->
    
    <view class="cart-list" v-if="cartItems.length > 0">
      <view class="cart-item" v-for="(item, index) in cartItems" :key="index">
        <image class="item-img" :src="getProductImage(item)" mode="aspectFill"></image>
        <view class="item-info">
          <view class="item-name">{{ item.product_name }}</view>
          <view v-if="item.options" class="item-options">{{ item.options }}</view>
          <view class="item-price">¥{{ item.price }}</view>
          <view class="item-actions">
            <view class="qty-btn" @click="changeQty(item, -1)">-</view>
            <text class="qty-num">{{ item.quantity }}</text>
            <view class="qty-btn" @click="changeQty(item, 1)">+</view>
            <text class="delete-btn" @click="deleteItem(item)">删除</text>
          </view>
        </view>
      </view>
    </view>
    
    <view class="empty-state" v-else>
      <text class="empty-icon">🛒</text>
      <text class="empty-text">购物车是空的</text>
      <view class="shop-btn" @click="goShop">去选购</view>
    </view>
    
    <view class="bottom-bar" v-if="cartItems.length > 0">
      <view class="total-info">
        <text class="total-label">合计</text>
        <text class="total-price">¥{{ totalPrice.toFixed(2) }}</text>
      </view>
      <view class="submit-btn" @click="submitOrder">下单</view>
    </view>
    
    <!-- 美化弹框 -->
    <BeautyModal 
      v-model:visible="showResultModal" 
      :title="resultTitle"
      :content="resultContent"
      confirmText="知道了"
      @confirm="handleModalConfirm"
    />
    
    <!-- 助教水牌台桌号不一致警告 -->
    <BeautyModal
      v-model:visible="showCoachTableWarning"
      title="⚠️ 台桌号不一致"
      :content="`您当前水牌台桌号为 ${coachWaterTableNo}，与当前选择台桌号（${tableName}）不一致，确定要用 ${tableName} 下单吗？`"
      confirmText="确定下单"
      cancelText="取消"
      showCancel
      @confirm="confirmCoachTableMismatch"
      @cancel="cancelCoachTableMismatch"
    />
    
    <!-- #ifdef H5 -->
    <!-- 台桌选择器（员工使用） -->
    <TableSelector :visible="showTableSelector" :defaultTable="defaultTableNo" @confirm="onTableSelected" @cancel="showTableSelector = false" />
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <!-- 悬浮返回按钮 -->
    <view class="float-back-btn" :style="{ left: floatPosition === 'left' ? '20px' : 'auto', right: floatPosition === 'right' ? '20px' : 'auto' }" @click="goBack">
      <text class="float-back-icon">‹</text>
    </view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import BeautyModal from '@/components/BeautyModal.vue'
import TableInfo from '@/components/TableInfo.vue'
import TableSelector from '@/components/TableSelector.vue'

const tableInfoRef = ref(null)
const sessionId = ref('')
const cartItems = ref([])
const totalPrice = ref(0)

// 台桌信息（用 ref 保证响应式，切换后手动更新）
const tableName = ref(uni.getStorageSync('tableName') || '')
const tableStatus = computed(() => {
  const name = tableName.value
  if (!name) return 'empty'

  const authStr = uni.getStorageSync('tableAuth')
  if (!authStr) return 'empty'

  try {
    const auth = JSON.parse(authStr)
    const configStr = uni.getStorageSync('frontConfig')
    let expireMinutes = 5
    if (configStr) {
      try {
        const config = JSON.parse(configStr)
        expireMinutes = config.tableAuthExpireMinutes || 5
      } catch {}
    }
    const isExpired = (Date.now() - auth.time) > expireMinutes * 60 * 1000
    return isExpired ? 'expired' : 'valid'
  } catch {
    return 'empty'
  }
})

// 弹框状态
const showResultModal = ref(false)
const resultTitle = ref('')
const resultContent = ref('')
const orderSuccess = ref(false)
// 助教水牌台桌号不一致警告
const showCoachTableWarning = ref(false)
const coachWaterTableNo = ref('')
const pendingOrderSubmit = ref(false)
const floatPosition = ref('left')

// 员工识别：有 adminToken 或 coachToken 即为员工
const isEmployee = computed(() => {
  return !!(uni.getStorageSync('adminToken') || uni.getStorageSync('coachToken'))
})

// 台桌选择器
const showTableSelector = ref(false)
const defaultTableNo = ref('')

const getProductImage = (item) => {
  const url = item.image_url
  if (!url) return '/static/avatar-default.png'
  if (url.startsWith('http')) return url
  return 'http://47.238.80.12:8081' + url
}

// 检查台桌授权（仅非员工）
const checkTableAuth = () => {
  // #ifdef H5
  const status = tableStatus.value
  if (status === 'empty') {
    resultTitle.value = '提示'
    resultContent.value = '请用手机相机扫码进入'
    showResultModal.value = true
    return false
  }
  if (status === 'expired') {
    resultTitle.value = '授权已过期'
    resultContent.value = '扫码授权已超过30分钟，请用手机相机重新扫码'
    showResultModal.value = true
    return false
  }
  // #endif
  return true
}

const loadCart = async () => {
  if (!sessionId.value) return
  try {
    const data = await api.getCart(sessionId.value)
    cartItems.value = data.items || []
    totalPrice.value = data.totalPrice || 0
  } catch (e) {}
}

const changeQty = async (item, delta) => {
  const newQty = item.quantity + delta
  try {
    if (newQty <= 0) await api.deleteCartItem({ sessionId: sessionId.value, productName: item.product_name, options: item.options || '' })
    else await api.updateCart({ sessionId: sessionId.value, productName: item.product_name, quantity: newQty, options: item.options || '' })
    loadCart()
  } catch (e) { uni.showToast({ title: '操作失败', icon: 'none' }) }
}

const deleteItem = async (item) => {
  try { await api.deleteCartItem({ sessionId: sessionId.value, productName: item.product_name, options: item.options || '' }); loadCart() }
  catch (e) { uni.showToast({ title: '删除失败', icon: 'none' }) }
}

// 打开台桌选择器
const openTableSelector = async () => {
  await loadDefaultTableNo()
  showTableSelector.value = true
}

// 台桌选择回调
const onTableSelected = async (tableNo) => {
  showTableSelector.value = false
  // 保存台桌号到 localStorage
  uni.setStorageSync('tableName', tableNo)
  // 当作扫码成功：同时写入 tableAuth
  uni.setStorageSync('tableAuth', JSON.stringify({ table: tableNo, time: Date.now() }))
  // 同步更新 ref（让页面立即响应）
  tableName.value = tableNo
  
  // 更新购物车中所有商品的 table_no
  try {
    await api.updateCartTable({ sessionId: sessionId.value, tableNo })
  } catch (e) {
    console.log('更新购物车台桌号失败', e)
  }
  
  // 刷新购物车
  loadCart()
  
  uni.showToast({ title: `已切换到 ${tableNo}`, icon: 'success' })
}

// 加载默认台桌号（已上桌助教）
const loadDefaultTableNo = async () => {
  // 如果已经有台桌号，用它作为默认值
  if (tableName.value) {
    defaultTableNo.value = tableName.value
    return
  }
  
  const coachInfo = uni.getStorageSync('coachInfo')
  if (coachInfo?.coachNo) {
    try {
      const res = await api.getCoachWaterStatus(coachInfo.coachNo)
      if (res.data?.table_no) {
        defaultTableNo.value = res.data.table_no
      }
    } catch (e) {
      console.log('获取水牌状态失败', e)
    }
  }
}

// 下单
const submitOrder = async () => {
  if (cartItems.value.length === 0) {
    resultTitle.value = '提示'
    resultContent.value = '购物车是空的'
    showResultModal.value = true
    return
  }
  
  // 员工：检查是否已选台桌号
  if (isEmployee.value) {
    if (!tableName.value) {
      resultTitle.value = '提示'
      resultContent.value = '请先选择台桌号'
      showResultModal.value = true
      return
    }
    // 水牌为上桌状态的助教，检查台桌号一致性
    await checkCoachTableConsistency()
    return
  }
  
  // 非员工：走原有扫码检查逻辑
  if (!checkTableAuth()) return
  if (!tableName.value) {
    resultTitle.value = '提示'
    resultContent.value = '请扫台桌码进入后再下单'
    showResultModal.value = true
    return
  }
  
  await doSubmitOrder()
}

// 检查助教水牌台桌号与购物车台桌号是否一致
const checkCoachTableConsistency = async () => {
  const coachInfo = uni.getStorageSync('coachInfo')
  if (!coachInfo?.coachNo) {
    // 后台用户，直接下单
    await doSubmitOrder()
    return
  }
  
  try {
    const res = await api.getCoachWaterStatus(coachInfo.coachNo)
    const waterStatus = res.data?.status
    const waterTableNo = res.data?.table_no
    
    // 判断是否为上桌状态
    const isOnTable = waterStatus === '早班上桌' || waterStatus === '晚班上桌'
    
    if (isOnTable && waterTableNo && waterTableNo !== tableName.value) {
      // 水牌台桌号与当前选择台桌号不一致，弹出警告
      coachWaterTableNo.value = waterTableNo
      showCoachTableWarning.value = true
      return
    }
    
    // 一致或无冲突，直接下单
    await doSubmitOrder()
  } catch (e) {
    console.log('获取水牌状态失败，直接下单', e)
    await doSubmitOrder()
  }
}

// 确认使用不一致的台桌号下单
const confirmCoachTableMismatch = async () => {
  showCoachTableWarning.value = false
  pendingOrderSubmit.value = true
  await doSubmitOrder()
}

// 取消下单（台桌号不一致时）
const cancelCoachTableMismatch = () => {
  showCoachTableWarning.value = false
}

// 实际下单逻辑
const doSubmitOrder = async () => {
  try {
    uni.showLoading({ title: '提交中...' })
    const deviceFingerprint = api.getDeviceFingerprint()
    const data = await api.createOrder(sessionId.value, deviceFingerprint)
    uni.hideLoading()
    
    resultTitle.value = '下单成功'
    resultContent.value = data.message || '请等待服务员送餐'
    orderSuccess.value = true
    showResultModal.value = true
  } catch (e) { 
    uni.hideLoading()
    resultTitle.value = '提示'
    resultContent.value = e.error || '下单失败，请重试'
    showResultModal.value = true
  }
}

const handleModalConfirm = () => {
  if (orderSuccess.value) {
    cartItems.value = []
    totalPrice.value = 0
    orderSuccess.value = false
  }
}

const goShop = () => uni.switchTab({ url: '/pages/products/products' })
const goBack = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/products/products' })
  }
}

onMounted(() => { 
  sessionId.value = uni.getStorageSync('sessionId') || ''
  loadCart()
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
})

// 每次显示页面时重新读取台桌信息
onShow(() => {
  // 同步 ref（响应式）
  tableName.value = uni.getStorageSync('tableName') || ''
  tableInfoRef.value?.loadTableInfo()
  loadCart()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding: 16px; padding-bottom: 100px; }

/* 员工模式：顶部台桌号 + 切换按钮 */
.employee-table-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 12px;
  margin-bottom: 16px;
}
.employee-table-bar .table-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}
.employee-table-bar .table-value {
  font-size: 16px;
  color: #d4af37;
  font-weight: 600;
  min-width: 50px;
}
.employee-table-bar .switch-btn {
  margin-left: auto;
  padding: 6px 16px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 20px;
  font-size: 12px;
  color: #000;
  font-weight: 600;
}
.employee-table-bar .switch-btn:active {
  opacity: 0.8;
}

.cart-list { display: flex; flex-direction: column; gap: 12px; }
.cart-item { background: rgba(20,20,30,0.6); border-radius: 12px; padding: 16px; display: flex; gap: 12px; border: 1px solid rgba(218,165,32,0.1); }
.item-img { width: 80px; height: 80px; border-radius: 8px; background: rgba(30,30,40,0.5); }
.item-info { flex: 1; }
.item-name { font-size: 15px; font-weight: 500; margin-bottom: 8px; }
.item-options { font-size: 12px; color: #e6553a; margin-bottom: 4px; }
.item-price { font-size: 14px; color: #d4af37; margin-bottom: 12px; }
.item-actions { display: flex; align-items: center; }
.qty-btn { width: 28px; height: 28px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }
.qty-num { font-size: 16px; min-width: 30px; text-align: center; }
.delete-btn { color: #e74c3c; font-size: 12px; margin-left: auto; }
.empty-state { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 48px; display: block; margin-bottom: 16px; }
.empty-text { font-size: 14px; color: rgba(255,255,255,0.3); display: block; margin-bottom: 24px; }
.shop-btn { display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; color: #000; font-weight: 600; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 70px; background: linear-gradient(180deg, rgba(10,10,15,0.98), #0a0a0f); border-top: 1px solid rgba(218,165,32,0.1); display: flex; align-items: center; padding: 0 16px; }
.total-info { flex: 1; }
.total-label { font-size: 12px; color: rgba(255,255,255,0.5); }
.total-price { font-size: 22px; color: #d4af37; font-weight: 600; margin-left: 8px; }
.submit-btn { padding: 14px 40px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; color: #000; font-weight: 600; }

/* #ifdef H5 */
/* 悬浮返回按钮 */
.float-back-btn {
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
.float-back-icon {
  font-size: 20px;
  color: #000;
  font-weight: bold;
}
/* #endif */
</style>

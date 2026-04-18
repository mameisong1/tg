<template>
  <view class="page">
    <!-- 固定顶部 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">奖罚管理{{ pageTitleSuffix }}</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <view class="container">
      <!-- 筛选栏 -->
      <view class="filter-section">
        <!-- 奖罚类型选择 -->
        <view class="filter-row">
          <text class="filter-label">奖罚类型</text>
          <picker v-if="!fixedType" :value="typeIndex" :range="typeLabels" @change="onTypeChange">
            <view class="filter-value">{{ currentTypeName }} ▾</view>
          </picker>
          <view v-else class="filter-value fixed">{{ currentTypeName }}</view>
        </view>
        
        <!-- 确定日期选择（仅类型已加载后显示） -->
        <view class="filter-row" v-if="rewardTypes.length > 0">
          <text class="filter-label">确定日期</text>
          <picker v-if="isDayType" mode="date" :value="confirmDate" :start="minDate" :end="maxDate" @change="onDateChange">
            <view class="filter-value">{{ confirmDate }} ▾</view>
          </picker>
          <picker v-else mode="month" :value="confirmDate" @change="onDateChange">
            <view class="filter-value">{{ confirmDate }} ▾</view>
          </picker>
        </view>
      </view>
      
      <!-- 人员卡片列表 -->
      <view class="cards-title" v-if="targets.length > 0">
        <text>{{ targetTypeLabel }}一览（{{ targets.length }}人）</text>
      </view>
      <view class="empty-state" v-else-if="!loading && rewardTypes.length === 0">
        <text class="empty-icon">📋</text>
        <text class="empty-text">请选择奖罚类型</text>
      </view>
      <view class="empty-state" v-else-if="!loading && targets.length === 0">
        <text class="empty-icon">👥</text>
        <text class="empty-text">暂无{{ targetTypeLabel }}数据</text>
      </view>
      
      <view class="cards-grid">
        <view class="person-card" v-for="(person, idx) in targets" :key="idx">
          <view class="card-name">{{ person.displayName || person.name }}</view>
          
          <!-- 快捷按钮 -->
          <view class="quick-btns">
            <view class="quick-btn" :class="{ active: person.tempAmount === 10 }" @click="setQuickAmount(person, 10)">10元</view>
            <view class="quick-btn" :class="{ active: person.tempAmount === 20 }" @click="setQuickAmount(person, 20)">20元</view>
            <view class="quick-btn" :class="{ active: person.tempAmount === 50 }" @click="setQuickAmount(person, 50)">50元</view>
          </view>
          
          <!-- 金额输入 + 确定按钮（同行） -->
          <view class="amount-save-row">
            <input class="amount-input-inline" type="digit" v-model="person.tempAmount" placeholder="0" />
            <view class="save-btn-inline" @click="savePerson(person)">确定</view>
          </view>
          
          <!-- 保存成功提示 -->
          <view class="save-success" v-if="person.saveMsg">{{ person.saveMsg }}</view>
          
          <!-- 当前已设金额 -->
          <view class="current-amount" v-if="person.currentAmount">
            已设: ¥{{ person.currentAmount.toFixed(2) }}
          </view>
        </view>
      </view>
      
      <view class="loading" v-if="loading">加载中...</view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const rewardTypes = ref([])
const typeIndex = ref(0)
const fixedType = ref('')  // URL参数传入的类型
const confirmDate = ref('')
const targets = ref([])
const loading = ref(false)
const pageTitleSuffix = ref('')  // 页面标题后缀（显示奖罚类型）

// 当前选中的奖罚类型
const currentType = computed(() => {
  if (rewardTypes.value.length === 0) return ''
  if (fixedType.value) return fixedType.value
  return rewardTypes.value[typeIndex.value]?.['奖罚类型'] || ''
})

const currentTypeName = computed(() => currentType.value || '请选择')

// 目标对象（服务员/助教）
const targetType = computed(() => {
  const typeObj = rewardTypes.value.find(t => t['奖罚类型'] === currentType.value)
  return typeObj ? typeObj['对象'] : ''
})

const targetTypeLabel = computed(() => {
  return targetType.value || '奖罚对象'
})

// 是否是按日的类型
const isDayType = computed(() => currentType.value === '服务日奖')

// 日期范围
const minDate = computed(() => {
  if (!isDayType.value) return '2026-01-01'
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return d.toISOString().slice(0, 10)
})

const maxDate = computed(() => {
  if (!isDayType.value) return '2030-12-31'
  return new Date().toISOString().slice(0, 10)
})

const typeLabels = computed(() => rewardTypes.value.map(t => t['奖罚类型']))

function goBack() {
  uni.navigateBack()
}

function onTypeChange(e) {
  typeIndex.value = e.detail.value
  // 切换类型时重新初始化日期
  if (isDayType.value) {
    confirmDate.value = new Date().toISOString().slice(0, 10)
  } else {
    confirmDate.value = new Date().toISOString().slice(0, 7)
  }
  loadTargets()
}

function onDateChange(e) {
  confirmDate.value = e.detail.value
  loadTargets()
}

function setQuickAmount(person, amount) {
  person.tempAmount = (person.tempAmount === amount) ? 0 : amount
}

async function savePerson(person) {
  const amount = parseFloat(person.tempAmount) || 0
  const phone = person.phone
  
  if (!phone) {
    uni.showToast({ title: '该人员无手机号', icon: 'none' })
    return
  }
  
  try {
    const res = await api.upsertRewardPenalty({
      type: currentType.value,
      confirmDate: confirmDate.value,
      phone: phone,
      name: person.name || person.displayName,
      amount: amount,
      remark: person.tempRemark || ''
    })
    
    if (res.success) {
      if (amount === 0) {
        person.currentAmount = null
        person.saveMsg = '已删除'
      } else {
        person.currentAmount = amount
        person.saveMsg = '保存成功 ✓'
      }
      setTimeout(() => { person.saveMsg = '' }, 2000)
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

async function loadTypes() {
  try {
    const res = await api.getRewardPenaltyTypes()
    if (res.success && res.types) {
      rewardTypes.value = res.types
      // 如果传入了固定类型，选中它
      if (fixedType.value) {
        const idx = res.types.findIndex(t => t['奖罚类型'] === fixedType.value)
        if (idx >= 0) typeIndex.value = idx
        pageTitleSuffix.value = `（${fixedType.value}）`
      }
      // 初始化日期
      if (isDayType.value) {
        confirmDate.value = new Date().toISOString().slice(0, 10)
      } else {
        confirmDate.value = new Date().toISOString().slice(0, 7)
      }
    }
  } catch (e) {
    uni.showToast({ title: '加载奖罚类型失败', icon: 'none' })
  }
}

async function loadTargets() {
  if (!targetType.value) return
  loading.value = true
  try {
    const res = await api.getRewardPenaltyTargets(targetType.value)
    if (res.success && res.data) {
      // 初始化每人数据
      targets.value = res.data.map(p => ({
        ...p,
        tempAmount: 0,
        tempRemark: '',
        currentAmount: null,
        saveMsg: ''
      }))
      // 加载当前日期已设的金额
      loadCurrentAmounts()
    }
  } catch (e) {
    uni.showToast({ title: '加载人员列表失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function loadCurrentAmounts() {
  try {
    const res = await api.getRewardPenaltyList({
      type: currentType.value,
      confirmDate: confirmDate.value
    })
    if (res.success && res.data) {
      // 用phone建立映射
      const amountMap = {}
      res.data.forEach(r => {
        amountMap[r.phone] = r.amount
      })
      targets.value.forEach(p => {
        if (amountMap[p.phone] !== undefined) {
          p.currentAmount = amountMap[p.phone]
          p.tempAmount = amountMap[p.phone]
        }
      })
    }
  } catch (e) {
    // 静默失败
  }
}

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync()
  statusBarHeight.value = sysInfo.statusBarHeight || 0
  
  // 获取URL参数
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  if (currentPage.options && currentPage.options.type) {
    fixedType.value = currentPage.options.type
  }
  
  loadTypes().then(() => {
    loadTargets()
  })
})
</script>

<style scoped>
.page {
  background: #0a0a0f;
  min-height: 100vh;
  color: #fff;
}
.fixed-area { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: #0a0a0f; }
.fixed-header {
  display: flex; align-items: center; justify-content: space-between;
  height: 44px; padding: 0 12px;
}
.back-btn { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 24px; color: #d4af37; }
.header-title { font-size: 17px; font-weight: 600; }
.back-placeholder { width: 44px; }
.container { padding: 16px; }

.filter-section {
  background: rgba(20,20,30,0.8); border-radius: 12px; padding: 16px; margin-bottom: 16px;
  border: 1px solid rgba(218,165,32,0.1);
}
.filter-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.filter-row:last-child { margin-bottom: 0; }
.filter-label { font-size: 14px; color: rgba(255,255,255,0.6); }
.filter-value {
  font-size: 14px; color: #d4af37; padding: 6px 12px; background: rgba(212,175,55,0.1);
  border-radius: 6px; min-width: 120px; text-align: center;
}
.filter-value.fixed { background: rgba(212,175,55,0.2); }

.cards-title { font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 12px; }

.cards-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}

.person-card {
  background: rgba(40,40,60,0.6); border-radius: 12px; padding: 14px;
  border: 1px solid rgba(218,165,32,0.1); position: relative;
}
.card-name {
  font-size: 14px; font-weight: 600; margin-bottom: 10px; color: #d4af37;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.quick-btns { display: flex; gap: 8px; margin-bottom: 12px; }
.quick-btn {
  flex: 1; text-align: center; padding: 12px 0; font-size: 15px; font-weight: 600;
  background: rgba(212,175,55,0.1); border-radius: 8px; color: #d4af37;
}
.quick-btn.active { background: rgba(212,175,55,0.3); color: #fff; }

.amount-save-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.amount-input-inline {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; padding: 8px 10px; color: #fff; font-size: 15px; text-align: right;
}
.save-btn-inline {
  padding: 8px 18px; background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 8px; color: #000; font-size: 14px; font-weight: 600; white-space: nowrap;
}

.save-success {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.85); color: #4caf50; padding: 8px 16px; border-radius: 8px;
  font-size: 14px; font-weight: 600; z-index: 10;
}

.current-amount {
  font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; margin-top: 8px;
}

.empty-state {
  text-align: center; padding: 40px 20px;
}
.empty-icon { font-size: 48px; display: block; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: rgba(255,255,255,0.4); }
.loading { text-align: center; padding: 20px; color: rgba(255,255,255,0.4); }
</style>

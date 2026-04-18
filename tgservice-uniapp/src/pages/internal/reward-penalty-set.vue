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
          <!-- 日类型：自定义3天选择器 -->
          <template v-if="isDayType">
            <view class="date-picker-wrapper" @click="showDatePicker = !showDatePicker">
              <view class="filter-value">{{ confirmDate }} ▾</view>
            </view>
            <!-- 日期下拉弹框（与日类型选择器绑定，确保不跟原生picker同时出现） -->
            <view class="date-dropdown" v-if="showDatePicker" @click="showDatePicker = false">
              <view class="date-dropdown-content" @click.stop>
                <view class="date-option" v-for="d in dateOptions" :key="d.value"
                      :class="{ active: confirmDate === d.value }"
                      @click="selectDate(d.value)">
                  {{ d.label }}
                </view>
              </view>
            </view>
          </template>
          <!-- 月类型：原生picker -->
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
          
          <!-- 当前奖罚金额 -->
          <view class="card-amount">
            <text class="amount-value" :class="{ hasAmount: person.currentAmount }">
              {{ person.currentAmount !== null ? '¥' + Math.round(person.currentAmount) : '未设定' }}
            </text>
          </view>
          
          <!-- 备注显示 -->
          <view class="card-remark" v-if="person.currentRemark">
            <text class="card-remark-text">{{ person.currentRemark }}</text>
          </view>
          
          <!-- 设定按钮 -->
          <view class="set-btn" @click="openModal(person)">
            <text class="set-btn-text">设定</text>
          </view>
          
          <!-- 保存成功提示 -->
          <view class="save-success" v-if="person.saveMsg">{{ person.saveMsg }}</view>
        </view>
      </view>
      
      <!-- 弹框 -->
      <view class="modal-mask" v-if="modalVisible" @click="closeModal">
        <view class="modal-content" @click.stop>
          <!-- 关闭按钮 -->
          <view class="modal-close" @click="closeModal">
            <text class="close-icon">✕</text>
          </view>
          
          <!-- 姓名显示 -->
          <view class="modal-name">{{ modalPerson?.displayName || modalPerson?.name }}</view>
          
          <!-- 快捷金额按钮 -->
          <view class="modal-quick-btns">
            <view class="modal-quick-btn" :class="{ active: modalTempAmount === 10 }" @click="modalTempAmount = 10">10元</view>
            <view class="modal-quick-btn" :class="{ active: modalTempAmount === 20 }" @click="modalTempAmount = 20">20元</view>
            <view class="modal-quick-btn" :class="{ active: modalTempAmount === 50 }" @click="modalTempAmount = 50">50元</view>
          </view>
          
          <!-- 快捷负数按钮 -->
          <view class="modal-quick-btns modal-neg-btns">
            <view class="modal-quick-btn modal-neg-btn" @click="modalTempAmount = modalTempAmount - 10">-10元</view>
            <view class="modal-quick-btn modal-neg-btn" @click="modalTempAmount = modalTempAmount - 20">-20元</view>
            <view class="modal-quick-btn modal-neg-btn" @click="modalTempAmount = modalTempAmount - 50">-50元</view>
          </view>
          
          <!-- 金额输入框 + 清零按钮 -->
          <view class="modal-input-row">
            <input class="modal-amount-input" type="text" inputmode="numeric" :value="modalTempAmount" @input="onAmountInput" placeholder="输入自定义金额" />
            <view class="modal-clear-btn" @click="clearInput">
              <text class="clear-btn-text">清零</text>
            </view>
          </view>
          
          <!-- 备注输入 -->
          <view class="modal-remark-row">
            <input class="modal-remark-input" type="text" :value="modalTempRemark" @input="onRemarkInput" placeholder="备注（可选）" />
          </view>
          
          <!-- 取消 + 确定 -->
          <view class="modal-actions">
            <view class="modal-btn modal-btn-cancel" @click="closeModal">取消</view>
            <view class="modal-btn modal-btn-save" @click="saveModalPerson">确定</view>
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
  d.setDate(d.getDate() - 2)
  return d.toISOString().slice(0, 10)
})

const maxDate = computed(() => {
  if (!isDayType.value) return '2030-12-31'
  return new Date().toISOString().slice(0, 10)
})

// 3天日期选项
const dateOptions = computed(() => {
  if (!isDayType.value) return []
  const options = []
  for (let i = 0; i < 3; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const value = d.toISOString().slice(0, 10)
    const labels = ['今天', '昨天', '前天']
    options.push({ value, label: labels[i] + ' (' + value + ')' })
  }
  return options
})

const showDatePicker = ref(false)

function selectDate(value) {
  confirmDate.value = value
  showDatePicker.value = false
  loadTargets()
}

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

// 弹框状态
const modalVisible = ref(false)
const modalPerson = ref(null)
const modalTempAmount = ref(0)
const modalTempRemark = ref('')

function openModal(person) {
  modalPerson.value = person
  modalTempAmount.value = person.currentAmount !== null ? person.currentAmount : 0
  modalTempRemark.value = person.currentRemark || ''
  modalVisible.value = true
}

function closeModal() {
  modalVisible.value = false
  modalPerson.value = null
  modalTempRemark.value = ''
}

function onAmountInput(e) {
  const val = e.detail ? e.detail.value : (e.target ? e.target.value : '')
  modalTempAmount.value = val === '' ? 0 : (parseFloat(val) || 0)
}

function onRemarkInput(e) {
  modalTempRemark.value = e.detail ? e.detail.value : (e.target ? e.target.value : '')
}

function clearInput() {
  modalTempAmount.value = 0
}

async function saveModalPerson() {
  if (!modalPerson.value) return
  const person = modalPerson.value
  person.tempAmount = modalTempAmount.value
  person.tempRemark = modalTempRemark.value
  person.currentRemark = modalTempRemark.value
  await savePerson(person)
  closeModal()
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
        currentRemark: '',
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
      const remarkMap = {}
      res.data.forEach(r => {
        amountMap[r.phone] = r.amount
        remarkMap[r.phone] = r.remark || ''
      })
      targets.value.forEach(p => {
        if (amountMap[p.phone] !== undefined) {
          p.currentAmount = amountMap[p.phone]
          p.tempAmount = amountMap[p.phone]
        }
        if (remarkMap[p.phone]) {
          p.currentRemark = remarkMap[p.phone]
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

/* 自定义日期选择器 */
.date-picker-wrapper { cursor: pointer; }
.date-dropdown {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 150; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 160px;
}
.date-dropdown-content {
  background: #1a1a2e; border-radius: 12px; padding: 8px 0;
  border: 1px solid rgba(218,165,32,0.2); min-width: 220px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.date-option {
  padding: 14px 20px; font-size: 14px; color: #d4af37; text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.date-option:last-child { border-bottom: none; }
.date-option.active { background: rgba(212,175,55,0.2); color: #fff; font-weight: 600; }

.cards-title { font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 12px; }

.cards-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;
}

.person-card {
  background: rgba(40,40,60,0.6); border-radius: 12px; padding: 14px;
  border: 1px solid rgba(218,165,32,0.1); position: relative;
  display: flex; flex-direction: column; align-items: center;
}
.card-name {
  font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #d4af37;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;
}

.card-amount { margin-bottom: 6px; min-height: 24px; }
.card-remark { margin-bottom: 12px; min-height: 18px; }
.card-remark-text { font-size: 12px; color: rgba(255,255,255,0.5); text-align: center; }
.amount-value { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.3); }
.amount-value.hasAmount { color: #d4af37; }

.set-btn {
  padding: 6px 20px; background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 8px; cursor: pointer;
}
.set-btn-text { color: #000; font-size: 13px; font-weight: 600; }

/* 弹框 */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.modal-content {
  background: #1a1a2e; border-radius: 16px; padding: 24px;
  width: 85%; max-width: 340px; position: relative; z-index: 210;
  border: 1px solid rgba(218,165,32,0.2);
  pointer-events: auto;
}
.modal-close {
  position: absolute; top: 12px; right: 12px; width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.close-icon { font-size: 18px; color: rgba(255,255,255,0.5); }
.modal-name {
  font-size: 22px; font-weight: 700; color: #d4af37;
  text-align: center; margin-bottom: 20px;
}
.modal-quick-btns { display: flex; gap: 10px; margin-bottom: 10px; }
.modal-neg-btns { margin-bottom: 12px; }
.modal-neg-btn {
  background: rgba(255,80,80,0.1); color: #ff5050;
  font-size: 14px; padding: 10px 0;
}
.modal-neg-btn:active { background: rgba(255,80,80,0.25); }
.modal-quick-btn {
  flex: 1; text-align: center; padding: 14px 0; font-size: 16px; font-weight: 600;
  background: rgba(212,175,55,0.1); border-radius: 10px; color: #d4af37;
}
.modal-quick-btn.active { background: rgba(212,175,55,0.3); color: #fff; }
.modal-input-row { margin-bottom: 12px; box-sizing: border-box; display: flex; gap: 8px; align-items: center; }
.modal-amount-input {
  flex: 1; min-height: 44px; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 14px; color: #fff; font-size: 18px; text-align: center;
  outline: none; -webkit-appearance: none;
}
.modal-clear-btn {
  padding: 8px 16px; background: rgba(255,80,80,0.15); border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(255,80,80,0.2); white-space: nowrap;
}
.clear-btn-text { font-size: 13px; color: #ff5050; font-weight: 600; }
.modal-remark-row { margin-bottom: 16px; }
.modal-remark-input {
  width: 100%; min-height: 44px; box-sizing: border-box; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 14px; color: #fff; font-size: 16px;
  outline: none; -webkit-appearance: none;
}
.modal-actions { display: flex; gap: 12px; }
.modal-btn {
  flex: 1; text-align: center; padding: 14px 0; font-size: 15px; font-weight: 600;
  border-radius: 10px; cursor: pointer;
}
.modal-btn-cancel {
  background: rgba(128,128,128,0.2); color: #aaa;
}
.modal-btn-save {
  background: linear-gradient(135deg, #d4af37, #ffd700); color: #000;
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

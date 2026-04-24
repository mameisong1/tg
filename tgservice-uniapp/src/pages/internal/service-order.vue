<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">服务下单</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="form-section">
      <!-- 台桌号 -->
      <view class="form-item" @click="handleTableFieldClick">
        <view class="form-value">
          <text :class="{ placeholder: !form.table_no }">{{ form.table_no || '请选择台桌' }}</text>
          <text class="arrow">›</text>
        </view>
      </view>

      <!-- 快捷需求按钮 -->
      <view class="quick-list">
        <view class="quick-row" v-for="group in quickTagGroups" :key="group.label">
          <text class="group-label" :style="{ color: group.color }">{{ group.label }}</text>
          <view class="quick-tags">
            <view
              class="quick-tag"
              :style="getTagStyle(group.color)"
              v-for="tag in group.tags"
              :key="tag"
              @click="selectQuickTag(tag)"
            >
              <text>{{ tag }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 自定义需求（必填） -->
      <view class="form-item">
        <text class="form-label">需求内容 <text class="required">*</text></text>
        <input class="input" v-model="form.requirement" placeholder="请输入需求内容" maxlength="200" />
      </view>

      <!-- 下单人 -->
      <view class="form-item">
        <text class="form-label">下单人</text>
        <text class="requester-name">{{ requesterName }}</text>
      </view>

      <view class="submit-btn" @click="submitOrder"><text>提交服务单</text></view>
    </view>

    <!-- 台桌选择器 -->
    <TableSelector :visible="showTableSelector" @confirm="onTableSelected" @cancel="showTableSelector = false" />
    
    <!-- 成功弹窗 -->
    <SuccessModal :visible="showSuccess" title="提交成功" content="服务单已提交，请等待处理" @confirm="handleSuccessConfirm" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import TableSelector from '@/components/TableSelector.vue'
import SuccessModal from '@/components/SuccessModal.vue'

const statusBarHeight = ref(0)
const showTableSelector = ref(false)
const showSuccess = ref(false)
const adminInfo = ref({})
const coachInfo = ref({})
const tableAuthExpireMinutes = ref(5) // 默认5分钟

// 2026-04-20 fix: 提取为独立函数
const checkAuthExpiration = () => {
  const authStr = uni.getStorageSync('tableAuth')
  if (authStr) {
    try {
      const auth = JSON.parse(authStr)
      const isExpired = (Date.now() - auth.time) > tableAuthExpireMinutes.value * 60 * 1000
      if (isExpired) {
        uni.removeStorageSync('tablePinyin')
        uni.removeStorageSync('tableName')
        uni.removeStorageSync('tableAuth')
      }
    } catch (e) {
      uni.removeStorageSync('tablePinyin')
      uni.removeStorageSync('tableName')
      uni.removeStorageSync('tableAuth')
    }
  }
}

// 加载前端配置（获取授权过期时间）
const loadFrontConfig = async () => {
  try {
    const data = await api.getFrontConfig()
    if (data.tableAuthExpireMinutes) {
      tableAuthExpireMinutes.value = data.tableAuthExpireMinutes
    }
  } catch (e) {
    console.log('获取前端配置失败')
  }
  // 配置加载完成后立即检查过期
  checkAuthExpiration()
}

const quickTagGroups = ref([])

// 配置缓存（1小时有效期）
const STORAGE_KEY = 'serviceCategoriesCache'
const CACHE_DURATION = 60 * 60 * 1000 // 1小时

// 加载服务分类配置
const loadServiceCategories = async () => {
  const now = Date.now()
  
  // 检查本地存储缓存
  const storageStr = uni.getStorageSync(STORAGE_KEY)
  if (storageStr) {
    try {
      const storage = JSON.parse(storageStr)
      if (storage.data && (now - storage.time) < CACHE_DURATION) {
        quickTagGroups.value = storage.data
        return
      }
    } catch (e) {}
  }
  
  // 从 API 读取
  try {
    const data = await api.systemConfig.getServiceCategories()
    quickTagGroups.value = data.data || []
    
    // 更新本地存储缓存
    uni.setStorageSync(STORAGE_KEY, JSON.stringify({
      data: data.data,
      time: now
    }))
  } catch (e) {
    // 读取失败使用默认配置
    quickTagGroups.value = [
      { label: '酒水冰块', color: '#3498db', tags: ['啤酒杯', '加冰块', '食用冰桶', '温水', '冰杯'] },
      { label: '器具用品', color: '#e67e22', tags: ['换垃圾袋', '筷子/碗', '纸巾', '毛毯', '打火机', '吸管', '烟灰缸', '骰子'] },
      { label: '人工服务', color: '#e74c3c', tags: ['音响连接', '看账单', '拿外卖', '搞卫生', '挂烟1包', '挂烟2包'] }
    ]
  }
}

const getTagStyle = (color) => {
  return {
    background: color + '18',
    borderColor: color + '66',
    color: color
  }
}

const form = ref({ table_no: '', requirement: '' })

const requesterName = computed(() => {
  if (coachInfo.value?.stageName) return coachInfo.value.stageName
  return adminInfo.value.name || adminInfo.value.username || '未知'
})

const requesterType = computed(() => {
  return coachInfo.value?.stageName ? '助教' : '后台用户'
})

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  adminInfo.value = uni.getStorageSync('adminInfo') || {}
  coachInfo.value = uni.getStorageSync('coachInfo') || {}
  loadFrontConfig()
  loadServiceCategories()
})

const loadDefaultTable = async () => {
  try {
    const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
    if (res.data?.table_no) {
      form.value.table_no = res.data.table_no
    }
  } catch (e) {}
}

// 台桌选择回调
// 2026-04-20: 与扫码存储保持一致，存入 tablePinyin、tableName、tableAuth 三项
const onTableSelected = (table) => {
  form.value.table_no = table.name
  showTableSelector.value = false
  uni.setStorageSync('tablePinyin', table.name_pinyin)
  uni.setStorageSync('tableName', table.name)
  uni.setStorageSync('tableAuth', JSON.stringify({
    table: table.name_pinyin,
    tableName: table.name,
    time: Date.now()
  }))
}

// 点击快捷需求，直接填入需求内容
const selectQuickTag = (tag) => {
  form.value.requirement = tag
}

const submitOrder = async () => {
  if (!form.value.table_no) return uni.showToast({ title: '请选择台桌', icon: 'none' })
  if (!form.value.requirement) return uni.showToast({ title: '请输入需求内容', icon: 'none' })

  try {
    uni.showLoading({ title: '提交中...' })
    await api.serviceOrders.create({
      table_no: form.value.table_no,
      requirement: form.value.requirement,
      requester_name: requesterName.value,
      requester_type: requesterType.value
    })
    uni.hideLoading()
    form.value.table_no = ''
    form.value.requirement = ''
    showSuccess.value = true
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '提交失败', icon: 'none' })
  }
}

const handleSuccessConfirm = () => {
  showSuccess.value = false
  uni.switchTab({ url: '/pages/member/member' })
}

const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }

// 每次显示页面时检查台桌授权是否过期
// 2026-04-20 fix: 先加载配置再检查过期
onShow(() => {
  loadFrontConfig()
  form.value.table_no = ''
})

// 台桌号字段点击事件
const handleTableFieldClick = async () => {
  console.log('[service-order] handleTableFieldClick 被调用')
  console.log('[service-order] coachInfo:', coachInfo.value)
  console.log('[service-order] coachNo:', coachInfo.value?.coachNo)

  // 仅对助教执行自动填充逻辑
  if (coachInfo.value?.coachNo) {
    try {
      const res = await api.waterBoards.getOne(coachInfo.value.coachNo)
      console.log('[service-order] waterBoards API response:', JSON.stringify(res))

      const waterStatus = res.data?.status
      const waterTableNo = res.data?.table_no

      console.log('[service-order] waterStatus:', waterStatus)
      console.log('[service-order] waterTableNo:', waterTableNo)

      // 判断是否为上桌状态
      const isOnTable = waterStatus === '早班上桌' || waterStatus === '晚班上桌'
      console.log('[service-order] isOnTable:', isOnTable)

      if (isOnTable && waterTableNo) {
        const tableList = waterTableNo.split(',').map(t => t.trim()).filter(t => t)
        console.log('[service-order] tableList:', tableList, 'length:', tableList.length)

        if (tableList.length === 1) {
          // 【单台桌自动选中】
          form.value.table_no = tableList[0]
          uni.setStorageSync('tableName', tableList[0])
          uni.setStorageSync('tableAuth', JSON.stringify({
            table: tableList[0],
            time: Date.now()
          }))
          console.log('[service-order] 自动选中台桌:', tableList[0])
          uni.showToast({ title: `已自动选中台桌 ${tableList[0]}`, icon: 'success' })
          return // 不弹出选择器
        }
        console.log('[service-order] 多台桌，不自动选中')
        // 多台桌：不自动选中，弹出选择器让用户手动选择
      } else {
        console.log('[service-order] 未满足自动选中条件: isOnTable=', isOnTable, 'waterTableNo=', waterTableNo)
      }
    } catch (e) {
      console.log('[service-order] 获取水牌状态失败，弹出选择器', e)
    }
  } else {
    console.log('[service-order] 无 coachNo，直接弹出选择器')
  }

  // 默认：弹出选择器
  showTableSelector.value = true
}
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }

.form-section { margin: 16px; }
.form-item { margin-bottom: 24px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.required { color: #e74c3c; }
.form-value { display: flex; justify-content: space-between; align-items: center; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; }
.form-value .placeholder { color: rgba(255,255,255,0.3); }
.arrow { font-size: 18px; color: rgba(255,255,255,0.3); }

/* 分类按钮列表布局（竖向排列） */
.quick-list {
  margin-bottom: 16px;
}
.quick-row {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.quick-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.group-label {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.quick-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.quick-tag { padding: 8px 12px; border: 1px solid; border-radius: 20px; font-size: 13px; white-space: nowrap; }
.quick-tag:active { filter: brightness(1.3); }

.input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 12px; font-size: 14px; color: #fff; box-sizing: border-box; }

.requester-name { font-size: 15px; color: #d4af37; }

.submit-btn { height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.submit-btn text { font-size: 16px; font-weight: 600; color: #000; }
</style>
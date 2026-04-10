<template>
  <!-- 员工模式：始终显示台桌信息，不显示扫码提示 -->
  <template v-if="isEmployee">
    <view class="table-info employee-mode">
      <text class="table-label">当前台桌：</text>
      <text class="table-value">{{ tableName || '未选择' }}</text>
    </view>
  </template>
  <!-- 非员工模式 -->
  <view v-else-if="!hideWhenValid || tableStatus !== 'valid'" class="table-info" :class="statusClass">
    <!-- 正常状态 -->
    <template v-if="tableStatus === 'valid'">
      <text class="table-label">当前台桌：</text>
      <text class="table-value">{{ tableName }}</text>
    </template>
    
    <!-- 未扫码状态 -->
    <template v-else-if="tableStatus === 'empty'">
      <text class="table-value warning">未扫码</text>
      <text class="table-hint">请用手机相机扫码进入</text>
    </template>
    
    <!-- 已过期状态 -->
    <template v-else-if="tableStatus === 'expired'">
      <text class="table-value warning">台桌授权已过期</text>
      <text class="table-hint">请用手机相机重新扫码</text>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'

// Props
const props = defineProps({
  hideWhenValid: {
    type: Boolean,
    default: false
  },
  isEmployee: {
    type: Boolean,
    default: false
  }
})

const tableName = ref('')
const tableAuthExpired = ref(false)
const tableAuthExpireMinutes = ref(30) // 默认30分钟，可从后端获取

// 计算状态
const tableStatus = computed(() => {
  if (!tableName.value) return 'empty'
  if (tableAuthExpired.value) return 'expired'
  return 'valid'
})

// 计算样式类
const statusClass = computed(() => {
  if (tableStatus.value === 'valid') return ''
  return 'warning-state'
})

// 检查授权是否过期
const checkAuth = () => {
  const authStr = uni.getStorageSync('tableAuth')
  if (authStr) {
    try {
      const auth = JSON.parse(authStr)
      tableAuthExpired.value = (Date.now() - auth.time) > tableAuthExpireMinutes.value * 60 * 1000
    } catch {
      tableAuthExpired.value = true
    }
  } else {
    // 无授权信息，视为未扫码（如果有台桌名则视为过期）
    tableAuthExpired.value = !!tableName.value
  }
}

// 加载台桌信息
const loadTableInfo = () => {
  // #ifdef H5
  // H5：直接从 localStorage 读取台桌信息（不依赖 sessionStorage）
  tableName.value = uni.getStorageSync('tableName') || ''
  
  // 如果为空，可能 App.vue 还没存完，延迟重试
  if (!tableName.value) {
    setTimeout(() => {
      tableName.value = uni.getStorageSync('tableName') || ''
      checkAuth()
    }, 500)  // 等待 500ms 后重试
    return
  }
  
  checkAuth()
  // #endif
  
  // #ifndef H5
  // 小程序：直接从 localStorage 读取
  tableName.value = uni.getStorageSync('tableName') || ''
  tableAuthExpired.value = false // 小程序不过期
  // #endif
}

// 加载前端配置
const loadFrontConfig = async () => {
  // #ifdef H5
  try {
    const data = await api.getFrontConfig()
    if (data.tableAuthExpireMinutes) {
      tableAuthExpireMinutes.value = data.tableAuthExpireMinutes
    }
  } catch (e) {
    console.log('获取前端配置失败，使用默认值')
  }
  // #endif
}

onMounted(() => {
  loadFrontConfig().then(() => {
    loadTableInfo()
  })
})

onShow(() => {
  loadTableInfo()
})

// 暴露方法供父组件调用
defineExpose({
  loadTableInfo,
  tableName,
  tableStatus
})
</script>

<style scoped>
.table-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: rgba(218,165,32,0.1);
  border: 1px solid rgba(218,165,32,0.2);
  border-radius: 12px;
  margin-bottom: 16px;
}

.table-info.warning-state {
  background: rgba(231,76,60,0.1);
  border-color: rgba(231,76,60,0.2);
}

.table-label {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}

.table-value {
  font-size: 16px;
  color: #d4af37;
  font-weight: 600;
}

.table-value.warning {
  color: #e74c3c;
  font-size: 15px;
}

.table-hint {
  width: 100%;
  font-size: 12px;
  color: #e74c3c;
  margin-top: 6px;
}
</style>
<template>
  <view class="table-selector-mask" v-if="visible" @click="handleCancel">
    <view class="table-selector" @click.stop>
      <view class="selector-header">
        <text class="selector-title">选择台桌</text>
        <text class="selector-close" @click="handleCancel">✕</text>
      </view>
      
      <!-- 区域筛选 -->
      <view class="area-tabs">
        <view
          v-for="area in areas"
          :key="area.value"
          class="area-tab"
          :class="{ active: currentArea === area.value }"
          @click="currentArea = area.value"
        >
          <text>{{ area.label }}</text>
        </view>
      </view>
      
      <!-- 台桌网格 -->
      <scroll-view class="table-grid-scroll" scroll-y>
        <view class="table-grid">
          <view
            v-for="table in filteredTables"
            :key="table.name"
            class="table-btn"
            :class="{ selected: selectedTable === table.name, unavailable: table.status === '占用' }"
            @click="table.status !== '占用' && (selectedTable = table.name)"
          >
            <text>{{ table.name }}</text>
          </view>
        </view>
        <!-- 空状态 -->
        <view v-if="filteredTables.length === 0 && !loading" class="empty-state">
          <text>该区域暂无台桌</text>
        </view>
        <!-- 加载中 -->
        <view v-if="loading" class="loading-state">
          <text>加载中...</text>
        </view>
      </scroll-view>
      
      <!-- 底部操作 -->
      <view class="selector-footer">
        <text class="selected-info">当前选中：{{ selectedTable || '未选择' }}</text>
        <view class="footer-btns">
          <view class="footer-btn cancel-btn" @click="handleCancel">取消</view>
          <view class="footer-btn confirm-btn" :class="{ disabled: !selectedTable }" @click="handleConfirm">确认</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  // 默认选中的台桌号（已上桌助教）
  defaultTable: { type: String, default: '' }
})

const emit = defineEmits(['confirm', 'cancel'])

// 从数据库获取的台桌数据
const allTables = ref([])
const loading = ref(false)

const areas = computed(() => {
  const areaSet = new Set(allTables.value.map(t => t.area))
  return Array.from(areaSet).map(area => ({ label: area, value: area }))
})

const currentArea = ref('')
const selectedTable = ref(props.defaultTable || '')

// 获取台桌列表
async function fetchTables() {
  if (allTables.value.length > 0) return // 已加载过则不重复请求
  loading.value = true
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://tg.tiangong.club/api'
    const res = await uni.request({
      url: `${baseUrl}/tables`,
      method: 'GET'
    })
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      allTables.value = res.data
      // 默认选中第一个区域
      if (areas.value.length > 0 && !currentArea.value) {
        currentArea.value = areas.value[0].value
      }
    }
  } catch (e) {
    console.error('获取台桌列表失败:', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    selectedTable.value = props.defaultTable || ''
    fetchTables()
    // 如果有默认台桌，自动选中对应区域
    if (props.defaultTable && allTables.value.length > 0) {
      const found = allTables.value.find(t => t.name === props.defaultTable)
      if (found) {
        currentArea.value = found.area
      }
    }
  }
})

// 监听 areas 变化，自动设置当前区域
watch(areas, (newAreas) => {
  if (newAreas.length > 0 && !currentArea.value) {
    currentArea.value = newAreas[0].value
  }
}, { immediate: true })

const filteredTables = computed(() => {
  return allTables.value.filter(t => t.area === currentArea.value)
})

const handleConfirm = () => {
  if (!selectedTable.value) return
  emit('confirm', selectedTable.value)
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.table-selector-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.table-selector {
  width: 90%;
  max-width: 500px;
  height: 70vh;
  background: #1a1a24;
  border-radius: 16px;
  padding-bottom: env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.selector-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
}

.selector-close {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px 8px;
}

/* 区域筛选 */
.area-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px;
  overflow-x: auto;
}

.area-tab {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.area-tab.active {
  background: rgba(212, 175, 55, 0.2);
  border-color: #d4af37;
  color: #d4af37;
}

/* 台桌网格 */
.table-grid-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 20px;
}

.table-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 0 16px;
}

.table-btn {
  width: calc(25% - 8px);
  min-width: 70px;
  height: 44px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
}

.table-btn.selected {
  background: rgba(212, 175, 55, 0.3);
  border-color: #d4af37;
  color: #d4af37;
  font-weight: 600;
}

.table-btn.unavailable {
  opacity: 0.3;
  background: rgba(255, 0, 0, 0.1);
  border-color: rgba(255, 0, 0, 0.2);
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

/* 底部操作 */
.selector-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.selected-info {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
  display: block;
}

.footer-btns {
  display: flex;
  gap: 12px;
}

.footer-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.confirm-btn {
  background: linear-gradient(135deg, #d4af37, #ffd700);
  color: #000;
  font-weight: 600;
}

.confirm-btn.disabled {
  opacity: 0.5;
}
</style>

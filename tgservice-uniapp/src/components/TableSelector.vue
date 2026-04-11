<template>
  <view class="table-selector-mask" v-if="visible" @click="handleCancel">
    <view class="table-selector" @click.stop>
      <view class="selector-header">
        <text class="selector-title">🎱 选择台桌</text>
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
        <!-- 分段显示（仅大厅区） -->
        <template v-if="currentArea === '大厅' || currentArea === '普台区'">
          <view v-for="(segment, idx) in hallSegments" :key="idx" class="segment-section">
            <text class="segment-title">{{ segment.label }}</text>
            <view class="table-grid">
              <view
                v-for="table in segment.tables"
                :key="table.name"
                class="table-btn"
                :class="{ unavailable: table.status === '占用', 'is-default': props.defaultTable === table.name }"
                @click="selectTable(table)"
              >
                <text>{{ table.name }}</text>
              </view>
            </view>
          </view>
        </template>
        
        <!-- 其他区域正常显示 -->
        <template v-else>
          <view class="table-grid">
            <view
              v-for="table in filteredTables"
              :key="table.name"
              class="table-btn"
              :class="{ unavailable: table.status === '占用', 'is-default': props.defaultTable === table.name }"
              @click="selectTable(table)"
            >
              <text>{{ table.name }}</text>
            </view>
          </view>
        </template>
        
        <!-- 空状态 -->
        <view v-if="filteredTables.length === 0 && !loading" class="empty-state">
          <text>该区域暂无台桌</text>
        </view>
        <!-- 加载中 -->
        <view v-if="loading" class="loading-state">
          <text>加载中...</text>
        </view>
      </scroll-view>
      
      <!-- 底部提示 -->
      <view class="selector-footer">
        <text class="footer-hint">点击台桌号直接选择</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  defaultTable: { type: String, default: '' }
})

const emit = defineEmits(['confirm', 'cancel'])

const allTables = ref([])
const loading = ref(false)

const areas = computed(() => {
  const areaSet = new Set(allTables.value.map(t => t.area))
  const allAreas = Array.from(areaSet)
  // 指定区域排序顺序
  const areaOrder = ['包厢区', '大厅区', '斯诺克区', '棋牌区', 'TV区', 'tv区']
  const sorted = allAreas.sort((a, b) => {
    const idxA = areaOrder.findIndex(o => o === a || o.toLowerCase() === a.toLowerCase())
    const idxB = areaOrder.findIndex(o => o === b || o.toLowerCase() === b.toLowerCase())
    const orderA = idxA === -1 ? areaOrder.length : idxA
    const orderB = idxB === -1 ? areaOrder.length : idxB
    if (orderA !== orderB) return orderA - orderB
    return a.localeCompare(b, 'zh-CN')
  })
  return sorted.map(area => ({ label: area, value: area }))
})

const currentArea = ref('')

// 获取台桌列表
async function fetchTables() {
  if (allTables.value.length > 0) return
  loading.value = true
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'https://tg.tiangong.club/api'
    const res = await uni.request({
      url: `${baseUrl}/tables`,
      method: 'GET'
    })
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      allTables.value = res.data
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
    fetchTables()
    if (props.defaultTable && allTables.value.length > 0) {
      const found = allTables.value.find(t => t.name === props.defaultTable)
      if (found) currentArea.value = found.area
    }
  }
})

watch(areas, (newAreas) => {
  if (newAreas.length > 0 && !currentArea.value) {
    currentArea.value = newAreas[0].value
  }
}, { immediate: true })

const filteredTables = computed(() => {
  let tables = allTables.value.filter(t => t.area === currentArea.value)
  // 大厅区按数字排序，其他区域按字符串排序
  if (currentArea.value === '大厅区' || currentArea.value === '大厅' || currentArea.value === '普台区') {
    return tables.sort((a, b) => {
      // 提取数字部分进行排序
      const numA = parseInt(a.name.replace(/[^0-9]/g, '')) || 0
      const numB = parseInt(b.name.replace(/[^0-9]/g, '')) || 0
      return numA - numB
    })
  } else {
    return tables.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }
})

// 大厅区分段显示
const hallSegments = computed(() => {
  if (currentArea.value !== '大厅区' && currentArea.value !== '大厅' && currentArea.value !== '普台区') return []
  
  const tables = filteredTables.value
  const seg1 = [], seg2 = [], seg3 = []
  
  tables.forEach(t => {
    const num = parseInt(t.name.replace(/\D/g, '')) || 0
    if (num <= 11) seg1.push(t)
    else if (num <= 21) seg2.push(t)
    else seg3.push(t)
  })
  
  const segments = []
  if (seg1.length) segments.push({ label: '普台 1-11', tables: seg1 })
  if (seg2.length) segments.push({ label: '普台 11-21', tables: seg2 })
  if (seg3.length) segments.push({ label: '普台 21+', tables: seg3 })
  return segments
})

// 选中台桌后立即关闭提交
const selectTable = (table) => {
  if (table.status === '占用') return
  emit('confirm', table.name)
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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.table-selector {
  width: 92%;
  max-width: 500px;
  height: 75vh;
  background: linear-gradient(180deg, #1a1a24 0%, #0d0d12 100%);
  border: 2px solid #d4af37;
  border-radius: 20px;
  box-shadow: 0 0 40px rgba(212, 175, 55, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%);
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
}

.selector-title {
  font-size: 18px;
  font-weight: 700;
  color: #d4af37;
  letter-spacing: 2px;
}

.selector-close {
  font-size: 22px;
  color: rgba(255, 255, 255, 0.5);
  padding: 4px 10px;
}

/* 区域筛选 */
.area-tabs {
  display: flex;
  gap: 10px;
  padding: 14px 20px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.area-tab {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 25px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  transition: all 0.3s;
}

.area-tab.active {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(255, 215, 0, 0.2) 100%);
  border-color: #d4af37;
  color: #d4af37;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(212, 175, 55, 0.2);
}

/* 台桌网格 */
.table-grid-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 20px;
}

.segment-section {
  margin-bottom: 16px;
}

.segment-title {
  font-size: 13px;
  color: #d4af37;
  font-weight: 600;
  margin: 16px 0 10px;
  display: block;
  padding-left: 4px;
  border-left: 3px solid #d4af37;
  padding-left: 10px;
}

.table-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 4px 0 12px;
}

.table-btn {
  width: calc(25% - 8px);
  min-width: 65px;
  height: 48px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
  transition: all 0.2s;
}

.table-btn:active {
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.4) 0%, rgba(212, 175, 55, 0.2) 100%);
  border-color: #d4af37;
  color: #d4af37;
  transform: scale(0.95);
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.3);
}

.table-btn.unavailable {
  opacity: 0.35;
  background: rgba(231, 76, 60, 0.1);
  border-color: rgba(231, 76, 60, 0.2);
  color: rgba(255, 255, 255, 0.3);
}

.table-btn.is-default {
  background: linear-gradient(180deg, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.15) 100%);
  border-color: #d4af37;
  color: #d4af37;
  font-weight: 600;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.2);
}

.empty-state,
.loading-state {
  text-align: center;
  padding: 50px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

/* 底部提示 */
.selector-footer {
  padding: 14px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
}

.footer-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
</style>
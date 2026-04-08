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
            :key="table"
            class="table-btn"
            :class="{ selected: selectedTable === table }"
            @click="selectedTable = table"
          >
            <text>{{ table }}</text>
          </view>
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
  defaultTable: { type: String, default: '' },
  // 自定义台桌数据（可选，不提供则使用默认）
  tables: { type: Object, default: null }
})

const emit = defineEmits(['confirm', 'cancel'])

// 默认台桌配置
const defaultTables = {
  '大厅': ['普台 1', '普台 2', '普台 3', '普台 4', '普台 5', '普台 6', '普台 7', '普台 8', '普台 9', '普台 10'],
  '包房': ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
  '斯诺克': ['斯台 1', '斯台 2', '斯台 3', '斯台 4'],
  '其他': ['其他 1', '其他 2']
}

const tableData = computed(() => props.tables || defaultTables)

const areas = computed(() => Object.keys(tableData.value).map(key => ({
  label: key,
  value: key
})))

const currentArea = ref(areas.value[0]?.value || '')
const selectedTable = ref(props.defaultTable || '')

watch(() => props.visible, (val) => {
  if (val) {
    selectedTable.value = props.defaultTable || ''
    // 如果有默认台桌，自动选中对应区域
    if (props.defaultTable) {
      for (const area of areas.value) {
        if (tableData.value[area.value]?.includes(props.defaultTable)) {
          currentArea.value = area.value
          break
        }
      }
    }
  }
})

const filteredTables = computed(() => {
  return tableData.value[currentArea.value] || []
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
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

.table-selector {
  width: 100%;
  max-width: 500px;
  background: #1a1a24;
  border-radius: 20px 20px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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

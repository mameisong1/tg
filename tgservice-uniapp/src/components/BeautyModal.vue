<template>
  <view class="modal-overlay" v-if="visible" @click="handleOverlayClick">
    <view class="modal-container" @click.stop>
      <!-- Logo区域 -->
      <view class="modal-header">
        <image class="modal-logo" src="/static/logo.png" mode="aspectFit"></image>
        <text class="modal-brand">天宫国际</text>
      </view>
      
      <!-- 内容区域 -->
      <view class="modal-body">
        <text class="modal-title" v-if="title">{{ title }}</text>
        <!-- 支持slot插槽，如果使用了slot则不显示默认content -->
        <slot>
          <text class="modal-content">{{ content }}</text>
        </slot>
      </view>
      
      <!-- 按钮区域 -->
      <view class="modal-footer">
        <view class="modal-btn cancel" v-if="showCancel" @click="handleCancel">
          <text>{{ cancelText }}</text>
        </view>
        <view class="modal-btn confirm" @click="handleConfirm">
          <text>{{ confirmText }}</text>
        </view>
      </view>
      
      <!-- 装饰元素 -->
      <view class="modal-decor-top"></view>
      <view class="modal-decor-bottom"></view>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  showCancel: { type: Boolean, default: false },
  cancelText: { type: String, default: '取消' },
  confirmText: { type: String, default: '确定' },
  closeOnOverlay: { type: Boolean, default: true },
  closeOnConfirm: { type: Boolean, default: true }  // 🔴 2026-05-04: 新增，控制确认按钮是否自动关闭
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('update:visible', false)
    emit('cancel')
  }
}

const handleConfirm = () => {
  if (props.closeOnConfirm) {
    emit('update:visible', false)
  }
  emit('confirm')
}

const handleCancel = () => {
  emit('update:visible', false)
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  width: 85%;
  max-width: 340px;
  background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 20px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(218, 165, 32, 0.3);
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(218, 165, 32, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 16px;
  background: linear-gradient(180deg, rgba(218, 165, 32, 0.15) 0%, transparent 100%);
}

.modal-logo {
  width: 48px;
  height: 48px;
  margin-bottom: 8px;
}

.modal-brand {
  font-size: 18px;
  font-weight: 600;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 3px;
}

.modal-body {
  padding: 16px 24px 24px;
  text-align: center;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
  display: block;
}

.modal-content {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
  display: block;
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 0 20px 24px;
}

.modal-btn {
  flex: 1;
  height: 46px;
  border-radius: 23px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;
}

.modal-btn.confirm {
  background: linear-gradient(135deg, #d4af37 0%, #ffd700 100%);
  color: #000;
  box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
}

.modal-btn.confirm:active {
  transform: scale(0.98);
  box-shadow: 0 2px 10px rgba(212, 175, 55, 0.2);
}

.modal-btn.cancel {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-btn.cancel:active {
  background: rgba(255, 255, 255, 0.12);
}

/* 装饰元素 */
.modal-decor-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(218, 165, 32, 0.5), transparent);
}

.modal-decor-bottom {
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 3px;
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
  border-radius: 2px;
}
</style>
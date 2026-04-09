<template>
  <view class="modal-overlay" v-if="visible" @click.stop>
    <view class="modal-container">
      <view class="modal-icon">
        <text>✓</text>
      </view>
      <text class="modal-title">{{ title }}</text>
      <text class="modal-content">{{ content }}</text>
      <view class="modal-btn" @click="handleConfirm">
        <text>确定</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '提交成功' },
  content: { type: String, default: '' }
})

const emit = defineEmits(['confirm'])

const handleConfirm = () => {
  emit('confirm')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-container {
  width: 280px;
  background: #1a1a24;
  border: 2px solid #d4af37;
  border-radius: 16px;
  padding: 30px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8px 32px rgba(212, 175, 55, 0.3);
}

.modal-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.modal-icon text {
  font-size: 28px;
  color: #000;
  font-weight: bold;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #d4af37;
  margin-bottom: 8px;
}

.modal-content {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  margin-bottom: 24px;
  line-height: 1.5;
}

.modal-btn {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-btn text {
  font-size: 16px;
  font-weight: 600;
  color: #000;
}
</style>
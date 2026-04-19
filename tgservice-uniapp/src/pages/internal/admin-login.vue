<template>
  <view class="page">
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack"><text class="back-icon">‹</text></view>
        <text class="header-title">员工登录</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>

    <view class="container">
      <view class="brand-header">
        <text class="page-title">员工登录</text>
        <text class="page-subtitle">后台用户/助教</text>
      </view>

      <view class="form-section">
        <view class="form-item">
          <text class="form-label">手机号</text>
          <input class="form-input" v-model="form.phone" placeholder="请输入手机号" type="number" maxlength="11" />
        </view>
        <view class="form-item">
          <text class="form-label">密码</text>
          <input class="form-input" v-model="form.password" placeholder="请输入密码" password />
        </view>
        <view class="login-btn" @click="handleLogin"><text>登录</text></view>
        <text class="forgot-pwd" @click="showForgotTip">忘记密码？请联系管理员</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const form = reactive({ phone: '', password: '' })

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
})

const handleLogin = async () => {
  if (!form.phone || form.phone.length !== 11) return uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
  if (!form.password) return uni.showToast({ title: '请输入密码', icon: 'none' })

  try {
    uni.showLoading({ title: '登录中...' })
    const res = await api.adminLogin({ username: form.phone, password: form.password })
    uni.hideLoading()

    if (res.success) {
      uni.setStorageSync('adminToken', res.token)
      uni.setStorageSync('adminInfo', res.user)
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/member/member' })
      }, 800)
    }
  } catch (e) {
    uni.hideLoading()
    uni.showToast({ title: e.error || '登录失败', icon: 'none' })
  }
}

const showForgotTip = () => uni.showToast({ title: '请联系管理员重置密码', icon: 'none' })
const goBack = () => { const pages = getCurrentPages(); if (pages.length > 1) { uni.navigateBack() } else { uni.switchTab({ url: '/pages/member/member' }) } }
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 50px; }
.fixed-header { position: fixed; top: 0; left: 0; right: 0; z-index: 999; background: #0a0a0f; }
.status-bar-bg { background: #0a0a0f; }
.header-content { height: 44px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; }
.back-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title { font-size: 17px; font-weight: 600; color: #d4af37; letter-spacing: 2px; }
.header-placeholder { background: #0a0a0f; }

.container { padding: 0 16px; }
.brand-header { padding: 40px 20px 30px; text-align: center; }
.page-title { font-size: 24px; font-weight: 600; color: #d4af37; letter-spacing: 4px; display: block; margin-bottom: 8px; }
.page-subtitle { font-size: 13px; color: rgba(255,255,255,0.4); display: block; }

.form-section { background: rgba(20,20,30,0.6); border-radius: 16px; padding: 24px 20px; border: 1px solid rgba(218,165,32,0.1); }
.form-item { margin-bottom: 20px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.form-input { width: 100%; height: 48px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0 16px; font-size: 15px; color: #fff; box-sizing: border-box; }
.login-btn { width: 100%; height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
.login-btn text { font-size: 16px; font-weight: 600; color: #000; }
.forgot-pwd { font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; display: block; margin-top: 16px; }
</style>

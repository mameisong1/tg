<template>
  <view class="page">
    <!-- 固定置顶标题栏 -->
    <view class="fixed-header" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <image class="header-logo" src="/static/logo.png" mode="aspectFit"></image>
        <text class="header-title">天宫国际</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    
    <!-- 占位区域 -->
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <view class="container">
      <!-- 页头Logo - 和首页完全一致 -->
      <view class="brand-header">
        <text class="page-title">教练登录</text>
      </view>
      
      <view class="form-section">
        <view class="form-item">
          <text class="form-label">工号</text>
          <input class="form-input" v-model="form.employeeId" placeholder="请输入工号" placeholder-class="placeholder" />
        </view>
        <view class="form-item">
          <text class="form-label">艺名</text>
          <input class="form-input" v-model="form.stageName" placeholder="请输入艺名" placeholder-class="placeholder" />
        </view>
        <view class="form-item">
          <text class="form-label">身份证后6位</text>
          <input class="form-input" v-model="form.idCardLast6" placeholder="用于身份验证" placeholder-class="placeholder" password maxlength="6" />
        </view>
        <view class="login-btn" @click="handleLogin"><text>登录</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, onMounted, ref } from 'vue'
import api from '@/utils/api.js'

// 状态栏高度
const statusBarHeight = ref(0)

const form = reactive({ employeeId: '', stageName: '', idCardLast6: '' })

const goBack = () => {
  uni.navigateBack()
}

const handleLogin = async () => {
  const { employeeId, stageName, idCardLast6 } = form
  if (!employeeId) return uni.showToast({ title: '请输入工号', icon: 'none' })
  if (!stageName) return uni.showToast({ title: '请输入艺名', icon: 'none' })
  if (!idCardLast6 || idCardLast6.length !== 6) return uni.showToast({ title: '请输入6位身份证号', icon: 'none' })
  
  try {
    uni.showLoading({ title: '登录中...' })
    const data = await api.coachLogin({ employeeId, stageName, idCardLast6 })
    uni.hideLoading()
    if (data.success) {
      uni.setStorageSync('coachToken', data.token)
      uni.setStorageSync('coachInfo', data.coach)
      // 如果助教同时是后台用户，保存 adminToken 和 adminInfo
      // ⚠️ 使用 h5AdminToken 避免与后台管理系统 adminToken 冲突
      if (data.adminInfo) {
        uni.setStorageSync('h5AdminInfo', data.adminInfo)
      }
      if (data.adminToken) {
        uni.setStorageSync('h5AdminToken', data.adminToken)
      }
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => uni.redirectTo({ url: '/pages/coach-profile/coach-profile' }), 1000)
    }
  } catch (e) { 
    uni.hideLoading()
    // 显示具体错误信息（如"该账号已离职"）
    uni.showToast({ title: e.error || '登录失败', icon: 'none' })
  }
}

onMounted(() => {
  // 获取状态栏高度
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  
  const coachInfo = uni.getStorageSync('coachInfo')
  if (coachInfo) uni.redirectTo({ url: '/pages/coach-profile/coach-profile' })
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 50px; }

/* 固定置顶标题栏 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.header-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px;
}
.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon {
  font-size: 28px;
  color: #d4af37;
}
.back-placeholder {
  width: 32px;
}
.header-logo {
  width: 24px;
  height: 24px;
}
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 2px;
}
.header-placeholder {
  background: #0a0a0f;
}

/* 页头 */
.brand-header {
  padding: 24px 20px;
  text-align: center;
}
.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}
.brand-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 180px;
  background: radial-gradient(ellipse at top, rgba(218,165,32,0.2) 0%, transparent 70%);
}
.brand-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: relative;
}
.brand-logo {
  width: 36px;
  height: 36px;
}
.brand-name {
  font-size: 28px;
  font-weight: 600;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: 4px;
}
.brand-en {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 4px;
  margin-top: 6px;
  position: relative;
}
.page-title { 
  font-size: 16px; 
  color: #d4af37; 
  font-weight: 500; 
  position: relative; 
  margin-top: 12px;
  display: block;
}

/* 表单 */
.form-section { background: rgba(20,20,30,0.6); border-radius: 16px; padding: 24px 20px; border: 1px solid rgba(218,165,32,0.1); margin: 0 16px; }
.form-item { margin-bottom: 20px; }
.form-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; display: block; }
.form-input { 
  width: 100%; 
  height: 48px; 
  background: rgba(255,255,255,0.05); 
  border: 1px solid rgba(255,255,255,0.1); 
  border-radius: 10px; 
  padding: 0 16px; 
  font-size: 15px; 
  color: #fff; 
  box-sizing: border-box;
}
.placeholder { color: rgba(255,255,255,0.3); }
.login-btn { width: 100%; height: 50px; background: linear-gradient(135deg, #d4af37, #ffd700); border-radius: 25px; display: flex; align-items: center; justify-content: center; margin-top: 30px; }
.login-btn text { font-size: 16px; font-weight: 600; color: #000; }
</style>
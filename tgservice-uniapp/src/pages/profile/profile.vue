<template>
  <view class="page">
    <!-- 固定标题栏 -->
    <view class="fixed-header">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text class="back-icon">‹</text>
        </view>
        <text class="header-title">个人信息</text>
        <view class="back-placeholder"></view>
      </view>
    </view>
    
    <!-- 占位区域 -->
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    
    <!-- 头像区域 -->
    <view class="avatar-section">
      <view class="avatar-wrap">
        <text class="avatar-text">{{ memberInfo.name ? memberInfo.name.charAt(0) : '会' }}</text>
      </view>
      <text class="member-no">会员号: {{ memberInfo.memberNo }}</text>
      <text class="member-phone">{{ maskPhone(memberInfo.phone) }}</text>
    </view>
    
    <!-- 信息编辑区 -->
    <view class="info-section">
      <view class="info-item" @click="editName">
        <text class="info-label">姓名</text>
        <view class="info-value-wrap">
          <text class="info-value" :class="{ placeholder: !memberInfo.name }">{{ memberInfo.name || '未设置' }}</text>
          <text class="info-arrow">›</text>
        </view>
      </view>
      
      <view class="info-item" @click="editGender">
        <text class="info-label">性别</text>
        <view class="info-value-wrap">
          <text class="info-value" :class="{ placeholder: !memberInfo.gender }">{{ memberInfo.gender || '未设置' }}</text>
          <text class="info-arrow">›</text>
        </view>
      </view>
    </view>
    
    <!-- 退出登录按钮 -->
    <view class="logout-section">
      <view class="logout-btn" @click="logout">退出登录</view>
    </view>
    
    <!-- 编辑姓名弹窗 -->
    <view class="edit-modal" v-if="showEditName" @click="showEditName = false">
      <view class="edit-content" @click.stop>
        <text class="edit-title">编辑姓名</text>
        <input class="edit-input" v-model="editNameValue" placeholder="请输入姓名" maxlength="10" />
        <view class="edit-actions">
          <view class="edit-btn cancel" @click="showEditName = false">取消</view>
          <view class="edit-btn confirm" @click="saveName">保存</view>
        </view>
      </view>
    </view>
    
    <!-- 编辑性别弹窗 -->
    <view class="edit-modal" v-if="showEditGender" @click="showEditGender = false">
      <view class="edit-content" @click.stop>
        <text class="edit-title">选择性别</text>
        <view class="gender-options">
          <view class="gender-option" :class="{ active: editGenderValue === '男' }" @click="editGenderValue = '男'">
            <text>男</text>
          </view>
          <view class="gender-option" :class="{ active: editGenderValue === '女' }" @click="editGenderValue = '女'">
            <text>女</text>
          </view>
        </view>
        <view class="edit-actions">
          <view class="edit-btn cancel" @click="showEditGender = false">取消</view>
          <view class="edit-btn confirm" @click="saveGender">保存</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api.js'

const statusBarHeight = ref(0)
const memberInfo = ref({})
const showEditName = ref(false)
const editNameValue = ref('')
const showEditGender = ref(false)
const editGenderValue = ref('男')

// 手机号遮罩
const maskPhone = (phone) => {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}

const goBack = () => {
  uni.navigateBack()
}

// 加载会员信息
const loadProfile = async () => {
  try {
    const data = await api.getMemberProfile()
    memberInfo.value = data
  } catch (err) {
    uni.showToast({ title: '获取信息失败', icon: 'none' })
  }
}

// 编辑姓名
const editName = () => {
  editNameValue.value = memberInfo.value.name || ''
  showEditName.value = true
}

const saveName = async () => {
  if (!editNameValue.value.trim()) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  
  try {
    await api.updateMemberProfile({ name: editNameValue.value.trim(), gender: memberInfo.value.gender })
    memberInfo.value.name = editNameValue.value.trim()
    showEditName.value = false
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

// 编辑性别
const editGender = () => {
  editGenderValue.value = memberInfo.value.gender || '男'
  showEditGender.value = true
}

const saveGender = async () => {
  try {
    await api.updateMemberProfile({ name: memberInfo.value.name, gender: editGenderValue.value })
    memberInfo.value.gender = editGenderValue.value
    showEditGender.value = false
    uni.showToast({ title: '保存成功', icon: 'success' })
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  }
}

// 退出登录
const logout = async () => {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          // 先调用后端清除openid
          await api.memberLogout()
        } catch (err) {
          // 即使失败也继续退出
        }
        // 删除所有登录相关数据
        uni.removeStorageSync('memberToken')
        uni.removeStorageSync('coachToken')
        uni.removeStorageSync('coachInfo')
        
        // 使用 reLaunch 强制刷新会员中心页面，让用户立即看到退出状态
        uni.reLaunch({ url: '/pages/member/member' })
      }
    }
  })
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadProfile()
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 40px; }

/* 固定标题栏 */
.fixed-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.header-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #0a0a0f;
}
.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.back-icon { font-size: 28px; color: #d4af37; }
.back-placeholder { width: 32px; }
.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 2px;
}
.header-placeholder { background: #0a0a0f; }

/* 头像区域 */
.avatar-section {
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: linear-gradient(180deg, rgba(212,175,55,0.1) 0%, transparent 100%);
}
.avatar-wrap {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.avatar-text { font-size: 32px; font-weight: 600; color: #000; }
.member-no { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
.member-phone { font-size: 15px; color: #d4af37; }

/* 信息区域 */
.info-section {
  margin: 16px;
  background: rgba(20,20,30,0.6);
  border-radius: 12px;
  border: 1px solid rgba(218,165,32,0.1);
  overflow: hidden;
}
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.info-item:last-child { border-bottom: none; }
.info-label { font-size: 15px; color: rgba(255,255,255,0.7); }
.info-value-wrap { display: flex; align-items: center; gap: 8px; }
.info-value { font-size: 15px; color: #fff; }
.info-value.placeholder { color: rgba(255,255,255,0.3); }
.info-arrow { font-size: 18px; color: rgba(255,255,255,0.3); }

/* 退出登录 */
.logout-section { padding: 40px 16px 20px; }
.logout-btn {
  width: 100%;
  height: 48px;
  background: rgba(231,76,60,0.15);
  border: 1px solid rgba(231,76,60,0.3);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: #e74c3c;
}

/* 编辑弹窗 */
.edit-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.edit-content {
  width: 85%;
  max-width: 320px;
  background: #1a1a24;
  border-radius: 16px;
  padding: 24px;
}
.edit-title { font-size: 16px; font-weight: 600; display: block; text-align: center; margin-bottom: 20px; }
.edit-input {
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
.edit-actions { display: flex; gap: 12px; margin-top: 20px; }
.edit-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}
.edit-btn.cancel { background: rgba(255,255,255,0.1); color: #fff; }
.edit-btn.confirm { background: linear-gradient(135deg, #d4af37, #ffd700); color: #000; font-weight: 600; }
.gender-options { display: flex; gap: 12px; }
.gender-option {
  flex: 1;
  height: 48px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: rgba(255,255,255,0.7);
}
.gender-option.active {
  background: rgba(212,175,55,0.2);
  border-color: #d4af37;
  color: #d4af37;
}
</style>
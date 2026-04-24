<template>
  <view class="page">
    <!-- #ifndef H5 -->
    <!-- 小程序：固定标题 -->
    <view class="fixed-area">
      <view class="status-bar-bg" :style="{ height: statusBarHeight + 'px' }"></view>
      <view class="fixed-header">
        <text class="header-title">会员中心</text>
      </view>
    </view>
    <view class="header-placeholder" :style="{ height: (statusBarHeight + 44) + 'px' }"></view>
    <!-- #endif -->
    
    <!-- #ifdef H5 -->
    <!-- H5：标题不固定 -->
    <view class="h5-header">
      <text class="header-title">会员中心</text>
    </view>
    <!-- #endif -->
    
    <!-- 登录检查状态 -->
    <view class="login-section" v-if="isCheckingLogin">
      <view class="loading-card">
        <text class="loading-text">加载中...</text>
      </view>
    </view>
    
    <!-- 未登录状态 -->
    <view class="login-section" v-else-if="!memberInfo.memberNo">
      <!-- #ifdef MP-WEIXIN -->
      <!-- 小程序：原有样式 -->
      <view class="login-card">
        <image class="login-icon" src="/static/logo.png" mode="aspectFit"></image>
        <text class="login-title">欢迎使用天宫国际</text>
        <text class="login-desc">注册会员享更多优惠</text>
        <button class="login-btn" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
          <text class="login-btn-text">微信手机号快速登录</text>
        </button>
        <view class="agreement-check">
          <view class="checkbox" :class="{ checked: agreed }" @click="agreed = !agreed">
            <text v-if="agreed">✓</text>
          </view>
          <text class="agreement-text" @click="agreed = !agreed">我已阅读并同意</text>
          <text class="agreement-link" @click="goAgreement('user')">《用户协议》</text>
          <text class="agreement-text">和</text>
          <text class="agreement-link" @click="goAgreement('privacy')">《隐私政策》</text>
        </view>
      </view>
      <!-- #endif -->
      
      <!-- #ifdef H5 -->
      <!-- H5：紧凑登录框 -->
      <view class="h5-login-card">
        <view class="h5-login-title-row">
          <image class="h5-title-logo" src="/static/logo.png" mode="aspectFit"></image>
          <text class="h5-login-title">会员登录</text>
        </view>
        <view class="h5-form-item">
          <input class="h5-form-input" type="number" v-model="smsPhone" placeholder="手机号" maxlength="11" />
        </view>
        <view class="h5-form-item">
          <input class="h5-form-input" type="number" v-model="smsCode" placeholder="验证码" maxlength="6" />
          <view class="h5-code-btn" :class="{ disabled: smsCooldown > 0 }" @click="sendSmsCode">
            <text>{{ smsCooldown > 0 ? smsCooldown + 's' : '获取' }}</text>
          </view>
        </view>
        <view class="h5-login-btn" @click="loginBySms">
          <text>登录</text>
        </view>
        <view class="h5-agreement">
          <view class="checkbox" :class="{ checked: agreed }" @click="agreed = !agreed">
            <text v-if="agreed">✓</text>
          </view>
          <text class="agreement-text" @click="agreed = !agreed">同意</text>
          <text class="agreement-link" @click="goAgreement('user')">《用户协议》</text>
          <text class="agreement-link" @click="goAgreement('privacy')">《隐私政策》</text>
        </view>
      </view>
      <!-- #endif -->
    </view>
    
    <!-- 已登录状态 -->
    <view class="member-section" v-if="!isCheckingLogin && memberInfo.memberNo">
      <view class="member-card" @click="goProfile">
        <view class="member-avatar">
          <text class="avatar-text">{{ memberInfo.name ? memberInfo.name.charAt(0) : '会' }}</text>
        </view>
        <view class="member-info">
          <text class="member-name">{{ memberInfo.name || '会员' + memberInfo.memberNo }}</text>
          <text class="member-phone">{{ maskPhone(memberInfo.phone) }}</text>
        </view>
        <text class="member-arrow">›</text>
      </view>
      
      <!-- 如果姓名或性别未填写，显示引导编辑 -->
      <view class="info-card" v-if="!memberInfo.name || !memberInfo.gender">
        <view class="info-item" v-if="!memberInfo.name" @click="editName">
          <text class="info-label">姓名</text>
          <view class="info-value-wrap">
            <text class="info-value placeholder">未设置</text>
            <text class="info-arrow">›</text>
          </view>
        </view>
        <view class="info-item" v-if="!memberInfo.gender" @click="editGender">
          <text class="info-label">性别</text>
          <view class="info-value-wrap">
            <text class="info-value placeholder">未设置</text>
            <text class="info-arrow">›</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 人气值板块 - 移到管理功能下面 -->
    
    <!-- V2.0 内部专用（直接显示在「我的」页面，不再跳转内部首页） -->
    
    <!-- 常用功能板块（大分组） - 所有后台用户可见 -->
    <view class="internal-group" v-if="!isCheckingLogin && memberInfo.memberNo && showCommonFeatures">
      <view class="group-header">
        <text class="group-title">🔧 常用功能</text>
      </view>
      <view class="group-section">
        <view class="internal-btns">
          <!-- 水牌查看：收银和服务员不能看 -->
          <view class="internal-btn" v-if="canViewWaterBoard" @click="navigateTo('/pages/internal/water-board-view')">
            <text class="internal-btn-icon">📋</text>
            <text class="internal-btn-text">水牌查看</text>
          </view>
          <!-- 服务下单：所有后台用户可用 -->
          <view class="internal-btn" @click="navigateTo('/pages/internal/service-order')">
            <text class="internal-btn-icon">🔔</text>
            <text class="internal-btn-text">服务下单</text>
          </view>
          <!-- 我的奖罚：所有后台用户可用 -->
          <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-view')">
            <text class="internal-btn-icon">🏆</text>
            <text class="internal-btn-text">我的奖罚</text>
            <view class="badge" v-if="rewardPenaltyCount > 0">{{ rewardPenaltyCount }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 助教专用板块（大分组） -->
    <view class="internal-group" v-if="!isCheckingLogin && memberInfo.memberNo && isCoach">
      <view class="group-header">
        <text class="group-title">🎱 助教专用</text>
      </view>
      
      <!-- 组1: 日常（上移） -->
      <view class="group-section">
        <view class="section-header">
          <text class="section-title">⏰ 日常</text>
        </view>
        <view class="internal-btns">
          <view class="internal-btn" @click="goCoachProfile">
            <text class="internal-btn-icon">👤</text>
            <text class="internal-btn-text">个人中心</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/clock')">
            <text class="internal-btn-icon">⏰</text>
            <text class="internal-btn-text">上下班</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/table-action')">
            <text class="internal-btn-icon">🎱</text>
            <text class="internal-btn-text">上下桌</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/invitation-upload')">
            <text class="internal-btn-icon">📸</text>
            <text class="internal-btn-text">约客上传</text>
          </view>
        </view>
      </view>

      <!-- 组2: 申请（下移） -->
      <view class="group-section">
        <view class="section-header">
          <text class="section-title">📋 申请</text>
        </view>
        <view class="internal-btns">
          <view class="internal-btn" @click="navigateTo('/pages/internal/overtime-apply')">
            <text class="internal-btn-icon">📋</text>
            <text class="internal-btn-text">加班申请</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/leave-apply')">
            <text class="internal-btn-icon">🏖️</text>
            <text class="internal-btn-text">公休申请</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/lejuan')">
            <text class="internal-btn-icon">💰</text>
            <text class="internal-btn-text">乐捐报备</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/rest-apply')">
            <text class="internal-btn-icon">🏖️</text>
            <text class="internal-btn-text">休息申请</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/leave-request-apply')">
            <text class="internal-btn-icon">📝</text>
            <text class="internal-btn-text">请假申请</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/shift-change-apply')">
            <text class="internal-btn-icon">🔄</text>
            <text class="internal-btn-text">班次切换</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 管理功能板块（大分组） -->
    <view class="internal-group" v-if="!isCheckingLogin && memberInfo.memberNo && isManager">
      <view class="group-header">
        <text class="group-title">⚙️ 管理功能</text>
      </view>
      
      <!-- 组1: 管理（含智能开关） -->
      <view class="group-section">
        <view class="section-header">
          <text class="section-title">📋 管理</text>
        </view>
        <view class="internal-btns">
          <view class="internal-btn" @click="navigateTo('/pages/internal/water-board')">
            <text class="internal-btn-icon">📋</text>
            <text class="internal-btn-text">水牌管理</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/leave-calendar')">
            <text class="internal-btn-icon">📅</text>
            <text class="internal-btn-text">助教日历</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-set?type=服务奖罚')">
            <text class="internal-btn-icon">🏆</text>
            <text class="internal-btn-text">服务奖罚</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/reward-penalty-set?type=助教奖罚')">
            <text class="internal-btn-icon">⚠️</text>
            <text class="internal-btn-text">助教奖罚</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/switch-control')">
            <text class="internal-btn-icon">💡</text>
            <text class="internal-btn-text">智能开关</text>
          </view>
        </view>
      </view>

      <!-- 组2: 审查 -->
      <view class="group-section">
        <view class="section-header">
          <text class="section-title">🔍 审查</text>
        </view>
        <view class="internal-btns">
          <view class="internal-btn" @click="navigateTo('/pages/internal/attendance-review')">
            <text class="internal-btn-icon">📋</text>
            <text class="internal-btn-text">打卡审查</text>
            <view class="badge" v-if="attendanceReviewCount > 0">{{ attendanceReviewCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/lejuan-list')">
            <text class="internal-btn-icon">💰</text>
            <text class="internal-btn-text">乐捐一览</text>
            <view class="badge" v-if="lejuanCount > 0">{{ lejuanCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/invitation-review?shift=早班')">
            <text class="internal-btn-icon">🌅</text>
            <text class="internal-btn-text">早班约客</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/invitation-review?shift=晚班')">
            <text class="internal-btn-icon">🌙</text>
            <text class="internal-btn-text">晚班约客</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/guest-invitation-stats')">
            <text class="internal-btn-icon">📊</text>
            <text class="internal-btn-text">约客统计</text>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/missing-table-out-stats')">
            <text class="internal-btn-icon">📊</text>
            <text class="internal-btn-text">漏单统计</text>
          </view>
        </view>
      </view>

      <!-- 组3: 审批 -->
      <view class="group-section">
        <view class="section-header">
          <text class="section-title">✅ 审批</text>
        </view>
        <view class="internal-btns">
          <view class="internal-btn" @click="navigateTo('/pages/internal/overtime-approval')">
            <text class="internal-btn-icon">✅</text>
            <text class="internal-btn-text">加班审批</text>
            <view class="badge" v-if="overtimeCount > 0">{{ overtimeCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/leave-approval')">
            <text class="internal-btn-icon">🏖️</text>
            <text class="internal-btn-text">公休审批</text>
            <view class="badge" v-if="publicLeaveCount > 0">{{ publicLeaveCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/shift-change-approval')">
            <text class="internal-btn-icon">🔄</text>
            <text class="internal-btn-text">班次审批</text>
            <view class="badge" v-if="shiftChangeCount > 0">{{ shiftChangeCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/leave-request-approval')">
            <text class="internal-btn-icon">📝</text>
            <text class="internal-btn-text">请假审批</text>
            <view class="badge" v-if="leaveRequestCount > 0">{{ leaveRequestCount }}</view>
          </view>
          <view class="internal-btn" @click="navigateTo('/pages/internal/rest-approval')">
            <text class="internal-btn-icon">🏖️</text>
            <text class="internal-btn-text">休息审批</text>
            <view class="badge" v-if="restCount > 0">{{ restCount }}</view>
          </view>
        </view>
      </view>
    </view>

    <!-- 人气值板块 - 原教练专用板块 -->
    <view class="coach-section" v-if="!isCheckingLogin && memberInfo.memberNo && coachInfo.coachNo && coachInfo.status !== '离职'">
      <view class="section-header">
        <text class="section-title">🔥 人气值</text>
      </view>
      
      <view class="popularity-card">
        <text class="popularity-label">我的人气值</text>
        <text class="popularity-value">{{ myPopularity }}</text>
        <view class="coach-profile-btn" @click="goCoachProfile">
          <text class="coach-profile-text">教练个人中心 ›</text>
        </view>
      </view>
      
      <view class="ranking-section" v-if="topCoaches.length > 0">
        <text class="ranking-title">🔥 人气榜 TOP6</text>
        <!-- 第一行：第1名，最大卡片 -->
        <view class="ranking-row first-row" v-if="topCoaches.length > 0">
          <view class="ranking-card large card-gold" v-for="(coach, index) in topCoaches.slice(0, 1)" :key="coach.coach_no">
            <view class="medal medal-gold">🥇</view>
            <image class="ranking-avatar large" :src="getCoachPhoto(coach)" mode="aspectFill"></image>
            <text class="ranking-name">{{ coach.employee_id }}号 {{ coach.stage_name }}</text>
            <text class="ranking-pop">{{ coach.popularity || 0 }}</text>
          </view>
        </view>
        <!-- 第二行：第2-3名 -->
        <view class="ranking-row" v-if="topCoaches.length > 1">
          <view class="ranking-card medium" :class="index === 0 ? 'card-silver' : 'card-bronze'" v-for="(coach, index) in topCoaches.slice(1, 3)" :key="coach.coach_no">
            <view class="medal" :class="['medal-' + ['silver','bronze'][index]]">
              {{ ['🥈','🥉'][index] }}
            </view>
            <image class="ranking-avatar medium" :src="getCoachPhoto(coach)" mode="aspectFill"></image>
            <text class="ranking-name">{{ coach.employee_id }}号 {{ coach.stage_name }}</text>
            <text class="ranking-pop">{{ coach.popularity || 0 }}</text>
          </view>
        </view>
        <!-- 第三行：第4-6名 -->
        <view class="ranking-row" v-if="topCoaches.length > 3">
          <view class="ranking-card small" v-for="(coach, index) in topCoaches.slice(3, 6)" :key="coach.coach_no">
            <view class="medal medal-normal">{{ index + 4 }}</view>
            <image class="ranking-avatar small" :src="getCoachPhoto(coach)" mode="aspectFill"></image>
            <text class="ranking-name">{{ coach.employee_id }}号 {{ coach.stage_name }}</text>
            <text class="ranking-pop">{{ coach.popularity || 0 }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 历史订单 -->
    <view class="order-section">
      <view class="section-header">
        <text class="section-title">📋 待处理订单</text>
        <text class="section-hint" v-if="pendingOrders.length > 0">{{ pendingOrders.length }} 条</text>
      </view>
      <view class="order-list" v-if="pendingOrders.length > 0">
        <view class="order-card" v-for="order in pendingOrders" :key="order.id">
          <view class="order-header">
            <text class="order-no">{{ order.order_no }}</text>
            <text class="order-time">{{ formatOrderTime(order.created_at) }}</text>
          </view>
          <view class="order-items">
            <view class="order-item" v-for="(item, idx) in order.items" :key="idx">
              <text class="item-name">{{ item.name }}</text>
              <text class="item-qty">x{{ item.quantity }}</text>
              <text class="item-price">¥{{ item.price * item.quantity }}</text>
            </view>
          </view>
          <view class="order-footer">
            <text class="order-total">合计: ¥{{ order.total_price }}</text>
            <text class="order-status">待处理</text>
          </view>
        </view>
      </view>
      <view class="empty-orders" v-else>
        <text class="empty-text">暂无待处理订单</text>
      </view>
    </view>
    
    <!-- 设置区域 -->
    <!-- 悬浮按钮位置设置 - 始终显示，无需登录 -->
    <view class="settings-section">
      <view class="section-header">
        <text class="section-title">⚙️ 设置</text>
      </view>
      <view class="setting-item" @click="toggleFloatPosition">
        <text class="setting-label">悬浮按钮位置</text>
        <text class="setting-value">{{ floatPosition === 'left' ? '左边' : '右边' }}</text>
        <text class="setting-arrow">›</text>
      </view>
    </view>
    
    <!-- 会员设置 - 登录后显示 -->
    <view class="settings-section" v-if="!isCheckingLogin && memberInfo.memberNo">
    </view>
    
    <!-- 底部协议信息 -->
    <view class="footer-section">
      <!-- #ifdef H5 -->
      <!-- PWA添加到桌面 - 始终显示 -->
      <view class="pwa-install-section" @click="handleInstallClick">
        <text class="pwa-icon">📱</text>
        <text class="pwa-text">添加到桌面</text>
      </view>

      <!-- H5全屏模式 -->
      <view class="fullscreen-section" @click="toggleFullscreen">
        <text class="fullscreen-icon">{{ isFullscreen ? '🔳' : '⛶' }}</text>
        <text class="fullscreen-text">{{ isFullscreen ? '退出全屏' : '全屏模式' }}</text>
      </view>
      <!-- #endif -->
      <view class="footer-links">
        <text class="footer-link" @click="goAgreement('user')">用户协议</text>
        <text class="footer-divider">|</text>
        <text class="footer-link" @click="goAgreement('privacy')">隐私政策</text>
      </view>
      <text class="footer-company">中山市开火体育文化有限公司</text>
      <!-- #ifdef H5 -->
      <a href="https://beian.miit.gov.cn" target="_blank" class="footer-icp" style="text-decoration: none; color: rgba(255,255,255,0.5);">粤ICP备2026027219号</a>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <text class="footer-icp">粤ICP备2026027219号</text>
      <!-- #endif -->
      <!-- 新增：公安备案号 -->
      <text class="footer-psb-icp">京公网安备11010102000001号</text>
    </view>
    
    <!-- #ifdef H5 -->
    <!-- 华为手机添加到桌面操作指引弹窗 -->
    <view class="edit-modal" v-if="showHuaweiGuide" @click="showHuaweiGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 添加到桌面</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击浏览器右下角</text>
            <text class="ios-step-icon">⋮</text>
            <text class="ios-step-text">菜单按钮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">找到并点击</text>
            <text class="ios-step-highlight">"添加到桌面"</text>
            <text class="ios-step-text">或</text>
            <text class="ios-step-highlight">"发送到桌面"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">确认后即可在桌面找到应用</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showHuaweiGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- 微信/QQ内置浏览器引导弹窗 -->
    <view class="edit-modal" v-if="showWechatGuide" @click="showWechatGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 在浏览器中打开</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击右上角</text>
            <text class="ios-step-icon">⋯</text>
            <text class="ios-step-text">菜单按钮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">选择</text>
            <text class="ios-step-highlight">"在浏览器中打开"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">打开后再点击"添加到桌面"</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showWechatGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- Android通用引导弹窗 -->
    <view class="edit-modal" v-if="showAndroidGuide" @click="showAndroidGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 添加到桌面</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击浏览器菜单按钮</text>
            <text class="ios-step-icon">⋮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">找到</text>
            <text class="ios-step-highlight">"添加到主屏幕"</text>
            <text class="ios-step-text">或</text>
            <text class="ios-step-highlight">"添加到桌面"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">确认后即可在桌面找到应用</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showAndroidGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- #endif -->

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

    <!-- #ifdef H5 -->
    <!-- iPhone 添加到桌面操作指引弹窗 -->
    <view class="edit-modal" v-if="showIOSGuide" @click="showIOSGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 添加到主屏幕</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击底部</text>
            <text class="ios-step-icon">↗</text>
            <text class="ios-step-text">分享按钮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">向下滚动，找到</text>
            <text class="ios-step-highlight">"添加到主屏幕"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">点击后即可在桌面找到应用</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showIOSGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- 华为手机添加到桌面操作指引弹窗 -->
    <view class="edit-modal" v-if="showHuaweiGuide" @click="showHuaweiGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 添加到桌面</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击浏览器右下角</text>
            <text class="ios-step-icon">⋮</text>
            <text class="ios-step-text">菜单按钮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">找到并点击</text>
            <text class="ios-step-highlight">"添加到桌面"</text>
            <text class="ios-step-text">或</text>
            <text class="ios-step-highlight">"发送到桌面"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">确认后即可在桌面找到应用</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showHuaweiGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- 微信/QQ内置浏览器引导弹窗 -->
    <view class="edit-modal" v-if="showWechatGuide" @click="showWechatGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 在浏览器中打开</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击右上角</text>
            <text class="ios-step-icon">⋯</text>
            <text class="ios-step-text">菜单按钮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">选择</text>
            <text class="ios-step-highlight">"在浏览器中打开"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">打开后再点击"添加到桌面"</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showWechatGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- Android通用引导弹窗 -->
    <view class="edit-modal" v-if="showAndroidGuide" @click="showAndroidGuide = false">
      <view class="ios-guide-content" @click.stop>
        <text class="ios-guide-title">📱 添加到桌面</text>
        <view class="ios-guide-steps">
          <view class="ios-step">
            <text class="ios-step-num">1</text>
            <text class="ios-step-text">点击浏览器菜单按钮</text>
            <text class="ios-step-icon">⋮</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">2</text>
            <text class="ios-step-text">找到</text>
            <text class="ios-step-highlight">"添加到主屏幕"</text>
            <text class="ios-step-text">或</text>
            <text class="ios-step-highlight">"添加到桌面"</text>
          </view>
          <view class="ios-step">
            <text class="ios-step-num">3</text>
            <text class="ios-step-text">确认后即可在桌面找到应用</text>
          </view>
        </view>
        <view class="ios-guide-close" @click="showAndroidGuide = false">
          <text>我知道了</text>
        </view>
      </view>
    </view>
    <!-- #endif -->
    
    
    <!-- 🔴 新增：身份选择弹框 -->
    <view class="edit-modal" v-if="showRoleSelectModal" @click="showRoleSelectModal = false">
      <view class="role-select-content" @click.stop>
        <text class="role-select-title">请选择您的身份</text>
        <view class="role-select-options">
          <view class="role-option" v-if="pendingRoles.includes('coach')" @click="selectRole('coach')">
            <text class="role-icon">🎱</text>
            <text class="role-name">助教身份</text>
            <text class="role-desc">用于提交上桌单、服务下单</text>
          </view>
          <view class="role-option" v-if="pendingRoles.includes('admin')" @click="selectRole('admin')">
            <text class="role-icon">🔧</text>
            <text class="role-name">后台身份</text>
            <text class="role-desc">用于审批管理、后台操作</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import api from '@/utils/api.js'
import { attendanceReview } from '@/utils/api.js'
import { format, toDate } from '@/utils/time-util.js'

// 格式化订单时间：M/D HH:mm
const formatOrderTime = (timeStr) => {
  const d = toDate(timeStr);
  if (!d) return '';
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}


// 员工识别
const isEmployee = computed(() => {
  return !!(uni.getStorageSync('adminToken') || uni.getStorageSync('coachToken'))
})

const statusBarHeight = ref(0)
const pendingOrders = ref([])
const coachInfo = ref({})
const myPopularity = ref(0)
const topCoaches = ref([])

// 从组件获取台桌名
// 会员相关
const isCheckingLogin = ref(true)  // 登录检查状态
const memberInfo = ref({})
const agreed = ref(false)

// H5短信登录相关
const smsPhone = ref('')
const smsCode = ref('')
const smsCooldown = ref(0)
let cooldownTimer = null

// 编辑弹窗
const showEditName = ref(false)
const editNameValue = ref('')
const showEditGender = ref(false)
const editGenderValue = ref('')

// 🔴 新增：身份选择弹框
const showRoleSelectModal = ref(false)
const pendingRoles = ref([])
const tempLoginData = ref(null)

// H5全屏状态
// #ifdef H5
const isFullscreen = ref(false)
const canInstallPwa = ref(false) // 是否可以安装PWA（Android才会触发）
const isIOS = ref(false) // 是否是iOS设备
const showIOSGuide = ref(false) // iPhone操作指引弹窗
const showHuaweiGuide = ref(false) // 华为手机操作指引弹窗
const showAndroidGuide = ref(false) // 普通Android操作指引弹窗
const showWechatGuide = ref(false) // 微信/QQ内置浏览器引导弹窗
// #endif

// 悬浮按钮位置设置
const floatPosition = ref('left')

// 设备检测函数
const detectDevice = () => {
  const ua = navigator.userAgent
  return {
    isHuawei: /Huawei|HUAWEI|HONOR/i.test(ua),
    isHarmonyOS: /HarmonyOS/i.test(ua),
    isWeChat: /MicroMessenger/i.test(ua),
    isQQ: /\sQQ\//i.test(ua),
    isAndroid: /Android/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    isPwaMode: window.matchMedia('(display-mode: standalone)').matches ||
               navigator.standalone === true
  }
}

// H5全屏切换
const toggleFullscreen = () => {
  // #ifdef H5
  // 检测 iOS Safari 限制
  if (isIOS.value) {
    uni.showToast({ 
      title: 'iOS Safari 不支持全屏功能', 
      icon: 'none',
      duration: 2000
    })
    return
  }
  
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(err => {
      console.log('全屏失败:', err)
      uni.showToast({ title: '全屏功能不可用', icon: 'none' })
    })
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    })
  }
  // #endif
}

// PWA安装相关
let deferredPrompt = null

// 统一处理安装点击
const handleInstallClick = async () => {
  const device = detectDevice()
  
  // 已是PWA模式
  if (device.isPwaMode) {
    uni.showToast({ title: '已是桌面应用', icon: 'none' })
    return
  }
  
  // 微信/QQ内置浏览器 - 不支持PWA，直接显示引导
  if (device.isWeChat || device.isQQ) {
    showWechatGuide.value = true
    return
  }
  
  // iOS设备 - 不支持beforeinstallprompt，显示iOS引导
  if (device.isIOS) {
    showIOSGuide.value = true
    return
  }
  
  // 其他设备（包括华为/鸿蒙/普通Android）- 先尝试原生安装提示
  if (deferredPrompt) {
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        canInstallPwa.value = false
      }
      deferredPrompt = null
    } catch (err) {
      console.log('原生安装失败，显示引导:', err)
      // 根据设备类型显示对应引导
      if (device.isHuawei || device.isHarmonyOS) {
        showHuaweiGuide.value = true
      } else {
        showAndroidGuide.value = true
      }
    }
  } else {
    // beforeinstallprompt 未触发，显示对应引导
    if (device.isHuawei || device.isHarmonyOS) {
      showHuaweiGuide.value = true
    } else {
      showAndroidGuide.value = true
    }
  }
}

const installPwa = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      canInstallPwa.value = false
    }
    deferredPrompt = null
  }
}

// 手机号遮罩
const maskPhone = (phone) => {
  if (!phone || phone.length < 7) return phone
  return phone.substring(0, 3) + '****' + phone.substring(7)
}

// H5发送短信验证码
const sendSmsCode = async () => {
  if (smsCooldown.value > 0) return
  
  if (!smsPhone.value || !/^1[3-9]\d{9}$/.test(smsPhone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  
  if (!agreed.value) {
    uni.showToast({ title: '请先同意协议', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '发送中...' })
    const data = await api.sendSmsCode(smsPhone.value)
    uni.hideLoading()
    
    if (data.success) {
      uni.showToast({ title: '验证码已发送', icon: 'success' })
      // 保存手机号用于下次自动填充
      uni.setStorageSync('lastPhone', smsPhone.value)
      // 开始60秒倒计时
      smsCooldown.value = 60
      cooldownTimer = setInterval(() => {
        smsCooldown.value--
        if (smsCooldown.value <= 0) {
          clearInterval(cooldownTimer)
        }
      }, 1000)
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: err.error || '发送失败', icon: 'none' })
  }
}

// H5短信验证码登录
const loginBySms = async () => {
  if (!smsPhone.value || !/^1[3-9]\d{9}$/.test(smsPhone.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  
  if (!smsCode.value || smsCode.value.length !== 6) {
    uni.showToast({ title: '请输入6位验证码', icon: 'none' })
    return
  }
  
  if (!agreed.value) {
    uni.showToast({ title: '请先同意协议', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '登录中...' })
    const data = await api.loginBySms(smsPhone.value, smsCode.value)
    uni.hideLoading()
    
    if (data.success) {
      // 保存token和会员信息到localStorage（H5持久化）
      uni.setStorageSync('memberToken', data.token)
      uni.setStorageSync('lastPhone', smsPhone.value)
      // 保存同意协议状态
      uni.setStorageSync('agreed', true)
      memberInfo.value = data.member
      
      // 🔴 新增：处理多重身份
      if (data.roles && data.roles.length > 0) {
        handleRoleSelection(data.roles, data)
      } else {
        // 单身份或无 roles 返回，直接保存
        saveLoginData(data)
      }
      
      // 清空验证码
      smsCode.value = ''
      
      uni.showToast({ title: '登录成功', icon: 'success' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: err.error || '登录失败', icon: 'none' })
  }
}

// 微信手机号登录
const onGetPhoneNumber = async (e) => {
  if (!agreed.value) {
    uni.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' })
    return
  }
  
  if (e.detail.errMsg !== 'getPhoneNumber:ok') {
    uni.showToast({ title: '获取手机号失败', icon: 'none' })
    return
  }
  
  try {
    uni.showLoading({ title: '登录中...' })
    
    // 获取code
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        success: resolve,
        fail: reject
      })
    })
    
    // 调用后端登录接口
    const data = await api.memberLogin({
      code: loginRes.code,
      encryptedData: e.detail.encryptedData,
      iv: e.detail.iv
    })
    
    uni.hideLoading()
    
    if (data.success) {
      // 保存token和会员信息
      uni.setStorageSync('memberToken', data.token)
      memberInfo.value = data.member
      
      // 🔴 新增：处理多重身份
      if (data.roles && data.roles.length > 0) {
        handleRoleSelection(data.roles, data)
      } else {
        saveLoginData(data)
      }
      
      uni.showToast({ title: '登录成功', icon: 'success' })
    }
  } catch (err) {
    uni.hideLoading()
    uni.showToast({ title: err.error || '登录失败', icon: 'none' })
  }
}

// 自动登录检查（10分钟冷却）
let lastCheckTime = 0
const CHECK_COOLDOWN = 10 * 60 * 1000 // 10分钟

const checkAutoLogin = async () => {
  const now = Date.now()
  if (now - lastCheckTime < CHECK_COOLDOWN) {
    // 冷却期内跳过，直接结束 loading
    isCheckingLogin.value = false
    return
  }

  const token = uni.getStorageSync('memberToken')
  if (token) {
    // 已有token，获取会员信息
    try {
      const profile = await api.getMemberProfile()
      memberInfo.value = profile
      
      // ✅ 自动登录成功才设置冷却时间
      lastCheckTime = Date.now()
      
      // 如果匹配后台用户，自动实现内部员工登录
      if (profile.adminInfo) {
        uni.setStorageSync('adminInfo', profile.adminInfo)
      }
      // ⚠️ 保存 adminToken（内部页面 api.js 认证必需）
      if (profile.adminToken) {
        uni.setStorageSync('adminToken', profile.adminToken)
      }
      
      // 如果同时是教练，设置教练信息
      if (profile.coachInfo) {
        uni.setStorageSync('coachInfo', profile.coachInfo)
        coachInfo.value = profile.coachInfo
      } else {
        // 不是教练，清空教练信息
        coachInfo.value = {}
        uni.removeStorageSync('coachInfo')
      }
    } catch (err) {
      // ⚠️ 只有 401（token 过期/无效）才清除 token
      // 网络错误（502、超时等）保留 token，不踢用户下线
      if (err?.statusCode === 401) {
        memberInfo.value = {}
        coachInfo.value = {}
        uni.removeStorageSync('memberToken')
        // 自动填充上次手机号
        autoFillPhone()
      }
      // 其他错误：静默忽略，不设置冷却时间，下次立即重试
    } finally {
      // ✅ 无论成功失败，都结束 loading 状态
      isCheckingLogin.value = false
    }
  } else {
    // 无token，先清空会员和教练信息
    memberInfo.value = {}
    coachInfo.value = {}
    // 自动填充上次手机号
    autoFillPhone()
    // ✅ 结束 loading 状态
    isCheckingLogin.value = false
  }
}

// H5自动填充上次手机号
const autoFillPhone = () => {
  // #ifdef H5
  const lastPhone = uni.getStorageSync('lastPhone')
  if (lastPhone) {
    smsPhone.value = lastPhone
  }
  // 恢复同意协议状态
  const agreedSaved = uni.getStorageSync('agreed')
  if (agreedSaved) {
    agreed.value = true
  }
  // #endif
}

// 尝试通过openid自动登录
const tryAutoLogin = async () => {
  try {
    const loginRes = await new Promise((resolve, reject) => {
      uni.login({
        success: resolve,
        fail: reject
      })
    })
    
    const data = await api.memberAutoLogin(loginRes.code)
    if (data.success && data.registered) {
      uni.setStorageSync('memberToken', data.token)
      memberInfo.value = data.member
      
      // 🔴 新增：处理多重身份
      if (data.roles && data.roles.length > 0) {
        handleRoleSelection(data.roles, data)
      } else {
        saveLoginData(data)
      }
    } else {
      // 未注册，确保信息为空
      memberInfo.value = {}
      coachInfo.value = {}
    }
    // 未注册则什么都不做，等用户自己点击登录
  } catch (err) {
    // 自动登录失败，确保清空信息
    memberInfo.value = {}
    coachInfo.value = {}
  }
}

// 🔴 新增：保存登录数据（单身份）
const saveLoginData = (data) => {
  if (data.adminInfo) {
    uni.setStorageSync('adminInfo', data.adminInfo)
    console.log('自动内部登录:', data.adminInfo.role, data.adminInfo.name)
  }
  if (data.adminToken) {
    uni.setStorageSync('adminToken', data.adminToken)
    console.log('已保存 adminToken')
  }
  
  if (data.coachInfo) {
    const coachToken = btoa(`${data.coachInfo.coachNo}:${Date.now()}`)
    uni.setStorageSync('coachToken', coachToken)
    uni.setStorageSync('coachInfo', data.coachInfo)
    coachInfo.value = data.coachInfo
  }
}

// 🔴 新增：处理多重身份选择
const handleRoleSelection = (roles, loginData) => {
  // 🟡 审计修复：使用 extraRoles.length <= 1 判断
  const extraRoles = roles.filter(r => r !== 'member')
  
  if (extraRoles.length <= 1) {
    // 单身份或无额外身份 → 直接保存
    saveLoginData(loginData)
    return
  }
  
  // 多重身份 → 弹框选择
  pendingRoles.value = extraRoles
  tempLoginData.value = loginData
  showRoleSelectModal.value = true
}

// 🔴 新增：用户选择身份
const selectRole = async (role) => {
  showRoleSelectModal.value = false
  
  // 保存偏好身份
  api.setPreferredRole(role)
  
  // 根据选择保存对应 token
  if (role === 'admin' && tempLoginData.value) {
    if (tempLoginData.value.adminToken) {
      uni.setStorageSync('adminToken', tempLoginData.value.adminToken)
    }
    if (tempLoginData.value.adminInfo) {
      uni.setStorageSync('adminInfo', tempLoginData.value.adminInfo)
    }
  } else if (role === 'coach' && tempLoginData.value) {
    if (tempLoginData.value.coachInfo) {
      const coachToken = btoa(`${tempLoginData.value.coachInfo.coachNo}:${Date.now()}`)
      uni.setStorageSync('coachToken', coachToken)
      uni.setStorageSync('coachInfo', tempLoginData.value.coachInfo)
      coachInfo.value = tempLoginData.value.coachInfo
    }
  }
  
  uni.showToast({ title: `已选择${role === 'coach' ? '助教' : '后台'}身份`, icon: 'success' })
  tempLoginData.value = null
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

// 跳转协议页面
const goAgreement = (type) => {
  uni.navigateTo({ url: `/pages/agreement/agreement?type=${type}` })
}

// 跳转个人信息页面
const goProfile = () => {
  uni.navigateTo({ url: '/pages/profile/profile' })
}

// 加载待处理订单（严格模式：只显示当前设备的订单）
const loadPendingOrders = async () => {
  const deviceFingerprint = uni.getStorageSync('device_fp')
  if (!deviceFingerprint) {
    pendingOrders.value = []
    return
  }
  try {
    const orders = await api.getMyPendingOrders(deviceFingerprint)
    pendingOrders.value = orders || []
  } catch (err) {
    console.error('获取订单失败', err)
  }
}

// 格式化时间（使用 TimeUtil）
// 格式化时间：formatOrderTime 已定义（使用 TimeUtil.toDate）

// 检查教练登录
const checkCoachLogin = () => {
  const info = uni.getStorageSync('coachInfo')
  coachInfo.value = info || {}
}

// 加载人气值数据
const loadPopularity = async () => {
  if (!coachInfo.value.coachNo) return
  
  try {
    const coach = await api.getCoach(coachInfo.value.coachNo)
    myPopularity.value = coach.popularity || 0
    
    const top = await api.getPopularityTop6()
    topCoaches.value = top || []
  } catch (err) {
    console.error('获取人气值失败', err)
  }
}

const goCoachProfile = () => {
  uni.navigateTo({ url: '/pages/coach-profile/coach-profile' })
}

// V2.0 内部专用功能（直接显示在「我的」页面）
const hasInternalAccess = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  const coachInfo = uni.getStorageSync('coachInfo')
  return !!(adminInfo || coachInfo)
})

const isManager = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  return adminInfo && ['店长', '助教管理', '管理员'].includes(adminInfo.role)
})

// 助教在职且未离职
const isCoach = computed(() => {
  const coachInfo = uni.getStorageSync('coachInfo')
  if (!coachInfo) return false
  // 离职助教不能看到内部专用版块
  if (coachInfo.status === '离职') return false
  return true
})

const isCoachViewer = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  return adminInfo && adminInfo.role === '教练'
})

// 其他后台用户（收银、前厅管理等）
const isOtherAdmin = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  const coachInfo = uni.getStorageSync('coachInfo')
  if (!adminInfo && !coachInfo) return false
  if (adminInfo && ['店长', '助教管理'].includes(adminInfo.role)) return false
  if (adminInfo && adminInfo.role === '教练') return false
  if (coachInfo && !adminInfo) return false
  return true
})

// 是否显示常用功能板块（所有后台用户）
const showCommonFeatures = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  const coachInfo = uni.getStorageSync('coachInfo')
  // 有后台用户信息或助教信息（非离职）
  if (adminInfo) return true
  if (coachInfo && coachInfo.status !== '离职') return true
  return false
})

// 是否能看水牌（收银和服务员不能看）
const canViewWaterBoard = computed(() => {
  const adminInfo = uni.getStorageSync('adminInfo')
  // 收银和服务员不能看水牌
  if (adminInfo && ['收银', '服务员'].includes(adminInfo.role)) return false
  return true
})

// 安全的返回方法：如果没有上一页，返回「我的」tab
const goBackOrTab = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/member/member' })
  }
}

const navigateTo = (url) => uni.navigateTo({ url })
const showUnderConstruction = () => uni.showToast({ title: '工事中。。。', icon: 'none' })

// 待审批数字指示器
const overtimeCount = ref(0)
const publicLeaveCount = ref(0)
const shiftChangeCount = ref(0)
const leaveRequestCount = ref(0)
const restCount = ref(0)
const lejuanCount = ref(0)
const rewardPenaltyCount = ref(0)
const attendanceReviewCount = ref(0)

// === 业务追踪（使用统一的 errorReporter）===
import errorReporter from '@/utils/error-reporter.js'

// 注意：全局错误监听已移至 error-reporter.js + main.js + App.vue
// 这里只保留页面特定的业务追踪调用

const loadPendingCounts = async () => {
  try {
    const res = await api.applications.getPendingCount()
    const d = res.data || {}
    overtimeCount.value = d.overtime || 0
    publicLeaveCount.value = d.public_leave || 0
    shiftChangeCount.value = d.shift_change || 0
    leaveRequestCount.value = d.leave || 0
    restCount.value = d.rest || 0
    lejuanCount.value = d.lejuan || 0

    // 加载打卡审查待审数量
    try {
      const arRes = await attendanceReview.getPendingCount()
      attendanceReviewCount.value = arRes.data?.count || 0
    } catch (e) {
      // 忽略
    }
    
    // 加载奖罚计数（传入用户phone）
    const adminInfo = uni.getStorageSync('adminInfo') || {}
    const coachInfo = uni.getStorageSync('coachInfo') || {}
    const userPhone = adminInfo.username || coachInfo.phone || ''
    
    if (userPhone) {
      try {
        const rpRes = await api.rewardPenalty.getRecentCount({ phone: userPhone })
        rewardPenaltyCount.value = rpRes.count || 0
      } catch (e) {
        console.error('加载奖罚计数失败:', e)
      }
    }
  } catch (e) {
    errorReporter.track('loadPendingCounts_failed', {
      message: e.message,
      error: e.error
    })
  }
}

const getCoachPhoto = (coach) => {
  const photo = coach.photos && coach.photos[0]
  if (!photo) return '/static/avatar-default.png'
  if (photo.startsWith('http')) return photo
  return 'http://47.238.80.12:8081' + photo
}

// 切换悬浮按钮位置
const toggleFloatPosition = () => {
  floatPosition.value = floatPosition.value === 'left' ? 'right' : 'left'
  uni.setStorageSync('floatButtonPosition', floatPosition.value)
  uni.showToast({ 
    title: `悬浮按钮已移至${floatPosition.value === 'left' ? '左边' : '右边'}`, 
    icon: 'none',
    duration: 1000
  })
  // 1秒后自动刷新页面
  setTimeout(() => {
    location.reload()
  }, 1000)
}

onMounted(() => {
  const systemInfo = uni.getSystemInfoSync()
  statusBarHeight.value = systemInfo.statusBarHeight || 20
  loadPendingOrders()
  loadPendingCounts()
  checkCoachLogin()
  checkAutoLogin()
  
  // 读取悬浮按钮位置设置
  floatPosition.value = uni.getStorageSync('floatButtonPosition') || 'left'
  
  // #ifdef H5
  // 检测 iOS 设备
  isIOS.value = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  
  // 监听全屏状态变化
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  
  // PWA 调试日志 - 页面加载时
  const device = detectDevice()
  console.log('=== PWA 调试信息 ===')
  console.log('UserAgent:', navigator.userAgent)
  console.log('设备检测:', JSON.stringify(device))
  console.log('deferredPrompt:', deferredPrompt)
  console.log('beforeinstallprompt 支持:', 'onbeforeinstallprompt' in window)
  
  // 监听PWA安装事件（仅Android/鸿蒙会触发）
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('=== beforeinstallprompt 事件触发 ===')
    console.log('事件对象:', e)
    e.preventDefault()
    deferredPrompt = e
    canInstallPwa.value = true
    console.log('deferredPrompt 已设置:', !!deferredPrompt)
  })
  // #endif
})

onShow(() => {
  loadPendingOrders()
  loadPendingCounts()
  checkCoachLogin()
  loadPopularity()
  checkAutoLogin()  // 每次显示时检查自动登录
})
</script>

<style scoped>
.page { min-height: 100vh; background: #0a0a0f; padding-bottom: 80px; }

/* 固定头部 */
/* #ifndef H5 */
.fixed-area {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  background: #0a0a0f;
}
.status-bar-bg { background: #0a0a0f; }
.fixed-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
.header-placeholder { background: #0a0a0f; }
/* #endif */

/* #ifdef H5 */
.h5-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
}
/* #endif */

.header-title {
  font-size: 17px;
  font-weight: 600;
  color: #d4af37;
  letter-spacing: 4px;
}

/* 登录卡片 */
.login-section { padding: 40px 20px; }
.login-card {
  background: rgba(20,20,30,0.6);
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  border: 1px solid rgba(218,165,32,0.15);
}
.login-icon { width: 60px; height: 60px; margin-bottom: 16px; }
.login-title { font-size: 20px; font-weight: 600; display: block; margin-bottom: 8px; }
.login-desc { font-size: 13px; color: rgba(255,255,255,0.5); display: block; margin-bottom: 24px; }
.login-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
}
.login-btn-text { font-size: 15px; font-weight: 600; color: #000; }
.agreement-check {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  flex-wrap: wrap;
  gap: 4px;
}
.checkbox {
  width: 16px;
  height: 16px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  font-size: 12px;
  color: transparent;
}
.checkbox.checked {
  background: #d4af37;
  border-color: #d4af37;
  color: #000;
}
.agreement-text { font-size: 12px; color: rgba(255,255,255,0.5); }
.agreement-link { font-size: 12px; color: #d4af37; }

/* 会员卡片 */
.member-section { padding: 0 16px; }
.member-card {
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(255,215,0,0.1));
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid rgba(218,165,32,0.3);
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.member-card:active {
  transform: scale(0.98);
  background: linear-gradient(135deg, rgba(212,175,55,0.3), rgba(255,215,0,0.15));
}
.member-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-text { font-size: 22px; font-weight: 600; color: #000; }
.member-info { flex: 1; }
.member-name { font-size: 18px; font-weight: 600; display: block; margin-bottom: 4px; }
.member-phone { font-size: 13px; color: rgba(255,255,255,0.6); }
.member-arrow { font-size: 20px; color: rgba(255,255,255,0.3); margin-left: auto; }

.info-card {
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
.info-label { font-size: 14px; color: rgba(255,255,255,0.7); }
.info-value-wrap { display: flex; align-items: center; gap: 8px; }
.info-value { font-size: 14px; color: #fff; }
.info-value.placeholder { color: rgba(255,255,255,0.4); }
.info-arrow { font-size: 18px; color: rgba(255,255,255,0.3); }

/* Section */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px 12px;
}
.section-title { font-size: 15px; font-weight: 500; }
.section-hint { font-size: 12px; color: rgba(255,255,255,0.5); }

/* 订单区 */
.order-section { margin-top: 24px; }
.order-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.order-card {
  background: rgba(20,20,30,0.6);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(218,165,32,0.1);
}
.order-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.order-no { font-size: 12px; color: rgba(255,255,255,0.5); }
.order-time { font-size: 12px; color: rgba(255,255,255,0.4); }
.order-items { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; }
.order-item { display: flex; justify-content: space-between; padding: 4px 0; }
.item-name { flex: 1; font-size: 14px; }
.item-qty { width: 40px; text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); }
.item-price { width: 60px; text-align: right; font-size: 13px; }
.order-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.order-total { font-size: 15px; color: #d4af37; font-weight: 500; }
.order-status {
  font-size: 12px;
  color: #f1c40f;
  background: rgba(241,196,15,0.2);
  padding: 4px 12px;
  border-radius: 12px;
}
.empty-orders {
  margin: 0 16px;
  padding: 40px;
  text-align: center;
  background: rgba(255,255,255,0.02);
  border-radius: 12px;
}
.empty-text { font-size: 14px; color: rgba(255,255,255,0.3); }

/* V2.0 内部专用入口 */
/* 大分组容器 */
.internal-group {
  margin: 0 16px 16px;
  background: rgba(20,20,30,0.6);
  border: 1px solid rgba(218,165,32,0.2);
  border-radius: 16px;
  overflow: hidden;
}
.group-header {
  padding: 14px 16px 10px;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(255,215,0,0.08));
  border-bottom: 1px solid rgba(218,165,32,0.15);
}
.group-title { font-size: 16px; font-weight: 600; color: #d4af37; }
/* 小分组（紧凑版） */
.group-section { padding: 0 12px 12px; }
.group-section .section-header { padding: 10px 4px 6px; }
.group-section .section-title { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.8); }
.group-section .internal-btns { gap: 8px; margin-top: 6px; }
.internal-section { margin: 0 16px 16px; }
.internal-btns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
.internal-btn {
  position: relative;
  padding: 14px 6px;
  background: rgba(30,35,50,0.2);
  border: 1px solid rgba(218,165,32,0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.internal-btn-icon { font-size: 24px; }
.internal-btn-text { font-size: 12px; color: rgba(255,255,255,0.7); }
.internal-btn-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 角标样式 */
.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  padding: 0 4px;
  background: #e74c3c;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  border-radius: 9px;
  z-index: 10;
}

/* 助教专用板块 */
.coach-section { margin-top: 24px; }
.popularity-card {
  margin: 0 16px 16px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(255,215,0,0.1));
  border-radius: 12px;
  border: 1px solid rgba(218,165,32,0.2);
  display: flex;
  align-items: center;
  gap: 12px;
}
.popularity-label { font-size: 15px; color: rgba(255,255,255,0.8); }
.popularity-value { font-size: 28px; color: #d4af37; font-weight: 600; flex: 1; }
.coach-profile-btn { padding: 8px 16px; background: rgba(212,175,55,0.2); border-radius: 20px; }
.coach-profile-text { font-size: 13px; color: #d4af37; }
.ranking-section {
  margin: 0 16px 16px;
  padding: 16px;
  background: rgba(20,20,30,0.6);
  border-radius: 12px;
  border: 1px solid rgba(218,165,32,0.1);
}
.ranking-title { font-size: 14px; color: #d4af37; margin-bottom: 16px; display: block; text-align: center; }
.ranking-row { display: flex; justify-content: center; gap: 10px; margin-bottom: 12px; }
.ranking-row:last-child { margin-bottom: 0; }
.ranking-row.first-row { justify-content: center; }

/* 大卡片 - 第1名 */
.ranking-card.large {
  width: 140px;
  padding: 16px 12px;
}
.ranking-avatar.large { width: 72px; height: 72px; }
.ranking-card.large .ranking-name { font-size: 14px; }
.ranking-card.large .ranking-pop { font-size: 20px; }

/* 中等卡片 - 第2-3名 */
.ranking-card.medium {
  width: 110px;
  padding: 14px 10px;
}
.ranking-avatar.medium { width: 60px; height: 60px; }

/* 小卡片 - 第4-6名 */
.ranking-card.small {
  width: 85px;
  padding: 10px 6px;
}
.ranking-avatar.small { width: 48px; height: 48px; }
.ranking-card.small .ranking-name { font-size: 11px; }
.ranking-card.small .ranking-pop { font-size: 14px; }

/* 金色卡片 - 第1名 */
.ranking-card.card-gold {
  background: linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,170,0,0.15));
  border: 1px solid rgba(255,215,0,0.4);
}
.ranking-card.card-gold .ranking-name { color: #fff; }
.ranking-card.card-gold .ranking-pop { color: #ffd700; }

/* 银色卡片 - 第2名 */
.ranking-card.card-silver {
  background: linear-gradient(135deg, rgba(192,192,192,0.2), rgba(160,160,160,0.1));
  border: 1px solid rgba(192,192,192,0.4);
}
.ranking-card.card-silver .ranking-name { color: #fff; }
.ranking-card.card-silver .ranking-pop { color: #e0e0e0; }

/* 铜色卡片 - 第3名 */
.ranking-card.card-bronze {
  background: linear-gradient(135deg, rgba(205,127,50,0.2), rgba(184,115,51,0.1));
  border: 1px solid rgba(205,127,50,0.4);
}
.ranking-card.card-bronze .ranking-name { color: #fff; }
.ranking-card.card-bronze .ranking-pop { color: #daa06d; }

/* 基础卡片样式 */
.ranking-card {
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  background: rgba(30,30,40,0.6);
  border-radius: 12px;
  border: 1px solid rgba(218,165,32,0.2);
}
.ranking-card .medal {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 1;
  font-weight: 600;
}
.ranking-card .medal-gold { background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; }
.ranking-card .medal-silver { background: linear-gradient(135deg, #c0c0c0, #a0a0a0); color: #000; }
.ranking-card .medal-bronze { background: linear-gradient(135deg, #cd7f32, #b87333); color: #fff; }
.ranking-card .medal-normal { background: rgba(255,255,255,0.15); font-size: 14px; color: rgba(255,255,255,0.6); }
.ranking-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(30,30,40,0.5);
  margin-bottom: 8px;
  margin-top: 4px;
  border: 2px solid rgba(218,165,32,0.3);
}
.ranking-card .ranking-name { font-size: 12px; color: #fff; text-align: center; margin-bottom: 4px; word-break: break-all; line-height: 1.3; }
.ranking-card .ranking-pop { font-size: 16px; color: #d4af37; font-weight: 600; }

/* 底部协议 */
.footer-section {
  text-align: center;
  padding: 24px 16px;
  margin-top: 24px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

/* 设置区域 */
.settings-section { margin-top: 24px; }
.setting-item {
  margin: 0 16px;
  padding: 16px;
  background: rgba(20,20,30,0.6);
  border-radius: 12px;
  border: 1px solid rgba(218,165,32,0.1);
  display: flex;
  align-items: center;
}
.setting-label { font-size: 14px; color: rgba(255,255,255,0.8); flex: 1; }
.setting-value { font-size: 14px; color: #d4af37; margin-right: 8px; }
.setting-arrow { font-size: 18px; color: rgba(255,255,255,0.3); }
.footer-links { display: flex; justify-content: center; align-items: center; gap: 8px; margin-bottom: 8px; }
.footer-link { font-size: 14px; color: rgba(255,255,255,0.5); }
.footer-divider { font-size: 14px; color: rgba(255,255,255,0.3); }
.footer-company { font-size: 13px; color: rgba(255,255,255,0.3); display: block; margin-bottom: 4px; }
.footer-icp { font-size: 12px; color: rgba(255,255,255,0.5); }
.footer-icp a { color: rgba(255,255,255,0.5) !important; }
.footer-psb-icp {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  display: block;
  margin-top: 2px;
}

/* H5 PWA安装按钮 */
.pwa-install-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgba(212,175,55,0.2), rgba(255,215,0,0.1));
  border-radius: 12px;
  border: 2px solid #d4af37;
}
.pwa-icon { font-size: 20px; }
.pwa-text { font-size: 16px; color: #d4af37; font-weight: 600; }

/* H5全屏模式按钮 */
.fullscreen-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  margin-bottom: 16px;
  background: rgba(212,175,55,0.1);
  border-radius: 12px;
  border: 1px solid rgba(212,175,55,0.2);
}
.fullscreen-icon { font-size: 18px; }
.fullscreen-text { font-size: 14px; color: #d4af37; }

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

/* H5短信登录表单样式 */
.sms-login-form {
  width: 100%;
  padding: 0 30rpx;
}
.form-item {
  margin-bottom: 24rpx;
}
.form-input {
  width: 100%;
  height: 90rpx;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(212,175,55,0.3);
  border-radius: 8rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #fff;
  box-sizing: border-box;
}
.form-input::placeholder {
  color: rgba(255,255,255,0.5);
}
.code-item {
  display: flex;
  gap: 20rpx;
}
.code-input {
  flex: 1;
}
.send-code-btn {
  width: 200rpx;
  height: 90rpx;
  background: linear-gradient(135deg, #d4af37 0%, #c9a227 100%);
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #1a1a2e;
  font-weight: 500;
}
.send-code-btn.disabled {
  background: rgba(212,175,55,0.3);
  color: rgba(255,255,255,0.5);
}

/* ===== H5紧凑登录卡片 ===== */
/* #ifdef H5 */
.h5-login-card {
  background: rgba(20,20,30,0.6);
  border-radius: 16px;
  padding: 24px 20px 20px;
  border: 1px solid rgba(218,165,32,0.15);
}
.h5-login-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 20px;
}
.h5-title-logo {
  width: 24px;
  height: 24px;
}
.h5-login-title {
  font-size: 16px;
  font-weight: 600;
  color: #d4af37;
}
.h5-form-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.h5-form-input {
  flex: 1;
  height: 40px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(212,175,55,0.25);
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  color: #fff;
}
.h5-form-input::placeholder {
  color: rgba(255,255,255,0.4);
}
.h5-code-btn {
  width: 70px;
  height: 40px;
  background: linear-gradient(135deg, #d4af37, #c9a227);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #000;
  font-weight: 500;
  flex-shrink: 0;
}
.h5-code-btn.disabled {
  background: rgba(212,175,55,0.3);
  color: rgba(255,255,255,0.5);
}
.h5-login-btn {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: #000;
  margin-top: 16px;
}
.h5-agreement {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 14px;
  gap: 4px;
}
/* #endif */

/* ===== iPhone 操作指引弹窗样式 ===== */
/* #ifdef H5 */
.ios-guide-content {
  width: 90%;
  max-width: 340px;
  background: #1a1a24;
  border-radius: 16px;
  padding: 24px 20px;
}
.ios-guide-title {
  font-size: 18px;
  font-weight: 600;
  color: #d4af37;
  display: block;
  text-align: center;
  margin-bottom: 24px;
}
.ios-guide-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ios-step {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.ios-step-num {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #000;
  flex-shrink: 0;
}
.ios-step-text {
  font-size: 14px;
  color: rgba(255,255,255,0.8);
}
.ios-step-icon {
  font-size: 18px;
  color: #007aff;
  font-weight: 600;
}
.ios-step-highlight {
  font-size: 14px;
  color: #d4af37;
  font-weight: 600;
  background: rgba(212,175,55,0.15);
  padding: 2px 8px;
  border-radius: 4px;
}
.ios-guide-close {
  margin-top: 24px;
  height: 44px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: #000;
}
/* #endif */

/* 登录检查加载状态 */
.loading-card {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 120px 20px;
}
.loading-text {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
}

/* 🔴 新增：身份选择弹框样式 */
.role-select-content {
  width: 90%;
  max-width: 340px;
  background: #1a1a24;
  border-radius: 16px;
  padding: 24px 20px;
}
.role-select-title {
  font-size: 18px;
  font-weight: 600;
  color: #d4af37;
  display: block;
  text-align: center;
  margin-bottom: 24px;
}
.role-select-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.role-option {
  padding: 16px;
  background: rgba(30,30,40,0.6);
  border: 1px solid rgba(218,165,32,0.2);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.role-option:active {
  transform: scale(0.98);
  background: rgba(212,175,55,0.2);
}
.role-icon {
  font-size: 32px;
}
.role-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}
.role-desc {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
}

</style>
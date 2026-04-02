<script>
import api from '@/utils/api.js'

export default {
  onLaunch: function (options) {
    console.log('App Launch', options)
    this.handleTableParams(options)
    
    // #ifdef H5
    // 注册 Service Worker（仅 H5）
    this.registerServiceWorker()
    // #endif
  },
  onShow: function (options) {
    console.log('App Show', options)
    this.handleTableParams(options)
  },
  onHide: function () {
    console.log('App Hide')
  },
  methods: {
    // #ifdef H5
    // 注册 Service Worker
    async registerServiceWorker() {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/static/sw.js')
          console.log('Service Worker 注册成功:', registration.scope)
        } catch (err) {
          console.error('Service Worker 注册失败:', err)
        }
      } else {
        console.log('浏览器不支持 Service Worker')
      }
    },
    // #endif
    
    async handleTableParams(options) {
      let tablePinyin = ''
      let fromScan = false // 是否来自扫码
      
      // H5模式：从URL获取参数（支持hash路由）
      // #ifdef H5
      // 方式1：从search参数获取（普通模式）
      const urlParams = new URLSearchParams(window.location.search)
      let urlTable = urlParams.get('table')
      
      // 方式2：从hash中获取参数（hash路由模式）
      if (!urlTable && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')
        urlTable = hashParams.get('table')
      }
      
      if (urlTable) {
        tablePinyin = urlTable
        fromScan = true // URL带参数视为扫码进入
        console.log('H5 URL参数 table:', tablePinyin)
        
        // 特殊参数：table=clear 清空台桌授权
        if (urlTable === 'clear') {
          uni.removeStorageSync('tablePinyin')
          uni.removeStorageSync('tableName')
          uni.removeStorageSync('tableAuth')
          // 同时清空 sessionStorage
          sessionStorage.removeItem('scanTable')
          sessionStorage.removeItem('scanTime')
          console.log('已清空台桌授权')
          return // 不继续处理
        }
        
        // 【核心】存入 sessionStorage（关闭标签页即失效）
        // 这样用户收藏的URL是干净的，离店后无法继续使用
        sessionStorage.setItem('scanTable', tablePinyin)
        sessionStorage.setItem('scanTime', Date.now().toString())
        console.log('已存入 sessionStorage:', tablePinyin)
        
        // 【核心】清理 URL 参数（让用户收藏的是干净 URL）
        // 使用 replaceState 不刷新页面，但修改地址栏
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0]
        window.history.replaceState({}, '', cleanUrl)
        console.log('已清理 URL 参数')
        
        
      }
      // #endif
      
      // 小程序模式：处理扫码进入的参数
      // #ifndef H5
      if (options.scene) {
        const scene = decodeURIComponent(options.scene)
        if (scene.startsWith('table=')) {
          tablePinyin = scene.replace('table=', '')
          fromScan = true
        } else if (!scene.includes('=')) {
          tablePinyin = scene
          fromScan = true
        }
      }
      
      // 小程序query参数
      if (options.query && options.query.table) {
        tablePinyin = options.query.table
        fromScan = true
      }
      // #endif
      
      // 查询台桌名并保存
      if (tablePinyin) {
        try {
          const table = await api.getTableByPinyin(tablePinyin)
          if (table && table.name) {
            const oldTableName = uni.getStorageSync('tableName') || ''
            
            // 保存新的台桌信息
            uni.setStorageSync('tablePinyin', tablePinyin)
            uni.setStorageSync('tableName', table.name)
            
            // #ifdef H5
            // H5：每次扫码都更新授权时间（修复：扫码进入时应该刷新有效期）
            if (fromScan) {
              const tableAuth = {
                table: tablePinyin,
                tableName: table.name,
                time: Date.now()
              }
              uni.setStorageSync('tableAuth', JSON.stringify(tableAuth))
              console.log('扫码授权已更新:', table.name, '时间:', new Date().toLocaleTimeString())
            }
            // #endif
            
            console.log('保存台桌:', table.name, tablePinyin)
            
            // 如果台桌变了，自动更新购物车里所有商品的台桌号
            if (oldTableName !== table.name) {
              const sessionId = uni.getStorageSync('sessionId')
              if (sessionId) {
                try {
                  await api.updateCartTable({ sessionId, tableNo: table.name })
                  console.log('已更新购物车台桌号:', table.name)
                } catch (e) {
                  console.log('更新购物车台桌号失败', e)
                }
              }
            }
          } else {
            console.log('未找到台桌:', tablePinyin)
          }
        } catch (err) {
          console.error('查询台桌失败', err)
        }
      }
    }
  }
}
</script>

<style>
/* 全局样式 */
page {
  background-color: #0a0a0f;
  color: #ffffff;
  font-family: 'PingFang SC', -apple-system, sans-serif;
}

/* 底部导航栏样式 - 紧凑型 */
:deep(.uni-tabbar) {
  height: 50px !important;
  background: rgba(10,10,15,0.98) !important;
  border-top: 1px solid rgba(218,165,32,0.1) !important;
}

:deep(.uni-tabbar__item) {
  padding: 4px 8px !important;
}

:deep(.uni-tabbar__icon) {
  width: 24px !important;
  height: 24px !important;
}

:deep(.uni-tabbar__label) {
  font-size: 11px !important;
}

/* 通用工具类 */
.container {
  padding: 16px;
}

.text-gold {
  color: #d4af37;
}

.text-muted {
  color: rgba(255,255,255,0.4);
}

/* ===== H5 图片预览背景色 ===== */
/* UniApp H5 previewImage 动态创建的元素需要全局样式 */
.uni-preview-image,
.uni-image-viewer,
.uni-image-preview,
.uni-image-viewer__mask {
  background-color: rgba(50, 50, 58, 0.95) !important;
}

/* 属性选择器 */
[uni-image-preview],
[uni-image-viewer] {
  background-color: rgba(50, 50, 58, 0.95) !important;
}

/* 预览容器内所有元素 */
.uni-image-viewer *,
.uni-preview-image * {
  background-color: transparent !important;
}

/* 遮罩层特殊处理 */
.uni-mask,
uni-mask {
  background-color: rgba(50, 50, 58, 0.95) !important;
}
</style>
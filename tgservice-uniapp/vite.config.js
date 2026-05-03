import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

export default defineConfig(({ mode }) => {
  // 根据 mode 决定默认 API URL
  // production 模式用生产 URL，其他模式用测试 URL
  const defaultApiUrl = mode === 'production' 
    ? 'https://tiangong.club/api' 
    : 'https://tg.tiangong.club/api'

  return {
    plugins: [uni()],
    server: {
      port: 8083,
      host: '0.0.0.0'
    },
    define: {
      // 强制注入环境变量，确保所有代码路径都使用正确的 URL
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(defaultApiUrl)
    }
  }
})
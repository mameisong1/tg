/**
 * PM2 配置 - Docker 容器内使用
 * tgservice: 80 端口（后端 API）
 * tgservice-uniapp: 81 端口（H5 前端）
 */

module.exports = {
  apps: [
    {
      name: 'tgservice',
      script: 'server.js',
      cwd: '/app/tgservice/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 80
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/app/logs/tgservice-error.log',
      out_file: '/app/logs/tgservice-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'tgservice-uniapp',
      script: '/app/tgservice-uniapp/start-docker.sh',
      interpreter: 'bash',
      cwd: '/app/tgservice-uniapp',
      env: {
        NODE_ENV: 'production',
        PORT: 81
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: '/app/logs/tgservice-uniapp-error.log',
      out_file: '/app/logs/tgservice-uniapp-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
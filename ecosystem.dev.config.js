/**
 * PM2 配置 - 开发环境（宿主机）
 * 端口: 8088
 */
module.exports = {
  apps: [{
    name: 'tgservice-dev',
    script: 'server.js',
    cwd: '/TG/tgservice/backend',
    env: {
      NODE_ENV: 'development',
      TGSERVICE_ENV: 'test',
      PORT: 8088
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/TG/tgservice/logs/error-dev.log',
    out_file: '/TG/tgservice/logs/out-dev.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};

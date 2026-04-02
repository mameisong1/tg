module.exports = {
  apps: [{
    name: 'tgservice-uniapp',
    script: 'serve',
    args: '-s -l 8083',
    cwd: '/TG/tgservice-uniapp/dist/build/h5',
    interpreter: 'none',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
/**
 * Redis 缓存工具类
 * 天宫国际 V2.0
 */

const redis = require('redis');
const path = require('path');

class RedisCache {
  constructor() {
    this.client = null;
    this.keyPrefix = 'tg';
    this.connected = false;
  }

  // 根据环境加载配置
  getConfig() {
    const env = process.env.TGSERVICE_ENV || 'production';
    const configFileName = env === 'test' ? '.config' : '.config.prod';
    const configPath = path.join(__dirname, '../../' + configFileName);
    const config = JSON.parse(require('fs').readFileSync(configPath, 'utf-8'));
    return config.redis || { host: '127.0.0.1', port: 8090, password: '', db: 0, keyPrefix: 'tg' };
  }

  // 初始化连接
  async connect() {
    if (!this.client || !this.connected) {
      const redisConfig = this.getConfig();
      this.keyPrefix = redisConfig.keyPrefix || 'tg';
      
      this.client = redis.createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port
        },
        password: redisConfig.password || undefined,
        database: redisConfig.db || 0
      });

      this.client.on('error', (err) => {
        console.error('[Redis] 连接错误:', err.message);
      });

      this.client.on('connect', () => {
        console.log('[Redis] 连接成功:', redisConfig.host + ':' + redisConfig.port);
      });

      await this.client.connect();
      this.connected = true;
    }
  }

  // 获取缓存
  async get(key) {
    try {
      await this.connect();
      const fullKey = `${this.keyPrefix}:${key}`;
      const data = await this.client.get(fullKey);
      if (data) {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }
      return null;
    } catch (err) {
      console.error('[Redis] GET 失败:', key, err.message);
      return null;
    }
  }

  // 设置缓存
  async set(key, value, ttlSeconds = 60) {
    try {
      await this.connect();
      const fullKey = `${this.keyPrefix}:${key}`;
      // 统一转换为 JSON 字符串（支持 object、number、string 等）
      const data = JSON.stringify(value);
      await this.client.setEx(fullKey, ttlSeconds, data);
    } catch (err) {
      console.error('[Redis] SET 失败:', key, err.message);
    }
  }

  // 删除缓存（支持通配符）
  async del(keyPattern) {
    try {
      await this.connect();
      const keys = await this.client.keys(`${this.keyPrefix}:${keyPattern}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
        console.log('[Redis] 删除缓存:', keys.length, '个 key');
      }
    } catch (err) {
      console.error('[Redis] DEL 失败:', keyPattern, err.message);
    }
  }

  // 删除单个 key
  async delOne(key) {
    try {
      await this.connect();
      const fullKey = `${this.keyPrefix}:${key}`;
      await this.client.del(fullKey);
    } catch (err) {
      console.error('[Redis] DEL ONE 失败:', key, err.message);
    }
  }

  // 获取 TTL
  async ttl(key) {
    try {
      await this.connect();
      const fullKey = `${this.keyPrefix}:${key}`;
      return await this.client.ttl(fullKey);
    } catch (err) {
      console.error('[Redis] TTL 失败:', key, err.message);
      return -1;
    }
  }

  // 关闭连接
  async quit() {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }
}

// 单例导出
module.exports = new RedisCache();
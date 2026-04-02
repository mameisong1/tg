#!/usr/bin/env node
/**
 * 台桌二维码生成脚本
 * 根据台桌表数据生成小程序二维码
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

// 配置
const DB_PATH = path.join(__dirname, '../tgservice/db/tgservice.db');
const QRCODE_DIR = path.join(__dirname, '../tgservice-uniapp/qrcode');
const CONFIG_PATH = path.join(__dirname, '../tgservice/.config');

// 读取配置
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
} catch (e) {
  console.log('警告: 无法读取配置文件');
}

// 小程序配置 - 从config读取
const APPID = config.wechat?.appid || '';
const APPSECRET = config.wechat?.appsecret || '';

// 确保二维码目录存在
if (!fs.existsSync(QRCODE_DIR)) {
  fs.mkdirSync(QRCODE_DIR, { recursive: true });
}

// 数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  }
  console.log('数据库已连接');
});

// 获取access_token
async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${config.wechat?.appsecret || ''}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error(result.errmsg || '获取access_token失败'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// 生成小程序码
async function generateWXACode(accessToken, scene, page) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      scene: scene,
      page: page,
      width: 430,
      auto_color: false,
      line_color: { "r": 212, "g": 175, "b": 55 },
      is_hyaline: false
    });
    
    const options = {
      hostname: 'api.weixin.qq.com',
      port: 443,
      path: `/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        // 检查是否是错误响应
        if (buffer[0] === 0x7b) { // JSON starts with {
          try {
            const error = JSON.parse(buffer.toString());
            reject(new Error(error.errmsg || '生成二维码失败'));
          } catch (e) {
            resolve(buffer);
          }
        } else {
          resolve(buffer);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 获取所有台桌
function getTables() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM tables ORDER BY area, name', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// 主函数
async function main() {
  try {
    console.log('\n🎱 台桌二维码生成工具\n');
    
    // 获取台桌列表
    const tables = await getTables();
    console.log(`找到 ${tables.length} 个台桌\n`);
    
    if (tables.length === 0) {
      console.log('没有台桌数据，请先导入台桌');
      return;
    }
    
    // 按区域分组
    const areas = {};
    tables.forEach(t => {
      if (!areas[t.area]) areas[t.area] = [];
      areas[t.area].push(t);
    });
    
    // 检查是否有微信配置
    if (!config.wechat?.appsecret) {
      console.log('⚠️ 未配置微信appsecret，将生成模拟二维码文件\n');
      console.log('请在 /TG/tgservice/.config 中配置 wechat.appsecret 后重新运行\n');
      
      // 生成占位文件
      for (const [area, tableList] of Object.entries(areas)) {
        for (const table of tableList) {
          const filename = `${area}_${table.name}.jpg`.replace(/\//g, '_');
          const filepath = path.join(QRCODE_DIR, filename);
          
          // 写入占位文件
          const content = `台桌: ${table.name}\n区域: ${area}\n拼音: ${table.name_pinyin}\n\n请配置微信appsecret后重新生成二维码`;
          fs.writeFileSync(filepath.replace('.jpg', '.txt'), content);
          console.log(`  生成: ${filename}`);
        }
      }
      
      console.log(`\n完成！共生成 ${tables.length} 个占位文件`);
      console.log(`目录: ${QRCODE_DIR}`);
      return;
    }
    
    // 获取access_token
    console.log('获取access_token...');
    const accessToken = await getAccessToken();
    console.log('access_token获取成功\n');
    
    // 生成二维码
    let success = 0;
    let failed = 0;
    
    for (const [area, tableList] of Object.entries(areas)) {
      console.log(`\n【${area}】`);
      
      for (const table of tableList) {
        const filename = `${area}_${table.name}.jpg`.replace(/\//g, '_');
        const filepath = path.join(QRCODE_DIR, filename);
        
        try {
          console.log(`  生成: ${table.name} (${table.name_pinyin})...`);
          
          const buffer = await generateWXACode(
            accessToken,
            table.name_pinyin,
            'pages/index/index'
          );
          
          fs.writeFileSync(filepath, buffer);
          success++;
          console.log(`    ✓ 保存: ${filename}`);
        } catch (err) {
          failed++;
          console.log(`    ✗ 失败: ${err.message}`);
        }
      }
    }
    
    console.log(`\n========== 完成 ==========`);
    console.log(`成功: ${success} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`目录: ${QRCODE_DIR}`);
    
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    db.close();
  }
}

main();
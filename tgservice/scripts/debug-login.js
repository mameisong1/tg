const WebSocket = require('ws');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendCommand(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          ws.off('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch (err) { reject(err); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.off('message', handler); reject(new Error(`Timeout: ${method}`)); }, 30000);
  });
}

async function executeScript(ws, script) {
  const result = await sendCommand(ws, 'Runtime.evaluate', { 
    expression: script, 
    returnByValue: true 
  });
  return result.result?.value;
}

async function debug() {
  const response = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await response.json();
  const page = pages.find(p => p.url && p.url.includes('admin.taikeduo.com'));
  
  if (!page) {
    console.log('没有找到台客多页面');
    return;
  }
  
  console.log('页面URL:', page.url);
  
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  
  ws.on('open', async () => {
    console.log('=== 步骤1: 检查当前页面状态 ===');
    await sleep(1000);
    
    const initialState = await executeScript(ws, `
      (function() {
        return {
          bodyText: document.body.innerText.substring(0, 300),
          hasPwdLoginBtn: !!document.querySelector('span.switch-text'),
          pwdLoginBtnText: document.querySelector('span.switch-text')?.innerText
        };
      })()
    `);
    console.log('初始状态:', initialState);
    
    console.log('\n=== 步骤2: 点击密码登录 ===');
    const clickResult = await executeScript(ws, `
      (function() {
        const span = document.querySelector('span.switch-text');
        if (span) {
          span.click();
          return '已点击: ' + span.innerText;
        }
        return '未找到密码登录按钮';
      })()
    `);
    console.log('点击结果:', clickResult);
    
    await sleep(2000);
    
    console.log('\n=== 步骤3: 检查切换后的状态 ===');
    const afterSwitch = await executeScript(ws, `
      (function() {
        const inputs = document.querySelectorAll('input');
        return {
          bodyText: document.body.innerText.substring(0, 300),
          inputCount: inputs.length,
          inputs: Array.from(inputs).map(inp => ({
            type: inp.type,
            placeholder: inp.placeholder,
            visible: inp.offsetParent !== null
          })),
          hasPasswordInput: !!document.querySelector('input[type="password"]')
        };
      })()
    `);
    console.log('切换后状态:', JSON.stringify(afterSwitch, null, 2));
    
    console.log('\n=== 步骤4: 填写用户名密码 ===');
    const fillResult = await executeScript(ws, `
      (function() {
        const username = '18680174119';
        const password = 'tgk123456';
        
        const inputs = document.querySelectorAll('input');
        let result = [];
        
        for (const input of inputs) {
          const type = input.type || 'text';
          const placeholder = input.placeholder || '';
          
          if (type === 'text' || placeholder.includes('手机号') || placeholder.includes('账号')) {
            input.focus();
            input.value = username;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            result.push('用户名已填写: ' + input.value);
          }
          
          if (type === 'password') {
            input.focus();
            input.value = password;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            result.push('密码已填写');
          }
        }
        
        return result.join(', ') || '未找到输入框';
      })()
    `);
    console.log('填写结果:', fillResult);
    
    await sleep(1000);
    
    console.log('\n=== 步骤5: 检查填写后的输入框值 ===');
    const afterFill = await executeScript(ws, `
      (function() {
        const inputs = document.querySelectorAll('input');
        return Array.from(inputs).map(inp => ({
          type: inp.type,
          placeholder: inp.placeholder,
          value: inp.value ? '(有值: ' + inp.value.substring(0, 3) + '...)' : '(空)'
        }));
      })()
    `);
    console.log('填写后输入框:', afterFill);
    
    console.log('\n=== 步骤6: 点击登录按钮 ===');
    const loginClick = await executeScript(ws, `
      (function() {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.innerText.includes('登') && btn.innerText.includes('录')) {
            btn.click();
            return '已点击: ' + btn.innerText;
          }
        }
        return '未找到登录按钮';
      })()
    `);
    console.log('登录点击:', loginClick);
    
    console.log('\n=== 步骤7: 等待登录结果 ===');
    await sleep(5000);
    
    const finalState = await executeScript(ws, `
      (function() {
        return {
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 500),
          hasError: document.body.innerText.includes('错误') || document.body.innerText.includes('失败'),
          hasSidebar: !!document.querySelector('.sidebar, .el-menu, .nav-menu')
        };
      })()
    `);
    console.log('最终状态:', finalState);
    
    ws.close();
    process.exit(0);
  });
}

debug().catch(console.error);
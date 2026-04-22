const puppeteer = require('puppeteer');
const fs = require('fs');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function testBadge() {
  console.log('连接 Chrome...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: { width: 375, height: 812 }
  });

  console.log('新建标签页...');
  const page = await browser.newPage();
  
  try {
    // 导航到测试环境
    console.log('导航到测试环境...');
    await page.goto('http://127.0.0.1:8089', { waitUntil: 'networkidle2', timeout: 30000 });
    
    await wait(2000);
    
    // 截图首页
    console.log('截图首页...');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/home-page.png', fullPage: true });
    
    // 尝试找到会员登录入口
    console.log('查找会员入口...');
    const memberLink = await page.evaluate(() => {
      // 查找所有链接和按钮
      const links = Array.from(document.querySelectorAll('a, button, [class*="btn"], [class*="link"]'));
      const memberLinks = links.filter(l => {
        const text = l.innerText || '';
        return text.includes('会员') || text.includes('我的') || text.includes('个人');
      });
      return memberLinks.map(l => ({ text: l.innerText, href: l.href || '' }));
    });
    console.log('会员入口:', memberLinks);
    
    // 直接导航到会员中心页面（因为路飞已经是助教用户）
    console.log('导航到会员中心...');
    await page.goto('http://127.0.0.1:8089/#/pages/member/member', { waitUntil: 'networkidle2', timeout: 30000 });
    
    await wait(3000);
    
    // 截图会员中心
    console.log('截图会员中心...');
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/member-center.png', fullPage: true });
    
    // 检查页面内容
    const pageContent = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 2000),
        badgeElements: Array.from(document.querySelectorAll('[class*="badge"], [class*="count"], .badge, .uni-badge')).map(el => ({
          class: el.className,
          text: el.innerText,
          visible: el.offsetParent !== null
        })),
        rewardPenaltyBtn: Array.from(document.querySelectorAll('button, a, [class*="btn"], div')).filter(el => 
          el.innerText.includes('奖罚') || el.innerText.includes('奖励') || el.innerText.includes('惩罚')
        ).map(el => ({ text: el.innerText, class: el.className }))
      };
    });
    
    console.log('\n=== 页面信息 ===');
    console.log('URL:', pageContent.url);
    console.log('标题:', pageContent.title);
    console.log('页面文本片段:', pageContent.bodyText.substring(0, 500));
    console.log('\n=== 角标元素 ===');
    console.log('角标数量:', pageContent.badgeElements.length);
    if (pageContent.badgeElements.length > 0) {
      console.log('角标内容:', JSON.stringify(pageContent.badgeElements, null, 2));
    }
    console.log('\n=== 奖罚按钮 ===');
    console.log('奖罚按钮数量:', pageContent.rewardPenaltyBtn.length);
    if (pageContent.rewardPenaltyBtn.length > 0) {
      console.log('奖罚按钮:', JSON.stringify(pageContent.rewardPenaltyBtn, null, 2));
    }
    
    // 检查是否有"我的奖罚"相关内容
    if (pageContent.bodyText.includes('奖罚')) {
      console.log('✅ 页面包含"奖罚"文本');
    } else {
      console.log('⚠️ 页面不包含"奖罚"文本');
    }
    
    // 检查角标
    if (pageContent.badgeElements.length > 0) {
      const visibleBadges = pageContent.badgeElements.filter(b => b.visible && b.text.trim() !== '');
      if (visibleBadges.length > 0) {
        console.log('✅ 检测到可见角标:', visibleBadges);
      } else {
        console.log('⚠️ 角标元素存在但不可见或无内容');
      }
    }
    
    // 最终截图
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-badge-final.png', fullPage: true });
    console.log('\n截图已保存:');
    console.log('- /root/.openclaw/workspace_coder-tg/home-page.png');
    console.log('- /root/.openclaw/workspace_coder-tg/member-center.png');
    console.log('- /root/.openclaw/workspace_coder-tg/test-badge-final.png');
    
  } catch (error) {
    console.error('测试错误:', error.message);
    await page.screenshot({ path: '/root/.openclaw/workspace_coder-tg/test-error.png', fullPage: true });
  } finally {
    console.log('关闭标签页...');
    await page.close();
  }
}

testBadge().catch(console.error);
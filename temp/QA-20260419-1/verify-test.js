const puppeteer = require('puppeteer');
const path = require('path');

const SCREENSHOT_DIR = '/root/.openclaw/workspace_coder-tg/screenshots';
const BASE = 'http://127.0.0.1:8089';

async function screenshot(page, name) {
  const fp = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: fp, fullPage: true });
  console.log(`📸 ${name}.png`);
  return fp;
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function loginSms(page, phone) {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 });
  await wait(1000);
  await page.evaluate((p) => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.placeholder && inp.placeholder.includes('手机号')) {
        inp.value = p; inp.dispatchEvent(new Event('input', { bubbles: true })); break;
      }
    }
  }, phone);
  await wait(300);
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp.placeholder && inp.placeholder.includes('验证码')) {
        inp.value = '888888'; inp.dispatchEvent(new Event('input', { bubbles: true })); break;
      }
    }
  });
  await wait(300);
  await page.evaluate(() => {
    const cbs = document.querySelectorAll('.checkbox');
    for (const cb of cbs) { if (!cb.classList.contains('checked')) { cb.click(); break; } }
  });
  await wait(300);
  await page.evaluate(() => {
    const btn = document.querySelector('.h5-login-btn');
    if (btn) btn.click();
  });
  await wait(3000);
}

async function getStorage(page, key) {
  return await page.evaluate((k) => {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); }
  }, key);
}

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  let page;

  // =========================================
  // 1. 18680174119 login → navigate to member page
  // =========================================
  console.log('=== 18680174119: login + member page ===');
  page = await browser.newPage();
  await loginSms(page, '18680174119');
  await wait(2000);

  console.log('After login (index page):');
  const idxSections = await page.evaluate(() => {
    const t = [];
    document.querySelectorAll('.section-title, .brand-name').forEach(el => t.push(el.textContent.trim()));
    return t;
  });
  console.log('  Sections:', idxSections);
  await screenshot(page, 'verify-186-after-login-index');

  // Navigate to member page
  console.log('Navigating to member page...');
  await page.goto(BASE + '/#/pages/member/member', { waitUntil: 'networkidle0', timeout: 15000 });
  await wait(3000);

  const storage = {
    adminInfo: await getStorage(page, 'adminInfo'),
    coachInfo: await getStorage(page, 'coachInfo'),
    adminToken: await getStorage(page, 'adminToken'),
    coachToken: await getStorage(page, 'coachToken'),
    memberInfo: await getStorage(page, 'memberInfo'),
  };
  console.log('localStorage on member page:');
  console.log('  adminInfo:', JSON.stringify(storage.adminInfo));
  console.log('  coachInfo:', JSON.stringify(storage.coachInfo));
  console.log('  adminToken:', storage.adminToken ? 'exists' : 'null');
  console.log('  coachToken:', storage.coachToken ? 'exists' : 'null');

  // Check what the page actually shows
  const memberContent = await page.evaluate(() => {
    const body = document.body;
    // Check if member section is visible
    const memberSection = body.querySelector('.member-section');
    const internalSections = body.querySelectorAll('.internal-section');
    const sectionTitles = [];
    document.querySelectorAll('.section-title').forEach(el => sectionTitles.push(el.textContent.trim()));
    const btnTexts = [];
    document.querySelectorAll('.internal-btn-text').forEach(el => btnTexts.push(el.textContent.trim()));
    const hasMemberCard = !!body.querySelector('.member-card');
    const hasLoginCard = !!body.querySelector('.h5-login-card, .login-card');
    const hasCoachSection = !!body.querySelector('.coach-section');
    const memberSectionVisible = memberSection ? memberSection.offsetParent !== null : false;

    return {
      sectionTitles,
      btnTexts,
      hasMemberCard,
      hasLoginCard,
      hasCoachSection,
      internalSectionCount: internalSections.length,
      memberSectionVisible,
      // Get all visible text
      bodyText: body.innerText.substring(0, 800),
    };
  });
  console.log('Member page content:');
  console.log('  hasMemberCard:', memberContent.hasMemberCard);
  console.log('  hasLoginCard:', memberContent.hasLoginCard);
  console.log('  hasCoachSection:', memberContent.hasCoachSection);
  console.log('  internalSectionCount:', memberContent.internalSectionCount);
  console.log('  memberSectionVisible:', memberContent.memberSectionVisible);
  console.log('  sectionTitles:', memberContent.sectionTitles);
  console.log('  btnTexts:', memberContent.btnTexts);
  console.log('  bodyText:', memberContent.bodyText.substring(0, 300));

  await screenshot(page, 'verify-186-member-page');

  // Check the member.vue computed values via console
  console.log('\n=== Checking Vue component state ===');
  const vueState = await page.evaluate(() => {
    // Try to access Vue devtools or component instance
    const app = document.querySelector('#app');
    if (app && app.__vue_app__) {
      // Vue 3
      const root = app.__vue_app__._instance;
      // Walk down to find the component with memberInfo
      let found = null;
      function walk(instance) {
        if (!instance) return false;
        const proxy = instance.proxy;
        if (proxy && proxy.memberInfo !== undefined) {
          found = {
            memberInfo: proxy.memberInfo,
            isCoach: proxy.isCoach,
            isManager: proxy.isManager,
            showCommonFeatures: proxy.showCommonFeatures,
          };
          return true;
        }
        if (instance.subTree && instance.subTree.component) {
          if (walk(instance.subTree.component)) return true;
        }
        if (instance.subTree && instance.subTree.children) {
          for (const child of instance.subTree.children) {
            if (child && child.component && walk(child.component)) return true;
          }
        }
        return false;
      }
      walk(root);
      return found;
    }
    return null;
  });
  console.log('Vue state:', JSON.stringify(vueState, null, 2));

  await page.close();

  // =========================================
  // 2. Coach 16675852676 login → member page
  // =========================================
  console.log('\n=== 16675852676: login + member page ===');
  page = await browser.newPage();
  await loginSms(page, '16675852676');
  await wait(2000);

  await page.goto(BASE + '/#/pages/member/member', { waitUntil: 'networkidle0', timeout: 15000 });
  await wait(3000);

  const storage2 = {
    adminInfo: await getStorage(page, 'adminInfo'),
    coachInfo: await getStorage(page, 'coachInfo'),
  };
  console.log('  adminInfo:', JSON.stringify(storage2.adminInfo));
  console.log('  coachInfo:', JSON.stringify(storage2.coachInfo));

  const memberContent2 = await page.evaluate(() => {
    const body = document.body;
    const sectionTitles = [];
    document.querySelectorAll('.section-title').forEach(el => sectionTitles.push(el.textContent.trim()));
    const btnTexts = [];
    document.querySelectorAll('.internal-btn-text').forEach(el => btnTexts.push(el.textContent.trim()));
    return {
      sectionTitles,
      btnTexts,
      hasMemberCard: !!body.querySelector('.member-card'),
      bodyText: body.innerText.substring(0, 500),
    };
  });
  console.log('  sectionTitles:', memberContent2.sectionTitles);
  console.log('  btnTexts:', memberContent2.btnTexts);
  console.log('  hasMemberCard:', memberContent2.hasMemberCard);

  await screenshot(page, 'verify-166-member-page');
  await page.close();

  console.log('\n✅ Verification complete');
}

main().catch(e => { console.error(e); process.exit(1); });

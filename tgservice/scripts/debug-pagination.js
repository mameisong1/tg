/**
 * 调试分页组件
 */

const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  
  // 检查分页
  const paginationInfo = await page.evaluate(() => {
    const info = {};
    
    // 查找分页容器
    const pagination = document.querySelector('.ant-pagination, .el-pagination');
    if (pagination) {
      info.paginationHTML = pagination.outerHTML.substring(0, 2000);
      
      // 获取总条数文本
      const totalText = document.body.innerText.match(/共\s*(\d+)\s*条|共\s*(\d+)\s*件|total\s*(\d+)/i);
      info.totalMatch = totalText;
      
      // 获取页码按钮
      const pageItems = document.querySelectorAll('.ant-pagination-item');
      info.pageItems = Array.from(pageItems).map(p => ({
        text: p.textContent,
        title: p.getAttribute('title'),
        className: p.className
      }));
      
      // 获取下一页按钮
      const nextBtn = document.querySelector('.ant-pagination-next');
      if (nextBtn) {
        info.nextBtnClass = nextBtn.className;
        info.nextBtnDisabled = nextBtn.classList.contains('ant-pagination-disabled');
      }
      
      // 获取每页条数
      const pageSizeSelect = document.querySelector('.ant-pagination-options-size-changer');
      if (pageSizeSelect) {
        info.pageSizeText = pageSizeSelect.textContent;
      }
    }
    
    return info;
  });
  
  console.log('分页信息:');
  console.log(JSON.stringify(paginationInfo, null, 2));
  
  // 截图
  await page.screenshot({ path: '/TG/tgservice/data/pagination-debug.png' });
  console.log('\n截图保存到: /TG/tgservice/data/pagination-debug.png');
  
  await browser.close();
}

main();
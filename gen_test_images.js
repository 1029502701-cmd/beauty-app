const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#87CEEB"/><circle cx="120" cy="120" r="50" fill="#FFDAB9"/><circle cx="105" cy="110" r="5" fill="#333"/><circle cx="135" cy="110" r="5" fill="#333"/><path d="M105 135 Q120 145 135 135" stroke="#333" fill="none"/><rect x="70" y="170" width="100" height="130" fill="#4169E1"/><circle cx="280" cy="120" r="50" fill="#DEB887"/><circle cx="265" cy="110" r="5" fill="#333"/><circle cx="295" cy="110" r="5" fill="#333"/><path d="M265 135 Q280 145 295 135" stroke="#333" fill="none"/><rect x="230" y="170" width="100" height="130" fill="#8B0000"/></svg>');
  await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_multi_face.jpg', quality: 90 });
  console.log('test_multi_face.jpg created');
  await page.setContent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1E90FF"/><stop offset="100%" stop-color="#87CEEB"/></linearGradient></defs><rect width="400" height="300" fill="url(#sky)"/><polygon points="0,200 100,100 200,200" fill="#2E8B57"/><polygon points="150,200 250,80 350,200" fill="#228B22"/><polygon points="300,200 380,120 400,200" fill="#2E8B57"/><rect width="400" height="100" y="200" fill="#228B22"/><circle cx="350" cy="50" r="30" fill="#FFD700"/></svg>');
  await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_no_face.jpg', quality: 90 });
  console.log('test_no_face.jpg created');
  await browser.close();
})();
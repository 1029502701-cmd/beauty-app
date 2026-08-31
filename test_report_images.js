const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:8788");
  await page.evaluate(() => localStorage.setItem("session_token","58a91a89-76c1-4474-85ce-98fb9c194802"));
  console.log("=== NORMAL REPORT ===");
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-001");
  await page.waitForTimeout(20000);
  const evalFn=(imgs)=>imgs.map(img=>({src:img.src,loaded:img.complete&&img.naturalWidth>0,nw:img.naturalWidth,nh:img.naturalHeight}));
  const img1=await page.$$eval("img",evalFn);
  console.log(JSON.stringify(img1,null,2));
  console.log("=== EXTREME REPORT ===");
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-extreme");
  await page.waitForTimeout(20000);
  const img2=await page.$$eval("img",evalFn);
  console.log(JSON.stringify(img2,null,2));
  const urls=[...new Set([...img1,...img2].map(i=>i.src).filter(s=>s&&s.startsWith("http")))];
  console.log("=== DIRECT URL CHECKS ===");
  for(const u of urls){
    if(!u||u.startsWith("data:"))continue;
    try{const t=await browser.newPage();await t.goto(u,{waitUntil:"domcontentloaded",timeout:15000}).catch(()=>{});await t.waitForTimeout(3000);
      const d=await t.evaluate(()=>document.querySelector("img")?{found:true}:{found:false});
      console.log("  "+u.substring(0,90)+" dims="+JSON.stringify(d));await t.close();
    }catch(e){console.log("  "+u.substring(0,90)+" ERR:"+e.message);}
  }
  await browser.close();
  console.log("=== DONE ===");
})();
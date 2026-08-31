const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  
  // Set token before any navigation
  await p.addInitScript(() => {
    localStorage.setItem("session_token", "58a91a89-76c1-4474-85ce-98fb9c194802");
  });
  
  // Normal report
  await p.goto("http://127.0.0.1:8788/report/t1-e2e-001", { waitUntil: "networkidle", timeout: 20000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const imgs1 = await p.$$eval("img", a => a.map(x => ({ src: x.src, loaded: x.complete && x.naturalWidth > 0 })));
  console.log("NORMAL:", JSON.stringify(imgs1, null, 2));
  
  // Extreme report
  await p.goto("http://127.0.0.1:8788/report/t1-e2e-extreme", { waitUntil: "networkidle", timeout: 20000 });
  await new Promise(r => setTimeout(r, 8000));
  
  const imgs2 = await p.$$eval("img", a => a.map(x => ({ src: x.src, loaded: x.complete && x.naturalWidth > 0 })));
  console.log("EXTREME:", JSON.stringify(imgs2, null, 2));
  
  await b.close();
})();

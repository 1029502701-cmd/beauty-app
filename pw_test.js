const { chromium } = require("playwright");
(async () => {
  try {
    const b = await chromium.launch({ headless: true });
    const p = await b.newPage();
    await p.goto("about:blank");
    await p.setContent("<img src='https://img.alicdn.com/bao/uploaded/i4/2200742227911/O1CN01T4ncKzKDZAB2R3rs_!!4611686018427383751-0-item_pic.jpg'>");
    await new Promise(r => setTimeout(r, 3000));
    const img = await p.$eval("img", el => ({ src: el.src, loaded: el.complete && el.naturalWidth > 0 }));
    console.log(JSON.stringify(img));
    await b.close();
  } catch(e) {
    console.error("ERROR: " + e.message);
  }
})();

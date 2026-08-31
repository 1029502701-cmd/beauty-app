const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  
  const urls = [
    "https://img.alicdn.com/bao/uploaded/i4/2200742227911/O1CN01T4ncKzKDZAB2R3rs_!!4611686018427383751-0-item_pic.jpg",
    "https://img.alicdn.com/bao/uploaded/i2/1842679449/O1CN01npQEqL2JfhT1chw8g_!!1842679449.jpg",
    "https://img.alicdn.com/imgextra/i1/O1CN01abc123_!!xxx.jpg",
    "https://img.alicdn.com/bao/uploaded/i4/4263451812/O1CN01rdl2gR1PFwoe9MWT9_!!4263451812.jpg",
    "https://img.alicdn.com/bao/uploaded/i3/2083840680/O1CN0119pVHoVbOuB2bdTk_!!2083840680.jpg",
    "https://img.alicdn.com/bao/uploaded/i4/1126469070/O1CN01ndhkW02Gs7R1f3V1b_!!1126469070.heic",
    "https://img.alicdn.com/imgextra/i2/O1CN01def456_!!xxx.jpg",
    "https://img.alicdn.com/bao/uploaded/i3/265519046/O1CN013iO5sN2Gh7xhXm4xD_!!265519046.jpg"
  ];
  
  const results = [];
  for (const url of urls) {
    await p.goto("about:blank");
    await p.setContent("<img src='" + url + "'>");
    await new Promise(r => setTimeout(r, 2000));
    const img = await p.$eval("img", el => ({
      src: el.src,
      loaded: el.complete && el.naturalWidth > 0
    }));
    results.push(img);
  }
  
  console.log(JSON.stringify(results, null, 2));
  await b.close();
})();

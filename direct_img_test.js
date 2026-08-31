const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  const urls = [
    'https://img.alicdn.com/bao/uploaded/i4/2200742227911/O1CN01T4ncKzKDZAB2R3rs_!!4611686018427383751-0-item_pic.jpg',
    'https://img.alicdn.com/bao/uploaded/i2/1842679449/O1CN01npQEqL2JfhT1chw8g_!!1842679449.jpg',
    'https://img.alicdn.com/bao/uploaded/i4/4263451812/O1CN01rdl2gR1PFwoe9MWT9_!!4263451812.jpg',
    'https://img.alicdn.com/bao/uploaded/i3/2083840680/O1CN0119pVHoVbOuB2bdTk_!!2083840680.jpg',
    'https://img.alicdn.com/bao/uploaded/i4/1126469070/O1CN01ndhkW02Gs7R1f3V1b_!!1126469070.heic',
    'https://img.alicdn.com/bao/uploaded/i3/265519046/O1CN013iO5sN2Gh7xhXm4xD_!!265519046.jpg'
  ];
  const labels = ["Fenty Beauty Contour", "Clinique Moisturizer", "NARS Blush", "NARS Concealer", "CT Powder", "Benefit Bronzer"];
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    await p.goto(urls[i], { waitUntil: "networkidle", timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    const info = await p.$eval("img", e => ({
      src: e.src.substring(0, 80),
      complete: e.complete,
      naturalWidth: e.naturalWidth,
      naturalHeight: e.naturalHeight,
      displayWidth: e.clientWidth,
      displayHeight: e.clientHeight
    }));
    results.push({ label: labels[i], url: urls[i].substring(0, 70), ...info });
  }
  console.log(JSON.stringify(results, null, 2));
  await b.close();
})();
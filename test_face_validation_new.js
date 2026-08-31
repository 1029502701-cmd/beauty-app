const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'http://localhost:5174';
const TOKEN = '6e1555f1-929c-4117-85c8-7cb79ac1038a';
const images = [
  { name: 'test_face.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_face.jpg', desc: '单人正脸照 - 预期200' },
  { name: 'test_multi_face.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_multi_face.jpg', desc: '多人合影照(2人) - 预期400多张人脸' },
  { name: 'test_no_face.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_no_face.jpg', desc: '风景照无人脸 - 预期400未检测到人脸' },
];
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token) => { localStorage.setItem('session_token', token); }, TOKEN);
  await page.waitForTimeout(500);
  console.log('=== FACE VALIDATION TEST (new account, fresh quota) ===');
  console.log('Token: ' + TOKEN.substring(0, 8) + '...');
  console.log('');
  for (const img of images) {
    console.log('--- ' + img.name + ' (' + img.desc + ') ---');
    if (!fs.existsSync(img.path) || fs.statSync(img.path).size === 0) {
      console.log('[SKIP] file empty or missing: ' + img.path);
      continue;
    }
    const buf = fs.readFileSync(img.path);
    const b64 = buf.toString('base64');
    const result = await page.evaluate(async ({ b64, token }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const fd = new FormData();
      fd.append('photo', blob, 'test.jpg');
      try {
        const res = await fetch('/api/tier1/analyze', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: fd,
        });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (e) { return { status: 0, body: e.message }; }
    }, { b64, token: TOKEN });
    console.log('[HTTP ' + result.status + ']');
    console.log('[RESP] ' + result.body);
    console.log('');
  }
  console.log('=== DONE ===');
  await browser.close();
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
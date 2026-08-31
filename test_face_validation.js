const { chromium } = require('playwright');
const fs2 = require('fs');
const BASE = 'http://localhost:5174';
const TOKEN = '8f4873ff-746d-4170-9308-90b106aea95a';
const images = [
  { name: 'test_face.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_face.jpg', desc: 'real face photo' },
  { name: 'small_test.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/small_test.jpg', desc: 'small image' },
  { name: 'photo.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg', desc: 'another photo' },
];
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token) => { localStorage.setItem('session_token', token); }, TOKEN);
  await page.waitForTimeout(500);
  console.log('=== UPLOADING IMAGES VIA BROWSER FETCH ===');
  for (const img of images) {
    console.log('');
    console.log('--- ' + img.name + ' (' + img.desc + ') ---');
    if (!fs2.existsSync(img.path) || fs2.statSync(img.path).size === 0) { console.log('[SKIP] file empty or missing'); continue; }
    const buf = fs2.readFileSync(img.path);
    const b64 = buf.toString('base64');
    const result = await page.evaluate(async ({ b64, token }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const fd = new FormData();
      fd.append('photo', blob, 'test.jpg');
      try {
        const res = await fetch('/api/tier1/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (e) { return { status: 0, body: e.message }; }
    }, { b64, token: TOKEN });
    console.log('[HTTP ' + result.status + ']');
    console.log('[BODY] ' + result.body.substring(0, 500));
  }
  console.log('');
  console.log('=== DONE ===');
  await browser.close();
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
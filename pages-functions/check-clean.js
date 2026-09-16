const fs = require('fs');
// Check if generate.ts still has any probe/debug leftover
const f = 'C:/Users/yao/Documents/ChatGPT/美妆app/pages-functions/functions/api/tier3/generate.ts';
const src = fs.readFileSync(f, 'utf8');
const markers = ['PROBE', '[probe]', 'tokenDiag', 'debug: String', 'tP = Date.now', 'p1 = null', 'p2 = null', 'p3 = null', 'probe crashed'];
let found = false;
for (const m of markers) {
  if (src.includes(m)) { console.log('STILL PRESENT:', m); found = true; }
}
if (!found) console.log('generate.ts is clean — no probe/debug leftovers');

// also check index.ts
const f2 = 'C:/Users/yao/Documents/ChatGPT/美妆app/pages-functions/functions/api/admin/tier3-codes/index.ts';
const src2 = fs.readFileSync(f2, 'utf8');
for (const m of ['tokenDiag', 'temporary diagnostic', 'temporary: include']) {
  if (src2.includes(m)) { console.log('index.ts STILL PRESENT:', m); }
}
if (!src2.includes('tokenDiag')) console.log('index.ts is clean');

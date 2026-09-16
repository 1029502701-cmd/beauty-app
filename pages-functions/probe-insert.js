const fs = require('fs');
const f = 'C:/Users/yao/Documents/ChatGPT/美妆app/pages-functions/functions/api/tier3/generate.ts';
let src = fs.readFileSync(f, 'utf8');
const anchor = '  // 5. 写入 reports_tier3';
if (!src.includes(anchor)) { console.error('anchor not found'); process.exit(1); }
if (src.includes('// PROBE (temporary): reproduce the 500 steps in order')) { console.log('probe already present, skipping'); process.exit(0); }
const probe = `// PROBE (temporary): reproduce the 500 steps in order to identify which one throws
    try {
      const tP = Date.now();
      let p1 = null;
      try { p1 = await env.DB.prepare("SELECT name FROM pragma_table_info('reports_tier3') WHERE name = 'unlock_method'").all(); } catch (e) { p1 = 'ERR:' + e; }
      console.log('[probe] step1 pragma_table_info:', JSON.stringify(p1), 'in ' + (Date.now() - tP) + 'ms');
      let p2 = null;
      try { p2 = await env.DB.prepare("SELECT COUNT(*) AS cnt FROM reports_tier3 WHERE user_id = ? AND unlock_method = 'redeem_code'").bind(user.userId).first(); } catch (e) { p2 = 'ERR:' + e; }
      console.log('[probe] step2 COUNT query:', JSON.stringify(p2), 'in ' + (Date.now() - tP) + 'ms');
      let p3 = null;
      try { p3 = await env.DB.prepare("SELECT id FROM reports_tier3 WHERE user_id = ? AND unlock_method = ? ORDER BY created_at DESC LIMIT 1").bind(user.userId, 'redeem_code').first(); } catch (e) { p3 = 'ERR:' + e; }
      console.log('[probe] step3 SELECT by unlock_method:', JSON.stringify(p3), 'in ' + (Date.now() - tP) + 'ms');
    } catch (e) { console.log('[probe] probe crashed:', e); }
`;
src = src.replace(anchor, probe + '\n' + anchor);
fs.writeFileSync(f, src);
console.log('probe inserted OK');

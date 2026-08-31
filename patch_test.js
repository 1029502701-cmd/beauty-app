const fs = require('fs');
let c = fs.readFileSync('browser_test2.js', 'utf8');

// Replace cookie-based auth block with just variable assignment
c = c.replace(
  /const sessionId = loginData\.sessionId \|\| loginData\.session_id;\n  if \(sessionId\) \{\n    await context\.addCookies\(\[\{[\s\S]*?\}\]\);\n    console\.log\('  Cookie set'\);\n  \}/,
  "const sessionId = loginData.sessionId || loginData.session_id;"
);

// Replace the navigation step to inject localStorage first
c = c.replace(
  /console\.log\('\\n\[5\] Navigating to \/report\.\.\.'\);\n  await page\.goto\(BASE \+ '\/report', \{ waitUntil: 'networkidle', timeout: 20000 \}\);\n  await page\.waitForTimeout\(4000\);/,
  `console.log('\\n[5] Setting auth then navigating...');
  await page.goto(BASE + '/report', { waitUntil: 'domcontentloaded', timeout: 10000 });
  if (sessionId) { await page.evaluate((t) => localStorage.setItem('session_token', t), sessionId); console.log('  localStorage set'); }
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);`
);

fs.writeFileSync('browser_test2.js', c);
console.log('patched OK');

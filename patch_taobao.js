const fs = require('fs');
const path = 'pages-functions/functions/api/_taobao.ts';
let c = fs.readFileSync(path, 'utf8');

// Fix 1: Increase MIN_PRICE from 30 to 50
c = c.replace('const MIN_PRICE = 30;', 'const MIN_PRICE = 50;');

// Fix 2: Add sample filtering to second pass
const oldSecondPass = `  // Second pass: best-available within price range
  for (var i = 0; i < products.length; i++) {
    if (products[i].price >= MIN_PRICE && products[i].price <= MAX_PRICE) {
      console.log("[taobao] Best avail: " + products[i].title.substring(0, 40) + " (¥" + products[i].price + ")");
      return products[i];
    }
  }`;

const newSecondPass = `  // Second pass: best-available within price range, also filter samples
  for (var i = 0; i < products.length; i++) {
    if (products[i].price < MIN_PRICE || products[i].price > MAX_PRICE) continue;
    var sampleKws2 = ["小样", "试用装", "中样", "体验装", "1ml", "2ml", "3ml", "5ml", "10ml", "0.5ml", "1.5ml", "30ml*3", "3支装", "5支装", "支装", "分装"];
    if (sampleKws2.some(function(s) { return products[i].title.indexOf(s) !== -1; })) continue;
    console.log("[taobao] Best avail: " + products[i].title.substring(0, 40) + " (¥" + products[i].price + ")");
    return products[i];
  }`;

if (c.includes(oldSecondPass)) {
  c = c.replace(oldSecondPass, newSecondPass);
  console.log('Second pass patched successfully');
} else {
  console.log('Second pass pattern not found, trying alternative...');
  // Try line by line
  const lines = c.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '// Second pass: best-available within price range') {
      console.log('Found at line', i + 1);
      found = true;
      break;
    }
  }
  if (!found) console.log('Pattern not found at all');
}

fs.writeFileSync(path, c);
console.log('File written, size:', c.length);

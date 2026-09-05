const fs = require('fs');
let c = fs.readFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/CapturePhotoUpload.jsx', 'utf8');
const target = 'className={capture-step}>';
const replacement = 'className={`capture-step${i < visibleCount ? \' capture-step--visible\' : \'\'} `}>';
c = c.replace(target, replacement);
fs.writeFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/CapturePhotoUpload.jsx', c);
console.log('Done');
const lines = c.split('\r\n');
for (let i = 293; i < 300; i++) console.log(i+1, lines[i]);
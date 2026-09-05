const fs = require('fs');
const filePath = 'C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/CapturePhotoUpload.jsx';
let content = fs.readFileSync(filePath, 'utf8');
const oldStr = 'className={capture-step }>';
const newStr = String.rawclassName={capture-step}>;
if (!content.includes(oldStr)) {
  console.log('ERROR: old string not found');
  process.exit(1);
}
content = content.replace(oldStr, newStr);
fs.writeFileSync(filePath, content);
console.log('Fixed!');
const lines = content.split('\r\n');
for (let i = 293; i < 300; i++) console.log(i + 1, lines[i]);

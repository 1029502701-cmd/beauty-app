const fs = require('fs');
const p = require('path').join(process.cwd(), 'app', 'src');
const w = (rel, content) => { fs.writeFileSync(p + '/' + rel, content, 'utf8'); console.log('' + rel + ' wrote'); };
const s = String.fromCharCode(39);
const d = String.fromCharCode(34);
const n = String.fromCharCode(10);
console.log('gen loaded');

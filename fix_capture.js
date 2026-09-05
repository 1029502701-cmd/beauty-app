const fs = require('fs');
let c = fs.readFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/CapturePhotoUpload.jsx', 'utf8');
const lines = c.split('\r\n');
// Fix lines 297-303 to restore proper JSX structure
lines[296] = '            {ANALYSIS_STEPS.map((label, i) => (';
lines[297] = '              <li key={i} className={`capture-step${i < visibleCount ? '\'' capture-step--visible'\'' : '\''\''}`}>';
lines[298] = '                <span className="capture-step-check">{i < visibleCount ? '\''✓'\'' : '\''·'\''}</span>';
lines[299] = '                <span className="capture-step-label">{label}</span>';
lines[300] = '              </li>';
lines[301] = '            ))}';
lines[302] = '            {visibleCount >= ANALYSIS_STEPS.length && !apiReady && !apiError && (';
lines[303] = '              <p className="capture-pending-text">正在整理结果中...</p>';
lines[304] = '            )}';
fs.writeFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/CapturePhotoUpload.jsx', lines.join('\r\n'));
console.log('Fixed!');
for (let i = 294; i < 310; i++) console.log(i+1, JSON.stringify(lines[i]));

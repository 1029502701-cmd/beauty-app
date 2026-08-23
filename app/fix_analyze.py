import os

p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\tier1\analyze.ts'
with open(p, 'r', encoding='utf8') as f:
    c = f.read()

bt = chr(96)  # backtick

# Fix line 24: replace literal  with template literal
old24 = "console.error('[tier1/analyze] DeepSeek API error \: ' + errBody.slice(0,200));"
new24 = 'console.error(' + bt + '[tier1/analyze] DeepSeek API error : ' + bt + ');'
c = c.replace(old24, new24)

# Fix line 71: add semicolon after template literal
old71 = 'const photoBase64 = ' + bt + 'data:;base64,' + bt
new71 = 'const photoBase64 = ' + bt + 'data:;base64,' + bt + ';'
c = c.replace(old71, new71)

with open(p, 'w', encoding='utf8') as f:
    f.write(c)

lines = c.split('\n')
print('Line 24:', lines[23][:140])
print('Line 71:', lines[70][:90])
print('Line 71 has ;:', lines[70].strip().endswith(';'))
print('Line 24 has BT:', chr(96) in lines[23])

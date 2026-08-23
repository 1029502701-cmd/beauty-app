path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Capture.jsx'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

# Fix the Authorization header line
content = content.replace(
    'headers: { Authorization: Bearer  },',
    'headers: { Authorization: \Bearer \ },'
)

# Fix the error throw line
content = content.replace(
    'if (!res.ok) throw new Error(请求失败: );',
    'if (!res.ok) throw new Error(\请求失败: \);'
)

with open(path, 'w', encoding='utf8') as f:
    f.write(content)

with open(path, 'r', encoding='utf8') as f:
    check = f.read()
print('Has Bearer token:', '' in check)
print('Has requestError:', '请求失败' in check)
print('Length:', len(check))

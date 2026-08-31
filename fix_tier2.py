import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Tier2Result.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
old = r'style={{ width: \% }}'
new = "style={{ width: `${((duration - remain) / duration) * 100}%` }}"
if old in content:
    content = content.replace(old, new)
    print('Fixed template literal')
else:
    print('Pattern not found, trying alternative')
    # Show what's actually there
    import re
    m = re.search(r'width: .+?% \}', content)
    if m:
        print(repr(m.group()))
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')

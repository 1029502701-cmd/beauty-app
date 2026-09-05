import os
home_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Home.jsx'
with open(home_path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace("path: '/capture'", "path: '/report'")
with open(home_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Home.jsx fixed')

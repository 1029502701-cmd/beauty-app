path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_fetch = 'var resp = await fetch("/_curated-products.json");'
new_fetch = 'var resp = await fetch("http://127.0.0.1:8788/_curated-products.json");'
content = content.replace(old_fetch, new_fetch)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed fetch URL")

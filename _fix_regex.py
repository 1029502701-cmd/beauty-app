path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_utils.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace(".replace(/\\\\+/g,", ".replace(/\\+/g,")
content = content.replace(".replace(/\\\\//g,", ".replace(/\\//g,")
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed")

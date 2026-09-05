path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\CapturePhotoUpload.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old = '    throw new Error(err.message || err.error || `请求失败: ${res.status}`);\n  }\n  return res.json();'
new = """    if (res.status === 429 && err.error === 'daily_limit_exceeded') {
      throw new Error(err.message || '今日初识次数已用完，明天再来吧');
    }
    throw new Error(err.message || err.error || '请求失败: ' + res.status);
  }
  return res.json();"""
content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
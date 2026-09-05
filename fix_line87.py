import sys

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\CapturePhotoUpload.jsx"
with open(path, "rb") as f:
    content = f.read()

old = b"throw new Error(err.message || err.error || \xe8\xaf\xb7\xe6\xb1\x82\xe5\xa4\xb1\xe8\xb4\xa5: \\);"
new = b"throw new Error(err.message || err.error || \"\xe8\xaf\xb7\xe6\xb1\x82\xe5\xa4\xb1\xe8\xb4\xa5: \" + res.status);"
content = content.replace(old, new)

with open(path, "wb") as f:
    f.write(content)
print("done")
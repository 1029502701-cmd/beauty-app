import sys

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\CapturePhotoUpload.jsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

target_line = None
for i, line in enumerate(lines):
    if "请求失败" in line and "res.status" in line:
        target_line = i
        break

if target_line is not None:
    indent = lines[target_line][:len(lines[target_line]) - len(lines[target_line].lstrip())]
    new_lines = [
        indent + "if (res.status === 429 && err.error === 'daily_limit_exceeded') {\n",
        indent + "  throw new Error(err.message || '今日初识次数已用完，明天再来吧');\n",
        indent + "}\n",
        lines[target_line],
    ]
    lines[target_line:target_line+1] = new_lines

with open(path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("done")
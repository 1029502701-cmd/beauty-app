path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\CapturePhotoUpload.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove the duplicate 429 block (keep only the first one)
marker = """    if (res.status === 429 && err.error === 'daily_limit_exceeded') {
      throw new Error(err.message || '今日初识次数已用完，明天再来吧');
    }
"""
# Find all occurrences and remove duplicates
parts = content.split(marker)
# parts[0] is before first match, parts[1] is between first and second, parts[2] is after second
if len(parts) == 3:
    # Keep first occurrence, remove the duplicate
    content = parts[0] + marker + parts[2]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
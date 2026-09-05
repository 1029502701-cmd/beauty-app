import re
with open("app/src/pages/CapturePhotoUpload.jsx", "r", encoding="utf-8") as f:
    content = f.read()
old = "{!compact && <button className=\"capture-view-report-btn\" onClick={() => onComplete?.(reportId, reportData, preview)}>查看详情</button>}"
new = "<button className=\"capture-view-report-btn\" onClick={() => onComplete?.(reportId, reportData, preview)}>查看详情</button>"
if old in content:
    content = content.replace(old, new)
    with open("app/src/pages/CapturePhotoUpload.jsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("FIXED")
else:
    print("NOT FOUND")

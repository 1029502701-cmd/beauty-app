path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix: use correct R2 key format with userId from token
old_line = "    setPreview('/api/r2-proxy?key=face-photos/' + reportId + '.jpg&bucket=temp');"
new_line = """    // Extract userId from JWT token to build correct R2 key
    try {
      const token = localStorage.getItem('session_token');
      const userId = token ? JSON.parse(window.atob(token.split('.')[1])).user_id : null;
      if (userId) {
        setPreview('/api/r2-proxy?key=face-photos/' + encodeURIComponent(userId) + '/' + encodeURIComponent(reportId) + '.jpg&bucket=temp');
      }
    } catch {}"""

if old_line in content:
    content = content.replace(old_line, new_line, 1)
    print("Fix applied: R2 key now includes userId")
else:
    print("ERROR: old line not found, trying alternate pattern")
    # Try finding the effect block and replacing it
    old_block = """  // Restore photo preview from R2 when tier1 report is loaded
  useEffect(() => {
    if (!reportId) return;
    setPreview('/api/r2-proxy?key=face-photos/' + reportId + '.jpg&bucket=temp');
  }, [reportId]);"""
    new_block = """  // Restore photo preview from R2 when tier1 report is loaded
  useEffect(() => {
    if (!reportId) return;
    try {
      const token = localStorage.getItem('session_token');
      const userId = token ? JSON.parse(window.atob(token.split('.')[1])).user_id : null;
      if (userId) {
        setPreview('/api/r2-proxy?key=face-photos/' + encodeURIComponent(userId) + '/' + encodeURIComponent(reportId) + '.jpg&bucket=temp');
      }
    } catch {}
  }, [reportId]);"""
    if old_block in content:
        content = content.replace(old_block, new_block, 1)
        print("Fix applied (block mode)")
    else:
        print("ERROR: block pattern not found either")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
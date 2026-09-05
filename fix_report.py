import re

path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add photo preview effect after the existing tier1 loading effect
old_block = """  // Load tier1 report from sessionStorage (set by Capture.jsx after analysis)
  useEffect(() => {
    if (!reportId) return;
    const stored = sessionStorage.getItem('capture_report_' + reportId);
    if (stored) { try { setTier1Report(JSON.parse(stored)); } catch {} }
  }, [reportId]);"""

new_block = """  // Load tier1 report from sessionStorage (set by Capture.jsx after analysis)
  useEffect(() => {
    if (!reportId) return;
    const stored = sessionStorage.getItem('capture_report_' + reportId);
    if (stored) { try { setTier1Report(JSON.parse(stored)); } catch {} }
  }, [reportId]);

  // Restore photo preview from facePhotoKey stored in the tier1 report data
  useEffect(() => {
    if (!tier1Report || !tier1Report.facePhotoKey) return;
    setPreview('/api/r2-proxy?key=' + encodeURIComponent(tier1Report.facePhotoKey) + '&bucket=temp');
  }, [tier1Report]);"""

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print('Fix 1 applied: photo preview effect added')
else:
    print('ERROR: Fix 1 pattern not found')

# Fix 2: Replace window.location.href with SPA navigation
old_line = '                    window.location.href = "/capture";'
new_lines = """                    window.history.pushState({}, '', '/capture');
                    window.dispatchEvent(new PopStateEvent('popstate'));"""

if old_line in content:
    content = content.replace(old_line, new_lines, 1)
    print('Fix 2 applied: archive reupload nav fixed')
else:
    print('ERROR: Fix 2 pattern not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add debug log to the effect
old = """  // Load tier1 report from sessionStorage (set by Capture.jsx after analysis)
  useEffect(() => {
    if (!reportId) return;
    const stored = sessionStorage.getItem('capture_report_' + reportId);
    if (stored) {
      try { setTier1Report(JSON.parse(stored)); } catch {}
    }
  }, [reportId]);"""

new = """  // Load tier1 report from sessionStorage (set by Capture.jsx after analysis)
  useEffect(() => {
    console.log('[REPORT DEBUG] reportId=', reportId, 'storedReportId=', sessionStorage.getItem('capture_report_id'));
    if (!reportId) return;
    const stored = sessionStorage.getItem('capture_report_' + reportId);
    console.log('[REPORT DEBUG] stored data exists:', !!stored);
    if (stored) {
      try { setTier1Report(JSON.parse(stored)); console.log('[REPORT DEBUG] tier1Report set'); } catch(e) { console.error('[REPORT DEBUG] parse error:', e); }
    }
  }, [reportId]);"""

content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("done")
path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Home.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove the pre-fetch useEffect and tier1ReportId state, simplify click handler
old_block = """  const [tier1ReportId, setTier1ReportId] = useState(null);

  // Pre-fetch tier1 report on Home load so click is instant
  useEffect(() => {
    if (!token) return;
    const storedId = sessionStorage.getItem('capture_report_id');
    if (storedId) { setTier1ReportId(storedId); return; }
    fetch(BASE + '/reports/mine', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const id = data?.tier1Report?.id;
        if (id) {
          sessionStorage.setItem('capture_report_id', id);
          setTier1ReportId(id);
        }
      })
      .catch(() => {});
  }, [token]);

  const handleAiBeautyClick = () => {
    const id = tier1ReportId || sessionStorage.getItem('capture_report_id');
    if (id) {
      navigate('/report?id=' + encodeURIComponent(id));
    } else {
      navigate('/report');
    }
  };"""

new_block = """  const handleAiBeautyClick = () => {
    const id = sessionStorage.getItem('capture_report_id');
    if (id) {
      navigate('/report?id=' + encodeURIComponent(id));
    } else {
      navigate('/report');
    }
  };"""

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print("Fix applied: removed async pre-fetch, using sessionStorage directly")
else:
    print("Pattern not found, trying alternate")
    # Check what's actually there
    import re
    if "tier1ReportId" in content:
        # Remove the state and effect, simplify click
        content = re.sub(r'  const \[tier1ReportId, setTier1ReportId\] = useState\(null\);\n\n', '', content)
        content = re.sub(r'  // Pre-fetch tier1 report on Home load so click is instant\n  useEffect\(\(\) => \{\n    if \(!token\) return;\n    const storedId = sessionStorage\.getItem\(\'capture_report_id\'\);\n    if \(storedId\) \{ setTier1ReportId\(storedId\); return; \}\n    fetch\(BASE \+ \'/reports/mine\'[^)]+\)\n      \.catch\(\(\) => \{\}\);\n  \}, \[token\]\);\n\n', '', content)
        content = content.replace(
            "const id = tier1ReportId || sessionStorage.getItem('capture_report_id');",
            "const id = sessionStorage.getItem('capture_report_id');"
        )
        print("Fix applied via regex")
    else:
        print("tier1ReportId not found in file")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: Add photo restoration effect after the preview state declaration
old_preview = "  const [preview, setPreview] = useState(state.preview || sessionStorage.getItem('capture_preview') || null);"
new_preview = """  const [preview, setPreview] = useState(state.preview || sessionStorage.getItem('capture_preview') || null);

  // Restore photo preview from R2 when tier1 report is loaded (key format: face-photos/{userId}/{reportId}.jpg)
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

if old_preview in content and "Restore photo preview" not in content:
    content = content.replace(old_preview, new_preview, 1)
    print("Fix 1 applied: photo restoration effect added")
else:
    print("Fix 1: already applied or pattern not found")

# Fix 2: Simplify 进阶 tab to only show unlock options
old_jiejie_start = "        {/* 进阶 */}"
old_jiejie_end = "        )}\n\n        {/* 专属 */}"

start_idx = content.find(old_jiejie_start)
end_idx = content.find(old_jiejie_end)

if start_idx != -1 and end_idx != -1:
    # Find the matching closing brace for the ternary
    # The 进阶 block ends with the JSX conditional expression closing
    search_from = start_idx
    depth = 0
    end_pos = -1
    for k in range(search_from, len(content)):
        if content[k] == "{":
            depth += 1
        elif content[k] == "}":
            depth -= 1
            if depth == 0:
                end_pos = k + 1
                break
    
    if end_pos != -1 and end_pos < end_idx:
        new_jiejie = '''        {/* 进阶 */}
        {activeTab === '进阶' && (
          <div className="report-tab-content">
            {!reportId ? <div className="report-loading">加载中...</div>
            : !tier2Status ? <div className="report-loading">加载中...</div>
            : tier2Generation?.generationStatus === 'processing' || tier2Processing ? (
              <div className="report-loading"><div className="report-loading-spinner" /><p>AI 正在生成进阶报告，请稍候…</p></div>
            ) : (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">🔒</div>
                <p className="report-unlock-text">选择方式解锁进阶报告</p>
                <div className="report-unlock-options">
                  <button
                    className="report-unlock-btn"
                    onClick={handleShareReport}
                    disabled={shareLoading || !reportId}
                  >
                    {shareLoading ? '生成分享中…' : '分享解锁'}
                  </button>
                  <button
                    className="report-unlock-btn-alt"
                    onClick={handleAdFinishForTier2}
                    disabled={adUnlockLoading || !reportId}
                  >
                    {adUnlockLoading ? '解锁中…' : '看广告解锁'}
                  </button>
                </div>
                <p className="report-unlock-hint">分享邀请好友完成分析，或观看5秒广告即可解锁</p>
                {shareDailyLimitExceeded && (
                  <p className="report-daily-limit-text">今日进阶报告次数已用完，明天再来吧</p>
                )}
              </div>
            )}
          </div>
        )}

'''
        content = content[:start_idx] + new_jiejie + content[end_pos:]
        print("Fix 2 applied: 进阶 tab simplified")
    else:
        print(f"ERROR: could not find end of 进阶 block (start={start_idx}, end_search={end_idx}, found_end={end_pos})")
else:
    print(f"ERROR: could not find 进阶 markers (start={start_idx}, end={end_idx})")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
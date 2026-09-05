path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the 进阶 tab block and replace it
result = []
i = 0
while i < len(lines):
    line = lines[i]
    # Check if this is the start of the 进阶 tab
    if "activeTab === '进阶'" in line and "{(activeTab === '进阶')" in "".join(lines[max(0,i-2):i+1]):
        # Found start, now find the end of this block
        # Collect until we find the closing }) for this tab
        block_start = i
        brace_count = 0
        j = i
        while j < len(lines):
            for ch in lines[j]:
                if ch == "{":
                    brace_count += 1
                elif ch == "}":
                    brace_count -= 1
            if brace_count <= 0 and j > i:
                # Check if this line closes the JSX expression
                if ")}" in lines[j] or lines[j].strip() == "}":
                    # This might be the end
                    pass
            j += 1
        break
    result.append(line)
    i += 1

# Alternative: use string replacement
content = "".join(lines)

# Find and replace the 进阶 section
old_jiejie_start = "activeTab === '进阶'"
old_jiejie_end = "          </div>\n        )}"

# Find the section
idx_start = content.find(old_jiejie_start)
if idx_start == -1:
    print("ERROR: 进阶 tab not found")
else:
    # Find the matching closing - look for the pattern after the old block
    # We need to find the end of the 进阶 tab conditional
    search_from = idx_start
    depth = 0
    end_idx = -1
    for k in range(search_from, len(content)):
        if content[k] == "{":
            depth += 1
        elif content[k] == "}":
            depth -= 1
            if depth == 0:
                end_idx = k + 1
                break
    
    if end_idx == -1:
        print("ERROR: Could not find end of 进阶 tab")
    else:
        new_jiejie = '''activeTab === '进阶' && (
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
        )}'''
        content = content[:idx_start] + new_jiejie + content[end_idx:]
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print("ReportPage.jsx updated: 进阶 tab now only shows unlock options")
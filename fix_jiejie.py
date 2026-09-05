path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the 进阶 tab section boundaries
start_marker = "        {/* 进阶 */}"
end_marker = "        )}\n\n        {/* 专属 */}"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print("ERROR: start marker not found")
elif end_idx == -1:
    print("ERROR: end marker not found")
else:
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
    content = content[:start_idx] + new_jiejie + content[end_idx + len(end_marker):]
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("ReportPage.jsx updated successfully")
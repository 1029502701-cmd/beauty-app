import re

with open('app/src/pages/ReportPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state variables
old = "  const [tier3LoadError, setTier3LoadError] = useState(null);\n  const [tier3CurrentQuestionIndex]"
new = "  const [tier3LoadError, setTier3LoadError] = useState(null);\n  const [tier3PreviewText, setTier3PreviewText] = useState('');\n  const [tier3PreviewLoading, setTier3PreviewLoading] = useState(true);\n  const [tier3CurrentQuestionIndex]"
content = content.replace(old, new)

# 2. Update useEffect to fetch preview text
old = """          if (optionsRes.ok) {
            const optionsData = await optionsRes.json();
            setTier3QuestionnaireOptions(optionsData.options || {});
          }
        }
      } catch { if (!cancelled) setTier3LoadError('加载失败'); }"""
new = """          if (optionsRes.ok) {
            const optionsData = await optionsRes.json();
            setTier3QuestionnaireOptions(optionsData.options || {});
          }
          const previewRes = await fetch(BASE + '/config/tier3_preview_text');
          if (previewRes.ok) {
            const previewData = await previewRes.json();
            setTier3PreviewText(previewData.value || '');
          }
        }
      } catch { if (!cancelled) setTier3LoadError('加载失败'); }"""
content = content.replace(old, new)

# 3. Remove amount from handleTier3Buy
old = "body: JSON.stringify({ amount: 600, channel: 'mock', purpose: 'token_purchase' }),"
new = "body: JSON.stringify({ channel: 'mock', purpose: 'token_purchase' }),"
content = content.replace(old, new)

# 4. Replace no-token JSX
old = """            ) : !tier3TokenStatus.hasToken ? (
              <div className="report-unlock-prompt">
                <div className="report-exclusive-icon">🔐</div>
                <p className="report-exclusive-text">专属深度分析报告</p>
                <p className="report-exclusive-hint">结合你的面部特征与个人偏好，AI 生成专属化妆方案</p>
                <button className="report-unlock-btn" onClick={handleTier3Buy}>💎 购买 token 解锁</button>
                <p className="report-unlock-hint">购买后可用于生成一次专属报告</p>
                <div className="report-redeem-section">
                  <p className="report-redeem-hint">已有兑换码？在此输入：</p>
                  <div className="report-redeem-input-row">
                    <input
                      className="report-redeem-input"
                      type="text"
                      placeholder="请输入10位兑换码"
                      value={tier3RedeemCode}
                      onChange={(e) => setTier3RedeemCode(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                    <button
                      className="report-redeem-btn"
                      onClick={handleTier3Redeem}
                      disabled={tier3Redeeming || !tier3RedeemCode.trim()}
                    >{tier3Redeeming ? '兑换中...' : '兑换'}</button>
                  </div>
                  {tier3Error && <p className="report-redeem-error">{tier3Error}</p>}
                </div>
              </div>"""
new = """            ) : !tier3TokenStatus.hasToken ? (
              <div className="report-unlock-prompt">
                <div className="report-exclusive-icon">🔐</div>
                <p className="report-exclusive-text">专属深度分析报告</p>
                {tier3PreviewLoading ? (
                  <p className="report-exclusive-hint">加载中...</p>
                ) : tier3PreviewText ? (
                  <div className="report-preview-section">
                    <p className="report-preview-label">专属报告包含</p>
                    <div className="report-preview-content" dangerouslySetInnerHTML={{ __html: tier3PreviewText }} />
                  </div>
                ) : null}
                <div className="report-btn-row">
                  <button className="report-buy-btn" onClick={handleTier3Buy}>购买</button>
                  <button className="report-unlock-btn-alt" onClick={handleTier3Redeem} disabled={tier3Redeeming || !tier3RedeemCode.trim()}>
                    {tier3Redeeming ? '兑换中...' : '解锁'}
                  </button>
                </div>
                <div className="report-redeem-section">
                  <p className="report-redeem-hint">已有兑换码？在此输入：</p>
                  <input
                    className="report-redeem-input-inline"
                    type="text"
                    placeholder="请输入10位兑换码"
                    value={tier3RedeemCode}
                    onChange={(e) => setTier3RedeemCode(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  {tier3Error && <p className="report-redeem-error">{tier3Error}</p>}
                </div>
              </div>"""
content = content.replace(old, new)

with open('app/src/pages/ReportPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('ReportPage.jsx updated successfully')

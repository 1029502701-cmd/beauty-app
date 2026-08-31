import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace old inline UI block with Tier2Result + unlock image section
old_block = """              <>
                <div className="report-section">
                  <h2 className="report-section-title">核心建议</h2>
                  <div className="report-core-card"><p className="report-core-text">{t2.coreMakeup || '暂无内容'}</p></div>
                </div>
                <div className="report-section">
                  <h2 className="report-section-title">风格定位</h2>
                  <span className="report-style-badge">{STYLE_EMOJIS[0]} {t2.style || '清新自然'}</span>
                  {t2.reason && <p className="report-reason">{t2.reason}</p>}
                </div>
                <div className="report-section">
                  <h2 className="report-section-title">关键部位建议</h2>
                  <div className="report-key-areas">
                    {Array.isArray(t2.keyAreas) && t2.keyAreas.map((area, i) => (
                      <div key={i} className="report-area-item">
                        <span className="report-area-num">{i + 1}</span>
                        <p className="report-area-text">{area}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {t2.productRecs && typeof t2.productRecs === 'object' && Object.keys(t2.productRecs).length > 0 && (
                  <div className="report-section">
                    <h2 className="report-section-title">推荐产品</h2>
                    {dimOrder.map((dim) => {
                      const recs = t2.productRecs[dim];
                      if (!recs || !Array.isArray(recs) || recs.length === 0) return null;
                      const isExpanded = expandedDims[dim];
                      return (
                        <div key={dim} className="report-dim-recs">
                          <button className="report-dim-header" onClick={() => toggleDim(dim)}>
                            <span className="report-dim-label">{dimLabels[dim] || dim}</span>
                            <span className="report-dim-arrow">{isExpanded ? '▲' : '▼'}</span>
                          </button>
                          {isExpanded && (
                            <div className="report-dim-products">
                              {recs.slice(0, 2).map((rec, i) => {
                                const hasMedia = rec.imageUrl || rec.price;
                                return (
                                  <a
                                    key={i}
                                    href={rec.itemUrl || undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={"report-product-card" + (hasMedia ? " report-product-card--rich" : "")}
                                    onClick={(e) => { if (!rec.itemUrl) e.preventDefault(); }}
                                  >
                                    {hasMedia && rec.imageUrl ? (
                                      <img
                                        src={rec.imageUrl}
                                        alt={rec.name || ""}
                                        className="report-product-img"
                                        referrerPolicy="no-referrer"
                                        loading="lazy"
                                        onError={(e) => { e.target.style.display = "none"; }}
                                      />
                                    ) : null}
                                    <div className="report-product-info">
                                      <span className="report-product-name">{rec.name || rec}</span>
                                      {rec.price ? (
                                        <span className="report-product-price">¥{rec.price}</span>
                                      ) : null}
                                      {rec.brandName ? (
                                        <span className="report-product-brand">{rec.brandName}</span>
                                      ) : null}
                                      <span className="report-product-desc">{rec.desc || ""}</span>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {t2.formula && (
                  <div className="report-section">
                    <h2 className="report-section-title">完整妆效配方</h2>
                    <div className="report-formula-card"><p className="report-formula-text">{t2.formula}</p></div>
                  </div>
                )}"""

new_block = """              <Tier2Result content={t2} isMock={!tier2Content} btnStyle={{background:'#db2777'}} onUnlockImage={handleAdFinish} />"""

if old_block in content:
    content = content.replace(old_block, new_block)
    print('Old inline UI replaced successfully')
else:
    print('ERROR: Could not find old block!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')

import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove MOCK_INFLUENCERS usage + 达人推荐 section
old_influencer_block = '''                <div className="report-section">
                  <h2 className="report-section-title">达人推荐</h2>
                  <div className="report-influencers">
                    {MOCK_INFLUENCERS.map((inf) => (
                      <div key={inf.id} className="report-influencer-card">
                        <div className="report-influencer-avatar">
                          <div style={{ width: '48px', aspectRatio: '3/4', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', lineHeight: 1 }}>
                            <img src={inf.avatar_url} alt={inf.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: '8px', background: '#f3f4f6' }} onError={(e) => { e.target.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                            <span style={{ display: 'none', fontSize: '20px' }}>{inf.avatar}</span>
                          </div>
                        </div>
                        <div className="report-influencer-info">
                          <span className="report-influencer-name">{inf.name}</span>
                          <span className="report-influencer-fans">{inf.fans}粉丝</span>
                          <span className="report-influencer-style">{inf.style}</span>
                        </div>
                        <p className="report-influencer-desc">{inf.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>'''

if old_influencer_block in content:
    content = content.replace(old_influencer_block, '')
    print('达人推荐 section removed')
else:
    print('ERROR: Could not find 达人推荐 block!')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')

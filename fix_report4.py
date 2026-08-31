import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Wrap Tier2Result + unlock image section in a fragment
old = '''              <Tier2Result content={t2} isMock={!tier2Content} btnStyle={{background:'#db2777'}} onUnlockImage={handleAdFinish} />
                <div className="report-section">
                  <h2 className="report-section-title">AI 妆效效果图</h2>'''
new = '''              <>
                <Tier2Result content={t2} isMock={!tier2Content} btnStyle={{background:'#db2777'}} onUnlockImage={handleAdFinish} />
                <div className="report-section">
                  <h2 className="report-section-title">AI 妆效效果图</h2>'''

if old in content:
    content = content.replace(old, new)
    print('Added opening <>')
else:
    print('ERROR: Could not find pattern!')

# Also need to close the fragment before the closing </>
old2 = '''                </div>

              </>
            )}'''
new2 = '''                </div>
              </>
            )}'''

if old2 in content:
    # Find the one that follows the unlock image section (not the Tier3 one)
    idx = content.find(old2)
    if idx > 0:
        content = content[:idx] + new2 + content[idx+len(old2):]
        print('Added closing </>')
    else:
        print('ERROR: Could not find closing pattern!')
else:
    print('ERROR: Closing pattern not found!')
    # Debug - find similar patterns
    import re
    for m in re.finditer(r'</div>\s*\n\s*</>', content):
        print(f'Found </div></> at pos {m.start()}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')

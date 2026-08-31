import re

# Patch ReportPage.jsx
path1 = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx"
with open(path1, "r", encoding="utf-8") as f:
    content = f.read()

old_card = """                              {recs.slice(0, 2).map((rec, i) => (
                                <div key={i} className="report-product-card">
                                  <span className="report-product-name">{rec.name || rec}</span>
                                  <span className="report-product-desc">{rec.desc || ''}</span>
                                </div>
                              ))}"""

new_card = """                              {recs.slice(0, 2).map((rec, i) => {
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
                                        <span className="report-product-price">\u00a5{rec.price}</span>
                                      ) : null}
                                      {rec.brandName ? (
                                        <span className="report-product-brand">{rec.brandName}</span>
                                      ) : null}
                                      <span className="report-product-desc">{rec.desc || ""}</span>
                                    </div>
                                  </a>
                                );
                              })}"""

if old_card in content:
    content = content.replace(old_card, new_card)
    print("Patched ReportPage.jsx - product cards")
else:
    print("WARNING: Could not find old product card pattern in ReportPage.jsx")
    # Try to find similar pattern
    idx = content.find("report-product-card")
    if idx >= 0:
        print(f"  Found at index {idx}, context: ...{content[max(0,idx-50):idx+200]}...")

with open(path1, "w", encoding="utf-8") as f:
    f.write(content)

# Patch index.css
path2 = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\index.css"
with open(path2, "r", encoding="utf-8") as f:
    css = f.read()

old_css = """.report-product-card {
  padding: 10px 12px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
}
.report-product-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h);
  margin-bottom: 2px;
}
.report-product-desc {
  display: block;
  font-size: 12px;
  color: var(--text);
  line-height: 1.4;
}"""

new_css = """.report-product-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow .2s, transform .15s;
  overflow: hidden;
}
.report-product-card:hover {
  box-shadow: var(--shadow);
  transform: translateY(-1px);
}
.report-product-card--rich {
  cursor: pointer;
}
.report-product-img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  flex-shrink: 0;
  background: #f5f5f5;
}
.report-product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.report-product-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-h);
  margin-bottom: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.report-product-price {
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  color: #e91e63;
}
.report-product-brand {
  display: inline-block;
  font-size: 11px;
  color: var(--text-mute);
  background: var(--border);
  border-radius: 3px;
  padding: 0 4px;
  margin-left: 4px;
}
.report-product-desc {
  display: block;
  font-size: 11px;
  color: var(--text);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}"""

if old_css in css:
    css = css.replace(old_css, new_css)
    print("Patched index.css - product card styles")
else:
    print("WARNING: Could not find old CSS pattern")
    # Show what we have around report-product-card
    idx = css.find(".report-product-card")
    if idx >= 0:
        print(f"  Found at index {idx}:")
        print(css[idx:idx+300])

with open(path2, "w", encoding="utf-8") as f:
    f.write(css)

print("Done!")

import re

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add 睫毛膏 to CATEGORY_PRICE_RANGES
content = content.replace(
    '  "安瓶": [50, 350], "肌底液": [50, 350],\n};',
    '  "安瓶": [50, 350], "肌底液": [50, 350],\n  "睫毛膏": [20, 150], "睫毛": [20, 150],\n};'
)

# 2. Enhance detectCategory with English keyword fallback
old_detect = """export function detectCategory(productName: string): string | null {
  if (!productName) return null;
  var name = productName.trim();
  for (var cat of Object.keys(CATEGORY_PRICE_RANGES)) {
    if (name.includes(cat)) return cat;
  }
  return null;
}"""

new_detect = """export function detectCategory(productName: string): string | null {
  if (!productName) return null;
  var name = productName.trim();
  for (var cat of Object.keys(CATEGORY_PRICE_RANGES)) {
    if (name.includes(cat)) return cat;
  }
  var nameLower = name.toLowerCase();
  var enKeywordMap: Record<string, string> = {
    "contour": "修容", "contouring": "修容", "bronzer": "修容",
    "blush": "腮红",
    "eyeshadow": "眼影", "shadow palette": "眼影盘",
    "highlight": "高光", "highlighter": "高光",
    "brow": "眉笔", "eyebrow": "眉笔", "brow pencil": "眉笔", "brow powder": "眉粉", "brow gel": "眉毛膏",
    "eyeliner": "眼线", "liner": "眼线",
    "mascara": "睫毛膏", "lash": "睫毛膏",
    "foundation": "粉底液", "base": "粉底液",
    "primer": "妆前乳", "setting spray": "定妆", "settingpowder": "散粉", "powder": "散粉",
    "concealer": "遮瑕",
    "serum": "精华", "moisturizer": "面霜", "cream": "面霜", "lotion": "乳液",
    "cleanser": "洁面", "face wash": "洁面",
    "sunscreen": "防晒", "spf": "防晒",
    "lip": "口红", "lipstick": "口红", "lip gloss": "唇釉",
    "eye cream": "眼霜", "eye serum": "眼部精华",
  };
  for (var enKey of Object.keys(enKeywordMap)) {
    if (nameLower.includes(enKey.toLowerCase())) {
      return enKeywordMap[enKey];
    }
  }
  return null;
}"""

content = content.replace(old_detect, new_detect)

# 3. Enhance findCuratedProduct with English tag/keyword matching
old_curated = """export async function findCuratedProduct(productName, env) {
  var name = productName.trim().toLowerCase();
  var products = await loadCuratedProducts();
  for (var i = 0; i < products.length; i++) {
    var cp = products[i];
    var tagMatch = cp.tags && cp.tags.some(function(t) { return name.includes(t.toLowerCase()); });
    var kwMatch = cp.keywords && cp.keywords.some(function(k) { return name.includes(k.toLowerCase()) || k.toLowerCase().includes(name); });
    if (tagMatch || kwMatch) {
      console.log("[curated] Matched: " + cp.name + " for " + productName);
      return cp;
    }
  }
  return null;
}"""

new_curated = """export async function findCuratedProduct(productName, env) {
  var name = productName.trim().toLowerCase();
  var products = await loadCuratedProducts();
  for (var i = 0; i < products.length; i++) {
    var cp = products[i];
    var tagMatch = cp.tags && cp.tags.some(function(t) { return name.includes(t.toLowerCase()); });
    var kwMatch = cp.keywords && cp.keywords.some(function(k) { return name.includes(k.toLowerCase()) || k.toLowerCase().includes(name); });
    if (tagMatch || kwMatch) {
      console.log("[curated] Matched: " + cp.name + " for " + productName);
      return cp;
    }
    var enTagMatch = cp.tags && cp.tags.some(function(t) {
      var tLower = t.toLowerCase();
      return tLower !== t && name.includes(tLower);
    });
    var enKwMatch = cp.keywords && cp.keywords.some(function(k) {
      var kLower = k.toLowerCase();
      return kLower !== k && (name.includes(kLower) || kLower.includes(name));
    });
    if (enTagMatch || enKwMatch) {
      console.log("[curated] EN Matched: " + cp.name + " for " + productName);
      return cp;
    }
  }
  return null;
}"""

content = content.replace(old_curated, new_curated)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched _taobao.ts successfully")

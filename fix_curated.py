path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Update findCuratedProduct to also match on semantic category hints
old_curated = '''export async function findCuratedProduct(productName, env) {
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
}'''

new_curated = '''export async function findCuratedProduct(productName, env) {
  var name = productName.trim().toLowerCase();
  var products = await loadCuratedProducts();
  // Semantic category hints: map product name patterns to curated product categories
  var semanticHints = {
    "primer": ["隔离", "妆前乳", "primer"],
    "foundation": ["粉底", "foundation"],
    "moisturiz": ["保湿", "面霜", "精华", "moisturizer", "cream", "serum"],
    "serum": ["精华", "serum", "肌底液"],
    "eyeshadow": ["眼影", "eyeshadow"],
    "mascara": ["睫毛膏", "mascara"],
    "eyeliner": ["眼线", "eyeliner"],
    "brow": ["眉笔", "眉毛", "brow"],
    "blush": ["腮红", "blush"],
    "concealer": ["遮瑕", "concealer"],
    "powder": ["散粉", "定妆", "powder"],
    "lip": ["口红", "唇釉", "lip"],
    "sunscreen": ["防晒", "sunscreen"],
    "cleanser": ["洁面", "cleanser"],
  };
  for (var i = 0; i < products.length; i++) {
    var cp = products[i];
    var tagMatch = cp.tags && cp.tags.some(function(t) { return name.includes(t.toLowerCase()); });
    var kwMatch = cp.keywords && cp.keywords.some(function(k) { return name.includes(k.toLowerCase()) || k.toLowerCase().includes(name); });
    if (tagMatch || kwMatch) {
      console.log("[curated] Matched: " + cp.name + " for " + productName);
      return cp;
    }
    // Semantic hint matching: if product name matches a hint category, try matching curated tags
    for (var hintKey of Object.keys(semanticHints)) {
      if (name.includes(hintKey)) {
        var hints = semanticHints[hintKey];
        var hintMatch = cp.tags && cp.tags.some(function(t) { return hints.some(function(h) { return t.toLowerCase() === h.toLowerCase(); }); });
        if (hintMatch) {
          console.log("[curated] Semantic Matched: " + cp.name + " for " + productName + " (hint=" + hintKey + ")");
          return cp;
        }
      }
    }
  }
  return null;
}'''

content = content.replace(old_curated, new_curated)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated findCuratedProduct with semantic matching")

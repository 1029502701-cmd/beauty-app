path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_func = """export async function findProductByKeyword(productName: string, env: Ctx['env']): Promise<TaobaoProduct | null> {
  if (!productName || productName.trim().length < 2) return null;
  var products = await searchTaobaoProducts(productName.trim(), env, 10);
  if (products.length === 0) return null;
  var name = productName.trim();
  var matched = products.find(function(p) { return p.title.includes(name) || name.includes(p.title.substring(0, 4)); });
  if (!matched) return products[0];
  // Filter out samples/cheap goods: skip if price < MIN_PRICE or title contains 小样/试用装/中样
  if (matched.price < MIN_PRICE) {
    console.log('[taobao] Price filter skipped: ' + matched.title + ' (\\u00a5' + matched.price + ')');
    return null;
  }
  var sampleKeywords = ['小样', '试用装', '中样', '体验装', '10ml', '5ml', '3ml'];
  for (var i = 0; i < sampleKeywords.length; i++) {
    if (matched.title.indexOf(sampleKeywords[i]) !== -1) {
      console.log('[taobao] Sample filter skipped: ' + matched.title);
      return null;
    }
  }
  return matched;
}"""

new_func = """export async function findProductByKeyword(productName: string, env: Ctx['env']): Promise<TaobaoProduct | null> {
  if (!productName || productName.trim().length < 2) return null;
  var products = await searchTaobaoProducts(productName.trim(), env, 10);
  if (products.length === 0) return null;
  var name = productName.trim();
  // Try to find a good match, skipping samples and cheap goods
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var isMatch = p.title.includes(name) || name.includes(p.title.substring(0, 4));
    if (!isMatch) continue;
    // Filter: price too low
    if (p.price < MIN_PRICE) {
      console.log('[taobao] Price filter: ' + p.title.substring(0, 30) + ' (\\u00a5' + p.price + ')');
      continue;
    }
    // Filter: sample/mini product
    var samplePatterns = ['小样', '试用装', '中样', '体验装', '1ml', '2ml', '3ml', '5ml', '5件装', '10ml', '10件'];
    var isSample = false;
    for (var j = 0; j < samplePatterns.length; j++) {
      if (p.title.indexOf(samplePatterns[j]) !== -1) { isSample = true; break; }
    }
    if (isSample) {
      console.log('[taobao] Sample filter: ' + p.title.substring(0, 30));
      continue;
    }
    console.log('[taobao] Selected: ' + p.title.substring(0, 40) + ' (\\u00a5' + p.price + ')');
    return p;
  }
  // No good match found, return null (degrade to text)
  console.log('[taobao] No valid match for: ' + name);
  return null;
}"""

if old_func in content:
    content = content.replace(old_func, new_func)
    print("Patched findProductByKeyword with improved filtering")
else:
    print("WARNING: Could not find exact old function")
    # Show what we have
    idx = content.find("findProductByKeyword")
    if idx >= 0:
        print(content[idx:idx+600])

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

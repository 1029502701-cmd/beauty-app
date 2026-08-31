import re

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Add MIN_PRICE filter constant after CACHE_TTL
content = content.replace(
    "const CACHE_TTL = 24 * 60 * 60;",
    "const CACHE_TTL = 24 * 60 * 60;\nconst MIN_PRICE = 20; // 低于20元的商品视为小样/劣质品，跳过"
)

# Replace findProductByKeyword to add price filtering
old_func = """export async function findProductByKeyword(productName: string, env: Ctx['env']): Promise<TaobaoProduct | null> {
  if (!productName || productName.trim().length < 2) return null;
  var products = await searchTaobaoProducts(productName.trim(), env, 10);
  if (products.length === 0) return null;
  var name = productName.trim();
  var matched = products.find(function(p) { return p.title.includes(name) || name.includes(p.title.substring(0, 4)); });
  return matched || products[0];
}"""

new_func = """export async function findProductByKeyword(productName: string, env: Ctx['env']): Promise<TaobaoProduct | null> {
  if (!productName || productName.trim().length < 2) return null;
  var products = await searchTaobaoProducts(productName.trim(), env, 10);
  if (products.length === 0) return null;
  var name = productName.trim();
  var matched = products.find(function(p) { return p.title.includes(name) || name.includes(p.title.substring(0, 4)); });
  if (!matched) return products[0];
  // Filter out samples/cheap goods: skip if price < MIN_PRICE or title contains 小样/试用装/中样
  if (matched.price < MIN_PRICE) {
    console.log('[taobao] Price filter skipped: ' + matched.title + ' (¥' + matched.price + ')');
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

content = content.replace(old_func, new_func)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched _taobao.ts")

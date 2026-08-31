path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_taobao.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

start = content.find("export async function findProductByKeyword")
brace_count = 0
pos = start
while pos < len(content):
    if content[pos] == "{":
        brace_count += 1
    elif content[pos] == "}":
        brace_count -= 1
        if brace_count == 0:
            end = pos + 1
            break
    pos += 1

new_func = (
    "export async function findProductByKeyword(productName: string, env: Ctx['env']): Promise<TaobaoProduct | null> {\n"
    "  if (!productName || productName.trim().length < 2) return null;\n"
    "  var products = await searchTaobaoProducts(productName.trim(), env, 10);\n"
    "  if (products.length === 0) return null;\n"
    "  var name = productName.trim();\n"
    "  var triedAlt = false;\n"
    "  while (true) {\n"
    "    for (var i = 0; i < products.length; i++) {\n"
    "      var p = products[i];\n"
    "      var isMatch = p.title.includes(name) || name.includes(p.title.substring(0, 4));\n"
    "      if (!isMatch) continue;\n"
    "      if (p.price < MIN_PRICE) {\n"
    "        console.log('[taobao] Price filter: ' + p.title.substring(0, 30) + ' (¥' + p.price + ')');\n"
    "        continue;\n"
    "      }\n"
    "      var samplePatterns = ['小样', '试用装', '中样', '体验装', '1ml', '2ml', '3ml', '5ml', '10ml'];\n"
    "      var isSample = false;\n"
    "      for (var j = 0; j < samplePatterns.length; j++) {\n"
    "        if (p.title.indexOf(samplePatterns[j]) !== -1) { isSample = true; break; }\n"
    "      }\n"
    "      if (isSample) {\n"
    "        console.log('[taobao] Sample filter: ' + p.title.substring(0, 30));\n"
    "        continue;\n"
    "      }\n"
    "      console.log('[taobao] Selected: ' + p.title.substring(0, 40) + ' (¥' + p.price + ')');\n"
    "      return p;\n"
    "    }\n"
    "    if (!triedAlt) {\n"
    "      triedAlt = true;\n"
    "      console.log('[taobao] Retrying with 正装 suffix for: ' + name);\n"
    "      products = await searchTaobaoProducts(name + ' 正装', env, 10);\n"
    "      if (products.length === 0) break;\n"
    "    } else {\n"
    "      break;\n"
    "    }\n"
    "  }\n"
    "  console.log('[taobao] No valid match for: ' + name);\n"
    "  return null;\n"
    "}\n"
)

content = content[:start] + new_func + content[end:]
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched. Size:", len(content))

# Verify
with open(path, "r", encoding="utf-8") as f:
    c2 = f.read()
print("Has retry logic:", "triedAlt" in c2)
print("Has 正装:", "正装" in c2)

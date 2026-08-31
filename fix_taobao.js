const fs = require("fs");
let code = fs.readFileSync("pages-functions/functions/api/_taobao.ts", "utf8");

const oldFuncStart = "function parseTaobaoXml(xmlText: string): TaobaoProduct[] {\r\n  try {\r\n    var parser = new DOMParser();";
const oldFuncEnd = "  } catch (e) { console.error('[taobao] XML parse error:', e); return []; }\r\n}\r\n\r\nexport async function findProductByKeyword";

const startIdx = code.indexOf(oldFuncStart);
const endIdx = code.indexOf(oldFuncEnd);
if (startIdx === -1 || endIdx === -1) {
  console.log("Could not find boundaries. start=" + startIdx + " end=" + endIdx);
  process.exit(1);
}

const newFunc = `function parseTaobaoXml(xmlText: string): TaobaoProduct[] {
  try {
    // Regex-based XML parsing (DOMParser not available in Cloudflare Workers)
    const errMatch = xmlText.match(/<error_response>[\\s\\S]*?<code>([^<]*)<\\/code>[\\s\\S]*?<msg>([^<]*)<\\/msg>/);
    if (errMatch) {
      console.warn('[taobao] API error: code=' + errMatch[1] + ', msg=' + errMatch[2]);
      return [];
    }
    const itemRegex = /<item_basic_info>([\\s\\S]*?)<\\/item_basic_info>/g;
    const products: TaobaoProduct[] = [];
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      const itemXml = itemMatch[1];
      const getText = function(tag) {
        const m = itemXml.match('<' + tag + '>([^<]*)<\\/' + tag + '>');
        return m ? m[1] : '';
      };
      const numIid = getText('num_iid');
      const title = getText('title');
      const pictUrl = getText('pict_url');
      const zkFinalPrice = getText('zk_final_price');
      const resalePrice = getText('resale_price');
      const itemUrl = getText('item_url');
      const clickUrl = getText('click_url');
      const shopTitle = getText('shop_title');
      const brandName = getText('brand_name');
      const smallImgMatches = itemXml.matchAll(/<small_images>[\\s\\S]*?<string>([^<]*)<\\/string>/g);
      const smallImages = [];
      for (const m of smallImgMatches) smallImages.push(m[1]);
      const imageUrl = pictUrl || (smallImages[0] || '');
      const finalUrl = clickUrl || itemUrl;
      const fullUrl = finalUrl ? (finalUrl.startsWith('http') ? finalUrl : 'https:' + finalUrl) : '';
      if (!numIid && !title) continue;
      products.push({
        itemId: numIid, title: title, imageUrl: imageUrl,
        price: isNaN(parseFloat(zkFinalPrice || resalePrice || '0')) ? 0 : parseFloat(zkFinalPrice || resalePrice || '0'),
        itemUrl: fullUrl, shopTitle: shopTitle || undefined, brandName: brandName || undefined,
      });
    }
    return products;
  } catch (e) { console.error('[taobao] XML parse error:', e); return []; }
}`;

const newCode = code.substring(0, startIdx) + newFunc + code.substring(endIdx);
fs.writeFileSync("pages-functions/functions/api/_taobao.ts", newCode);
console.log("Patched! New length:", newCode.length);

const fs = require("fs");
const code = fs.readFileSync("pages-functions/functions/api/_taobao.ts", "utf8");

const oldStart = code.indexOf("function parseTaobaoXml(xmlText) {");
const oldEnd = code.indexOf("\nexport async function findProductByKeyword", oldStart);
if (oldStart === -1 || oldEnd === -1) { console.log("NOT FOUND"); process.exit(1); }

const newFunc = `function parseTaobaoXml(xmlText) {
  try {
    var errIdx = xmlText.indexOf("<error_response>");
    if (errIdx !== -1) {
      var codeMatch = xmlText.substring(errIdx).match(/<code>([^<]*)<\\/code>/);
      var msgMatch = xmlText.substring(errIdx).match(/<msg>([^<]*)<\\/msg>/);
      console.warn('[taobao] API error: code=' + (codeMatch ? codeMatch[1] : '?') + ', msg=' + (msgMatch ? msgMatch[1] : '?'));
      return [];
    }
    var products = [];
    // Match: item_basic_info -> item_id -> price_promotion_info(zk_final_price) -> publish_info(click_url)
    var itemRegex = /<item_basic_info>([\\s\\S]*?)<\\/item_basic_info>[\\s\\S]*?<item_id>([^<]*)<\\/item_id>[\\s\\S]*?<price_promotion_info>[\\s\\S]*?<zk_final_price>([^<]*)<\\/zk_final_price>[\\s\\S]*?<\\/price_promotion_info>[\\s\\S]*?<publish_info>[\\s\\S]*?<click_url>([^<]*)<\\/click_url>/g;
    var match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      var itemXml = match[1];
      var numIid = match[2];
      var zkFinalPrice = match[3];
      var clickUrl = match[4];
      
      var getText = function(tag) {
        var t = "<" + tag + ">";
        var e = "</" + tag + ">";
        var si = itemXml.indexOf(t);
        if (si === -1) return "";
        var se = itemXml.indexOf(e, si + t.length);
        if (se === -1) return "";
        return itemXml.substring(si + t.length, se);
      };
      
      var title = getText("title");
      var pictUrl = getText("pict_url");
      var shopTitle = getText("shop_title");
      var brandName = getText("brand_name");
      
      var smallImages = [];
      var siStart = itemXml.indexOf("<small_images>");
      if (siStart !== -1) {
        var siEnd = itemXml.indexOf("</small_images>", siStart);
        if (siEnd !== -1) {
          var imgRegex = /<string>([^<]*)<\\/string>/g;
          var imgMatch;
          while ((imgMatch = imgRegex.exec(itemXml.substring(siStart, siEnd))) !== null) {
            smallImages.push(imgMatch[1]);
          }
        }
      }
      var imageUrl = pictUrl || (smallImages[0] || "");
      var fullUrl = clickUrl ? (clickUrl.startsWith("http") ? clickUrl : "https:" + clickUrl) : "";
      
      if (!numIid && !title) continue;
      products.push({
        itemId: numIid, title: title, imageUrl: imageUrl,
        price: isNaN(parseFloat(zkFinalPrice || "0")) ? 0 : parseFloat(zkFinalPrice || "0"),
        itemUrl: fullUrl, shopTitle: shopTitle || undefined, brandName: brandName || undefined,
      });
    }
    return products;
  } catch (e) { console.error("[taobao] XML parse error:", e); return []; }
}`;

const newCode = code.substring(0, oldStart) + newFunc + code.substring(oldEnd);
fs.writeFileSync("pages-functions/functions/api/_taobao.ts", newCode);
console.log("Patched! New length:", newCode.length);

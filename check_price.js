const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");
db.get('SELECT id, content FROM reports_tier2 ORDER BY created_at DESC LIMIT 1', function(e,r) {
  if (r) {
    var j = JSON.parse(r.content);
    console.log("ID:", r.id);
    if (j.productRecs) {
      for (var k in j.productRecs) {
        var arr = j.productRecs[k];
        if (Array.isArray(arr) && arr[0]) {
          console.log(k + ":", JSON.stringify(arr[0]).substring(0, 300));
        }
      }
    }
  }
  db.close();
});

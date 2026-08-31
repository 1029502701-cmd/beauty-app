const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");
db.get('SELECT content FROM reports_tier2 WHERE id LIKE "bb7b5dc0%" OR id LIKE "e0d666c8%" ORDER BY created_at DESC LIMIT 1', function(e,r) {
  if (r) {
    var j = JSON.parse(r.content);
    console.log("Keys:", Object.keys(j));
    if (j.productRecs) {
      var first = j.productRecs.faceShape && j.productRecs.faceShape[0];
      if (first) console.log("First product:", JSON.stringify(first));
    }
  } else {
    console.log("Not found");
  }
  db.close();
});

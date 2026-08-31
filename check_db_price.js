const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");
db.all('SELECT id, content FROM reports_tier2 ORDER BY created_at DESC LIMIT 1', function(e,r) {
  if (r && r[0]) {
    var j = JSON.parse(r[0].content);
    console.log("Report ID:", r[0].id);
    console.log("Generation status: checking...");
    // Check all keys
    console.log("Top-level keys:", Object.keys(j).join(", "));
    if (j.productRecs) {
      var firstRec = j.productRecs.faceShape && j.productRecs.faceShape[0];
      if (firstRec) {
        console.log("First product keys:", Object.keys(firstRec).join(", "));
        console.log("First product:", JSON.stringify(firstRec));
        console.log("Price type:", typeof firstRec.price, "Value:", JSON.stringify(firstRec.price));
      }
    } else {
      console.log("No productRecs found");
      console.log("Full content:", r[0].content.substring(0, 500));
    }
  }
  db.close();
});

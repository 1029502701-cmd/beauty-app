const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite");
db.all('SELECT id, generation_status, content FROM reports_tier2 ORDER BY created_at DESC LIMIT 3', function(e,r) {
  if (r) r.forEach(function(x) {
    try {
      var j = JSON.parse(x.content);
      console.log(x.id, x.generation_status, "keys:", Object.keys(j).join(", "));
      if (j.productRecs) {
        for (var k in j.productRecs) {
          var arr = j.productRecs[k];
          if (Array.isArray(arr) && arr[0]) {
            console.log("  " + k + ":", JSON.stringify(arr[0]).substring(0, 200));
          }
        }
      }
    } catch(e) { console.log(x.id, "parse_err"); }
  });
  db.close();
});

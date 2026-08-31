const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite");
db.get('SELECT content FROM reports_tier2 WHERE id="t2-e2e-1787880155"', (e, r) => {
  if (r) {
    const c = JSON.parse(r.content);
    console.log("Top keys:", Object.keys(c).join(", "));
    if (c.productRecs) {
      for (const [dim, items] of Object.entries(c.productRecs)) {
        console.log(dim + ":", JSON.stringify(items[0]));
      }
    } else {
      console.log("No productRecs. Content:", JSON.stringify(c).substring(0, 500));
    }
  } else {
    console.log("Not found");
  }
  db.close();
});

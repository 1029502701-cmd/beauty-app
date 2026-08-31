const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite");
db.get('SELECT content FROM reports_tier2 WHERE id LIKE "t2-e2e-%" ORDER BY created_at DESC LIMIT 1', (e, r) => {
  if (r) {
    const c = JSON.parse(r.content);
    console.log("Top keys:", Object.keys(c).join(", "));
    if (c.productRecs) {
      const first = c.productRecs.faceShape && c.productRecs.faceShape[0];
      console.log("First product keys:", Object.keys(first || {}).join(", "));
      console.log("First product:", JSON.stringify(first));
    }
  } else {
    console.log("Not found");
  }
  db.close();
});

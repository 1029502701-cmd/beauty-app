const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");
db.all('SELECT u.id as uid, u.phone, t1.id as t1id, t2.id as t2id, t2.generation_status FROM users u JOIN reports_tier1 t1 ON u.id=t1.user_id JOIN reports_tier2 t2 ON t1.id=t2.source_tier1_report_id WHERE u.phone="13998966531" ORDER BY t2.created_at DESC LIMIT 1', function(e,r) {
  if (r) console.log(JSON.stringify(r));
  db.close();
});

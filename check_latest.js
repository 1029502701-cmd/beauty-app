const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite");
db.all('SELECT u.phone, t2.id, t2.generation_status, substr(t2.content,1,200) as preview FROM users u JOIN reports_tier2 t2 ON u.id=t2.user_id ORDER BY t2.created_at DESC LIMIT 5', function(e,r) {
  if (r) r.forEach(function(x) {
    console.log(x.phone, x.id, x.generation_status, x.preview);
  });
  db.close();
});

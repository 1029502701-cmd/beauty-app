const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DB_PATH = path.join(__dirname, 'pages-functions', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite');
const db = new sqlite3.Database(DB_PATH);
db.get('SELECT id,user_id,generation_status,content FROM reports_tier2 WHERE generation_status="ready" ORDER BY created_at DESC LIMIT 1', (e,r) => {
  if (r) {
    const c = JSON.parse(r.content);
    console.log('ID:', r.id, 'status:', r.generation_status);
    if (c.productRecs) {
      for (const [k, v] of Object.entries(c.productRecs)) {
        console.log(k + ':', JSON.stringify(v).substring(0, 300));
      }
    }
  } else {
    console.log('No ready tier2 found');
  }
  db.close();
});

const sqlite3 = require("sqlite3");
const db = new sqlite3.Database("pages-functions/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite");
// Get content from 69515320 (has steps) and copy to 158c7a08
db.get("SELECT content FROM reports_tier2 WHERE id='69515320-11bc-47dc-9a47-b837b3395b3a'", (e, r) => {
  if (!r) { console.log("source not found"); db.close(); return; }
  const now = Math.floor(Date.now() / 1000);
  db.run("UPDATE reports_tier2 SET content=?, generation_status='ready', updated_at=? WHERE id='158c7a08-cb09-4bff-a8e7-e7c43eb6bcc4'", [r.content, now], function(e2) {
    console.log("Updated content:", this.changes, "changes");
    // Verify
    db.get("SELECT substr(content,1,200) as cp FROM reports_tier2 WHERE id='158c7a08-cb09-4bff-a8e7-e7c43eb6bcc4'", (e3, r2) => {
      console.log("New content preview:", r2?.cp?.substring(0, 150));
      try {
        const parsed = JSON.parse(r2.content);
        console.log("Has steps:", !!parsed.steps, "steps:", parsed.steps?.length);
      } catch(err) { console.log("Parse error:", err.message); }
    });
    db.close();
  });
});
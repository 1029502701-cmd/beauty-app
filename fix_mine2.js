const fs = require("fs");
const filePath = "pages-functions/functions/api/reports/mine.ts";
let c = fs.readFileSync(filePath, "utf8");

const oldTier1Block = `  const tier1Result = await env.DB.prepare(
    \`SELECT id, report_data, created_at\`
     FROM reports_tier1
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1\`
  )
    .bind(user.userId)
    .first();`;

const newTier1Block = `  const tier1Result = await env.DB.prepare(\`
    SELECT id, report_data, created_at
    FROM reports_tier1
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1\`).bind(user.userId).first();`;

if (c.includes(oldTier1Block)) {
  c = c.replace(oldTier1Block, newTier1Block);
  fs.writeFileSync(filePath, c);
  console.log("Fixed tier1 block");
} else {
  console.log("Old block not found, checking...");
  const idx = c.indexOf("tier1Result");
  if (idx > -1) console.log(c.substring(idx-50, idx+300));
}

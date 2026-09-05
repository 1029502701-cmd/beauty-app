const fs = require("fs");
const filePath = "pages-functions/functions/api/reports/mine.ts";
let c = fs.readFileSync(filePath, "utf8");

const tier1Block = `
  // ── Tier1：查询用户最新的初识报告 ───────────────────────────────────────────
  const tier1Result = await env.DB.prepare(
    ` + "`SELECT id, report_data, created_at`" + `
     FROM reports_tier1
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1` + "`" + `
  )
    .bind(user.userId)
    .first();
`;

const mergeMarker = `  // ── 合并并标注 access_type ─────────────────────────────────────────────────`;
c = c.replace(mergeMarker, tier1Block + "\n" + mergeMarker);

const oldResp = `return new Response(JSON.stringify({ reports }), {`;
const newResp = `return new Response(JSON.stringify({ reports, tier1Report: tier1Result ? { id: tier1Result.id, report: tier1Result.report_data, createdAt: tier1Result.created_at } : null }), {`;
c = c.replace(oldResp, newResp);

fs.writeFileSync(filePath, c);
console.log("Done");

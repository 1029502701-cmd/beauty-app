// Generate _routes.json for Cloudflare Pages Functions (wrangler >= 4.x spec).
// Emits { version:1, include:[...], exclude:[] }.
//   - rules must start with "/" and be <= 100 chars;
//   - total include+exclude <= 100;
//   - a wildcard "X/*" must not overlap any rule that is a sub-path of "X/".
// Strategy: for each parametric route emit ONE splat on its parent dir, then drop
// exact static rules that live under that splat (they would be flagged as overlap).
// Source of truth: functions/_routes.json (legacy :param list, 66 routes).
const fs = require("fs");
const path = require("path");

const refPath = path.join(__dirname, "functions", "_routes.json");
const outputPath = path.join(__dirname, "dist", "_routes.json");

const ref = JSON.parse(fs.readFileSync(refPath, "utf8"));
const legacy = (ref.routes || []).map((r) => (r.startsWith("/") ? r : "/" + r));

const exact = [];
const wild = [];
for (const rule of legacy) {
  if (/:/.test(rule)) {
    const m = rule.match(/^(.*)\/:[^/]+(\/.*)?$/);
    const parent = m ? m[1] : "/" + rule.split("/")[1];
    const w = parent + "/*";
    if (!wild.includes(w)) wild.push(w);
  } else {
    if (!exact.includes(rule)) exact.push(rule);
  }
}

const underSplat = (e) => wild.some((w) => e !== w && e.startsWith(w.slice(0, -1)));
const include = [...new Set([...wild, ...exact.filter((e) => !underSplat(e))])]
  .filter((x) => x.startsWith("/") && x.length <= 100)
  .sort();

const out = {
  version: 1,
  description: "Auto-generated from functions/_routes.json (include/exclude glob spec)",
  include,
  exclude: [],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(out, null, 2));
console.log("Generated " + include.length + " rules to " + outputPath);

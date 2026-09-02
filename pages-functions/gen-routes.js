// Generate _routes.json for Cloudflare Pages Functions
const fs = require("fs");
const path = require("path");

const functionsDir = path.join(__dirname, "functions/api");
const outputPath = path.join(__dirname, "dist", "_routes.json");

const routes = [];

function scan(dir, mountPath) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith("[") && entry.name.endsWith("]")) {
        const route = mountPath + "/" + entry.name.replace("[", ":").replace("]", "*");
        routes.push(route);
        continue;
      }
      const subMount = mountPath + "/" + entry.name;
      scan(full, subMount);
    } else if (entry.name.endsWith(".ts") && !entry.name.startsWith("_")) {
      const route = mountPath + "/" + entry.name.replace(".ts", "");
      routes.push(route);
    }
  }
}

scan(functionsDir, "/api");
const unique = [...new Set(routes)].sort();

const output = {
  version: 1,
  description: "Auto-generated from functions/api/",
  include: unique,
  exclude: []
};

fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log("Generated " + unique.length + " routes to " + outputPath);
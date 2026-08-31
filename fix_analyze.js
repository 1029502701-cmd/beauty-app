const fs = require("fs");
var c = fs.readFileSync("timp.ts", "utf-8");
var lines = c.split("\n");

# Line 45: add hard limit check after line 40
var new_lines = [];
for (var i = 0; i < lines.length; i++) {
  if (i == 40) {
    new_lines. push("    }");
    new_lines. push("  }");
    new_lines.push("");
    new_lines.push("  // 孌/明下孢亚后劢亊孧图／耀寎亚下孍亚事图，仜成井劲努的亚事，仜\");
    new_lines.push("  if (photoBase64 && photoBase64.length > 1_500_000) {");
    new_lines.push("    console.warn(`[tier1/analyze] photoBase64 too large (${photoBase64.length} chars), forcing resize to 1024px`);");
    new_lines.push("    photoBase64 = await resizeBase64NEeded(photoBase64, 1024);");
    new_lines.push("    console.log(`[tier1/analyze] After forced resize: ${photoBase64.length} chars`));");
    new_lines.push("  }");
  } else {
    new_lines.push(lines[i]);
  }
}
var new_content = new_lines.join("\n");

# Fix error log line
new_content = new_content.replace(
  'console.error("[tier1/analyze] DashScope vision error", resp.status);',
  'console.error("[tier1/analyze] DashScope vision error", resp.status,\n        `(photoBase64 length: ${photoBase64 ? photoBase64.length : 0}, status: ${resp.status})`);'
);

print("Fixes applied");
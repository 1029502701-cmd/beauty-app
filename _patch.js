const fs = require('fs');
const path = 'C:/Users/yao/Documents/ChatGPT/ÃÀ×±app/pages-functions/functions/api/tier1/analyze.ts';
let c = fs.readFileSync(path, 'utf-8');

const old1 = '  };\n\n  if (!textDesc)';
const new1 = '  };\n\n  const saveTier2 = async () => {\n    const tier2Id = generateId();\n    await env.DB.prepare(\n      \INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at)\n       VALUES (?, ?, ?, '\''pending'\'', ?, ?)\\n    ).bind(tier2Id, authUser.userId, '\''{}'\'', reportId, now).run();\n    console.log(\[tier1/analyze] Created tier2 record \ for tier1 \\);\n  };\n\n  if (!textDesc)';
c = c.replace(old1, new1);

c = c.replace(
  'await saveReport(ph);\n    return new Response(JSON.stringify({ report: ph, reportId })',
  'await saveReport(ph);\n    await saveTier2();\n    return new Response(JSON.stringify({ report: ph, reportId })'
);

c = c.replace(
  'await saveReport(report);\n  return new Response(JSON.stringify({ report, reportId })',
  'await saveReport(report);\n  await saveTier2();\n  return new Response(JSON.stringify({ report, reportId })'
);

fs.writeFileSync(path, c, 'utf-8');
console.log('Done');

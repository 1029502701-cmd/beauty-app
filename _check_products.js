const { Pool } = require('pg');
(async () => {
  const c = new Pool({ connectionString: 'postgresql://postgres:dCQdXkFwzY@ep-hidden-hat-a1dsdsfk.us-east-1.aws.neon.tech/beauty-app' });
  const r = await c.query("SELECT id, name, image_url, item_url FROM products WHERE report_id = (SELECT tier2_report_id FROM tier2_reports WHERE id = '2dec662c-fe6e-4ec4-b9a6-7b41e59bf413')");
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})();

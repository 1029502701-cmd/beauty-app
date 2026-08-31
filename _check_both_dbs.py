import sqlite3, glob

for f in glob.glob(r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\*.sqlite'):
    conn = sqlite3.connect(f)
    rows = conn.execute("SELECT id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE user_id='user-test-001'").fetchall()
    short = f.split('\\')[-1][:12]
    print(short, '->', rows)
    conn.close()
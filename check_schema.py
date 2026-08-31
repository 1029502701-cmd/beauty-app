import sqlite3
conn = sqlite3.connect(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite")
cur = conn.cursor()
cur.execute("PRAGMA table_info(reports_tier2)")
for r in cur.fetchall():
    print(r)
conn.close()

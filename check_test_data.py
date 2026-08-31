import sqlite3
conn = sqlite3.connect(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite")
cur = conn.cursor()
# Check existing tier2 test data
cur.execute("SELECT id, user_id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE id='t2-e2e-test'")
print("t2-e2e-test:", cur.fetchall())
# Check tier1
cur.execute("SELECT id, user_id FROM reports_tier1 WHERE id='t1-e2e-test'")
print("t1-e2e-test:", cur.fetchall())
# Check user
cur.execute("SELECT id, phone FROM users WHERE phone='13900000066'")
print("User 13900000066:", cur.fetchall())
conn.close()

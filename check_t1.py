import sqlite3
conn = sqlite3.connect(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite")
cur = conn.cursor()
# Check what tier1 reports exist for this user
cur.execute("SELECT id, user_id FROM reports_tier1 WHERE user_id='a81fb3b8-6994-4f10-bd72-d1d16b5b4733'")
print("Tier1 reports:", cur.fetchall())
# Check all tier2 reports
cur.execute("SELECT id, user_id, generation_status FROM reports_tier2 LIMIT 10")
print("Tier2 reports:", cur.fetchall())
conn.close()

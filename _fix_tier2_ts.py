import sqlite3, json, uuid, time

db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)

# Update existing tier2 to have unlock_method and correct created_at
now = int(time.time())
conn.execute("UPDATE reports_tier2 SET unlock_method='code', created_at=? WHERE id='fdd82328-b059-4bd3-a353-6a46cb0291ea'", (now,))
conn.commit()

# Verify
v = conn.execute("SELECT id, unlock_method, created_at FROM reports_tier2 WHERE id='fdd82328-b238-b059-4bd3-a353-6a46cb0291ea'").fetchone()
print("Update check:", v)

# Also update the created_at for the tier1
conn.execute("UPDATE reports_tier1 SET created_at=? WHERE id='139ca5ce-12a6-4845-8e79-dcda3e0e6878'", (now,))
conn.commit()

# Check mine would return
v2 = conn.execute("SELECT id, unlock_method, created_at FROM reports_tier2 WHERE user_id='user-test-001'").fetchall()
print("Tier2 records:", v2)

conn.close()
import sqlite3

db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite'
conn = sqlite3.connect(db_path)

# Delete the old seed tier2 for t1-001
conn.execute("DELETE FROM reports_tier2 WHERE id='tier2-test-a' AND source_tier1_report_id='t1-001'")
conn.commit()
print("Deleted tier2-test-a")

# Verify only our new tier2 remains for this user
rows = conn.execute("SELECT id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE user_id='user-test-001'").fetchall()
print("Remaining tier2 records:", rows)

conn.close()
import sqlite3, json, uuid, time

db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite'
conn = sqlite3.connect(db_path)

# Get user id for 13900000001
user = conn.execute("SELECT id FROM users WHERE phone='13900000001'").fetchone()
user_id = user[0] if user else None
print("User ID:", user_id)

# Check existing tier1 reports for this user
t1_rows = conn.execute("SELECT id, report_data FROM reports_tier1 WHERE user_id=?", (user_id,)).fetchall()
print("Tier1 reports for user:", len(t1_rows))
for row in t1_rows:
    print("  ", row[0])

# Check existing tier2 reports
t2_rows = conn.execute("SELECT id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE user_id=?", (user_id,)).fetchall()
print("Tier2 reports for user:", len(t2_rows))
for row in t2_rows:
    print("  ", row[0], row[1], row[2])

# Check all tier1 reports
all_t1 = conn.execute("SELECT id, user_id FROM reports_tier1").fetchall()
print("All tier1 reports:")
for row in all_t1:
    print("  ", row[0], "->", row[1])

conn.close()
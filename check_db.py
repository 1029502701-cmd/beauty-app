import sqlite3
db_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)
row = conn.execute("SELECT id, user_id, generation_status, source_tier1_report_id, substr(content,1,200) FROM reports_tier2 WHERE id = 't2-e2e-test'").fetchone()
print('Report:', row)
row2 = conn.execute("SELECT id, user_id, substr(report_data,1,100) FROM reports_tier1 WHERE id = 't1-e2e-test'").fetchone()
print('Tier1:', row2)

# Also check the user's ID
user = conn.execute("SELECT id, phone FROM users WHERE phone = '13900000066'").fetchone()
print('User:', user)
conn.close()

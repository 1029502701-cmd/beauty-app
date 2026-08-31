import sqlite3
conn = sqlite3.connect(r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite')
# Reset the failed tier2 record
conn.execute("UPDATE reports_tier2 SET generation_status='pending', content='{}' WHERE user_id='4cdf0d1b-9009-4313-af9b-2ba585af1ff1'")
conn.commit()
print('Reset tier2 records')
rows = conn.execute("SELECT id, generation_status FROM reports_tier2 WHERE user_id='4cdf0d1b-9009-4313-af9b-2ba585af1ff1'").fetchall()
print('Tier2:', rows)
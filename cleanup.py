import sqlite3
conn = sqlite3.connect(r'C:\Users\yao\.wrangler\state\v3\d1\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite')
conn.execute("DELETE FROM reports_tier2 WHERE user_id='4cdf0d1b-9009-4313-af9b-2ba585af1ff1'")
conn.execute("DELETE FROM tier2_daily_usage WHERE user_id='4cdf0d1b-9009-4313-af9b-2ba585af1ff1'")
conn.execute("DELETE FROM share_referrals WHERE sharer_user_id='4cdf0d1b-9009-4313-af9b-2ba585af1ff1'")
conn.commit()
print('Cleaned up old test data')
import sqlite3
db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)
conn.execute("UPDATE app_config SET value='#000000', updated_at=1787880000 WHERE key='tier2_btn_color'")
conn.commit()
rows = conn.execute("SELECT key, value FROM app_config WHERE key='tier2_btn_color'").fetchall()
print('Updated:', rows)
conn.close()
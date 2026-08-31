import sqlite3
db = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite'
conn = sqlite3.connect(db)
rows = conn.execute("SELECT key, value FROM app_config WHERE key='tier2_btn_color'").fetchall()
print('db7f before:', rows)
conn.execute("UPDATE app_config SET value='#000000', updated_at=1787880000 WHERE key='tier2_btn_color'")
conn.commit()
rows = conn.execute("SELECT key, value FROM app_config WHERE key='tier2_btn_color'").fetchall()
print('db7f after:', rows)
conn.close()
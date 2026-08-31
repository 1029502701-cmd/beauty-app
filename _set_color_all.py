import sqlite3
for db in [
    r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite',
    r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite'
]:
    conn = sqlite3.connect(db)
    conn.execute("UPDATE app_config SET value='#000000', updated_at=1787880000 WHERE key='tier2_btn_color'")
    conn.commit()
    rows = conn.execute("SELECT key, value FROM app_config WHERE key='tier2_btn_color'").fetchall()
    print(db[-20:], '->', rows)
    conn.close()
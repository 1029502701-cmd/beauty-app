import sqlite3, json, time

db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)
now = int(time.time())

# Fix tier2_btn_color
conn.execute("UPDATE app_config SET value='#000000', updated_at=? WHERE key='tier2_btn_color'", (now,))
conn.execute("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('tier2_show_ai_image', 'true', ?)", (now,))
conn.execute("INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('tier2_hook_text', '解锁专属报告，搭配更多场景', ?)", (now,))
conn.commit()

# Verify
rows = conn.execute("SELECT key, value FROM app_config WHERE key IN ('tier2_btn_color','tier2_show_ai_image','tier2_hook_text')").fetchall()
for r in rows:
    print(r[0], '=', r[1])
conn.close()
import sqlite3
p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\metadata.sqlite'
conn = sqlite3.connect(p)
tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print('Tables:', [r[0] for r in tables])
for t in tables:
    cnt = conn.execute(f'SELECT COUNT(*) FROM [{t[0]}]').fetchone()[0]
    print(f'  {t[0]}: {cnt} rows')
sessions = conn.execute("SELECT key, substr(value,1,120) FROM kv WHERE key LIKE '%session%'").fetchall()
print(f'\nSession entries: {len(sessions)}')
for s in sessions[:5]:
    print(f'  {s[0]}: {s[1]}')
sms = conn.execute("SELECT key, substr(value,1,80) FROM kv WHERE key LIKE '%sms_code%'").fetchall()
print(f'\nSMS entries: {len(sms)}')
for s in sms[:5]:
    print(f'  {s[0]}: {s[1]}')
conn.close()

import sqlite3, os

# Check the namespace blob DB for session keys
p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(p)
rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 10").fetchall()
print('Project KV sessions:')
for r in rows:
    print(f'  {r[0]}: exp={r[2]}')

# Also check admin sessions
admin_rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'admin_session:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('Admin sessions:')
for r in admin_rows:
    print(f'  {r[0]}: exp={r[2]}')

# Check sms_code entries
sms_rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'sms_code:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('SMS codes:')
for r in sms_rows:
    print(f'  {r[0]}: exp={r[2]}')
conn.close()

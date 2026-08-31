import requests, sqlite3, os
BASE = 'http://127.0.0.1:8788'

# Get session
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
result = r2.json()
session_id = result.get('sessionId')
print('Session:', session_id)

# Check KV immediately
kv_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(kv_path)
rows = conn.execute("SELECT key, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('Sessions in KV:')
for r in rows:
    print(f'  {r[0]}: exp={r[1]}')
our = conn.execute(f"SELECT key FROM _mf_entries WHERE key = 'session:{session_id}'").fetchone()
print(f'Our session found: {our is not None}')
conn.close()

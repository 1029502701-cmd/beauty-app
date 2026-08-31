import requests, sqlite3, time
BASE = 'http://127.0.0.1:8788'

# Get fresh session
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

time.sleep(1)

p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(p)
rows = conn.execute("SELECT key, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('Latest sessions in KV:')
for row in rows:
    print(f'  {row[0]}: exp={row[1]}')

our = conn.execute(f"SELECT key FROM _mf_entries WHERE key = 'session:{session_id}'").fetchone()
print(f'Our session in KV: {our}')

# Check the tier2 status
r3 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': f'Bearer {session_id}'})
print('Tier2 status:', r3.status_code, r3.text[:300])
conn.close()

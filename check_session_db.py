import requests, sqlite3

BASE = 'http://127.0.0.1:8788'
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

db1 = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(db1)
row = conn.execute("SELECT key, expiration FROM _mf_entries WHERE key = ?", (f'session:{session_id}',)).fetchone()
print('Session in DB1:', row)
conn.close()

db2 = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\442c21d28442650c4745c0c4e8e3a33b21b496e2c3f9d66656deef854b039b7a.sqlite'
conn2 = sqlite3.connect(db2)
row2 = conn2.execute("SELECT key, expiration FROM _mf_entries WHERE key = ?", (f'session:{session_id}',)).fetchone()
print('Session in DB2:', row2)
conn2.close()

r3 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': 'Bearer ' + session_id})
print('Tier2:', r3.status_code, r3.text[:200])

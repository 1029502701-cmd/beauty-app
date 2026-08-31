import requests, os, glob, sqlite3, time
BASE = 'http://127.0.0.1:8788'

# Get session
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

# Scan ALL sqlite files for this session
kv_root = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv'
found = False
for root, dirs, files in os.walk(kv_root):
    for f in files:
        if f.endswith('.sqlite'):
            fp = os.path.join(root, f)
            try:
                conn = sqlite3.connect(fp)
                rows = conn.execute("SELECT key FROM _mf_entries WHERE key = ?", (f'session:{session_id}',)).fetchall()
                if rows:
                    print(f'FOUND in {fp}: {rows}')
                    found = True
                conn.close()
            except Exception as e:
                pass
if not found:
    print('Session NOT found in any KV sqlite file')
    # List all session entries
    p = os.path.join(kv_root, 'miniflare-KVNamespaceObject', '1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite')
    conn = sqlite3.connect(p)
    rows = conn.execute("SELECT key FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 3").fetchall()
    print('Current sessions:', rows)
    conn.close()
print('Scan done')

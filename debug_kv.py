import requests, sqlite3, os, json

BASE = 'http://127.0.0.1:8788'

# Login
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
sid = r2.json().get('sessionId')
print('Session:', sid)

# Check KV DB for this session
kv_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(kv_path)
row = conn.execute("SELECT blob_id FROM _mf_entries WHERE key = ?", ('session:' + sid,)).fetchone()
print('Blob in KV DB:', row)

if row:
    blob_dir = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\9f3105f5547642b693452f5f740f8e2c\blobs'
    for f in os.listdir(blob_dir):
        if row[0] in f:
            fp = os.path.join(blob_dir, f)
            with open(fp, 'rb') as fh:
                print('Blob content:', fh.read()[:150])
            break
    else:
        print('Blob file NOT found in directory')
conn.close()

# Try with latest session from KV
conn2 = sqlite3.connect(kv_path)
latest = conn2.execute("SELECT key FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 1").fetchone()
print('Latest session:', latest)
if latest:
    latest_sid = latest[0].replace('session:', '')
    r3 = requests.get(BASE + '/api/tier2/status?tier2Id=t2-e2e-test', headers={'Authorization': 'Bearer ' + latest_sid})
    print('Tier2 with latest:', r3.status_code, r3.text[:200])
conn2.close()

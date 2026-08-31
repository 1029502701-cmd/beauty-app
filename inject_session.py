import requests, sqlite3, os, json, time

BASE = 'http://127.0.0.1:8788'
USER_ID = '95be035f-69c8-4ec5-9b51-94b7189dfd0f'

session_id = 'test-session-' + str(int(time.time()))

kv_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(kv_path)
cols = conn.execute('PRAGMA table_info(_mf_entries)').fetchall()
print('KV schema:', cols)

expires_at = int(time.time()) + 7*24*60*60
blob_id = session_id + '000001a0' + str(int(time.time()*1000))[-8:]
conn.execute("INSERT OR REPLACE INTO _mf_entries (key, blob_id, expiration) VALUES (?, ?, ?)",
    ('session:' + session_id, blob_id, expires_at * 1000))
conn.commit()

blob_dir = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\9f3105f5547642b693452f5f740f8e2c\blobs'
os.makedirs(blob_dir, exist_ok=True)
blob_content = json.dumps({'userId': USER_ID, 'expiresAt': expires_at}).encode()
blob_path = os.path.join(blob_dir, blob_id)
with open(blob_path, 'wb') as f:
    f.write(blob_content)

conn.close()
print('Injected session:', session_id)

r = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': 'Bearer ' + session_id})
print('Tier2 status:', r.status_code, r.text[:300])

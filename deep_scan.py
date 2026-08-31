import requests, sqlite3, os, json, time

BASE = 'http://127.0.0.1:8788'

# Step 1: Login and capture the session
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print(f'Session created: {session_id}')

# Step 2: Try tier2 immediately (should work if KV is in-memory)
r3 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': 'Bearer ' + session_id})
print(f'Immediate tier2 check: {r3.status_code} {r3.text[:200]}')

# Step 3: Scan ALL KV storage locations
kv_root = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv'
print(f'\nScanning KV storage...')

# Check all sqlite files
import glob
for db_path in glob.glob(kv_root + '/**/*.sqlite', recursive=True):
    try:
        conn = sqlite3.connect(db_path)
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        for t in tables:
            if t[0] == '_mf_entries':
                row = conn.execute(f"SELECT key FROM _mf_entries WHERE key = 'session:{session_id}'").fetchone()
                if row:
                    print(f'  FOUND in {os.path.basename(os.path.dirname(db_path))}/{os.path.basename(db_path)}')
                conn.close()
    except: pass

# Check blob directory
blob_dir = os.path.join(kv_root, '9f3105f5547642b693452f5f740f8e2c', 'blobs')
if os.path.exists(blob_dir):
    for f in os.listdir(blob_dir):
        fp = os.path.join(blob_dir, f)
        with open(fp, 'rb') as fh:
            content = fh.read()
        if session_id.encode() in content:
            print(f'  FOUND blob: {f[:40]}')
            break
    else:
        print('  NOT found in blob directory')
        # Show recent blobs
        files = sorted(os.listdir(blob_dir), key=lambda x: os.path.getmtime(os.path.join(blob_dir, x)), reverse=True)
        print(f'  Latest blobs:')
        for f in files[:3]:
            fp = os.path.join(blob_dir, f)
            with open(fp, 'rb') as fh:
                print(f'    {f[:50]}: {fh.read()[:80]}')

# Step 4: Check if the session works after a short delay
time.sleep(1)
r4 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': 'Bearer ' + session_id})
print(f'\nAfter 1s delay: {r4.status_code} {r4.text[:200]}')

# Step 5: Try with reports/mine
r5 = requests.get(BASE + '/api/reports/mine', headers={'Authorization': 'Bearer ' + session_id})
print(f'Mine: {r5.status_code} {r5.text[:200]}')

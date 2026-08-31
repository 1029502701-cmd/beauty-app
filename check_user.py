import requests, sqlite3

BASE = 'http://127.0.0.1:8788'

# Login and get session
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

# Check what user ID this session has in KV
import os, json
blob_dir = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\9f3105f5547642b693452f5f740f8e2c\blobs'
found = False
for f in os.listdir(blob_dir):
    fp = os.path.join(blob_dir, f)
    with open(fp, 'rb') as fh:
        content = fh.read()
    if session_id.encode() in content:
        print(f'Found session in blob {f[:40]}: {content[:150]}')
        found = True
        break
if not found:
    print('Session not in blob dir')
    # Search all blobs
    for f in sorted(os.listdir(blob_dir))[-5:]:
        fp = os.path.join(blob_dir, f)
        with open(fp, 'rb') as fh:
            content = fh.read()
        print(f'  Last blob {f[:40]}: {content[:100]}')

# Check DB for the user
db_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)
# Check all users with this phone
users = conn.execute("SELECT id, phone FROM users WHERE phone = '13900000066'").fetchall()
print('Users with phone 13900000066:', users)

# Check tier2 reports
reports = conn.execute("SELECT id, user_id, generation_status FROM reports_tier2 WHERE id = 'tier2-e2e-001'").fetchall()
print('Tier2 report:', reports)
conn.close()

# Also check via API what user the session belongs to
r3 = requests.get(BASE + '/api/reports/mine', headers={'Authorization': 'Bearer ' + session_id})
print('Mine:', r3.status_code, r3.text[:200])

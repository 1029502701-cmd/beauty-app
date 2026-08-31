import sqlite3, glob, requests, time

BASE = 'http://127.0.0.1:8788'
kv_root = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv'

# Get fresh admin session
r = requests.post(BASE + '/api/admin/login', json={'username': '15961962243', 'password': '123456bn'})
admin_sid = r.json().get('sessionId')
print('Admin session:', admin_sid)

# Scan all KV sqlite files for this session
found_any = False
for db_path in glob.glob(kv_root + '/**/*.sqlite', recursive=True):
    try:
        conn = sqlite3.connect(db_path)
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        for t in tables:
            if t[0] == '_mf_entries':
                row = conn.execute(f"SELECT key, expiration FROM _mf_entries WHERE key = 'admin_session:{admin_sid}'").fetchone()
                if row:
                    print(f'Found admin session in {db_path}: {row}')
                    found_any = True
                # Also check user sessions
                rows = conn.execute("SELECT key, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 3").fetchall()
                if rows:
                    print(f'  Sessions in {db_path}: {rows}')
        conn.close()
    except Exception as e:
        pass

if not found_any:
    print('Admin session NOT found in any KV sqlite file')
    
# Now get a user session and check
import requests as rq
rq.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r2 = rq.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r2.json().get('code')
r3 = rq.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
user_sid = r3.json().get('sessionId')
print('User session:', user_sid)

for db_path in glob.glob(kv_root + '/**/*.sqlite', recursive=True):
    try:
        conn = sqlite3.connect(db_path)
        row = conn.execute(f"SELECT key, expiration FROM _mf_entries WHERE key = 'session:{user_sid}'").fetchone()
        if row:
            print(f'Found user session in {db_path}: {row}')
        conn.close()
    except: pass
print('Scan complete')

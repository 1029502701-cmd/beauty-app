import requests, sqlite3

BASE = 'http://127.0.0.1:8788'

# Login
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

# Check what user this session belongs to via reports/mine
r3 = requests.get(BASE + '/api/reports/mine', headers={'Authorization': 'Bearer ' + session_id})
print('Mine:', r3.status_code, r3.text)

# Check tier2 status
r4 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': 'Bearer ' + session_id})
print('Tier2 status:', r4.status_code, r4.text)

# Check DB directly
db_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)

# Check if user exists
user = conn.execute("SELECT id, phone FROM users WHERE phone = '13900000066'").fetchone()
print('User in DB:', user)

# Check tier2 report
report = conn.execute("SELECT id, user_id, generation_status FROM reports_tier2 WHERE id = 'tier2-e2e-001'").fetchone()
print('Report:', report)

# Check if there are NEW users created
new_users = conn.execute("SELECT id, phone FROM users ORDER BY created_at DESC LIMIT 5").fetchall()
print('Latest users:', new_users)
conn.close()

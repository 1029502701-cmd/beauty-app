import requests
BASE = 'http://127.0.0.1:8788'
# Get session and use it immediately
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

# Use it for tier2
r3 = requests.get(BASE + '/api/tier2/status?tier2Id=tier2-e2e-001', headers={'Authorization': f'Bearer {session_id}'})
print('Tier2 status:', r3.status_code, r3.text[:200])

# Try with tier1ReportId
r4 = requests.get(BASE + '/api/tier2/status?tier1ReportId=t1-e2e-001', headers={'Authorization': f'Bearer {session_id}'})
print('Tier2 by tier1:', r4.status_code, r4.text[:200])

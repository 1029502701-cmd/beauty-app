import requests
BASE = 'http://127.0.0.1:8788'
requests.post(BASE + '/api/auth/phone/send-code', json={'phone': '13900000066'})
r = requests.get(BASE + '/api/debug/sms-code?phone=13900000066')
code = r.json().get('code')
r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': '13900000066', 'code': code})
session_id = r2.json().get('sessionId')
print('Session:', session_id)

# Try different endpoints
paths = [
    ('GET', '/api/tier2/status?tier2Id=tier2-e2e-001'),
    ('POST', '/api/tier2/generate', {'reportId': 'tier2-e2e-001'}),
]
for method, path, *body in paths:
    b = body[0] if body else None
    r = requests.request(method, BASE + path, json=b, headers={'Authorization': f'Bearer {session_id}'})
    print(f'{method} {path}: {r.status_code} {r.text[:200]}')

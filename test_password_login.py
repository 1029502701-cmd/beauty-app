import requests
BASE = 'http://127.0.0.1:8788'

# Try the password login instead (login-or-register)
# First set a password for the test user
r1 = requests.post(BASE + '/api/auth/set-password', json={'password': 'Test1234'})
print('Set password (no auth):', r1.status_code, r1.text[:100])

# Try login-or-register (this creates a new user with password)
r2 = requests.post(BASE + '/api/auth/login-or-register', json={
  'account': '13900000066',
  'password': 'Test1234',
  'confirmPassword': 'Test1234'
})
print('Login-or-register:', r2.status_code, r2.text[:200])

sid = r2.json().get('sessionId')
if sid:
    r3 = requests.get(BASE + '/api/tier2/status?tier2Id=t2-e2e-test', headers={'Authorization': 'Bearer ' + sid})
    print('Tier2:', r3.status_code, r3.text[:200])

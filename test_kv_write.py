import requests, os, glob, sqlite3
BASE = 'http://127.0.0.1:8788'

# Check what KV the server is actually using by writing and reading a test value
r = requests.get(BASE + '/api/test/get-test')
print('Test endpoint:', r.status_code, r.text)

# Try to write to KV via a test endpoint
r2 = requests.post(BASE + '/api/test/get-test', json={'key': 'test_kv_write', 'value': 'hello'})
print('Write test:', r2.status_code, r2.text[:200])

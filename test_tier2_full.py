import requests, sqlite3

BASE = 'http://127.0.0.1:8788'
db_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'

# Get a ready tier2 report and its user
conn = sqlite3.connect(db_path)
report = conn.execute("SELECT id, user_id FROM reports_tier2 WHERE generation_status = 'ready' LIMIT 1").fetchone()
print('Report:', report)
if report:
    user = conn.execute('SELECT phone FROM users WHERE id = ?', (report[1],)).fetchone()
    print('User phone:', user)
    if user:
        # Login as this user
        requests.post(BASE + '/api/auth/phone/send-code', json={'phone': user[0]})
        r = requests.get(BASE + '/api/debug/sms-code?phone=' + user[0])
        code = r.json().get('code')
        r2 = requests.post(BASE + '/api/auth/phone/login', json={'phone': user[0], 'code': code})
        sid = r2.json().get('sessionId')
        print('Session:', sid)
        
        # Check reports/mine
        r3 = requests.get(BASE + '/api/reports/mine', headers={'Authorization': 'Bearer ' + sid})
        print('Mine:', r3.status_code, r3.text[:200])
        
        # Check tier2 status
        r4 = requests.get(BASE + '/api/tier2/status?tier2Id=' + report[0], headers={'Authorization': 'Bearer ' + sid})
        print('Tier2 status:', r4.status_code, r4.text[:300])
        
        # Check with tier1ReportId instead
        source = conn.execute("SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ?", (report[0],)).fetchone()
        print('Source tier1:', source)
        if source:
            r5 = requests.get(BASE + '/api/tier2/status?tier1ReportId=' + source[0], headers={'Authorization': 'Bearer ' + sid})
            print('Tier2 by tier1:', r5.status_code, r5.text[:300])
conn.close()

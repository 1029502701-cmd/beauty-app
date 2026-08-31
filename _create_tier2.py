import sqlite3, json, uuid, time

# Connect to the active database
db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite'
conn = sqlite3.connect(db_path)

# Find the user_id for phone 13900000001
user = conn.execute("SELECT id FROM users WHERE phone='13900000001'").fetchone()
print("User:", user)
user_id = user[0] if user else None

# Find the tier1 report we just created
t1 = conn.execute("SELECT id, report_data FROM reports_tier1 WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (user_id,)).fetchone()
print("Tier1:", t1[0] if t1 else None)

if t1:
    t1_id = t1[0]
    t1_data = json.loads(t1[1])
    print("Tier1 data keys:", list(t1_data.keys()))
    
    # Create a tier2 record linked to this tier1
    t2_id = str(uuid.uuid4())
    now = int(time.time())
    
    # Insert tier2 with pending status - will auto-generate
    conn.execute(
        "INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (t2_id, user_id, json.dumps({"status":"pending"}), "pending", t1_id, now)
    )
    conn.commit()
    print("Created tier2:", t2_id)
    
    # Also check what the tier2 content format should be
    # Call the status endpoint to trigger generation
    import http.client
    conn2 = http.client.HTTPConnection("127.0.0.1", 8788)
    conn2.request("GET", "/api/tier2/status?tier1ReportId=" + t1_id)
    resp = conn2.getresponse()
    data = resp.read().decode()
    print("Status response:", data)
else:
    print("No tier1 report found")

conn.close()
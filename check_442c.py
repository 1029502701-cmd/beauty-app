import sqlite3

p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\442c21d28442650c4745c0c4e8e3a33b21b496e2c3f9d66656deef854b039b7a.sqlite'
conn = sqlite3.connect(p)
rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'admin_session:%' ORDER BY expiration DESC LIMIT 3").fetchall()
print('Admin sessions in 442c DB:', rows)
rows2 = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 3").fetchall()
print('User sessions in 442c DB:', rows2)
conn.close()

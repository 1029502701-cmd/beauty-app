import sqlite3
# Project-local KV
p = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(p)
rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('Project sessions:', rows)
rows2 = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'admin_session:%' ORDER BY expiration DESC LIMIT 5").fetchall()
print('Admin sessions:', rows2)
conn.close()

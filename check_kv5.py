import sqlite3
p = r'C:\Users\yao\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(p)
cols = conn.execute("PRAGMA table_info(_mf_entries)").fetchall()
print('Global columns:', cols)
rows = conn.execute("SELECT * FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY created_at DESC LIMIT 5").fetchall()
print('Global sessions:', rows)
conn.close()

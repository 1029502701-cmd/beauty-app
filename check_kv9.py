import sqlite3, os

# Check the global KV namespace DB
p = r'C:\Users\yao\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite'
conn = sqlite3.connect(p)
rows = conn.execute("SELECT key, blob_id, expiration FROM _mf_entries WHERE key LIKE 'session:%' ORDER BY expiration DESC LIMIT 10").fetchall()
print('Global KV sessions:')
for r in rows:
    print(f'  {r[0]}: exp={r[2]}')
conn.close()

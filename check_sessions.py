import sqlite3, json
conn = sqlite3.connect(".wrangler/state/v3/kv/miniflare-KVNamespaceObject/1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite")
cur = conn.cursor()
cur.execute("SELECT key, blob_id, expiration FROM _mf_entries ORDER BY expiration DESC LIMIT 10")
for row in cur.fetchall():
    print(f"{row[0]} blob={row[1][:20]} exp={row[2]}")
conn.close()

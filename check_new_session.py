import sqlite3, json
conn = sqlite3.connect(".wrangler/state/v3/kv/miniflare-KVNamespaceObject/1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite")
cur = conn.cursor()
cur.execute("SELECT blob_id FROM _mf_entries WHERE key = 'session:fe309f6b-ef17-4235-8b5a-fb753a43bf58'")
row = cur.fetchone()
if row:
    blob_id = row[0]
    blob_path = f".wrangler/state/v3/kv/9f3105f5547642b693452f5f740f8e2c/blobs/{blob_id}"
    import os
    if os.path.exists(blob_path):
        with open(blob_path) as f:
            data = json.load(f)
        print("userId:", data.get("userId"))
conn.close()

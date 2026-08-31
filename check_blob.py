import sqlite3, json
conn = sqlite3.connect(".wrangler/state/v3/kv/miniflare-KVNamespaceObject/1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite")
cur = conn.cursor()
cur.execute("SELECT blob_id FROM _mf_entries WHERE key = 'session:58052e8e-ad5d-4418-b354-47e00609f38e'")
row = cur.fetchone()
blob_id = row[0]
print("blob_id:", blob_id[:40])
# Read the blob file
blob_path = f".wrangler/state/v3/kv/9f3105f5547642b693452f5f740f8e2c/blobs/{blob_id}"
import os
print("blob exists:", os.path.exists(blob_path))
if os.path.exists(blob_path):
    with open(blob_path, "r") as f:
        content = f.read()
    print("content:", content[:200])
    data = json.loads(content)
    print("userId:", data.get("userId"))
conn.close()

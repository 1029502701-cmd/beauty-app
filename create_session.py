import sqlite3, os, json, time, uuid

kv_path = os.path.join(os.environ["USERPROFILE"], "Documents", "ChatGPT", "美妆app",
    "pages-functions", ".wrangler", "state", "v3", "kv",
    "9f3105f5547642b693452f5f740f8e2c", "miniflare-KVNamespaceObject.sqlite")

conn = sqlite3.connect(kv_path)
cur = conn.cursor()

# Insert fresh session
user_id = "82a2f43b-efd1-4079-91f7-dd0f647a65df"
session_id = str(uuid.uuid4())
expires_at = int(time.time()) + 7 * 24 * 60 * 60
session_data = json.dumps({"userId": user_id, "expiresAt": expires_at})

cur.execute(
    "INSERT OR REPLACE INTO miniflare_KVNamespaceObject (key, value, base64_encoded, metadata) VALUES (?, ?, ?, ?)",
    (f"session:{session_id}", session_data, 0, json.dumps({}))
)
conn.commit()
print(f"New session: {session_id}")
conn.close()

import sqlite3, os, json

db_path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\miniflare-KVNamespaceObject\1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite"
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT key, expiration FROM _mf_entries WHERE key LIKE 'session:%' AND expiration > ?", (int(__import__('time').time() * 1000),))
for k, exp in cur.fetchall():
    print(f"{k}: exp={exp}")
conn.close()

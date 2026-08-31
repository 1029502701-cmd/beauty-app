import sqlite3
conn = sqlite3.connect(".wrangler/state/v3/kv/miniflare-KVNamespaceObject/1115e4b153d0c8d8aef986f09e264166bf5aff6ffcdd65baafde1da11f460aa1.sqlite")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cur.fetchall())
try:
    cur.execute("SELECT key, value FROM kv_items LIMIT 20")
    for row in cur.fetchall():
        print(f"{row[0]}: {str(row[1])[:100]}")
except Exception as e:
    print(f"Error: {e}")
conn.close()

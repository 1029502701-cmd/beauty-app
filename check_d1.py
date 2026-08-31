import sqlite3
conn = sqlite3.connect(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", cur.fetchall())
try:
    cur.execute("SELECT * FROM d1_databases")
    for r in cur.fetchall():
        print(r)
except Exception as e:
    print("Error:", e)
    cur.execute("PRAGMA table_info(d1_databases)")
    print("Cols:", cur.fetchall())
conn.close()

import sqlite3
for f in [
    ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite",
    ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite",
    ".wrangler/state/v3/d1/beauty-app.db"
]:
    try:
        conn = sqlite3.connect(f)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"{f.split('/')[-1]}: {tables}")
        if "users" in tables:
            cur.execute("SELECT id, phone FROM users WHERE phone='13900000066'")
            print(f"  User: {cur.fetchall()}")
        conn.close()
    except Exception as e:
        print(f"{f}: Error {e}")

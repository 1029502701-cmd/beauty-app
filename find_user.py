import sqlite3

# Project DB
proj = r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
home = r'C:\Users\yao\.wrangler\state\v3\d1\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'

for name, path in [("Project", proj), ("Home", home)]:
    conn = sqlite3.connect(path)
    rows = conn.execute("SELECT id, phone FROM users WHERE phone='13900000006'").fetchall()
    print(f"{name} DB - User 13900000006: {rows}")
    rows2 = conn.execute("SELECT id, phone FROM users ORDER BY created_at DESC LIMIT 3").fetchall()
    print(f"{name} DB - Latest users: {rows2}")
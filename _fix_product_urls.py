import sqlite3, json, time

db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)

# Get current tier2 content
row = conn.execute("SELECT content FROM reports_tier2 WHERE id='fdd82328-b059-4bd3-a353-6a46cb0291ea'").fetchone()
content = json.loads(row[0])

# Add itemUrl and curatedProduct to each product
for dim, products in content.get('productRecs', {}).items():
    for p in products:
        p['itemUrl'] = 'https://item.taobao.com/item.htm?id=' + str(hash(p['name']) % 100000000)
        p['curatedProduct'] = {
            'name': p['name'] + '（精选替代款）',
            'price': '¥' + str(int(p['price'].replace('¥','').split('/')[0]) - 50) + '/件',
            'imageUrl': p['imageUrl'],
            'itemUrl': 'https://item.taobao.com/item.htm?id=' + str(hash(p['name']+'x') % 100000000)
        }

conn.execute("UPDATE reports_tier2 SET content=? WHERE id='fdd82328-b059-4bd3-a353-6a46cb0291ea'", (json.dumps(content, ensure_ascii=False),))
conn.commit()
print("Updated productRecs with itemUrl and curatedProduct")

# Verify
v = conn.execute("SELECT content FROM reports_tier2 WHERE id='fdd82328-b059-4bd3-a353-6a46cb0291ea'").fetchone()
c = json.loads(v[0])
for dim, prods in c.get('productRecs', {}).items():
    for p in prods:
        print(f"  {dim}: {p['name']} | link={p.get('itemUrl','MISSING')[:40]} | curated={p.get('curatedProduct','MISSING').get('name','')}")
conn.close()
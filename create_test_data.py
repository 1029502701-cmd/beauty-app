import sqlite3, json, time

conn = sqlite3.connect(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite")
cur = conn.cursor()

now_ms = int(time.time() * 1000)
user_id = "a81fb3b8-6994-4f10-bd72-d1d16b5b4733"

# Create tier1 report
tier1_data = json.dumps({
    "faceShape": "oval",
    "skinType": "combination",
    "eyebrowShape": "natural拱形",
    "eyeShape": "almond",
    "threeFiveRatio": "balanced",
    "symmetry": "high",
    "skinTone": "warm",
    "lipShape": "medium",
    "noseShape": "straight"
}, ensure_ascii=False)

cur.execute("INSERT OR REPLACE INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)",
    ("t1-e2e-test", user_id, tier1_data, now_ms))

# Create tier2 report with full content
tier2_content = json.dumps({
    "coreMakeup": "温柔日常妆",
    "reason": " Oval face shape and warm skin tone suit soft, natural makeup styles",
    "style": "日常通勤",
    "keyAreas": [
        "底妆：选择轻薄持妆型粉底液，色号匹配暖调肤色",
        "眉毛：自然拱形眉，用眉粉填充空隙即可",
        "眼妆：大地色系眼影，内眼线+自然睫毛",
        "腮红：珊瑚色斜扫颧骨，提升气色",
        "唇妆：豆沙色或水红色唇膏，水光质感",
        "修容：轻扫下颌线，突出 oval 脸型优势"
    ],
    "formula": "清透底妆 + 大地眼妆 + 珊瑚腮红 + 水光唇釉",
    "productRecs": {
        "faceShape": [
            {"name": "完美日记小细跟口红#09", "desc": "豆沙色日常百搭", "imageUrl": "https://img.alicdn.com/imgextra/i1/test1.jpg", "price": "7900", "itemUrl": "https://item.taobao.com/item.htm?id=123456789", "shopTitle": "完美日记旗舰店", "brandName": "Perfect Diary"},
            {"name": "NARS大白饼", "desc": "定妆持妆两用", "imageUrl": "https://img.alicdn.com/imgextra/i2/test2.jpg", "price": "28000", "itemUrl": "https://item.taobao.com/item.htm?id=123456790", "shopTitle": "NARS官方旗舰店", "brandName": "NARS"}
        ],
        "skinType": [
            {"name": "兰蔻持妆粉底液", "desc": "混油皮亲妈，轻薄持妆", "imageUrl": "https://img.alicdn.com/imgextra/i3/test3.jpg", "price": "38000", "itemUrl": "https://item.taobao.com/item.htm?id=123456791", "shopTitle": "兰蔻官方旗舰店", "brandName": "Lancome"}
        ],
        "eyebrowShape": [
            {"name": "植村秀砍刀眉笔", "desc": "自然眉形神器", "imageUrl": "https://img.alicdn.com/imgextra/i4/test4.jpg", "price": "21000", "itemUrl": "https://item.taobao.com/item.htm?id=123456792", "shopTitle": "植村秀官方旗舰店", "brandName": "Shu Uemura"}
        ],
        "eyeShape": [
            {"name": "3CE九色眼影盘 #ODETOFIELD", "desc": "大地色系万能盘", "imageUrl": "https://img.alicdn.com/imgextra/i5/test5.jpg", "price": "12900", "itemUrl": "https://item.taobao.com/item.htm?id=123456793", "shopTitle": "3CE官方旗舰店", "brandName": "3CE"}
        ],
        "threeFiveRatio": [
            {"name": "ROM&ND唇釉#05", "desc": "水光嘟嘟唇", "imageUrl": "https://img.alicdn.com/imgextra/i6/test6.jpg", "price": "5900", "itemUrl": "https://item.taobao.com/item.htm?id=123456794", "shopTitle": "ROMAND旗舰店", "brandName": "ROMAND"}
        ],
        "symmetry": [
            {"name": "Fenty Beauty修容棒", "desc": "精准修容不显脏", "imageUrl": "https://img.alicdn.com/imgextra/i7/test7.jpg", "price": "26000", "itemUrl": "https://item.taobao.com/item.htm?id=123456795", "shopTitle": "Fenty Beauty旗舰店", "brandName": "Fenty Beauty"}
        ]
    },
    "overallTips": "日常通勤妆以清透自然为主，突出皮肤好质感，眼妆不宜过重，唇色选择豆沙/水红色系最安全。"
}, ensure_ascii=False)

cur.execute("INSERT OR REPLACE INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ("t2-e2e-test", user_id, tier2_content, "ready", "t1-e2e-test", now_ms, now_ms))

conn.commit()

# Verify
cur.execute("SELECT id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE id='t2-e2e-test'")
print("Tier2:", cur.fetchone())
cur.execute("SELECT id, user_id FROM reports_tier1 WHERE id='t1-e2e-test'")
print("Tier1:", cur.fetchone())
conn.close()
print("Done!")

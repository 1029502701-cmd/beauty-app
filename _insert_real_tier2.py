import sqlite3, json, uuid, time

# Use the ACTIVE database (the one the server is using)
db_path = r'pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite'
conn = sqlite3.connect(db_path)

# Clean up old tier2 test records for user-test-001
conn.execute("DELETE FROM reports_tier2 WHERE user_id='user-test-001'")
conn.commit()

# Get or create user
user_row = conn.execute("SELECT id FROM users WHERE phone='13900000001'").fetchone()
if not user_row:
    user_id = str(uuid.uuid4())
    now = int(time.time())
    conn.execute("INSERT INTO users (id, phone, created_at, updated_at) VALUES (?, ?, ?, ?)", (user_id, '13900000001', now, now))
else:
    user_id = user_row[0]
print("User ID:", user_id)

# Create fresh tier1 report for this user
t1_id = str(uuid.uuid4())
now = int(time.time())
t1_data = {
    "faceShape": "圆脸", "skinType": "混合肌", "eyebrowShape": "一字眉",
    "eyeShape": "杏眼", "threeFiveRatio": "比例均衡型", "symmetry": "高对称度",
    "personaTags": "温柔知性风",
    "highlight": "你的五官比例很有辨识度，属于耐看型",
    "suggestions": ["建议尝试略带棱角的眉形拉长脸部视觉比例", "T区控油、U区保湿，分区护理效果更佳"]
}
conn.execute(
    "INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)",
    (t1_id, user_id, json.dumps(t1_data, ensure_ascii=False), now)
)
print("Created tier1:", t1_id)

# Create fresh tier2 with REAL content (area_* format)
t2_id = str(uuid.uuid4())
tier2_content = {
    "coreMakeup": "清透伪素颜妆，突出天然好气色",
    "reason": "你的面部特征非常适合自然清透的妆容风格，重点在于提升气色而非厚重修饰。",
    "style": "清透自然风",
    "area_faceShape": {
        "pros": "脸型轮廓柔和，下颌线条流畅，整体比例协调，属于百搭脸型。",
        "reason": "柔和的脸型轮廓让妆容可以自由选择多种风格，无需刻意修饰脸型问题。",
        "tips": "避免过重的修容，保持自然的立体感即可，重点放在眉眼和唇妆上。"
    },
    "area_skinType": {
        "pros": "肌肤状态良好，毛孔细腻，肤色均匀，属于健康的混合肌类型。",
        "reason": "混合肌的T区出油和两颊干燥需要分区护理，底妆选择半哑光质地最合适。",
        "tips": "妆前在T区使用控油妆前乳，两颊用保湿型妆前，底妆后T区轻扫散粉定妆。"
    },
    "area_eyebrowShape": {
        "pros": "眉形基础良好，眉峰自然，眉尾收得干净，只需微调即可达到理想效果。",
        "reason": "一字眉本身偏平直，稍加弧度能让脸型更立体，但不宜过度挑高。",
        "tips": "用眉粉填补眉毛稀疏处，眉峰位置略高于瞳孔外侧边缘，眉尾自然收细。"
    },
    "area_eyeShape": {
        "pros": "眼型圆润有神，眼角微微上扬，适合打造温柔系眼妆。",
        "reason": "圆润的眼型搭配大地色系眼影可以放大双眼效果，同时保持自然感。",
        "tips": "避免过于浓重的眼线，选择棕色系代替黑色，下眼睑用深色眼影轻扫增加深邃感。"
    },
    "area_threeFiveRatio": {
        "pros": "三庭五眼比例均衡，面部纵向和横向比例都接近黄金分割标准。",
        "reason": "均衡的比例让妆容可以大胆尝试不同风格，不需要通过化妆来修正比例问题。",
        "tips": "保持现有比例优势，重点放在提升皮肤质感和气色上，不要过度修容。"
    },
    "area_symmetry": {
        "pros": "面部对称度高，五官分布均匀，整体视觉和谐美观。",
        "reason": "高对称度是颜值的重要加分项，妆容可以更注重个性表达而非修正不对称。",
        "tips": "修容时注意两侧对称，腮红和高光的位置要保持平衡，避免一边重一边轻。"
    },
    "formula": "STEP 1: 保湿妆前乳打底 → STEP 2: 轻薄粉底液局部遮瑕 → STEP 3: 大地色眼影打底+加深 → STEP 4: 棕色眼线液笔画内眼线 → STEP 5: 睫毛夹卷翘+透明睫毛膏 → STEP 6: 蜜桃色腮红斜扫颧骨 → STEP 7: 豆沙色润色唇膏",
    "overallTips": "整体妆容以清透自然为主，重点突出皮肤质感和好气色。避免过于浓重的修容和闪粉，让五官的自然美成为主角。",
    "productRecs": {
        "faceShape": [{"name": "CPB 长管隔离霜", "desc": "妆前打底神器，打造持久服帖的底妆基础", "price": "¥680/40ml", "imageUrl": "https://img.alicdn.com/imgextra/i4/O1CN01abc123_!!6000000000123-2-yahoo.jpg"}],
        "skinType": [{"name": "NARS 超方瓶粉底液", "desc": "轻薄持妆，混合肌友好，打造自然光泽肌", "price": "¥420/30ml", "imageUrl": "https://img.alicdn.com/imgextra/i1/O1CN01def456_!!6000000000456-2-yahoo.jpg"}],
        "eyebrowShape": [{"name": "植村秀砍刀眉笔 #214", "desc": "自然棕色，画出根根分明的毛流感眉毛", "price": "¥260/1.5g", "imageUrl": "https://img.alicdn.com/imgextra/i2/O1CN01ghi789_!!6000000000789-2-yahoo.jpg"}],
        "eyeShape": [{"name": "3CE 九色眼影盘 #Overtake", "desc": "大地色系百搭盘，消肿显深邃", "price": "¥239", "imageUrl": "https://img.alicdn.com/imgextra/i3/O1CN01jkl012_!!6000000000012-2-yahoo.jpg"}],
        "threeFiveRatio": [{"name": "Fenty Beauty 高光修容盘", "desc": "自然提亮，适合亚洲肤色", "price": "¥320", "imageUrl": "https://img.alicdn.com/imgextra/i4/O1CN01mno345_!!6000000000345-2-yahoo.jpg"}],
        "symmetry": [{"name": "Rom&nd 果汁唇釉 #11", "desc": "水光质感豆沙色，日常百搭不挑人", "price": "¥79", "imageUrl": "https://img.alicdn.com/imgextra/i1/O1CN01pqr678_!!6000000000678-2-yahoo.jpg"}]
    }
}
conn.execute(
    "INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    (t2_id, user_id, json.dumps(tier2_content, ensure_ascii=False), "ready", t1_id, now)
)
conn.commit()
print("Created tier2:", t2_id)

# Verify
v = conn.execute("SELECT id, generation_status, source_tier1_report_id FROM reports_tier2 WHERE id=?", (t2_id,)).fetchone()
print("Verify:", v)

# Also update tier2_btn_color to black
conn.execute("UPDATE app_config SET value='#000000', updated_at=? WHERE key='tier2_btn_color'", (now,))
conn.commit()
print("Set tier2_btn_color to #000000")

conn.close()
print("\nDone! tier2_id =", t2_id)
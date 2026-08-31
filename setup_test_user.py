import sqlite3, json, uuid
conn = sqlite3.connect(r'C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite')

# Get the new user ID
user_row = conn.execute("SELECT id FROM users WHERE phone='13900000007'").fetchone()
user_id = user_row[0]
print(f"User ID: {user_id}")

# Create tier1 report
tier1_data = json.dumps({"faceShape":"方脸","skinType":"干性肌","eyebrowShape":"平眉","eyeShape":"丹凤眼","threeFiveRatio":"上庭偏长","symmetry":"中等对称度","personaTags":["成熟干练","气场强","中性风"],"highlight":"下颌线清晰有棱角，颧骨略高，整体轮廓偏硬朗","suggestions":["柔和眉形可弱化方脸的硬朗感","干皮需加强保湿底妆避免卡粉","丹凤眼适合猫眼线加大地色消肿","上庭长可用刘海或侧分修饰","用暖色调腮红中和冷硬感"]}, ensure_ascii=False)
conn.execute("INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)",
    ["t1-test-007", user_id, tier1_data, 1787749000])

# Create tier2 record
tier2_id = str(uuid.uuid4())
conn.execute("INSERT INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [tier2_id, user_id, "t1-test-007", "pending", "{}", 1787749000])
conn.commit()
print(f"Created tier1: t1-test-007, tier2: {tier2_id}")
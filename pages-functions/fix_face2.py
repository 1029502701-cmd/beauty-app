import sys
sys.stdout.reconfigure(encoding="utf-8")
path = r"functions/api/tier1/analyze.ts"
content = open(path, encoding="utf-8-sig").read()
old = '  // faceCount === -1 表示校验步骤失败，降级继续分析（保守策略）\n  // faceCount === 1 表示通过校验，继续正常流程\n  if (faceCount === 1) {\n    console.log("[tier1/analyze] Face count validated: exactly 1 face, proceeding to analysis");\n  }\n  // ===== 人脸校验结束 ====='
new = '  // faceCount === -1 表示校验步骤失败，拦截并提示用户重试\n  // faceCount === 1 表示通过校验，继续正常流程\n  if (faceCount === -1) {\n    console.warn("[tier1/analyze] Face count check failed, blocking analysis");\n    return new Response(\n      JSON.stringify({ error: "face_check_failed", message: "人脸校验服务异常，请重试" }),\n      { status: 503, headers: { "Content-Type": "application/json" } }\n    );\n  }\n  if (faceCount === 1) {\n    console.log("[tier1/analyze] Face count validated: exactly 1 face, proceeding to analysis");\n  }\n  // ===== 人脸校验结束 ====='
if old in content:
    content = content.replace(old, new)
    open(path, "w", encoding="utf-8-sig").write(content)
    print("FIXED")
else:
    print("NOT FOUND")

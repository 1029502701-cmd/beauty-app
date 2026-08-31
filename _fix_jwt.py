with open("pages-functions/functions/api/debug/jwt-test.ts", "r", encoding="utf-8") as f:
    c = f.read()
old = """  return new Response(JSON.stringify({
    hasJwtSecret: !!secret,
    secretLength: secret?.length ?? 0,
    secretFirst4: secret?.slice(0, 4) ?? 'none',
    sigResult,
    verifyResult,
    tokenPayload,
  }), { headers: { 'Content-Type': 'application/json' } });"""
new = """  return new Response(JSON.stringify({
    hasJwtSecret: !!secret,
    sigResult,
    verifyResult,
    tokenPayload,
  }), { headers: { 'Content-Type': 'application/json' } });"""
c = c.replace(old, new)
with open("pages-functions/functions/api/debug/jwt-test.ts", "w", encoding="utf-8") as f:
    f.write(c)
print("jwt-test.ts updated:", "secretLength" not in c)

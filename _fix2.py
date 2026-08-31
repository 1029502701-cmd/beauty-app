with open("pages-functions/functions/api/debug/jwt-test.ts", "r", encoding="utf-8") as f:
    c = f.read()
c = c.replace("secretLength: secret?.length ?? 0,\n    ", "")
c = c.replace("secretFirst4: secret?.slice(0, 4) ?? \'none\',\n", "")
with open("pages-functions/functions/api/debug/jwt-test.ts", "w", encoding="utf-8") as f:
    f.write(c)
print("secretLength:", "secretLength" in c)
print("secretFirst4:", "secretFirst4" in c)

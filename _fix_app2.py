import sys; sys.stdout.reconfigure(encoding="utf8")
path = r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\App.jsx"
c = open(path, "r", encoding="utf8").read()
old = "} else if (!token && path !== '/login' && path !== '/admin/login') {"
new = "} else if (!token && path !== '/login' && path !== '/admin/login' && !path.startsWith('/admin')) {"
c = c.replace(old, new)
open(path, "w", encoding="utf8").write(c)
print("Fixed, /admin occurrences:", c.count("/admin"))
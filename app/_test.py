import os, base64

base = \"U:\Users\\yao\\Documents\\ChatGPT\:\定／app\/app\/src\"

def w(p, c):
    fp = os.path.join(base, p)
    with open(fp, "w", encoding="utf-8") as f:
        f.write(c)
    print("wrote " + p)

print("hello")

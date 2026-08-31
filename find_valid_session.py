import hashlib, os, json, time

blob_dir = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\kv\9f3105f5547642b693452f5f740f8e2c\blobs"
files = os.listdir(blob_dir)
now = int(time.time())

# We know our session blob is 262db57ed6118fb730410b2d37112580d0dc2128e6d4b0f92ac3ec956feb346f
# Let's verify it exists and find the token
for fname in files:
    if fname.startswith("262db57ed6118fb73041"):
        fp = os.path.join(blob_dir, fname)
        with open(fp, "rb") as f:
            data = f.read()
        obj = json.loads(data)
        print(f"Found our session: {fname}")
        print(f"  Content: {data.decode()}")
        # The key was session:sess-1787877250
        key = "session:sess-1787877250"
        h = hashlib.sha256(key.encode()).hexdigest()
        print(f"  Key: {key}")
        print(f"  SHA256: {h}")
        print(f"  Match: {h == fname[:64]}")
        break

# Also check the other session we created
for fname in files:
    if fname.startswith("cfd60a0132c81cb6ea9f"):
        fp = os.path.join(blob_dir, fname)
        with open(fp, "rb") as f:
            data = f.read()
        obj = json.loads(data)
        print(f"\nFound session2: {fname}")
        key = "session:sess-1787877195"
        h = hashlib.sha256(key.encode()).hexdigest()
        print(f"  Key: {key}")
        print(f"  SHA256: {h}")
        print(f"  Match: {h == fname[:64]}")
        print(f"  Content: {data.decode()}")
        break

# Find a session for user 4cdf0d1b-9009-4313-af9b-2ba585af1ff1 (has tier2 reports)
print("\n--- Finding session for user 4cdf0d1b ---")
for fname in files:
    fp = os.path.join(blob_dir, fname)
    with open(fp, "rb") as f:
        data = f.read()
    try:
        obj = json.loads(data)
        if obj.get("userId") == "4cdf0d1b-9009-4313-af9b-2ba585af1ff1" and obj.get("expiresAt", 0) > now:
            # Try to find the token by checking common patterns
            # The blob prefix is the sha256 of "session:{token}"
            prefix = fname[:64]
            # Try UUID-format tokens
            import uuid
            for _ in range(100):
                token = str(uuid.uuid4())
                key = f"session:{token}"
                h = hashlib.sha256(key.encode()).hexdigest()
                if h == prefix:
                    print(f"  FOUND token: {token}")
                    print(f"  User: {obj['userId']}, Expires: {obj['expiresAt']}")
                    break
            else:
                print(f"  Found session for user 4cdf0d1b, prefix={prefix}, could not reverse token")
    except:
        pass

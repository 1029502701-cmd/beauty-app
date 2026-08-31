$base = "C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject"
Get-ChildItem $base -Filter "*.sqlite-wal" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $base -Filter "*.sqlite-shm" | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "WAL cleaned"

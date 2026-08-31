$base = "C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\miniflare-D1DatabaseObject"
Get-ChildItem $base -Filter "*.sqlite" | Where-Object { $_.Name -notmatch "_old" -and $_.Name -notmatch "metadata" } | Remove-Item -Force
Get-ChildItem $base -Filter "*.sqlite-wal" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $base -Filter "*.sqlite-shm" | Remove-Item -Force -ErrorAction SilentlyContinue
$nested = "C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\.wrangler\state\v3\d1\v3\d1\miniflare-D1DatabaseObject"
Get-ChildItem $nested -Filter "*.sqlite" | Where-Object { $_.Name -notmatch "metadata" } | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $nested -Filter "*.sqlite-wal" | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem $nested -Filter "*.sqlite-shm" | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "Done cleaning"

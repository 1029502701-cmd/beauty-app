$src = "C:\Users\yao\Documents\ChatGPT\美妆app\browser_test_v4.js"
$dst = "C:\Users\yao\Documents\ChatGPT\美妆app\browser_prod_test.js"
$c = Get-Content $src -Raw -Encoding UTF8
$c = $c -replace "http://localhost:8788","https://e9fcd454.beauty-api-pages.pages.dev"
$c = $c -replace "'test_output/face_photo.jpg'","`"D:/photo.jpg`""
Set-Content $dst $c -Encoding UTF8 -NoNewline
Write-Host "done"

@echo off
cd /d "C:\Users\yao\Documents\ChatGPT\美妆app"

echo Checking account...
call wrangler whoami

echo Building frontend...
cd app
call npm install
call npm run build
cd ..

echo Building functions...
cd pages-functions
call npx wrangler pages functions build --outdir dist
cd ..

echo Assembling deploy dir (static + _.js worker + _routes.json)...
if exist pages-functions\deploy-final rmdir /s /q pages-functions\deploy-final
mkdir pages-functions\deploy-final
xcopy /e /i /y /q app\dist\* pages-functions\deploy-final\
copy /y pages-functions\dist\_routes.json pages-functions\deploy-final\_routes.json
copy /y pages-functions\dist\index.js pages-functions\deploy-final\_.js

echo Deploying to master (single combined deploy)...
cd pages-functions
call npx wrangler pages deploy .\deploy-final --project-name=beauty-api-pages --branch=master --skip-caching
cd ..

echo Verifying API...
powershell -Command "try { Invoke-WebRequest -Uri https://beauty.meijian.top/api/config/feature_request_message -UseBasicParsing -TimeoutSec 30 | Select-Object -ExpandProperty Content } catch { Write-Host (\"API CHECK FAILED: \" + $_.Exception.Message) }"

echo Done!
pause

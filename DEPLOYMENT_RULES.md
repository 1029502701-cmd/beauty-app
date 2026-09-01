# Deployment Rules

## Production Deploy Command

\\\ash
cd pages-functions
npx wrangler pages deploy ./dist --project-name=beauty-api-pages --branch=master --skip-caching
\\\

**必须从 pages-functions 目录部署**，不能从 deploy-root 或根目录部署。
deploy-root 只包含静态前端文件，不包含 Cloudflare Functions（API）。

## Auth

- Account ID: \235c8c471fbed899968bedeb565015cf\
- 部署前确认: \
px wrangler whoami\ 显示账户为 \1029502701@qq.com\
- 如果 whoami 显示错误账户，设置正确的 API Token 环境变量

## Key Rules

- **必须使用 account \235c8c47...\\**，OAuth 默认登录到另一个账户
- **必须从 pages-functions 目录部署**（包含 functions bundle + 静态资源）
- 始终用 --branch=master
- 部署后双域名生效：beauty-api-pages.pages.dev 和 ccfu.ccwu.cc
- 2026-09-01: 修复登录重定向循环 — tokenProcessRef 在注销时未重置

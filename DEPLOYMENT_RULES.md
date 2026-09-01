# Deployment Rules

## Production Deploy Command (must use --branch=master)

`
npx wrangler pages deploy ./deploy-root --project-name=beauty-api-pages --branch=master --skip-caching
`

## Key Rules

- **Always use --branch=master**, otherwise it may default to main branch and overwrite Production with old code
- Always run from root directory, path is ./deploy-root (not ../deploy-root)
- Before deploying, verify deploy-root/index.html references the latest JS filename
- After deploy, both domains serve new code: beauty-api-pages.pages.dev and ccfu.ccwu.cc
- 2026-09-01: Fixed - old index-DnaWWMaC.js was served because deploy-root was not synced with latest vite build

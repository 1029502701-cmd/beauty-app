# Beauty App 版本记录

{
  "version": "v3",
  "commit": "3ff3248",
  "timestamp": "2026-09-04T02:15:59.706Z",
  "description": "路由修复+人脸校验降级",
  "environments": {
    "github": "https://github.com/1029502701-cmd/beauty-app",
    "pages_dev": "https://beauty-api-pages.pages.dev",
    "custom_domain": "https://ccfu.ccwu.cc"
  },
  "fixes": [
    "_routes.json 参数化路由从 :key* 改为 /*，解决 404",
    "DASHSCOPE_API_KEY 缺失时人脸校验降级放行，不再 503 拦截"
  ],
  "verification": {
    "bundle_size": 191552,
    "static_assets_ok": true,
    "parametric_routes_ok": true,
    "face_check_bypass": true
  }
}

## 三端状态

| 端 | URL | 状态 |
|----|-----|------|
| GitHub | https://github.com/1029502701-cmd/beauty-app | ✅ 3ff3248 |
| Pages Dev | https://beauty-api-pages.pages.dev | ✅ 已部署 |
| 自定义域名 | https://ccfu.ccwu.cc | ✅ 已部署 |

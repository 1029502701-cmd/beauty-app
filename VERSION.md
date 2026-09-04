# Beauty App 版本记录

## v3 (当前生产)

- **Commit**: 3ff3248
- **时间**: 2026-09-04
- **Bundle**: 191,552 bytes

### 修复内容
1. _routes.json 参数化路由从 :key* 改为 /* — 解决 /api/config/:key、/api/test-route/:param、/api/r2-perm/:key 等返回 HTML 的问题
2. DASHSCOPE_API_KEY 缺失时人脸校验降级放行 — 不再 503 拦截分析流程

---

## 三端状态

| 端 | URL | 状态 |
|----|-----|------|
| GitHub | https://github.com/1029502701-cmd/beauty-app | ✅ 3ff3248 |
| Pages Dev | https://beauty-api-pages.pages.dev | ✅ 已部署 |
| 自定义域名 | https://ccfu.ccwu.cc | ✅ 已部署 |

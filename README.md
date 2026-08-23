# AI 美妆分析 App

跨平台 React + Capacitor 应用，后端运行在 Cloudflare 全家桶上。

## 技术栈

- **前端**: React 19 + Vite 8 + Capacitor 6
- **后端 API**: Cloudflare Pages Functions
- **定时任务**: Cloudflare Workers (独立 Scheduled Worker)
- **数据库**: Cloudflare D1
- **对象存储**: Cloudflare R2
- **鉴权**: Session + Workers KV

## 项目结构

```
/beauty-app
  /app                  # React + Capacitor 前端
  /pages-functions      # Cloudflare Pages Functions（用户端 API）
  /scheduled-worker     # 独立 Scheduled Worker（定时清理任务）
  /migrations           # D1 migration SQL 文件
```

## 快速开始

### 前置要求
- Node.js 18+
- `wrangler` 已全局安装并已登录 (`wrangler login`)
- Android Studio（安卓打包）；iOS 打包需 Mac

### 安装依赖
```bash
npm install
```

### 本地开发
```bash
# Web 前端
npm run dev:web

# Pages Functions（需配置 wrangler.toml 中的 D1/R2）
npm run dev:pages

# Scheduled Worker
npm run dev:scheduled
```

### 构建前端
```bash
npm run build
```

### 移动端打包
```bash
# 同步到原生项目
npx cap sync

# 打开 Android Studio
npx cap open android

# 打开 Xcode（需要 Mac）
npx cap open ios
```

## Cloudflare 资源准备

在部署前需要创建以下资源，并更新对应的 `wrangler.toml`：

1. **D1 数据库**: `npx wrangler d1 create beauty-app`
2. **R2 Bucket (临时)**: `npx wrangler r2 bucket create beauty-temp`
3. **R2 Bucket (永久)**: `npx wrangler r2 bucket create beauty-perm`
4. **KV Namespace (Session)**: `npx wrangler kv:namespace create SESSION`

然后运行迁移：
```bash
npx wrangler d1 migrations apply --local --project-name=beauty-app
```
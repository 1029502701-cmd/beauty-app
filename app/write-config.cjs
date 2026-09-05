const ts = '20260904172855';
const fs = require('fs');
const path = require('path');
const config = \import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BUILD_TS = '\20260904172855'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cache-bust',
      closeBundle() {
        const html = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8')
        const updated = html
          .replace(/(src="\\/assets\\/[^"]+\\.js)("\s*>)/g, '\=' + BUILD_TS + '\')
          .replace(/(href="\\/assets\\/[^"]+\\.css)("\s*>)/g, '\=' + BUILD_TS + '\')
        writeFileSync(join(process.cwd(), 'dist', 'index.html'), updated, 'utf-8')
      },
    },
  ],
  optimizeDeps: { noDiscovery: true },
  build: { sourcemap: true },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
})
\;
fs.writeFileSync(path.join(__dirname, 'vite.config.js'), config);
console.log('Done, ts:', ts);
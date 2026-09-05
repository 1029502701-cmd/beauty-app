const ts = new Date().toISOString().replace(/[-T:Z]/g,'').slice(0,14);
const config = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BUILD_TS = '${ts}'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cache-bust',
      closeBundle() {
        const html = readFileSync(join(process.cwd(), 'dist', 'index.html'), 'utf-8')
        const updated = html
          .replace(/(src="\\/assets\\/[^"]+\\.js)("\s*>)/g, '$1?v=' + BUILD_TS + '$2')
          .replace(/(href="\\/assets\\/[^"]+\\.css)("\s*>)/g, '$1?v=' + BUILD_TS + '$2')
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
`;
require('fs').writeFileSync('vite.config.js', config, 'utf-8');
console.log('Done, ts:', ts);

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderSiteMetadata } from './scripts/site-metadata.js'
import { arxivDevPlugin } from './scripts/arxiv-dev.js'

const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date()).replaceAll('-', '/')

// https://vite.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: '../public',
  build: { copyPublicDir: false },
  plugins: [react(), arxivDevPlugin(), {
    name: 'site-metadata',
    transformIndexHtml(html) {
      const site = JSON.parse(fs.readFileSync(new URL('./config/site.json', import.meta.url), 'utf8'))
      return renderSiteMetadata(html, site)
    },
  }],
  define: {
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
  },
  base: '/'
})

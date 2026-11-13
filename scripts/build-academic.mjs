import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const academicDir = path.join(rootDir, 'academic')
const publicDir = path.join(rootDir, 'public')
const distDir = path.join(rootDir, 'dist')
const blogDir = path.join(distDir, 'blog')
const siteUrl = 'https://torchmar.github.io/'
const directoryAliasMarker = '<!-- generated directory alias -->'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}

function escapeXml(value) {
  return escapeHtml(value)
}

function render404(site) {
  return `<!doctype html>
<html lang="${escapeHtml(site.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 | ${escapeHtml(site.title)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/images/favicon.ico">
  <style>
    body {
      display: grid;
      min-height: 100svh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      place-items: center;
      font: 16px/1.6 system-ui, sans-serif;
      color: #212529;
      text-align: center;
    }
    h1 { margin: 0; font-size: 3rem; }
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
    a { color: #514c8a; }
  </style>
  <script>
    (() => {
      const path = window.location.pathname
      const suffix = window.location.search + window.location.hash
      const legacyRoots = /^\\/(about|archives|categories|links|page|posts|tags)(\\/|$)/
      if (legacyRoots.test(path)) {
        window.location.replace('/blog' + path + suffix)
        return
      }
      if (path.startsWith('/blog/') && path !== '/blog/404') {
        window.location.replace('/blog/404')
      }
    })()
  </script>
</head>
<body>
  <main>
    <h1>404</h1>
    <p>The page you requested could not be found.</p>
    <nav aria-label="Main navigation">
      <a href="/">Academic homepage</a>
      <a href="/blog/">Blog</a>
    </nav>
  </main>
</body>
</html>
`
}

async function readOptional(filePath) {
  try {
    return await fs.readFile(filePath)
  }
  catch (error) {
    if (error.code === 'ENOENT')
      return null
    throw error
  }
}

async function findBlogHtmlFiles(directory = blogDir, relativeDirectory = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name)
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory())
      files.push(...await findBlogHtmlFiles(absolutePath, relativePath))
    else if (entry.isFile() && entry.name.endsWith('.html'))
      files.push(relativePath)
  }
  return files.sort()
}

function blogRouteFromHtml(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/')
  if (normalized === 'index.html')
    return '/blog/'
  if (normalized.endsWith('/index.html'))
    return `/blog/${normalized.slice(0, -'index.html'.length)}`
  return `/blog/${normalized.slice(0, -'.html'.length)}`
}

function absoluteSiteUrl(siteUrl, pathname) {
  return new URL(pathname, siteUrl).href
}

async function normalizeBlogMetadata(htmlFiles, siteUrl) {
  for (const relativePath of htmlFiles) {
    if (relativePath === '404.html')
      continue

    const filePath = path.join(blogDir, ...relativePath.split('/'))
    const canonical = absoluteSiteUrl(siteUrl, blogRouteFromHtml(relativePath))
    let html = await fs.readFile(filePath, 'utf8')
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/gi, '')
    html = html.replace(
      /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    )
    html = html.replace('</head>', `<link rel="canonical" href="${escapeHtml(canonical)}"></head>`)
    await fs.writeFile(filePath, html)
  }
}

async function excludeGeneratedDirectoryAliases(htmlFiles) {
  const primaryFiles = []
  for (const relativePath of htmlFiles) {
    const filePath = path.join(blogDir, ...relativePath.split('/'))
    const html = await fs.readFile(filePath, 'utf8')
    if (!html.includes(directoryAliasMarker))
      primaryFiles.push(relativePath)
  }
  return primaryFiles
}

async function writeBlogDirectoryAliases(htmlFiles) {
  const aliases = []
  const existingFiles = new Set(htmlFiles)

  for (const relativePath of htmlFiles) {
    const normalized = relativePath.replaceAll('\\', '/')
    if (normalized === 'index.html' || normalized === '404.html' || normalized.endsWith('/index.html'))
      continue

    const aliasPath = `${normalized.slice(0, -'.html'.length)}/index.html`
    if (existingFiles.has(aliasPath))
      continue

    const sourcePath = path.join(blogDir, ...normalized.split('/'))
    const targetPath = path.join(blogDir, ...aliasPath.split('/'))
    const existingAlias = await readOptional(targetPath)
    if (existingAlias && !existingAlias.toString().includes(directoryAliasMarker))
      continue

    const source = await fs.readFile(sourcePath, 'utf8')
    const alias = source.replace('<head>', `<head>\n  ${directoryAliasMarker}`)
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, alias)
    aliases.push(aliasPath)
  }

  return aliases.sort()
}

function legacyTargetFromHtml(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/')
  if (normalized.endsWith('/index.html'))
    return `/blog/${normalized.slice(0, -'index.html'.length)}`
  return `/blog/${normalized.slice(0, -'.html'.length)}`
}

function renderRedirect(relativePath, siteUrl) {
  const fallbackTarget = legacyTargetFromHtml(relativePath)
  const canonical = absoluteSiteUrl(siteUrl, fallbackTarget)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(fallbackTarget)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <title>Redirecting…</title>
  <script>
    (() => {
      const target = '/blog' + window.location.pathname + window.location.search + window.location.hash
      window.location.replace(target)
    })()
  </script>
</head>
<body>
  <p>Moved to <a href="${escapeHtml(fallbackTarget)}">${escapeHtml(fallbackTarget)}</a>.</p>
</body>
</html>
`
}

async function cleanAcademicOutput() {
  await fs.mkdir(distDir, { recursive: true })
  const entries = await fs.readdir(distDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === 'blog')
      continue
    await fs.rm(path.join(distDir, entry.name), { recursive: true, force: true })
  }
}

async function copyPublicCompatibilityAssets() {
  const reserved = new Set([
    '404.html',
    'atom.xml',
    'feed.json',
    'feed.xml',
    'index.html',
    'robots.txt',
    'sitemap.xml',
  ])
  const entries = await fs.readdir(publicDir, { withFileTypes: true })
  for (const entry of entries) {
    if (reserved.has(entry.name))
      continue
    await fs.cp(
      path.join(publicDir, entry.name),
      path.join(distDir, entry.name),
      { recursive: true, force: true },
    )
  }
}

async function writeLegacyRedirects(htmlFiles, siteUrl) {
  const redirectFiles = htmlFiles.filter(relativePath =>
    relativePath !== 'index.html' && relativePath !== '404.html')

  for (const relativePath of redirectFiles) {
    const targetPath = path.join(distDir, ...relativePath.split('/'))
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, renderRedirect(relativePath, siteUrl))
  }
}

async function syncFeeds(capturedFeeds) {
  for (const [name, contents] of Object.entries(capturedFeeds)) {
    if (!contents)
      continue
    await Promise.all([
      fs.writeFile(path.join(distDir, name), contents),
      fs.writeFile(path.join(blogDir, name), contents),
    ])
  }
}

function renderSitemap(siteUrl, htmlFiles) {
  const paths = ['/', ...htmlFiles
    .filter(relativePath => relativePath !== '404.html')
    .map(blogRouteFromHtml)]
  const uniqueUrls = [...new Set(paths.map(pathname => absoluteSiteUrl(siteUrl, pathname)))]
  const entries = uniqueUrls
    .map(url => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`
}

async function main() {
  const site = JSON.parse(await fs.readFile(path.join(academicDir, 'config', 'site.json'), 'utf8'))

  const blogIndex = path.join(blogDir, 'index.html')
  if (!await readOptional(blogIndex))
    throw new Error('dist/blog/index.html is missing; build the blog first')

  const feedNames = ['atom.xml', 'feed.xml', 'feed.json']
  const capturedFeeds = {}
  for (const name of feedNames) {
    capturedFeeds[name] = await readOptional(path.join(distDir, name))
      ?? await readOptional(path.join(blogDir, name))
      ?? await readOptional(path.join(publicDir, name))
  }
  for (const name of ['atom.xml', 'feed.xml']) {
    if (!capturedFeeds[name])
      throw new Error(`${name} was not generated by Valaxy`)
  }

  const discoveredHtmlFiles = await findBlogHtmlFiles()
  const htmlFiles = await excludeGeneratedDirectoryAliases(discoveredHtmlFiles)
  await normalizeBlogMetadata(htmlFiles, siteUrl)
  const directoryAliases = await writeBlogDirectoryAliases(htmlFiles)
  await cleanAcademicOutput()
  await copyPublicCompatibilityAssets()
  await build({
    root: academicDir,
    configFile: path.join(academicDir, 'vite.config.js'),
    build: { outDir: distDir, emptyOutDir: false },
    plugins: [{
      name: 'academic-canonical',
      transformIndexHtml() {
        return [{ tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' }]
      },
    }],
  })
  await fs.writeFile(path.join(distDir, '404.html'), render404(site))

  const redirectFiles = [...new Set([...htmlFiles, ...directoryAliases])]
  await writeLegacyRedirects(redirectFiles, siteUrl)
  await syncFeeds(capturedFeeds)
  await Promise.all([
    fs.writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(siteUrl, htmlFiles)),
    fs.writeFile(
      path.join(distDir, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: ${absoluteSiteUrl(siteUrl, '/sitemap.xml')}\n`,
    ),
  ])

  console.log(`Academic homepage built with ${redirectFiles.length} legacy redirects.`)
}

await main()

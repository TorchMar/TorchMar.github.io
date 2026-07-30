import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MarkdownIt from 'markdown-it'
import { parse } from 'yaml'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const academicDir = path.join(rootDir, 'academic')
const publicDir = path.join(rootDir, 'public')
const distDir = path.join(rootDir, 'dist')
const blogDir = path.join(distDir, 'blog')
const contentPath = path.join(academicDir, 'content.yml')
const directoryAliasMarker = '<!-- generated directory alias -->'

const sectionOrder = [
  'recentNews',
  'publications',
  'education',
  'researchExperience',
  'honors',
  'projects',
  'teaching',
  'academicService',
  'talks',
]

const timelineSections = new Set([
  'education',
  'researchExperience',
  'honors',
  'projects',
  'teaching',
  'academicService',
  'talks',
])

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
})

const originalLinkOpen = markdown.renderer.rules.link_open
  ?? ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const hrefIndex = tokens[index].attrIndex('href')
  const href = hrefIndex >= 0 ? tokens[index].attrs[hrefIndex][1] : ''
  if (/^https?:\/\//i.test(href)) {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
  }
  return originalLinkOpen(tokens, index, options, env, renderer)
}

function invariant(condition, message) {
  if (!condition)
    throw new Error(`Academic content error: ${message}`)
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

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

function localizedValue(value, language) {
  if (isObject(value)) {
    const selected = value[language]
    if (selected !== undefined && selected !== null && selected !== '')
      return selected
    return value.en ?? ''
  }
  return value ?? ''
}

function localizedPair(value) {
  return {
    en: localizedValue(value, 'en'),
    zh: localizedValue(value, 'zh'),
  }
}

function localizedArrays(value) {
  const en = Array.isArray(value?.en) ? value.en : []
  const zh = Array.isArray(value?.zh) && value.zh.length > 0 ? value.zh : en
  return { en, zh }
}

function renderLocalized(value, {
  tag = 'span',
  className = '',
  markdownMode = 'plain',
} = {}) {
  const pair = localizedPair(value)
  const renderValue = (text) => {
    if (markdownMode === 'block')
      return markdown.render(String(text ?? ''))
    if (markdownMode === 'inline')
      return markdown.renderInline(String(text ?? ''))
    return escapeHtml(text)
  }
  const classAttribute = className ? ` class="${escapeHtml(className)}"` : ''
  return [
    `<${tag}${classAttribute} data-lang="en">${renderValue(pair.en)}</${tag}>`,
    `<${tag}${classAttribute} data-lang="zh">${renderValue(pair.zh)}</${tag}>`,
  ].join('')
}

function safeUrl(value) {
  const url = String(value ?? '').trim()
  invariant(url.length > 0, 'link URLs cannot be empty')
  invariant(
    url === '#'
      || url.startsWith('/')
      || url.startsWith('#')
      || url.startsWith('mailto:')
      || /^https?:\/\//i.test(url),
    `unsupported URL "${url}"`,
  )
  return url
}

function linkAttributes(url) {
  if (/^https?:\/\//i.test(url))
    return ' target="_blank" rel="noopener noreferrer"'
  return ''
}

function renderLinks(links, className = 'entry-links') {
  if (!Array.isArray(links) || links.length === 0)
    return ''

  const rendered = links.map((link) => {
    invariant(isObject(link), 'each link must be an object')
    const url = safeUrl(link.url)
    return `<a href="${escapeHtml(url)}"${linkAttributes(url)}>${renderLocalized(link.label)}</a>`
  }).join('')

  return `<div class="${escapeHtml(className)}">${rendered}</div>`
}

function renderInterests(interests) {
  const values = localizedArrays(interests)
  return ['en', 'zh'].map((language) => {
    const items = values[language].map(item => `<li>${escapeHtml(item)}</li>`).join('')
    return `<ul class="interests" data-lang="${language}">${items}</ul>`
  }).join('')
}

function renderProfile(profile) {
  if (!profile.enabled)
    return ''

  const photo = safeUrl(profile.photo)
  const alt = localizedPair(profile.photoAlt)
  const email = String(profile.email ?? '').trim()
  const emailLink = email
    ? `<p class="profile-contact"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`
    : ''

  return `
    <section class="profile" id="profile" aria-labelledby="profile-name">
      <div class="profile-copy">
        <h1 id="profile-name">${renderLocalized(profile.name)}</h1>
        ${renderLocalized(profile.role, { tag: 'p', className: 'profile-role' })}
        ${renderLocalized(profile.affiliation, { tag: 'p', className: 'profile-affiliation' })}
        ${renderLocalized(profile.location, { tag: 'p', className: 'profile-location' })}
        ${renderLocalized(profile.bio, { tag: 'div', className: 'profile-bio', markdownMode: 'block' })}
        ${renderInterests(profile.researchInterests)}
        ${emailLink}
        ${renderLinks(profile.links, 'profile-links')}
      </div>
      <img
        class="profile-photo"
        src="${escapeHtml(photo)}"
        alt="${escapeHtml(alt.en)}"
        data-alt-en="${escapeHtml(alt.en)}"
        data-alt-zh="${escapeHtml(alt.zh)}"
        width="190"
        height="190"
      >
    </section>`
}

function sectionHeading(section, id) {
  return `<h2 class="section-heading" id="${escapeHtml(id)}-title">${renderLocalized(section.title)}</h2>`
}

function renderNews(section) {
  const items = section.items.map((item) => {
    const date = String(item.date ?? '')
    return `
      <li class="news-item">
        <time class="news-date">${escapeHtml(date)}</time>
        <div class="news-body">
          ${renderLocalized(item.text, { tag: 'div', markdownMode: 'block' })}
          ${renderLinks(item.links)}
        </div>
      </li>`
  }).join('')

  return `
    <section class="content-section" id="recent-news" aria-labelledby="recent-news-title">
      ${sectionHeading(section, 'recent-news')}
      <ul class="news-list">${items}</ul>
    </section>`
}

function renderPublications(section) {
  const intro = section.intro
    ? renderLocalized(section.intro, { tag: 'div', className: 'section-intro', markdownMode: 'block' })
    : ''

  const items = section.items.map((item) => {
    const venueWithYear = {
      en: [localizedValue(item.venue, 'en'), item.year].filter(Boolean).join(', '),
      zh: [localizedValue(item.venue, 'zh'), item.year].filter(Boolean).join('，'),
    }
    const note = localizedPair(item.note)
    const noteHtml = note.en || note.zh
      ? renderLocalized(item.note, { tag: 'p', className: 'publication-note', markdownMode: 'inline' })
      : ''

    return `
      <li class="publication-item">
        ${renderLocalized(item.title, { tag: 'h3', className: 'publication-title', markdownMode: 'inline' })}
        ${renderLocalized(item.authors, { tag: 'div', className: 'publication-authors', markdownMode: 'block' })}
        ${renderLocalized(venueWithYear, { tag: 'p', className: 'publication-venue' })}
        ${noteHtml}
        ${renderLinks(item.links)}
      </li>`
  }).join('')

  return `
    <section class="content-section" id="publications" aria-labelledby="publications-title">
      ${sectionHeading(section, 'publications')}
      ${intro}
      <ol class="publication-list">${items}</ol>
    </section>`
}

function renderTimelineSection(key, section) {
  const id = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  const intro = section.intro
    ? renderLocalized(section.intro, { tag: 'div', className: 'section-intro', markdownMode: 'block' })
    : ''

  const items = section.items.map((item) => {
    const location = localizedPair(item.location)
    const organization = localizedPair(item.organization)
    const organizationLine = {
      en: [organization.en, location.en].filter(Boolean).join(' · '),
      zh: [organization.zh, location.zh].filter(Boolean).join(' · '),
    }
    return `
      <li class="timeline-item">
        ${renderLocalized(item.period, { tag: 'div', className: 'timeline-period' })}
        <div class="timeline-content">
          ${renderLocalized(item.title, { tag: 'h3', className: 'timeline-title', markdownMode: 'inline' })}
          ${renderLocalized(organizationLine, { tag: 'p', className: 'entry-organization' })}
          ${renderLocalized(item.details, { tag: 'div', className: 'entry-details', markdownMode: 'block' })}
          ${renderLinks(item.links)}
        </div>
      </li>`
  }).join('')

  return `
    <section class="content-section" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
      ${sectionHeading(section, id)}
      ${intro}
      <ul class="timeline-list">${items}</ul>
    </section>`
}

function renderSection(key, section) {
  if (!section.enabled)
    return ''
  if (key === 'recentNews')
    return renderNews(section)
  if (key === 'publications')
    return renderPublications(section)
  if (timelineSections.has(key))
    return renderTimelineSection(key, section)
  throw new Error(`Unsupported academic section: ${key}`)
}

function sectionId(key) {
  if (key === 'recentNews')
    return 'recent-news'
  return key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

function renderNavigation(profile, sections) {
  const profileLink = profile.enabled
    ? `<a href="#profile">${renderLocalized({ en: 'Home', zh: '主页' })}</a>`
    : ''
  const sectionLinks = sectionOrder
    .filter(key => sections[key].enabled)
    .map(key => `<a href="#${sectionId(key)}">${renderLocalized(sections[key].title)}</a>`)
    .join('')
  return `${profileLink}${sectionLinks}<a href="/blog/">${renderLocalized({ en: 'Blog', zh: '博客' })}</a>`
}

function validateContent(content) {
  invariant(isObject(content), 'content.yml must contain an object')
  invariant(isObject(content.site), 'site is required')
  invariant(isObject(content.profile), 'profile is required')
  invariant(isObject(content.sections), 'sections is required')
  invariant(content.site.defaultLanguage === 'en', 'site.defaultLanguage must be "en"')
  invariant(typeof content.profile.enabled === 'boolean', 'profile.enabled must be true or false')
  invariant(content.profile.name, 'profile.name is required')
  invariant(content.profile.photo, 'profile.photo is required')
  invariant(Array.isArray(content.profile.links), 'profile.links must be an array')

  const siteUrl = new URL(content.site.url)
  invariant(siteUrl.protocol === 'https:', 'site.url must use HTTPS')

  for (const key of sectionOrder) {
    const section = content.sections[key]
    invariant(isObject(section), `sections.${key} is required`)
    invariant(typeof section.enabled === 'boolean', `sections.${key}.enabled must be true or false`)
    invariant(section.title, `sections.${key}.title is required`)
    invariant(Array.isArray(section.items), `sections.${key}.items must be an array`)
    if (section.enabled)
      invariant(section.items.length > 0, `enabled section sections.${key} must contain at least one item`)
  }
}

function languageBootstrapScript() {
  return `<script>(()=>{let l='en';try{if(localStorage.getItem('torchmar-academic-language')==='zh')l='zh'}catch{}document.documentElement.dataset.language=l;document.documentElement.lang=l==='zh'?'zh-CN':'en'})()</script>`
}

function renderIndex(content) {
  const { site, profile, sections } = content
  const title = localizedValue(site.title, 'en')
  const description = localizedValue(site.description, 'en')
  const siteName = profile.enabled ? profile.name : site.title
  const sameAs = profile.links
    .map(link => String(link.url ?? ''))
    .filter(url => /^https?:\/\//i.test(url))
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: localizedValue(profile.name, 'en'),
    url: site.url,
    image: new URL(profile.photo, site.url).href,
    email: profile.email ? `mailto:${profile.email}` : undefined,
    affiliation: localizedValue(profile.affiliation, 'en'),
    sameAs,
  }

  const renderedSections = sectionOrder
    .map(key => renderSection(key, sections[key]))
    .join('')

  return `<!doctype html>
<html lang="en" data-language="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${languageBootstrapScript()}
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="${escapeHtml(localizedValue(profile.name, 'en'))}">
  <meta property="og:type" content="profile">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(site.url)}">
  <meta property="og:locale" content="en_US">
  <meta property="og:locale:alternate" content="zh_CN">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="${escapeHtml(site.url)}">
  <link rel="icon" href="/images/favicon.ico">
  <link rel="stylesheet" href="/assets/academic.css">
  <script type="application/ld+json">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>
  <script src="/assets/academic-language.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${renderLocalized({ en: 'Skip to content', zh: '跳转到正文' })}</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="site-name" href="/">${renderLocalized(siteName)}</a>
      <nav class="site-nav" aria-label="Primary navigation">
        ${renderNavigation(profile, sections)}
      </nav>
      <label class="language-control" for="language-select">
        <span class="language-label">${renderLocalized({ en: 'Language', zh: '语言' })}</span>
        <select id="language-select" aria-label="Language">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </label>
    </div>
  </header>
  <main class="page-shell" id="main">
    ${renderProfile(profile)}
    ${renderedSections}
  </main>
  <footer class="site-footer">
    ${renderLocalized({
      en: `© ${new Date().getFullYear()} ${localizedValue(profile.name, 'en')}. Built as a static academic homepage.`,
      zh: `© ${new Date().getFullYear()} ${localizedValue(profile.name, 'zh')}。静态学术主页。`,
    })}
  </footer>
</body>
</html>
`
}

function render404(content) {
  const title = localizedValue(content.site.title, 'en')
  return `<!doctype html>
<html lang="en" data-language="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${languageBootstrapScript()}
  <title>404 | ${escapeHtml(title)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/images/favicon.ico">
  <link rel="stylesheet" href="/assets/academic.css">
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
  <script src="/assets/academic-language.js" defer></script>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a class="site-name" href="/">${renderLocalized(content.profile.name)}</a>
      <div class="site-nav"></div>
      <label class="language-control" for="language-select">
        <span class="language-label">${renderLocalized({ en: 'Language', zh: '语言' })}</span>
        <select id="language-select" aria-label="Language">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </label>
    </div>
  </header>
  <main class="page-shell not-found">
    <div class="not-found-card">
      <h1>404</h1>
      ${renderLocalized({
        en: 'The page you requested could not be found.',
        zh: '没有找到你访问的页面。',
      }, { tag: 'p' })}
      <div class="not-found-actions">
        <a href="/">${renderLocalized({ en: 'Academic homepage', zh: '学术主页' })}</a>
        <a href="/blog/">${renderLocalized({ en: 'Blog', zh: '博客' })}</a>
      </div>
    </div>
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

async function writeAcademicAssets() {
  const assetsDir = path.join(distDir, 'assets')
  await fs.mkdir(assetsDir, { recursive: true })
  await Promise.all([
    fs.copyFile(path.join(academicDir, 'styles.css'), path.join(assetsDir, 'academic.css')),
    fs.copyFile(path.join(academicDir, 'language.js'), path.join(assetsDir, 'academic-language.js')),
  ])
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
  const source = await fs.readFile(contentPath, 'utf8')
  const content = parse(source)
  validateContent(content)

  const blogIndex = path.join(blogDir, 'index.html')
  invariant(await readOptional(blogIndex), 'dist/blog/index.html is missing; build the blog first')

  const feedNames = ['atom.xml', 'feed.xml', 'feed.json']
  const capturedFeeds = {}
  for (const name of feedNames) {
    capturedFeeds[name] = await readOptional(path.join(distDir, name))
      ?? await readOptional(path.join(blogDir, name))
      ?? await readOptional(path.join(publicDir, name))
  }
  invariant(capturedFeeds['atom.xml'], 'atom.xml was not generated by Valaxy')
  invariant(capturedFeeds['feed.xml'], 'feed.xml was not generated by Valaxy')

  const discoveredHtmlFiles = await findBlogHtmlFiles()
  const htmlFiles = await excludeGeneratedDirectoryAliases(discoveredHtmlFiles)
  await normalizeBlogMetadata(htmlFiles, content.site.url)
  const directoryAliases = await writeBlogDirectoryAliases(htmlFiles)
  await cleanAcademicOutput()
  await copyPublicCompatibilityAssets()
  await writeAcademicAssets()

  await Promise.all([
    fs.writeFile(path.join(distDir, 'index.html'), renderIndex(content)),
    fs.writeFile(path.join(distDir, '404.html'), render404(content)),
  ])

  const redirectFiles = [...new Set([...htmlFiles, ...directoryAliases])]
  await writeLegacyRedirects(redirectFiles, content.site.url)
  await syncFeeds(capturedFeeds)
  await Promise.all([
    fs.writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(content.site.url, htmlFiles)),
    fs.writeFile(
      path.join(distDir, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: ${absoluteSiteUrl(content.site.url, '/sitemap.xml')}\n`,
    ),
  ])

  console.log(`Academic homepage built with ${redirectFiles.length - 2} legacy redirects.`)
}

await main()

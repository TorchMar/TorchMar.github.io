// Only include HTTPS PDF endpoints verified to support cross-origin readers.
// cn.arxiv.org redirects to arxiv.org and is not an independent fallback.
export function pdfSources(url) {
  try {
    const parsed = new URL(url);
    if (!['arxiv.org', 'export.arxiv.org'].includes(parsed.hostname) || !/^\/pdf\//.test(parsed.pathname)) return [url];
    return ['https://arxiv.org', 'https://export.arxiv.org'].map(origin => `${origin}${parsed.pathname}${parsed.search}`);
  } catch { return [url]; }
}

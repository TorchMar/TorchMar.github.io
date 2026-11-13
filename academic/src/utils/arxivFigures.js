const paperIdPattern = /^\d{4}\.\d{4,5}(?:v\d+)?$/;
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const code = entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
});
const plain = value => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// arXiv also nests subfigures. A non-greedy figure regex truncates those
// before the parent caption, losing otherwise valid framework diagrams.
function figureBlocks(html) {
  const blocks = [];
  let depth = 0, start = 0;
  for (const token of html.matchAll(/<\/?figure\b[^>]*>/gi)) {
    if (!token[0].startsWith('</')) {
      if (depth === 0) start = token.index;
      depth++;
    } else if (depth && --depth === 0) {
      blocks.push(html.slice(start, token.index + token[0].length));
    }
  }
  return blocks;
}

// Caption-based ranking, not a claim of visual/semantic understanding.
export function selectFigure(html, pageUrl) {
  const base = new URL(pageUrl);
  if (base.origin !== 'https://arxiv.org' || !/^\/html\/\d{4}\.\d{4,5}(?:v\d+)?\/?$/.test(base.pathname)) return null;
  const paperId = base.pathname.split('/')[2].replace(/v\d+$/, '');
  const candidates = [];
  for (const body of figureBlocks(html)) {
    const captions = [...body.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)];
    const caption = plain(captions.at(-1)?.[1] || '');
    if (!caption || /\bltx_table\b/.test(body.split('>')[0])) continue;
    const lead = caption.replace(/^(?:Figure|Fig\.?)\s*\d+[.:]?\s*/i, '').slice(0, 260);
    const designOverview = /\b(design and composition|study design|benchmark design|system design|evaluation design|method diagram|topolog(?:y|ies)|(?:HITL|agent|network|system) configurations?)\b/i.test(lead);
    const methodIllustration = /\(Left\)/i.test(caption) && /\(Right\)/i.test(caption) && /\b(proposes?|proposed|our method)\b/i.test(caption) && /\b(visualized|representation|procedure)\b/i.test(caption);
    // Authors often describe stages without naming the illustration in the
    // caption, while using a descriptive image filename. Treat that as a
    // second signal, never as a per-paper URL exception.
    const assetHint = [...body.matchAll(/<(?:img|object)\b[^>]*\b(?:src|data)\s*=\s*["']([^"']+)["']/gi)].some(match => {
      const filename = match[1].split('/').at(-1).split(/[?#]/)[0];
      return /(?:^|[-_.])(?:architecture|framework|pipeline|workflow|overview|schematic|method)(?:[-_.]|$)/i.test(filename)
        && !/(?:^|[-_.])(?:results?|ablation|curves?|plots?)(?:[-_.]|$)/i.test(filename);
    });
    if (!designOverview && !methodIllustration && !assetHint && !/\b(architecture|framework|pipeline|workflow|overview|schematic|testbed|system diagram|experimental setup|system configuration)\b/i.test(lead)) continue;
    if (/^(?:(?:overview|illustration) of (?:our |the )?)?(?:benchmark examples?|examples?|samples?|ablation|accuracy|loss curves?|performance comparison|histogram)\b/i.test(lead)) continue;
    let score = 0;
    if (designOverview) score += 8;
    if (methodIllustration) score += 5;
    if (assetHint) score += 5;
    if (/\b(architecture|framework|pipeline|workflow)\b/i.test(caption)) score += 8;
    if (/\b(overview|schematic|illustration|diagram)\b/i.test(caption)) score += 5;
    if (/\b(testbed|experimental setup|system configuration)\b/i.test(lead)) score += 5;
    if (/\b(our|proposed|method|model|system)\b/i.test(caption)) score += 2;
    if (score < 5) continue;
    const images = [...body.replace(/<figcaption\b[\s\S]*?<\/figcaption>/gi, '').matchAll(/<(?:img|object)\b[^>]*>/gi)].filter(image => !/ltx_Math|ltx_math/.test(image[0]));
    // Preserve all panels instead of discarding composites or choosing an
    // arbitrary panel. Excessively large galleries are not diagram previews.
    if (!images.length) {
      // TikZ diagrams may be rendered directly into the HTML rather than
      // published as a separate image. Display only in an isolated img, never
      // inject remote SVG into the page DOM.
      const svg = body.match(/<svg\b[\s\S]*?<\/svg>/i)?.[0];
      if (svg && svg.length < 250000 && !/<(?:script|iframe|object|embed|image|use)\b|\bon\w+\s*=|(?:href|src)\s*=|url\s*\((?!#[\w.-]+\))/i.test(svg)) {
        const standalone = svg.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/<span\b/g, '<span xmlns="http://www.w3.org/1999/xhtml"');
        candidates.push({ url: `data:image/svg+xml,${encodeURIComponent(standalone)}`, caption: caption.slice(0, 1200), source: pageUrl, score });
      }
      continue;
    }
    if (images.length > 6) continue;
    const urls = [];
    for (const image of images) {
    const src = image[0].match(/\b(?:src|data)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    try {
      // Resolve against the document URL, not an invented directory. arXiv
      // uses paths such as "2610.35846v1/merging.svg" in /html/2610.35846v1.
      const url = new URL(decode(src), base);
      const assetPaper = url.pathname.split('/')[2]?.replace(/v\d+$/, '');
      if (url.origin !== base.origin || !url.pathname.startsWith('/html/') || assetPaper !== paperId || !/\.(png|jpe?g|webp|gif|svg)$/i.test(url.pathname)) continue;
      urls.push(url.href);
    } catch { /* Skip malformed remote URLs. */ }
    }
    if (urls.length === images.length) candidates.push({ url: urls[0], ...(urls.length > 1 ? { panels: [...new Set(urls)] } : {}), caption: caption.slice(0, 1200), source: pageUrl, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const { url, panels, caption, source } = candidates[0];
  return {url, ...(panels ? {panels} : {}), caption, source};
}

// Stop after a suitable complete figure, rather than downloading bibliography,
// appendices and the rest of a large HTML document before showing a thumbnail.
export async function readFigureResponse(response, pageUrl) {
  const reader = response.body?.getReader();
  if (!reader) return selectFigure(await response.text(), pageUrl);
  const decoder = new TextDecoder();
  let html = '';
  try {
    while (html.length < 2000000) {
      const {value,done} = await reader.read();
      if (done) break;
      html += decoder.decode(value, {stream:true});
      if (html.includes('</figure>')) {
        const figure = selectFigure(html, pageUrl);
        if (figure) return figure;
      }
    }
    return selectFigure(html, pageUrl);
  } finally { await reader.cancel().catch(() => {}); }
}

export function createFigureService({ fetchImpl = fetch, spacing = 3100, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let queue = Promise.resolve();
  let next = 0;
  const schedule = () => {
    const start = queue.then(async () => {
      const delay = next - now();
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      next = now() + spacing;
    });
    queue = start.catch(() => {});
    return start;
  };
  return async id => {
    if (!paperIdPattern.test(id)) return new Response('Invalid paper ID', { status: 400 });
    const cached = cache.get(id);
    if (cached && cached.expires > now()) return cached.response.clone();
    if (pending.has(id)) return (await pending.get(id)).clone();
    if (pending.size >= 16) return new Response('Try again later', { status: 429, headers: { 'Retry-After': '60' } });
    // Space request starts, not entire downloads: slow responses must not
    // hold every subsequent paper behind their full network timeout.
    const start = schedule();
    const job = start.then(async () => {
      let figure = null;
      let temporaryFailure = false;
      try {
        let pageUrl = `https://arxiv.org/html/${id}`;
        let response = await fetchImpl(pageUrl, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
        // Some revised PDFs have no HTML even though the preceding revision
        // does. Only fall back for an explicit 404, never for network failure.
        const version = Number(id.match(/v(\d+)$/)?.[1]);
        if (response.status === 404 && version > 1) {
          await response.body?.cancel();
          await schedule();
          pageUrl = `https://arxiv.org/html/${id.replace(/v\d+$/, `v${version - 1}`)}`;
          response = await fetchImpl(pageUrl, { signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' } });
        }
        if (response.ok) {
          figure = await readFigureResponse(response, response.url || pageUrl);
          if (figure && pageUrl !== `https://arxiv.org/html/${id}`) figure.sourceVersion = version - 1;
        } else if (response.status !== 404) temporaryFailure = true;
      } catch { temporaryFailure = true; }
      const ttl = figure ? 21600 : 1800;
      const response = Response.json({ figure, ...(temporaryFailure ? {retryable: true} : {}) }, { headers: { 'Cache-Control': temporaryFailure ? 'no-store' : `public, max-age=${ttl}` } });
      if (cache.size >= 128) cache.delete(cache.keys().next().value);
      if (!temporaryFailure) cache.set(id, { response: response.clone(), expires: now() + ttl * 1000 });
      return response;
    });
    pending.set(id, job);
    try { return (await job).clone(); } finally { pending.delete(id); }
  };
}

import { arxivId } from './arxivFeed.js';

export const paperSearchSources = ['https://hf-mirror.com', 'https://huggingface.co'];

export async function searchTopic(keyword, { signal, fetchImpl = fetch, timeoutMs = 8000, hedgeMs = 1200 } = {}) {
  if (signal?.aborted) throw new Error('Aborted');
  return new Promise((resolve, reject) => {
    const controllers = [];
    let settled = false, started = 0, failures = 0;
    let hedgeTimer, deadline;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hedgeTimer); clearTimeout(deadline);
      signal?.removeEventListener('abort', abort);
      controllers.forEach(controller => controller.abort());
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(new Error('Aborted'));
    const start = async () => {
      if (settled || started >= paperSearchSources.length) return;
      const origin = paperSearchSources[started++];
      const controller = new AbortController();
      controllers.push(controller);
      try {
      const url = new URL('/api/papers/search', origin);
      url.searchParams.set('q', keyword);
      const response = await fetchImpl(url, { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error(`Paper search failed: ${response.status}`);
        finish(null, normalizePapers(await response.json()));
      } catch {
        if (settled) return;
        failures++;
        if (started < paperSearchSources.length) start();
        else if (failures === paperSearchSources.length) finish(new Error('All paper sources unavailable'));
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    deadline = setTimeout(() => finish(new Error('Paper search timed out')), timeoutMs);
    hedgeTimer = setTimeout(start, hedgeMs);
    start();
  });
}

export function normalizePapers(entries, excluded = []) {
  if (!Array.isArray(entries)) throw new Error('Invalid paper response');
  const seen = new Set(excluded.map(arxivId).filter(Boolean));
  return entries.flatMap(entry => {
    const paper = entry?.paper || entry;
    const id = paper?.id;
    const published = paper?.publishedAt;
    if (typeof id !== 'string' || !/^\d{4}\.\d{4,5}$/.test(id) || seen.has(id)
      || typeof paper.title !== 'string' || !Number.isFinite(Date.parse(published))) return [];
    seen.add(id);
    return [{ id, figureId: id, title: paper.title, published,
      pdfUrl: `https://arxiv.org/pdf/${id}`,
      authors: (Array.isArray(paper.authors) ? paper.authors : []).map(author => author.name).filter(name => typeof name === 'string').join(', ') }];
  }).sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
}

export async function fetchHuggingFacePapers(keywords, { signal, excluded = [], fetchImpl = fetch } = {}) {
  // Search each configured topic, rather than treating unrelated topics as one phrase.
  const responses = await Promise.allSettled(keywords.map(async keyword => {
    const items = await searchTopic(keyword, { signal, fetchImpl });
    const excludedIds = new Set(excluded.map(arxivId).filter(Boolean));
    return items.filter(item => !excludedIds.has(item.id));
  }));
  if (signal?.aborted) throw new Error('Aborted');
  const successful = responses.filter(response => response.status === 'fulfilled');
  if (!successful.length) throw new Error('Paper search unavailable');
  const items = [...new Map(successful.flatMap(response => response.value).map(item => [item.id, item])).values()]
    .sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  return { items, time: Date.now(), fetchedAt: new Date().toISOString() };
}

import { createFigureService } from './arxivFigures.js';
const directFigures = createFigureService();
const storageKey = 'paper-figure-metadata-v13';
const memory = new Map();
const pending = new Map();
const validUrl = url => typeof url === 'string' && (/^https:\/\/arxiv\.org\/html\/\d{4}\.\d{4,5}(?:v\d+)?\/[^?#]+\.(png|jpe?g|webp|gif|svg)$/i.test(url) || (url.length < 1000000 && url.startsWith('data:image/svg+xml,%3Csvg')));
const valid = figure => figure && typeof figure.caption === 'string' && validUrl(figure.url) && (!figure.panels || (Array.isArray(figure.panels) && figure.panels.length > 0 && figure.panels.length <= 6 && figure.panels.every(validUrl)));
try {
  for (const [key, value] of JSON.parse(localStorage.getItem(storageKey) || '[]').slice(-64)) {
    if (value.expires > Date.now() && (value.figure === null || valid(value.figure))) memory.set(key, value);
  }
} catch { /* Storage may be disabled. */ }

export function cachedFigure(id) {
  const value = memory.get(id);
  return value?.expires > Date.now() ? value : null;
}

export function invalidateFigure(id) {
  memory.delete(id);
  try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
}

export function loadFigure(id, endpoint) {
  const cached = cachedFigure(id);
  if (cached) return Promise.resolve(cached.figure);
  if (pending.has(id)) return pending.get(id);
  const job = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    // Metadata is already cached above. Do not reuse an HTTP-cached empty
    // result after the parser or upstream HTML has recovered.
    const options = { signal: controller.signal, credentials: 'omit', cache: 'no-store' };
    const serviceUrl = endpoint ? new URL(endpoint, window.location.origin) : null;
    serviceUrl?.searchParams.set('figure', id);
    let temporaryFailure = false;
    const service = async (retry = true) => {
      const response = serviceUrl ? await fetch(serviceUrl, options) : await directFigures(id);
      if (!response.ok) throw new Error('Unavailable');
      const { figure, retryable } = await response.json();
      if (retryable) {
        temporaryFailure = true;
        if (serviceUrl && retry && !controller.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          return service(false);
        }
      } else temporaryFailure = false;
      if (!figure && !retryable) return null;
      if (!valid(figure)) throw new Error('No diagram');
      return figure;
    };
    let figure = null;
    // Direct mode shares a browser-side queue and parser; a configured
    // endpoint can alternatively provide server-side deduplication.
    try {
      try { figure = await service(); }
      catch (error) {
        if (!serviceUrl || controller.signal.aborted) throw error;
        await new Promise(resolve => setTimeout(resolve, 1500));
        figure = await service(false);
      }
    }
    catch { temporaryFailure = true; /* Never substitute an unrelated figure or PDF page. */ }
    finally { clearTimeout(timer); controller.abort(); }
    if (memory.size >= 64) memory.delete(memory.keys().next().value);
    if (!temporaryFailure) memory.set(id, { figure, expires: Date.now() + (figure ? 21600000 : 60000) });
    // Inline diagrams stay in memory only; do not persist image data locally.
    try { localStorage.setItem(storageKey, JSON.stringify([...memory].filter(([, value]) => !value.figure?.url.startsWith('data:')))); } catch { /* Memory cache still works. */ }
    return figure;
  })();
  pending.set(id, job);
  job.finally(() => pending.delete(id));
  return job;
}

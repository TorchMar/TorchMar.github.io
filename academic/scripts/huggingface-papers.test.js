import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePapers, fetchHuggingFacePapers, searchTopic } from '../src/utils/huggingFacePapers.js';

const paper = (id, date) => ({ paper: { id, title: 'Example', publishedAt: date, authors: [{ name: 'Author' }] } });
test('HF normalization rejects unsafe IDs, excludes self, deduplicates and sorts', () => {
  const items = normalizePapers([paper('2601.00001', '2026-01-01'), paper('2602.00002', '2026-02-01'), paper('2602.00002', '2026-02-01'), paper('../bad', '2026-01-01')]);
  assert.deepEqual(items.map(item => item.id), ['2602.00002', '2601.00001']);
  assert.equal(items[0].pdfUrl, 'https://arxiv.org/pdf/2602.00002');
  assert.equal(normalizePapers([paper('2601.00001', '2026-01-01')], ['https://arxiv.org/pdf/2601.00001v2']).length, 0);
});
test('HF requests configured keywords directly and tolerates a failed topic', async () => {
  const urls = [];
  const result = await fetchHuggingFacePapers(['Multimodal', 'AI Agents'], { fetchImpl: async (url, options) => {
    urls.push(String(url));
    assert.equal(options.credentials, 'omit');
    return url.searchParams.get('q') === 'Multimodal' ? Response.json([paper('2601.00001', '2026-01-01')]) : new Response('', { status: 429 });
  } });
  assert.equal(result.items.length, 1);
  assert.ok(urls.every(url => /^https:\/\/(hf-mirror.com|huggingface.co)\/api\/papers\/search\?/.test(url)));
});
test('invalid mirror payload falls back to the original source', async () => {
  const origins = [];
  const result = await searchTopic('Multimodal', { fetchImpl: async url => {
    origins.push(url.origin);
    return origins.length === 1 ? Response.json({ error: 'not papers' }) : Response.json([paper('2601.00001', '2026-01-01')]);
  } });
  assert.deepEqual(origins, ['https://hf-mirror.com', 'https://huggingface.co']);
  assert.equal(result.length, 1);
});
test('HF complete failure is surfaced, not cached as an empty feed', async () => {
  await assert.rejects(fetchHuggingFacePapers(['AIGC'], { fetchImpl: async () => new Response('', { status: 503 }) }));
});
test('slow mirror does not block source response and losing request is cancelled', async () => {
  let mirrorSignal;
  const items = await searchTopic('Multimodal', { hedgeMs: 5, timeoutMs: 200, fetchImpl: async (url, { signal }) => {
    if (url.hostname === 'hf-mirror.com') {
      mirrorSignal = signal;
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
    }
    return Response.json([paper('2601.00001', '2026-01-01')]);
  } });
  assert.equal(items.length, 1);
  assert.equal(mirrorSignal.aborted, true);
});
test('cancelling search rejects promptly without starting another source', async () => {
  const controller = new AbortController();
  let requests = 0;
  const job = searchTopic('AI', { signal: controller.signal, fetchImpl: async () => { requests++; return new Promise(() => {}); } });
  controller.abort();
  await assert.rejects(job, /Aborted/);
  assert.equal(requests, 1);
});

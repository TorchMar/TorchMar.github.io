import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfRangeSource } from '../src/utils/pdfRangeSource.js';

class Transport {
  constructor(length, initial) { this.length = length; this.initial = initial; }
  onDataRange(begin, bytes) { this.result = { begin, bytes }; }
}
test('range reader verifies partial responses without exposed Accept-Ranges', async () => {
  const errors = [], progress = [];
  const fetchImpl = async (_, options) => {
    if (options.method === 'HEAD') return new Response(null, { headers: { 'Content-Length': '10486543' } });
    const [, begin, end] = options.headers.Range.match(/bytes=(\d+)-(\d+)/).map(Number);
    return new Response(new Uint8Array(end - begin + 1), { status: 206 });
  };
  const source = await pdfRangeSource('https://arxiv.org/pdf/test', Transport, {
    signal: new AbortController().signal, fetchImpl, onError: error => errors.push(error), onProgress: value => progress.push(value),
  });
  assert.equal(source.length, 10486543);
  assert.equal(source.initial.length, 65536);
  source.requestDataRange(100000, 100100);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(source.result.bytes.length, 100);
  assert.equal(errors.length, 0);
  assert.equal(progress.length, 2);
});
test('servers ignoring Range fall back to normal loading', async () => {
  const url = 'https://arxiv.org/pdf/test';
  assert.equal(await pdfRangeSource(url, Transport, {
    signal: new AbortController().signal, onProgress() {}, onError() {},
    fetchImpl: async (_, options) => options.method === 'HEAD'
      ? new Response(null, { headers: { 'Content-Length': '100000' } })
      : new Response('not a partial response'),
  }), url);
});
test('HEAD failure falls back instead of failing the whole reader', async () => {
  const url = 'https://arxiv.org/pdf/test';
  assert.equal(await pdfRangeSource(url, Transport, {
    signal: new AbortController().signal,
    fetchImpl: async () => { throw new TypeError('HEAD unavailable'); },
  }), url);
});
test('a transient range failure retries the same bytes without restarting the document', async () => {
  let attempts = 0;
  const errors = [];
  const source = await pdfRangeSource('https://arxiv.org/pdf/test', Transport, {
    signal: new AbortController().signal, onError: error => errors.push(error),
    fetchImpl: async (_, options) => {
      if (options.method === 'HEAD') return new Response(null, { headers: { 'Content-Length': '1000000' } });
      const [, begin, end] = options.headers.Range.match(/bytes=(\d+)-(\d+)/).map(Number);
      if (begin === 100000 && ++attempts === 1) throw new TypeError('connection reset');
      return new Response(new Uint8Array(end - begin + 1), { status: 206 });
    },
  });
  source.requestDataRange(100000, 100100);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(attempts, 2);
  assert.equal(source.result.bytes.length, 100);
  assert.equal(errors.length, 0);
});
test('reopening a paper reuses persisted metadata and downloaded ranges without network', async () => {
  const entries = new Map();
  const options = {
    signal: new AbortController().signal,
    readCache: async key => entries.get(key),
    writeCache: async (key, value) => { entries.set(key, structuredClone(value)); },
    fetchImpl: async (_, request) => request.method === 'HEAD'
      ? new Response(null, { headers: { 'Content-Length': '1000000' } })
      : new Response(new Uint8Array(65536), { status: 206 }),
  };
  await pdfRangeSource('https://arxiv.org/pdf/cached', Transport, options);
  const source = await pdfRangeSource('https://arxiv.org/pdf/cached', Transport, {
    ...options, fetchImpl: async () => { assert.fail('cached range should not use network'); },
  });
  assert.equal(source.length, 1000000);
  assert.equal(source.initial.length, 65536);
});

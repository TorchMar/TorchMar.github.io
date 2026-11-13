import { paperAssetTtl, readPaperAsset, writePaperAsset } from './paperAssetCache.js';
// arXiv allows cross-origin PDF reads, but does not expose Accept-Ranges to JS.
// Verify a real 206 response instead of relying on that inaccessible header.
export async function pdfRangeSource(url, Transport, { signal, onError, onProgress, fetchImpl = fetch, readCache = readPaperAsset, writeCache = writePaperAsset }) {
  const key = `pdf:${url}`;
  let metadata = await readCache(key);
  let head;
  if (!metadata) {
  try { head = await fetchImpl(url, { method: 'HEAD', signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) }); }
  catch (error) { if (signal.aborted) throw error; return url; }
  const length = Number(head.headers.get('Content-Length'));
  if (!head.ok || !Number.isSafeInteger(length) || length <= 65536) return url;
  metadata = { length, generation: Date.now(), expires: Date.now() + paperAssetTtl };
  await writeCache(key, metadata, 256, metadata.expires);
  }
  const { length } = metadata;
  const initialEnd = Math.min(length, 65536);
  let received = 0;
  const requests = new Set();
  async function chunk(begin, end) {
    if (signal.aborted) throw new Error('Aborted');
    const chunkKey = `${key}:${metadata.generation}:${begin}:${end}`;
    const saved = await readCache(chunkKey);
    if (saved instanceof Uint8Array && saved.length === end - begin) {
      received += saved.length;
      onProgress?.({ loaded: received, total: length });
      return saved;
    }
    const request = new AbortController();
    requests.add(request);
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) request.abort();
    let timer = setTimeout(abort, 30000);
    try {
    const response = await fetchImpl(url, { headers: { Range: `bytes=${begin}-${end - 1}` }, signal: request.signal });
    if (response.status !== 206) {
      await response.body?.cancel();
      throw new Error('PDF server did not honor the byte range');
    }
    const reader = response.body.getReader();
    const parts = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(timer);
      timer = setTimeout(abort, 30000);
      parts.push(value);
      size += value.length;
      received += value.length;
      onProgress?.({ loaded: received, total: length });
    }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { data.set(part, offset); offset += part.length; }
    if (data.length !== end - begin) throw new Error('Incomplete PDF range');
    await writeCache(chunkKey, data, data.byteLength, metadata.expires);
    return data;
    } finally { requests.delete(request); clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  let initial;
  try { initial = await chunk(0, initialEnd); }
  catch (error) { if (signal.aborted) throw error; return url; }
  let stopped = false;
  class RangeSource extends Transport {
    requestDataRange(begin, end) {
      const read = async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try { return await chunk(begin, end); }
          catch (error) { if (attempt || stopped || signal.aborted) throw error; }
        }
      };
      read().then(data => {
        if (stopped || signal.aborted) return;
        this.onDataRange(begin, data);
      }).catch(error => { if (!stopped && !signal.aborted) onError(error); });
    }
    abort() { stopped = true; for (const request of requests) request.abort(); }
  }
  return new RangeSource(length, initial);
}

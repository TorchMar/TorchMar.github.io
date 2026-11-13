import { paperAssetTtl, writePaperAsset } from './paperAssetCache.js';
const entries = new Map();
const budget = 24 * 1024 * 1024;
let size = 0;

export function cachedPdfBytes(url) {
  const bytes = entries.get(url);
  // PDF.js transfers ownership to its worker; never transfer our cached copy.
  return bytes ? bytes.slice() : null;
}

export function cachePdfBytes(url, bytes) {
  void writePaperAsset(`pdf-full:${url}`, bytes.slice(), bytes.byteLength, Date.now() + paperAssetTtl);
  if (bytes.byteLength > budget) return;
  if (entries.has(url)) { size -= entries.get(url).byteLength; entries.delete(url); }
  while (size + bytes.byteLength > budget) {
    const key = entries.keys().next().value;
    size -= entries.get(key).byteLength;
    entries.delete(key);
  }
  entries.set(url, bytes.slice());
  size += bytes.byteLength;
}

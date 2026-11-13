// Browser-local binary cache. Storage failures must never block reading papers.
const budget = 128 * 1024 * 1024;
export const paperAssetTtl = 24 * 60 * 60 * 1000;
let database;
function open() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (!database) database = new Promise(resolve => {
    const request = indexedDB.open('paper-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return database;
}
export async function readPaperAsset(key) {
  try {
    const db = await open();
    if (!db) return null;
    return await new Promise(resolve => {
      const tx = db.transaction('assets', 'readonly');
      const request = tx.objectStore('assets').get(key);
      request.onsuccess = () => resolve(request.result?.expires > Date.now() && request.result.created + paperAssetTtl > Date.now() ? request.result.value : null);
      request.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  } catch { return null; }
}
export async function writePaperAsset(key, value, size, expires = Date.now() + paperAssetTtl) {
  if (size > budget || expires <= Date.now()) return;
  try {
    const db = await open();
    if (!db) return;
    await new Promise(resolve => {
      const tx = db.transaction('assets', 'readwrite');
      const store = tx.objectStore('assets');
      const request = store.getAll();
      request.onsuccess = () => {
        let total = size;
        const rows = request.result.sort((a, b) => b.created - a.created);
        for (const row of rows) {
          if (row.key === key) continue;
          if (row.expires <= Date.now() || total + row.size > budget) store.delete(row.key);
          else total += row.size;
        }
        store.put({ key, value, size, expires, created: Date.now() });
      };
      tx.oncomplete = tx.onabort = tx.onerror = () => resolve();
    });
  } catch { /* Private browsing or a full disk: continue without persistence. */ }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { cachePdfBytes, cachedPdfBytes } from '../src/utils/pdfBytesCache.js';

test('PDF cache survives worker buffer transfers and stays within its byte budget', () => {
  cachePdfBytes('one', new Uint8Array([1, 2, 3]));
  const first = cachedPdfBytes('one');
  structuredClone(first, { transfer: [first.buffer] });
  assert.deepEqual(cachedPdfBytes('one'), new Uint8Array([1, 2, 3]));
  cachePdfBytes('large', new Uint8Array(24 * 1024 * 1024));
  assert.equal(cachedPdfBytes('one'), null);
});

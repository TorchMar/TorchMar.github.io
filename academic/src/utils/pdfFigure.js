import { readPaperAsset, writePaperAsset } from './paperAssetCache';
import { pdfjs } from 'react-pdf';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { findFigureRegions } from './pdfFigureLayout';
import { createTaskPool } from './taskPool';
import { pdfRangeSource } from './pdfRangeSource';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const jobs = new Map();
const schedule = createTaskPool(2);

// Only actual image or vector paint regions near a figure caption are eligible. Never
// render a full-page thumbnail as a substitute for a missing diagram.
export function loadPdfFigure(id) {
  if (!/^\d{4}\.\d{4,5}(?:v\d+)?$/.test(id)) return Promise.resolve(null);
  if (jobs.has(id)) return jobs.get(id);
  const job = (async () => {
    const key = `figure-v1:${id}`;
    const cached = await readPaperAsset(key);
    if (cached) return cached;
    const result = await schedule(() => extract(id));
    if (result) await writePaperAsset(key, result, result.url.length * 2);
    return result;
  })().catch(error => {
    if (import.meta.env.DEV) console.warn('PDF figure extraction unavailable:', id, error.message);
    return null;
  });
  jobs.set(id, job);
  job.then(result => { if (!result) jobs.delete(id); });
  if (jobs.size > 24) jobs.delete(jobs.keys().next().value);
  return job;
}

async function extract(id) {
  const controller = new AbortController();
  let task;
  const timer = setTimeout(() => { controller.abort(); task?.destroy(); }, 60000);
  try {
    const source = await pdfRangeSource(`https://arxiv.org/pdf/${id}`, pdfjs.PDFDataRangeTransport, {
      signal: controller.signal,
      onError: () => { controller.abort(); task?.destroy(); },
    });
    if (controller.signal.aborted) return null;
    task = pdfjs.getDocument({ ...(typeof source === 'string' ? { url: source } : { range: source }), disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 });
    const doc = await task.promise;
    // Walk the document within the request's time budget, not a fixed page
    // number tied to today's papers. Stop at References / Appendix sections.
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const text = await page.getTextContent();
      if (n > 2 && text.items.some(item => /^(References|Bibliography|Appendix)$/i.test(item.str.trim()))) { page.cleanup(); break; }
      if (!text.items.some(item => /^\s*(?:Figure|Fig\.?)(?:\s|$)/i.test(item.str))) { page.cleanup(); continue; }
      const ops = await page.getOperatorList();
      let matrix = [1, 0, 0, 1, 0, 0];
      const stack = [], boxes = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i], args = ops.argsArray[i];
        if (fn === pdfjs.OPS.save) stack.push(matrix.slice());
        else if (fn === pdfjs.OPS.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (fn === pdfjs.OPS.transform) matrix = pdfjs.Util.transform(matrix, args);
        else if (fn === pdfjs.OPS.constructPath && args[2]?.length === 4) {
          const [x0, y0, x1, y1] = args[2];
          const points = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(p => { pdfjs.Util.applyTransform(p, matrix); return p; });
          const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
          boxes.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
        }
        else if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
          const points = [[0, 0], [0, 1], [1, 0], [1, 1]].map(p => { pdfjs.Util.applyTransform(p, matrix); return p; });
          const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
          const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          boxes.push(box);
        }
      }
      const size = page.getViewport({ scale: 1 });
      for (const { box, caption } of findFigureRegions(text.items, boxes, size.width, size.height)) {
        const viewport = page.getViewport({ scale: 1.5 });
        const rect = [...viewport.convertToViewportPoint(box[0], box[1]), ...viewport.convertToViewportPoint(box[2], box[3])];
        const x = Math.min(rect[0], rect[2]), y = Math.min(rect[1], rect[3]);
        const width = Math.abs(rect[2] - rect[0]), height = Math.abs(rect[3] - rect[1]);
        if (width * height > viewport.width * viewport.height * .6) continue;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [1, 0, 0, 1, -x, -y] }).promise;
        return { url: canvas.toDataURL('image/png'), caption, source: `https://arxiv.org/pdf/${id}#page=${n}` };
      }
      page.cleanup();
    }
    return null;
  } finally { clearTimeout(timer); controller.abort(); await task?.destroy(); }
}

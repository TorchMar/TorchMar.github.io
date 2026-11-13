import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { cachedPdfBytes, cachePdfBytes } from "../utils/pdfBytesCache";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import PdfAnnotations from "./PdfAnnotations";
import { readPaperAsset } from "../utils/paperAssetCache";
import { pdfRangeSource } from "../utils/pdfRangeSource";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const rangeOptions = { disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144 };

export default function PdfDocument({ url, source = url, pages, page, width, ratio, isPaper, toolbarHost, onLoad, onError, onProgress, onRatio, onRender, error }) {
  const file = useMemo(() => {
    const data = cachedPdfBytes(url);
    return data ? { data } : source;
  }, [url, source]);
  const [prepared, setPrepared] = useState(null);
  const handlers = useRef({ onError, onProgress });
  useEffect(() => { handlers.current = { onError, onProgress }; }, [onError, onProgress]);
  useEffect(() => {
    if (typeof file !== 'string') return;
    const controller = new AbortController();
    (async () => {
      const cached = await readPaperAsset(`pdf-full:${url}`);
      if (cached instanceof Uint8Array) return { data: cached };
      if (!/^https:\/\/(?:export\.)?arxiv\.org\/pdf\//.test(file)) return file;
      return pdfRangeSource(file, pdfjs.PDFDataRangeTransport, {
      signal: controller.signal,
      onError: error => handlers.current.onError(error),
      onProgress: progress => handlers.current.onProgress(progress),
    });
    })().then(value => { if (!controller.signal.aborted) setPrepared({ file, value }); })
      .catch(error => { if (!controller.signal.aborted) handlers.current.onError(error); });
    return () => controller.abort();
  }, [file, url]);
  const needsRange = typeof file === 'string';
  const resolved = needsRange ? (prepared?.file === file ? prepared.value : null) : file;
  const cachedDocument = useRef(null);
  function loaded(pdf) {
    onLoad(pdf);
    if (cachedDocument.current === pdf) return;
    cachedDocument.current = pdf;
    // Only cache after the existing download completes; do not force extra ranges.
    pdf.getDownloadInfo().then(() => pdf.getData()).then(bytes => cachePdfBytes(url, bytes)).catch(() => {});
  }
  // Keep the native dialog mounted while react-pdf 11 loads a document or page.
  // Its default Suspense mode would suspend the reader's modal lifecycle too.
  const content = <Page suspense={false} pageNumber={page} width={width} devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
    onLoadError={onError} onRenderError={onError}
    onRenderSuccess={onRender}
    onLoadSuccess={pdfPage => { const size = pdfPage.getViewport({ scale: 1 }); onRatio(size.height / size.width); }}
    loading={null} error={<p className="resume-message" role="alert">This page could not be rendered.</p>} />;
  if (!resolved) return null;
  return <Document suspense={false} file={resolved} options={resolved instanceof pdfjs.PDFDataRangeTransport ? rangeOptions : undefined} onLoadProgress={onProgress} onLoadSuccess={loaded} onLoadError={onError} onSourceError={onError} style={{ width }}
    externalLinkTarget="_blank" externalLinkRel="noopener noreferrer" loading={null} error={error}>
    {pages > 0 && (isPaper ? <PdfAnnotations page={page} width={width} height={width * ratio}
      storageKey={`paper-notes:v1:${url}`} toolbarHost={toolbarHost}>{content}</PdfAnnotations> : content)}
  </Document>;
}

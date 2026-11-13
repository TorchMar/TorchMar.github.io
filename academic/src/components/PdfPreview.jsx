import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "../hooks/useModalDialog";
import { ArrowLeft, ArrowRight, Download, FileText, Maximize2, Minus, Plus, X } from "lucide-react";
import "../css/ResumePreview.css";
import "../css/PaperWindow.css";
import { loadPdfDocument } from "../utils/loadPdfDocument";
import { pdfSources } from "../utils/pdfSources";

export default function PdfPreview({ url, name, onClose, kind = "resume", standalone = false }) {
  const titleId = useId();
  const isPaper = kind === "paper";
  const dialog = useRef(null);
  const viewport = useRef(null);
  const toolsHost = useRef(null);
  useModalDialog(dialog);
  const [area, setArea] = useState({ width: 600, height: 800, desktop: false });
  const [pageRatio, setPageRatio] = useState(Math.SQRT2);
  const [fit, setFit] = useState(isPaper ? "width" : "auto");
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const [renderer, setRenderer] = useState(null);
  const [moduleFailed, setModuleFailed] = useState(false);
  const sources = useMemo(() => pdfSources(url), [url]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [rendered, setRendered] = useState(null);
  const fitPage = fit === "page" || (fit === "auto" && area.desktop);
  const width = fitPage ? Math.min(area.width, area.height / pageRatio) : area.width;
  const pageWidth = Math.floor(width * zoom);
  const renderKey = `${attempt}:${sourceIndex}:${page}:${pageWidth}`;
  const rendering = rendered !== renderKey && !failed && !moduleFailed;
  const progress = useRef({ loaded: 0, at: Date.now() });
  function downloadProgress({ loaded }) {
    if (loaded > progress.current.loaded) {
      progress.current = { loaded, at: Date.now() };
      setSlow(false);
    }
  }
  function sourceFailed(error) {
    if (import.meta.env.DEV) console.warn('PDF reader failed:', sources[sourceIndex], error?.message || error);
    if (sourceIndex + 1 < sources.length) {
      setPages(0);
      setSourceIndex(value => value === sourceIndex ? value + 1 : value);
    }
    else setFailed(true);
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { if (active) setModuleFailed(true); }, 15000);
    loadPdfDocument().then(module => {
      if (active) { setRenderer(() => module.default); setModuleFailed(false); }
    }).catch(() => { if (active) setModuleFailed(true); }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, [attempt]);
  useEffect(() => {
    if (!renderer || !rendering) return;
    progress.current = { loaded: 0, at: Date.now() };
    const timer = setInterval(() => {
      if (Date.now() - progress.current.at < 20000) return;
      if (sourceIndex + 1 < sources.length) {
        setPages(0);
        setSourceIndex(value => value === sourceIndex ? value + 1 : value);
      } else if (Date.now() - progress.current.at > 60000) setFailed(true);
      else setSlow(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [renderer, rendering, renderKey, sourceIndex, sources.length]);
  const Renderer = renderer;
  const errorMessage = <div className="resume-message" role="alert"><p>The PDF could not be loaded.</p>
    <button type="button" onClick={() => { setFailed(false); setSlow(false); setModuleFailed(false); setPages(0); setSourceIndex(0); setAttempt(value => value + 1); }}>Try again</button>
    <a href={url} download>Download PDF</a></div>;

  function centerPage() {
    const container = viewport.current;
    if (container) container.scrollLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2);
  }

  useLayoutEffect(() => {
    centerPage();
  }, [pageWidth, page, area.width]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setArea({
      width: Math.max(180, entry.contentRect.width),
      height: Math.max(180, entry.contentRect.height),
      desktop: window.matchMedia("(min-width: 601px)").matches,
    }));
    observer.observe(viewport.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  function turnPage(next) {
    setPage(Math.max(1, Math.min(pages, next)));
    viewport.current.scrollTo({ top: 0, left: 0 });
  }

  return createPortal(<dialog ref={dialog} className={`resume-preview${isPaper ? " paper-pdf-preview" : ""}${standalone ? " standalone-pdf-preview" : ""}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (!pages || event.target.closest("a, button, input")) return;
      if (event.key === "PageDown" || event.key === "PageUp") {
        event.preventDefault(); turnPage(page + (event.key === "PageDown" ? 1 : -1));
      }
    }}>
    <header className="resume-heading">
      <h2 id={titleId} className="resume-accessible-title">{name} — {isPaper ? "Paper PDF" : "Resume"}</h2>
      {isPaper ? <div className="resume-pagination" aria-label="PDF pages">
        <button type="button" disabled={page <= 1 || !pages || failed} onClick={() => turnPage(page - 1)} aria-label="Previous page"><ArrowLeft /></button>
        <span aria-live="polite">{pages ? `${page} / ${pages}` : "— / —"}</span>
        <button type="button" disabled={!pages || page >= pages || failed} onClick={() => turnPage(page + 1)} aria-label="Next page"><ArrowRight /></button>
        <span className="pdf-loading-slot" role="status" aria-label={rendering ? "Loading PDF page" : "PDF page ready"}>{rendering && <i className="pdf-loading-ring" />}</span>
      </div> : <div className="resume-document-icon" title="Resume" aria-hidden="true">
        {isPaper ? <FileText /> : <svg viewBox="0 0 28 28" fill="none">
          <rect x="3" y="4" width="22" height="20" rx="4" fill="currentColor" fillOpacity=".1" />
          <path d="M11 4H7a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h4V4Z" fill="currentColor" fillOpacity=".16" />
          <rect x="3" y="4" width="22" height="20" rx="4" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="11" r="2" fill="currentColor" />
          <path d="M5.5 17a2.5 2.5 0 0 1 5 0v1h-5v-1Z" fill="currentColor" />
          <path d="M15 10h6m-6 4h6m-6 4h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>}
      </div>}
      <div className="resume-zoom" aria-label="PDF zoom">
        <button type="button" disabled={zoom <= .5} onClick={() => setZoom(value => Math.max(.5, value - .25))} title="Zoom out" aria-label="Zoom out"><Minus /></button>
        <button type="button" className="resume-scale" onClick={() => setZoom(1)} title="Reset zoom" aria-label={`Reset zoom, currently ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</button>
        <button type="button" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + .25))} title="Zoom in" aria-label="Zoom in"><Plus /></button>
        <button type="button" className="resume-fit" onClick={() => { setFit(fitPage ? "width" : "page"); setZoom(1); viewport.current.scrollTo({ top: 0, left: 0 }); }} title={fitPage ? "Fit to width" : "Fit whole page"} aria-label={fitPage ? "Fit to width" : "Fit whole page"}><Maximize2 /></button>
      </div>
      <div className="resume-window-actions resume-actions">
        <a href={url} download title="Download PDF" aria-label="Download PDF"><Download /></a>
        <button type="button" onClick={onClose} title="Close" aria-label="Close PDF preview"><X /></button>
      </div>
    </header>
    {isPaper && <div className="paper-tools-host" ref={toolsHost} />}
    {!isPaper && pages > 1 && <div className="resume-tools" aria-label="PDF controls">
      <div className="resume-pagination">
        <button type="button" disabled={page <= 1 || !pages || failed} onClick={() => turnPage(page - 1)} aria-label="Previous page"><ArrowLeft /></button>
        <span aria-live="polite">{pages ? `${page} / ${pages}` : "— / —"}</span>
        <button type="button" disabled={!pages || page >= pages || failed} onClick={() => turnPage(page + 1)} aria-label="Next page"><ArrowRight /></button>
      </div>
    </div>}
    <div className="resume-viewport" ref={viewport} tabIndex={0} aria-label={isPaper ? "Paper document" : "Resume document"}>
      {slow && rendering && <div className="resume-message" role="status"><p>The PDF is taking longer to respond.</p><button type="button" onClick={() => { setSlow(false); setPages(0); setAttempt(value => value + 1); }}>Retry</button></div>}
      {failed ? errorMessage : Renderer ? <Renderer key={`${attempt}:${sourceIndex}`} url={url} source={sources[sourceIndex]} pages={pages} page={page} width={pageWidth} ratio={pageRatio}
        isPaper={isPaper} toolbarHost={toolsHost.current} onLoad={({ numPages }) => { setPages(numPages); setFailed(false); setSlow(false); }}
        onError={sourceFailed} onProgress={downloadProgress} onRatio={setPageRatio} onRender={() => { setRendered(renderKey); setSlow(false); centerPage(); }} error={errorMessage} /> : moduleFailed ? errorMessage : null}
    </div>
  </dialog>, document.body);
}

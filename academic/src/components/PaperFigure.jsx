import { useEffect, useMemo, useState } from 'react';
import { cachedFigure, loadFigure, invalidateFigure } from '../utils/paperFigureCache';
import useNearViewport from '../hooks/useNearViewport';

export default function PaperFigure({ paper, endpoint }) {
  const id = paper.figureId || paper.id;
  const [container, visible] = useNearViewport('300px');
  const [figure, setFigure] = useState(() => cachedFigure(id)?.figure);
  const [loaded, setLoaded] = useState(new Set());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(true);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setPending(true);
    setFailed(false);
    async function load() {
      let next = await loadFigure(id, endpoint);
      if (!active) return;
      if (!next) next = await import('../utils/pdfFigure').then(module => module.loadPdfFigure(id));
      if (active) { setFigure(next); if (!next) setPending(false); }
    }
    load().catch(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [visible, id, endpoint, attempt]);
  useEffect(() => {
    if (!visible || !failed) return;
    let active = true;
    setPending(true);
    import('../utils/pdfFigure').then(module => module.loadPdfFigure(id)).then(next => {
      if (!active) return;
      if (next && next.url !== figure?.url) { setFigure(next); setLoaded(new Set()); setFailed(false); }
      else setPending(false);
    }).catch(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [visible, failed, id, figure?.url]);
  useEffect(() => {
    if (!visible || pending || (figure && !failed) || attempt >= 2) return;
    const timer = setTimeout(() => { invalidateFigure(id); setAttempt(value => value + 1); }, (attempt + 1) * 8000);
    return () => clearTimeout(timer);
  }, [visible, pending, figure, failed, attempt, id]);
  const images = useMemo(() => figure?.panels || (figure ? [figure.url] : []), [figure]);
  const ready = images.some(url => loaded.has(url));
  useEffect(() => {
    if (!visible || !figure || images.every(url => loaded.has(url)) || failed) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [visible, figure, loaded, failed, images]);
  return <span ref={container} className="related-cover" aria-hidden="true">
    {!ready && <span className={`related-figure-placeholder${pending ? ' is-loading' : ''}`} />}
    {visible && figure && (!failed || ready) && <span style={{ opacity: ready ? 1 : 0 }} className={`related-figure-panels${images.length > 1 ? ' is-composite' : ''}`}>{images.map(url => <img key={`${url}:${attempt}`} className="related-figure" src={url} style={{ display: failed && !loaded.has(url) ? 'none' : undefined }} alt="" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoaded(previous => new Set([...previous, url]))} onError={() => setFailed(true)} />)}</span>}
  </span>;
}

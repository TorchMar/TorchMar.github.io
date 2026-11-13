import { useEffect, useRef, useState } from "react";
import config from "../../config/paper-recommendations.json";
import { parseArxivFeed } from "../utils/arxivFeed";
import { fetchHuggingFacePapers } from "../utils/huggingFacePapers";
import "../css/RelatedPapers.css";
import PaperFigure from "./PaperFigure";
import { ChevronDown } from "lucide-react";
import { isDailyPapersVisible } from "../utils/sectionVisibility";

const feeds = new Map();

export default function RelatedPapers({ paper, onOpen, daily = false }) {
  const section = useRef(null);
  const [visible, setVisible] = useState(!daily);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const shown = useRef([]);
  const endpoint = config.endpoint;
  const cacheMinutes = daily ? (config.daily?.cacheMinutes ?? config.cacheMinutes) : config.cacheMinutes;
  const keywords = daily ? config.daily?.keywords : paper.tags;
  const paperKeywords = paper.tags || [];
  const limit = daily ? (expanded ? 8 : config.daily?.limit) : config.limit;
  const keywordKey = JSON.stringify(keywords);
  const enabled = daily ? isDailyPapersVisible(config) : config.enabled && keywords?.length;
  useEffect(() => {
    if (!enabled || !section.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "1200px" });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !visible) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let active = true;
    setLoading(true);
    function display(data, candidates) {
      if (!active || controller.signal.aborted) return;
      const existing = daily && expanded ? shown.current : [];
      const ids = new Set(existing.map(item => item.id));
      const items = [...existing, ...candidates.filter(item => {
        if (ids.has(item.id)) return false;
        ids.add(item.id);
        return true;
      })].slice(0, limit);
      shown.current = items;
      setError(false);
      setResult({ ...data, items, requestedLimit: limit });
    }
    async function load() {
      try {
        if (!endpoint) {
          const key = `hf-v2:${paper.id}:${keywordKey}`;
          let data = feeds.get(key);
          if (!data) {
            try {
              const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
              if (saved && Array.isArray(saved.items) && Date.now() - saved.time < cacheMinutes * 60000) data = saved;
            } catch { /* Browser storage is optional. */ }
          }
          if (!data || Date.now() - data.time >= cacheMinutes * 60000) {
            data = await fetchHuggingFacePapers(JSON.parse(keywordKey), { signal: controller.signal, excluded: [paper.link, paper.pdfUrl] });
            feeds.set(key, data);
            try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* Storage is optional. */ }
          }
          if (active) display(data, data.items);
          return;
        }
        const key = `${endpoint}|${paper.id}|${keywordKey}|${limit}`;
        let data = feeds.get(key);
        if (!data) {
          try {
            const saved = JSON.parse(sessionStorage.getItem(`arxiv-feed:${key}`) || 'null');
            if (saved && Date.now() - saved.time < cacheMinutes * 60000 && typeof saved.xml === 'string' && saved.xml.length < 1000000) {
              parseArxivFeed(saved.xml, [], limit);
              data = saved;
              feeds.set(key, data);
            }
          } catch { /* Invalid or unavailable cache: request fresh data. */ }
        }
        if (!data || Date.now() - data.time > cacheMinutes * 60000) {
          const url = new URL(endpoint, window.location.origin);
          url.searchParams.set("paper", paper.id);
          if (daily && expanded) url.searchParams.set("expanded", "1");
          const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
          if (!response.ok) throw new Error("Unavailable");
          data = { xml: await response.text(), time: Date.now(), fetchedAt: response.headers.get("X-Fetched-At"), stale: response.headers.get("X-Feed-Stale") === "true" };
          // Validate before caching remote data.
          parseArxivFeed(data.xml, [], limit);
          feeds.set(key, data);
          try { sessionStorage.setItem(`arxiv-feed:${key}`, JSON.stringify(data)); } catch { /* Storage can be full or disabled. */ }
        }
        const items = parseArxivFeed(data.xml, [paper.link, paper.pdfUrl], limit);
        if (active) display(data, items);
      } catch { if (active) setError(true); }
      finally { clearTimeout(timer); if (active) setLoading(false); }
    }
    load();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [enabled, visible, endpoint, cacheMinutes, paper.id, paper.link, paper.pdfUrl, retry, limit, keywordKey, daily, expanded]);
  if (!enabled) return null;
  return <section id={daily ? "daily-papers" : undefined} ref={section} className={`related-papers${daily ? " daily-papers" : ""}`} aria-label={`${daily ? "Daily" : "Related"} papers from ${endpoint ? "arXiv" : "Hugging Face"}`}>
    <div className="related-heading">{daily ? <h2 className="card-title">Daily Papers</h2> : <h3>RELATED PAPERS</h3>}</div>
    <div className="related-meta-row">
      <div className="related-keywords related-keyword-tags" aria-label={daily ? "Search keywords" : "Paper keywords"}>{(daily ? keywords : paperKeywords).map(keyword => <span className="related-keyword-tag" key={keyword}>{keyword}</span>)}</div>
      {result?.fetchedAt && <p className="related-updated">Fetched {new Date(result.fetchedAt).toLocaleString()}</p>}
    </div>
    {error && !result ? <p className="related-status" role="status">Recommendations are temporarily unavailable. <button type="button" onClick={() => { setError(false); setRetry(value => value + 1); }}>Retry</button></p> : result ? <>
      {result.items.length ? <div className="related-grid">{result.items.map(item => <button className="related-card" type="button" key={item.id} aria-haspopup="dialog" aria-label={`Read ${item.title}`} onClick={event => onOpen(item, event.currentTarget)}>
        <PaperFigure paper={item} endpoint={endpoint} />
        <span className="related-copy"><span className="related-date">arXiv · {item.published.slice(0, 10)}</span><strong>{item.title}</strong><span className="related-authors">{item.authors}</span></span>
      </button>)}{loading && Array.from({ length: Math.max(0, limit - result.items.length) }, (_, i) => <div key={`pending-${i}`} className="related-placeholder" aria-label="Fetching recommendations" />)}</div> : <p className="related-status">No matching papers found for these keywords.</p>}
    </> : <div className="related-grid" aria-label="Fetching recommendations" aria-busy="true">{[0, 1].map(i => <div className="related-placeholder" key={i} />)}</div>}
    {daily && result?.items.length > 0 && result.requestedLimit < 8 && <div className="daily-more-row">
      <button type="button" className="daily-more" aria-label="More" disabled={loading} aria-busy={loading} onClick={() => { setError(false); setLoading(true); if (expanded) setRetry(value => value + 1); else setExpanded(true); }}><span>More</span><ChevronDown aria-hidden="true" /></button>
    </div>}
  </section>;
}

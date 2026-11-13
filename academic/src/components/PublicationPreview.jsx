import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useModalDialog } from "../hooks/useModalDialog";
import { ArrowLeft, ArrowRight, X, Maximize2, Minus, FileText, BookOpen, Quote } from "lucide-react";
import "@fontsource-variable/newsreader/wght.css";
import { publicationPreviews as stories } from "../siteConfig";
import "../css/PublicationPreview.css";
import "../css/PaperWindow.css";
import { publicationTemplates, resolvePublicationPreview } from "../utils/publicationTemplates";
import RelatedPapers from "./RelatedPapers";

import PdfPreview from "./PdfPreview";
import { loadPdfDocument } from "../utils/loadPdfDocument";

function MetricBars({ rows, title, percent = false }) {
  return <div className="metric-bars"><h4>{title}</h4><p className="metric-scale">{percent ? "Accuracy · 0–100%" : "Correlation · 0–1"}</p>
    {rows.map(row => <div className="metric-row" key={row.label}>
      <div><span>{row.label}</span><strong>{row.value}{row.secondary ? " / " + row.secondary : ""}</strong></div>
      <div className="metric-rail"><i style={{width: `${parseFloat(row.value) * (percent ? 1 : 100)}%`}} /></div>
      {row.secondary && <div className="metric-rail secondary"><i style={{width: `${Number(row.secondary)*100}%`}} /></div>}
    </div>)}
  </div>;
}

function BudgetChart({ rows, title }) {
  const maxBudget = Math.max(1, ...rows.map(row => parseFloat(row.label)));
  const x = row => 55 + parseFloat(row.label) / maxBudget * 480;
  const y = value => 240 - Number(value) * 190;
  return <figure className="budget-chart"><figcaption>{title} <span>SRCC <i /> PLCC</span></figcaption>
    <svg viewBox="0 0 590 285" role="img" aria-label={rows.map(row => `${row.label} human MOS: SRCC ${row.value}, PLCC ${row.secondary}`).join("; ")}>
      {[0,.5,1].map(value => <g key={value}><line x1="55" x2="535" y1={y(value)} y2={y(value)} className="plot-grid" /><text x="36" y={y(value)+4} textAnchor="end">{value.toFixed(1)}</text></g>)}
      {["value","secondary"].map(column => <g key={column} className={column === "value" ? "plot-srcc" : "plot-plcc"}>
        <polyline points={rows.map(row => `${x(row)},${y(row[column])}`).join(" ")} />
        {rows.map(row => <g key={row.label}><circle cx={x(row)} cy={y(row[column])} r="4" /><text x={x(row)} y={y(row[column])+(column==="value"?22:-14)} textAnchor="middle">{row[column]}</text></g>)}
      </g>)}
      {rows.map(row => <text key={row.label} x={x(row)} y="265" textAnchor="middle">{row.label} MOS</text>)}
    </svg>
  </figure>;
}

export default function PublicationPreview({ paper, papers, onChange, onClose, onCopy, copied }) {
  const dialog = useRef(null);
  useModalDialog(dialog);
  const scrollArea = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  useEffect(() => { void loadPdfDocument().catch(() => {}); }, []);
  const paperButton = useRef(null);
  const returnFocus = useRef(null);
  const pointerOpened = useRef(false);
  const [relatedPdf, setRelatedPdf] = useState(null);
  const story = resolvePublicationPreview(paper, stories[paper.id]);
  const layout = story.template;
  const index = papers.findIndex(item => item.id === paper.id);
  useLayoutEffect(() => {
    // Reset after the new paper's DOM is mounted, before painting or scroll anchoring.
    scrollArea.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [paper.id]);

  function changePaper(offset) {
    setExpanded(false);
    onChange(papers[(index + offset + papers.length) % papers.length]);
  }

  const introduction = <section className="study-overview">
    <div className="study-question"><p className="study-eyebrow">{story.labels.idea}</p>
      <h3>{story.takeaway}</h3><p>{story.intro}</p>
    </div>
    <aside className="study-highlight"><strong>{story.highlight}</strong><span>{story.highlightLabel}</span><p>{story.highlightContext}</p></aside>
  </section>;

  const methodFigure = <figure className={`study-figure${expanded ? " is-expanded" : ""}`}>
    <div className="study-figure-scroll" tabIndex={expanded ? 0 : undefined} aria-label="Method figure">
      <img src={story.figure} alt={story.figureCaption} style={story.blendFigureBackground ? undefined : { filter: "none", mixBlendMode: "normal" }} />
    </div>
    <figcaption><span>{story.figureCaption}</span><button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <Minus /> : <Maximize2 />}{expanded ? "Fit figure" : "Enlarge"}</button></figcaption>
  </figure>;

  return <><dialog className={`research-preview study--${publicationTemplates[layout]?.className ?? "basic"}`} ref={dialog} onPointerDownCapture={() => { pointerOpened.current = true; }} onKeyDownCapture={() => { pointerOpened.current = false; }} aria-labelledby="research-paper-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <svg className="study-image-filters" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id="study-remove-white" colorInterpolationFilters="sRGB">
          {/* Fade only near-white pixels; retain darker text and colored diagram blocks. */}
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -10 -10 -10 0 30" result="whiteMask" />
          <feComposite in="SourceGraphic" in2="whiteMask" operator="in" />
        </filter>
      </defs>
    </svg>
    <div className="research-toolbar">
      <button className="research-previous" type="button" aria-label="Previous paper" onClick={() => changePaper(-1)}><ArrowLeft />Previous</button>
      <div className="research-window-controls">
        <span>{index + 1} / {papers.length}</span>
        <button className="research-next" type="button" aria-label="Next paper" onClick={() => changePaper(1)}>Next<ArrowRight /></button>
        <button type="button" aria-label="Close paper preview" onClick={onClose}><X /></button>
      </div>
    </div>
    <div className="research-scroll" ref={scrollArea} key={`paper-content-${paper.id}`}>
      <div className="study-heading">
        <p className="study-eyebrow">{story.category}</p>
        <div className="study-title-row">
          <h2 id="research-paper-title">{story.name}</h2>
          <p className="study-venue">{paper.venue}{layout === "challenge" ? " · Challenge report" : ""}</p>
        </div>
        {story.name !== paper.title && <p className="study-subtitle">{paper.title.startsWith(`${story.name}: `) ? paper.title.slice(story.name.length + 2) : paper.title}</p>}
        <div className="study-byline">
        <p className="study-authors">{paper.authors.map((author, i) => author.strong ? <strong key={i}>{author.text}</strong> : <React.Fragment key={i}>{author.text}</React.Fragment>)}</p>
        <div className="study-resources">
          <button ref={paperButton} type="button" onClick={() => setPdfOpen(true)} aria-haspopup="dialog"><FileText aria-hidden="true" />Paper</button>
          {story.source !== paper.link && <a href={story.source} target="_blank" rel="noreferrer"><BookOpen aria-hidden="true" />Full text</a>}
          <button type="button" onClick={event => onCopy(paper, event, false)}><Quote aria-hidden="true" /><span aria-live="polite">{copied === paper.id ? "Copied" : "Cite"}</span></button>
        </div>
        </div>
      </div>
      <div className="study-content">
        <details className="study-abstract study-abstract-top" id="study-abstract" key={`abstract-${paper.id}`} open={story.abstractExpanded || undefined}><summary>{story.labels.abstract} <span>+</span></summary><div>{(paper.abstract || "Abstract not provided.").split(/\n\s*\n/).map((text, i) => <p key={i}>{text}</p>)}</div></details>
        {layout !== "basic" && <>
        {layout === "comparison" && introduction}
        {layout === "narrative" && <section className="study-question"><p className="study-eyebrow">{story.labels.idea}</p><h3>{story.takeaway}</h3><p>{story.intro}</p></section>}
        {layout === "budget" && <section className="leaf-opening">
          <p className="study-eyebrow">{story.openingLabel}</p>
          <h3>{story.takeaway}</h3>
          <p className="leaf-intro">{story.intro}</p>
          <div className="leaf-budget"><aside className="study-highlight"><strong>{story.highlight}</strong><span>{story.highlightLabel}</span><p>{story.highlightContext}</p></aside><BudgetChart rows={story.rows} title={story.chartTitle} /></div>
          <p className="study-result-context">{story.resultNote}</p>
        </section>}
        {layout === "challenge" && <section className="challenge-opening">
          <div className="challenge-summary">
          <div>
          <p className="study-eyebrow">{story.openingLabel}</p>
          <h3>{story.takeaway}</h3>
          </div>
          <aside className="study-highlight"><strong>{story.highlight}</strong><span>{story.highlightLabel}</span><p>{story.highlightContext}</p></aside>
          </div>
          <figure className="study-task"><img src={paper.image} alt={story.taskCaption || paper.title} /><figcaption>{story.taskCaption}</figcaption></figure>
          <div className="challenge-entry"><p className="study-eyebrow">{story.labels.entry}</p><p>{story.intro}</p></div>
        </section>}
        <section className="study-method" aria-label="Method overview">
        <div className="study-section-heading"><p className="study-eyebrow">{story.labels.method}</p><h3>{story.headline}</h3></div>
        {layout === "budget" && <p className="study-method-copy">{story.method}</p>}
        {layout === "challenge" && <dl className="challenge-method-notes">{story.steps.map(({title, text}) => <div key={title}><dt>{title}</dt><dd>{text}</dd></div>)}</dl>}
        {methodFigure}
        {layout !== "challenge" && <ol className="study-steps">{story.steps.map(({title, text}, i) => <li key={title}><span>0{i + 1}</span><h4>{title}</h4><p>{text}</p></li>)}</ol>}
        {layout !== "budget" && <p className="study-method-copy">{story.method}</p>}
        </section>
        {layout !== "narrative" && <section className="study-results" aria-labelledby="study-results-title">
          <p className="study-eyebrow">{story.labels.results}</p>
          <h3 id="study-results-title">{story.resultTitle}</h3>
          {layout !== "budget" && <p className="study-result-context">{story.resultNote}</p>}
          {layout === "comparison" && <div className="study-comparison">
            <div className="study-chart-legend"><span>{story.labels.reference}</span><span>{story.name}</span><small>SRCC · scale 0–1</small></div>
            {story.rows.map(row => <div className="study-comparison-row" key={row.label}><span>{row.label}<small>{row.referenceLabel}</small></span><div><div className="study-bar is-reference"><i style={{width:`${Number(row.reference)*100}%`}} /><b>{row.reference}</b></div><div className="study-bar"><i style={{width:`${Number(row.value)*100}%`}} /><b>{row.value}</b></div></div></div>)}
            <div className="study-comparison-axis" aria-hidden="true"><span>0</span><span>0.2</span><span>0.4</span><span>0.6</span><span>0.8</span><span>1.0</span></div>
          </div>}
          {layout === "budget" && <>
            <MetricBars title={story.metricTitle || "SRCC / PLCC"} rows={story.ablationRows} />
          </>}
          {layout === "challenge" && <>
            <div className="challenge-ranking"><h4>{story.labels.ranking}</h4><p className="metric-scale">Overall accuracy · 0–100%</p>
              {story.rows.map(row => <div className={row.highlighted ? "rank-entry is-own" : "rank-entry"} key={row.rank}>
                <span className="rank-number">{row.rank}</span><div><div className="rank-label"><span>{row.label}</span><strong>{row.value}</strong></div><div className="metric-rail"><i style={{width:row.value}} /></div></div>
              </div>)}
            </div>
            <details className="study-evidence-details"><summary>{story.labels.groups}</summary><MetricBars title={story.labels.groupTitle} rows={story.ablationRows} percent /></details>
          </>}
          <p className="study-footnote">{story.footnote}</p>
          <a className="study-source" href={story.source} target="_blank" rel="noreferrer">{story.sourceLabel}</a>
        </section>}
        </>}
        <div className="study-bottom"><span>{paper.venue}</span><a href={story.source} target="_blank" rel="noreferrer">Continue reading the full paper</a></div>
        <RelatedPapers key={`related-${paper.id}`} paper={paper} onOpen={(item, button) => { returnFocus.current = button; setRelatedPdf(item); setPdfOpen(true); }} />
      </div>
    </div>
  </dialog>
  {pdfOpen && <PdfPreview key={relatedPdf?.id || paper.id} url={relatedPdf?.pdfUrl || paper.pdfUrl || paper.link} name={relatedPdf?.title || paper.title} kind="paper" onClose={() => { setPdfOpen(false); setRelatedPdf(null); const target = pointerOpened.current ? dialog.current : (returnFocus.current || paperButton.current); returnFocus.current = null; requestAnimationFrame(() => target?.focus({ preventScroll: true })); }} />}
  </>;
}

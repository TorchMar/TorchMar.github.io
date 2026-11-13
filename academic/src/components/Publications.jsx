import React, { lazy, Suspense, useEffect, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy, AiOutlineFileText } from "react-icons/ai";
import "../css/Publications.css";
import { publications } from "../siteConfig";
import { fetchScholarCitations, resolveCitationCount } from "../utils/scholarCitations";

const loadPublicationPreview = () => import("./PublicationPreview");
const PublicationPreview = lazy(loadPublicationPreview);

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
  return Promise.resolve();
}

export default function Publications() {
  const [copiedPaper, setCopiedPaper] = useState("");
  const [bursts, setBursts] = useState([]);
  const [citationMap, setCitationMap] = useState({});
  const [abstractPaper, setAbstractPaper] = useState(null);

  useEffect(() => {
    let active = true;
    fetchScholarCitations().then((citations) => {
      if (active) setCitationMap(citations);
    });
    return () => { active = false; };
  }, []);

  const copyCitation = (paper, event, celebrate = true) => {
    copyText(paper.citation).then(() => {
      const burstId = `${paper.id}-${Date.now()}`;
      setCopiedPaper(paper.id);
      if (celebrate) setBursts((current) => [...current, { id: burstId, x: event.clientX, y: event.clientY }]);
      window.setTimeout(() => setCopiedPaper((current) => current === paper.id ? "" : current), 1400);
      window.setTimeout(() => setBursts((current) => current.filter((burst) => burst.id !== burstId)), 900);
    }).catch(() => {});
  };

  return (
    <section id="publications">
      <div className="publication-fireworks" aria-hidden="true">
        {bursts.map((burst) => (
          <span className="publication-firework" style={{ left: burst.x, top: burst.y }} key={burst.id}>
            {Array.from({ length: 10 }).map((_, index) => <i style={{ "--particle-angle": `${index * 36}deg` }} key={index} />)}
          </span>
        ))}
      </div>
      <div className="card-title">Publications</div>
      <div className="publications-list">
        {publications.length === 0 && <p>No publications listed yet.</p>}
        {publications.map((paper) => {
          const citationCount = resolveCitationCount(paper.title, citationMap);
          return (
          <article className="publication-card" id={paper.id} key={paper.id}>
            <img className="publication-image" src={paper.image} alt="" loading="lazy" decoding="async" />
            <div className="publication-content">
              <div className="publication-venue">
                <span className={`venue-tag ${paper.venueType}`}>{paper.venue}</span>
                {paper.ccf && <span className="venue-tag ccf">{paper.ccf}</span>}
              </div>
              <h3 className="publication-title">
                {paper.abstract ? (
                  <button className="publication-abstract-trigger" type="button" aria-haspopup="dialog" aria-label={`Preview paper: ${paper.title}`}
                    onPointerEnter={() => { void loadPublicationPreview(); }}
                    onFocus={() => { void loadPublicationPreview(); }}
                    onClick={() => setAbstractPaper(paper)}>
                    {paper.title}
                  </button>
                ) : paper.title}
              </h3>
              <div className="publication-author-row">
                <div className="publication-authors">{paper.authors.map((author, index) => author.strong ? <strong key={index}>{author.text}</strong> : <React.Fragment key={index}>{author.text}</React.Fragment>)}</div>
                <div className="publication-author-tags">
                  {Number.isFinite(citationCount) && citationCount > 0 && <span className="publication-author-tag is-citation">Cited by {citationCount}</span>}
                  {paper.authorTag && <span className={`publication-author-tag is-${paper.authorTag.type}`}>{paper.authorTag.type === "rank" && <span className="challenge-trophy" aria-hidden="true">🏆</span>}{paper.authorTag.label}</span>}
                </div>
              </div>
              <div className="publication-tags">{paper.tags.map((tag) => <span className="tag-item-show" key={tag}>{tag}</span>)}</div>
              <div className="publication-links">
                <a href={paper.link} target="_blank" rel="noreferrer"><AiOutlineFileText aria-hidden="true" />Paper</a>
                <button className={`publication-cite${copiedPaper === paper.id ? " is-copied" : ""}`} type="button" onClick={(event) => copyCitation(paper, event)}>
                  {copiedPaper === paper.id ? <AiOutlineCheck aria-hidden="true" /> : <AiOutlineCopy aria-hidden="true" />}
                  {copiedPaper === paper.id ? "Copied" : "Cite"}
                </button>
                <span className="publication-citation-preview">{paper.citation}</span>
              </div>
            </div>
          </article>
          );
        })}
      </div>
      {abstractPaper && <Suspense fallback={null}><PublicationPreview paper={abstractPaper} papers={publications} onChange={setAbstractPaper} onClose={() => setAbstractPaper(null)} onCopy={copyCitation} copied={copiedPaper} /></Suspense>}
    </section>
  );
}

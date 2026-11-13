import React from "react";
import { Quote } from "lucide-react";
import "../css/About.css";
import { about } from "../siteConfig";

function InfoCallout({ icon, label, children, footer, variant = "default" }) {
  return (
    <aside className={`callout callout-${variant}`}>
      <div className="callout-icon" aria-hidden="true">{React.createElement(icon)}</div>
      {label && <div className="callout-label">{label}</div>}
      <blockquote className="callout-body">
        <p>{children}</p>
        {footer && <footer>{footer}</footer>}
      </blockquote>
    </aside>
  );
}

export default function About() {
  return (
    <section className="about" id="about">
      <div className="intro-text">
        {about.paragraphs.map((paragraph, paragraphIndex) => <React.Fragment key={paragraphIndex}>
          {paragraph.map((segment, segmentIndex) => segment.strong
            ? <strong key={segmentIndex}>{segment.text}</strong>
            : <React.Fragment key={segmentIndex}>{segment.text}</React.Fragment>)}
          {paragraphIndex < about.paragraphs.length - 1 && <><br /><br /></>}
        </React.Fragment>)}
        {about.quote && <InfoCallout icon={Quote} footer={about.quote.author} variant="quote">
          {about.quote.text}
        </InfoCallout>}
      </div>
    </section>
  );
}

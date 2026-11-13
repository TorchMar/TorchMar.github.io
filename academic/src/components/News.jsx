import React from "react";
import "../css/News.css";
import { newsItems } from "../siteConfig";

function NewsSegment({ segment }) {
  if (segment.href) {
    return <a className="news-ref" href={segment.href} target="_blank" rel="noreferrer">{segment.text}</a>;
  }
  if (segment.strong) return <strong className="news-ref">{segment.text}</strong>;
  return segment.text;
}

export default function News() {
  return <section className="News" id="news"><div className="card-title">News</div><ul className="news-list">{newsItems.map((item) => <li key={item.date}><div className="news-time">{item.date}</div><div className="news-content">{item.segments.map((segment, index) => <NewsSegment segment={segment} key={`${item.date}-${index}`} />)}</div></li>)}</ul></section>;
}

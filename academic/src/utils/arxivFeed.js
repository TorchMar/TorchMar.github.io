export function arxivId(value) {
  const match = String(value).match(/arxiv\.org\/(?:abs|pdf)\/((?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}))(?:v\d+)?(?:\.pdf)?(?:[?#].*)?$/i);
  return match?.[1] || null;
}

export function parseArxivFeed(xml, excluded, limit, Parser = DOMParser) {
  const doc = new Parser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid arXiv response");
  const atom = "http://www.w3.org/2005/Atom";
  const text = (node, tag) => node.getElementsByTagNameNS(atom, tag)[0]?.textContent?.replace(/\s+/g, " ").trim() || "";
  const seen = new Set(excluded.map(arxivId).filter(Boolean));
  return Array.from(doc.getElementsByTagNameNS(atom, "entry")).flatMap(entry => {
    const id = arxivId(text(entry, "id"));
    const title = text(entry, "title");
    const published = text(entry, "published");
    if (!id || !title || !Number.isFinite(Date.parse(published)) || seen.has(id)) return [];
    seen.add(id);
    const version = text(entry, "id").match(/v(\d+)$/)?.[1];
    return [{ id, figureId: version ? `${id}v${version}` : id, title, published, pdfUrl: `https://arxiv.org/pdf/${id}`, authors: Array.from(entry.getElementsByTagNameNS(atom, "author")).map(author => text(author, "name")).join(", ") }];
  }).sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, limit);
}

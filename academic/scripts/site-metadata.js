export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

export function renderSiteMetadata(html, site) {
  return html.replace(/%SITE_(TITLE|DESCRIPTION|LANGUAGE)%/g, (_, key) =>
    escapeHtml(site[key.toLowerCase()]));
}

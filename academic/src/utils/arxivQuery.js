export function buildQuery(config, id, expanded = false) {
  const daily = id === "daily";
  if (expanded && !daily) return null;
  if (daily && !config.daily?.enabled) return null;
  const keywords = daily ? config.daily.keywords : config.publications?.find(paper => paper.id === id)?.tags;
  if (!config.enabled || !Array.isArray(keywords) || !keywords.length) return null;
  const query = keywords.map(word => {
    const phrase = word.replace(/["\\]/g, " ").trim();
    return `(ti:"${phrase}" OR abs:"${phrase}")`;
  }).join(" OR ");
  const url = new URL("https://export.arxiv.org/api/query");
  url.search = new URLSearchParams({ search_query: query, start: "0", max_results: String(expanded ? 8 : (daily ? config.daily.limit : config.limit) + 3), sortBy: "submittedDate", sortOrder: "descending" });
  return url;
}

// A bounded, fixed-query service: callers cannot supply URLs or arbitrary searches.
export function createArxivService(config, { fetchImpl = fetch, now = Date.now, spacing = 3100 } = {}) {
  const memory = new Map();
  const pending = new Map();
  let queue = Promise.resolve();
  let nextRequest = 0;
  return async function getFeed(id, expanded = false) {
    const url = buildQuery(config, id, expanded);
    if (!url) return new Response("Unknown paper", { status: 404 });
    const key = url.toString();
    const ttl = (id === "daily" ? (config.daily?.cacheMinutes ?? config.cacheMinutes) : config.cacheMinutes) * 60;
    const cached = memory.get(key);
    if (cached && now() - cached.time < ttl * 1000) return cached.response.clone();
    if (pending.has(key)) return (await pending.get(key)).clone();
    const job = queue.then(async () => {
      const delay = nextRequest - now();
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      nextRequest = now() + spacing;
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: "application/atom+xml" } });
        if (!response.ok) throw new Error("arXiv unavailable");
        const xml = await response.text();
        if (xml.length > 1000000 || !xml.includes("<feed") || xml.includes("<id>http://arxiv.org/api/errors")) throw new Error("Invalid feed");
        const result = new Response(xml, { headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": `public, max-age=${ttl}`, "X-Fetched-At": new Date(now()).toISOString() } });
        memory.set(key, { time: now(), response: result.clone() });
        return result;
      } catch {
        if (cached) {
          const stale = cached.response.clone();
          stale.headers.set("X-Feed-Stale", "true");
          stale.headers.set("Cache-Control", "no-store");
          return stale;
        }
        return new Response("arXiv is temporarily unavailable", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
      }
    });
    pending.set(key, job);
    queue = job.then(() => {}, () => {});
    try { return (await job).clone(); } finally { pending.delete(key); }
  };
}

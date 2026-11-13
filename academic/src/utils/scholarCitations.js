import { scholarProfileUrl as GOOGLE_SCHOLAR_PROFILE } from "../siteConfig";
const CACHE_KEY = `anleeno:google-scholar-citations:v1:${GOOGLE_SCHOLAR_PROFILE || "disabled"}`;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function normalizeTitle(value = "") {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function rowsToMap(rows) {
  return rows.reduce((result, row) => {
    const key = normalizeTitle(row?.title);
    if (key && Number.isFinite(row?.citations)) {
      result[key] = Math.max(result[key] || 0, row.citations);
    }
    return result;
  }, {});
}

function parseScholarHtml(html) {
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  return Array.from(documentNode.querySelectorAll("tr.gsc_a_tr"))
    .map((row) => ({
      title: row.querySelector(".gsc_a_at")?.textContent?.trim() || "",
      citations: Number.parseInt(row.querySelector(".gsc_a_ac")?.textContent?.trim() || "0", 10),
    }))
    .filter((row) => row.title && Number.isFinite(row.citations));
}

function parseScholarMarkdown(text) {
  const rows = [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const match = line.match(/cited by\s+(\d+)/i);
    const title = lines[index - 1]?.replace(/^\d+\.\s*/, "");
    if (match && title && !/^(cited by|year|title)$/i.test(title)) {
      rows.push({ title, citations: Number.parseInt(match[1], 10) });
    }
  });

  return rows;
}

function readCache(allowExpired = false) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY));
    const isFresh = Date.now() - cached.savedAt < CACHE_TTL_MS;
    return cached?.citations && (allowExpired || isFresh) ? cached.citations : null;
  } catch {
    return null;
  }
}

function writeCache(citations) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ citations, savedAt: Date.now() }));
  } catch {
    // Citation data is optional and must never affect the publication cards.
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    return response.ok ? response.text() : "";
  } catch {
    return "";
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchScholarCitations() {
  if (!GOOGLE_SCHOLAR_PROFILE) return {};
  const cached = readCache();
  if (cached) return cached;

  const scholarPath = GOOGLE_SCHOLAR_PROFILE.replace(/^https?:\/\//i, "");
  const urls = [
    `https://r.jina.ai/http://${scholarPath}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(GOOGLE_SCHOLAR_PROFILE)}`,
  ];

  for (const url of urls) {
    const text = await fetchText(url);
    if (!text) continue;
    const rows = text.includes("gsc_a_tr") ? parseScholarHtml(text) : parseScholarMarkdown(text);
    const citations = rowsToMap(rows);
    if (Object.keys(citations).length > 0) {
      writeCache(citations);
      return citations;
    }
  }

  return readCache(true) || {};
}

export function resolveCitationCount(title, citationMap = {}) {
  const target = normalizeTitle(title);
  if (Number.isFinite(citationMap[target])) return citationMap[target];
  const similarTitle = Object.keys(citationMap).find(
    (candidate) => candidate.length >= 12 && (candidate.includes(target) || target.includes(candidate)),
  );
  return similarTitle ? citationMap[similarTitle] : null;
}

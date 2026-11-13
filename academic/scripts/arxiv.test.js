import test from "node:test";
import assert from "node:assert/strict";
import { buildQuery, createArxivService } from "../src/utils/arxivQuery.js";
import { arxivId } from "../src/utils/arxivFeed.js";

const config = { enabled: true, limit: 4, cacheMinutes: 30, publications: [{id:"demo",tags:["video quality", "visual quality"]}] };
test("daily expansion is explicit, capped at eight, and cached separately", async () => {
  const settings = {...config, daily:{enabled:true,limit:4,keywords:["AIGC"]}};
  const counts = [];
  const service = createArxivService(settings, {spacing:0,fetchImpl:async url => {
    counts.push(url.searchParams.get("max_results"));
    return new Response("<feed></feed>");
  }});
  await service("daily");
  assert.deepEqual(counts, ["7"]);
  await service("daily", true);
  await service("daily", true);
  await service("daily");
  assert.deepEqual(counts, ["7", "8"]);
  assert.equal(buildQuery(settings, "demo", true), null);
});
test("daily feed uses independent keywords, limit and visibility", () => {
  const daily = { enabled: true, limit: 6, keywords: ["reinforcement learning", "large language model"] };
  const query = buildQuery({ ...config, daily }, "daily");
  assert.equal(query.searchParams.get("max_results"), "9");
  assert.match(query.searchParams.get("search_query"), /reinforcement learning/);
  assert.equal(buildQuery(config, "daily"), null);
  assert.equal(buildQuery({ ...config, daily: { ...daily, enabled: false } }, "daily"), null);
});
test("daily cache lasts six hours independently of the related paper cache", async () => {
  const settings = { ...config, daily: { enabled: true, limit: 4, keywords: ["AIGC"], cacheMinutes: 360 } };
  let time = 0, calls = 0;
  const service = createArxivService(settings, {
    spacing: 0,
    now: () => time,
    fetchImpl: async () => { calls++; return new Response("<feed></feed>"); },
  });
  assert.equal((await service("daily")).headers.get("Cache-Control"), "public, max-age=21600");
  assert.equal((await service("demo")).headers.get("Cache-Control"), "public, max-age=1800");
  assert.equal(calls, 2);
  time = 30 * 60000;
  await service("daily");
  assert.equal(calls, 2);
  await service("demo");
  assert.equal(calls, 3);
  time = 360 * 60000 - 1;
  await service("daily");
  assert.equal(calls, 3);
  time++;
  await service("daily");
  assert.equal(calls, 4);
});
test("arXiv query is allowlisted, phrase-based and newest-first", () => {
  assert.equal(buildQuery(config, "https://evil.example"), null);
  assert.equal(buildQuery(config, "toString"), null);
  const url = buildQuery(config, "demo");
  assert.equal(url.hostname, "export.arxiv.org");
  assert.equal(url.searchParams.get("sortBy"), "submittedDate");
  assert.equal(url.searchParams.get("sortOrder"), "descending");
  assert.equal(url.searchParams.get("max_results"), "7");
  assert.match(url.searchParams.get("search_query"), /ti:"video quality" OR abs:"video quality"/);
});
test("related queries use publication tags without a second keyword configuration", () => {
  const settings = {...config,publications:[{id:"paper",tags:["MLLM", "Few-shot"]}]};
  const query = buildQuery(settings,"paper").searchParams.get("search_query");
  assert.equal(query, '(ti:"MLLM" OR abs:"MLLM") OR (ti:"Few-shot" OR abs:"Few-shot")');
  assert.equal(buildQuery({...settings,publications:[{id:"paper",tags:[]}]},"paper"),null);
});
test("concurrent requests share a fetch and cache results", async () => {
  let calls = 0;
  const service = createArxivService(config, { spacing: 0, fetchImpl: async () => { calls++; return new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'); } });
  const responses = await Promise.all([service("demo"), service("demo")]);
  assert.equal(calls, 1);
  assert.equal(await responses[0].text(), await responses[1].text());
  assert.equal((await service("demo")).status, 200);
  assert.equal(calls, 1);
  assert.equal((await service("missing")).status, 404);
});
test("outages are explicit and do not poison the cache", async () => {
  let time = 0, fail = false;
  const service = createArxivService(config, { spacing: 0, now: () => time, fetchImpl: async () => { if (fail) throw new Error(); return new Response("<feed></feed>"); } });
  await service("demo");
  time = 1800001; fail = true;
  assert.equal((await service("demo")).headers.get("X-Feed-Stale"), "true");
  const unavailable = createArxivService(config, { spacing: 0, fetchImpl: async () => new Response("error", { status: 429 }) });
  assert.equal((await unavailable("demo")).status, 503);
});
test("arXiv IDs exclude versions and reject unrelated links", () => {
  assert.equal(arxivId("https://arxiv.org/abs/2604.12813v2"), "2604.12813");
  assert.equal(arxivId("https://arxiv.org/pdf/2509.09190"), "2509.09190");
  assert.equal(arxivId("https://example.com/paper.pdf"), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectFigure, createFigureService, readFigureResponse } from '../src/utils/arxivFigures.js';

const page = 'https://arxiv.org/html/2604.12813v1';
const figure = (caption, src = '2604.12813v1/x1.png') => `<figure><img src="${src}"><figcaption>${caption}</figcaption></figure>`;
test('descriptive filenames recover diagrams without diagram keywords in captions', () => {
  const caption = 'Fig. 1: Distillation-Aware Compression Loop. A teacher supervises a smaller student in Stage 1 and Stage 2.';
  assert.equal(selectFigure(figure(caption, '2604.12813v1/DAC-Loop-architecture.png'), page).url, `${page}/DAC-Loop-architecture.png`);
  assert.equal(selectFigure(figure(caption, '2604.12813v1/method-results.png'), page), null);
  assert.equal(selectFigure(figure('Fig. 2: Accuracy comparison', '2604.12813v1/architecture.png'), page), null);
});
test('paired method illustrations need not use the word framework', () => {
  assert.ok(selectFigure(figure('Few-Shot Concept Induction. (Left) A learner infers concepts. (Right) ADA proposes a prototype representation visualized here.'), page));
  assert.equal(selectFigure(figure('Performance comparison. (Left) Our method accuracy. (Right) Proposed representation accuracy.'), page), null);
});
test('configuration diagrams and inline TikZ SVG are supported without DOM injection', () => {
  assert.ok(selectFigure(figure('Fig. 1: Two HITL configurations. Red shading indicates agent resources.'), page));
  const inline = svg => `<figure>${svg}<figcaption>Fig. 1: Overview of our method.</figcaption></figure>`;
  const result = selectFigure(inline('<svg viewBox="0 0 100 40"><path d="M0 0L100 40"/></svg>'), page);
  assert.ok(result.url.startsWith('data:image/svg+xml,'));
  assert.match(decodeURIComponent(result.url), /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.equal(selectFigure(inline('<svg onload="alert(1)"></svg>'), page), null);
  assert.equal(selectFigure(inline('<svg><image href="https://other.example/x"/></svg>'), page), null);
  assert.ok(selectFigure(inline('<svg><g clip-path="url(#clip1)"><path d="M0 0"/></g></svg>'), page));
  assert.equal(selectFigure(inline('<svg><path style="fill:url(https://other.example/x)"/></svg>'), page), null);
});
test('select architecture over plots and first-page figures', () => {
  const html = figure('Figure 1: Accuracy and ablation') + figure('Figure 3: Overview of our proposed framework', '2604.12813v1/x3.png');
  assert.equal(selectFigure(html, page).url, `${page}/x3.png`);
});
test('actual arXiv SVG object paths resolve without a duplicated paper directory', () => {
  const html = '<figure id="S3.F1" class="ltx_figure"><object type="image/svg+xml" data="2610.35846v1/merging.svg" class="ltx_graphics"></object><figcaption><span>Figure 1: </span>Overview of source-aware multilingual ASR expansion.</figcaption></figure>';
  assert.equal(selectFigure(html, 'https://arxiv.org/html/2610.35846v1').url, 'https://arxiv.org/html/2610.35846v1/merging.svg');
});
test('streaming extraction stops before the rest of the paper arrives', async () => {
  let canceled = false;
  const response = new Response(new ReadableStream({start(controller) { controller.enqueue(new TextEncoder().encode(figure('Our architecture'))); },cancel() { canceled = true; }}));
  assert.equal((await readFigureResponse(response,page)).url, `${page}/x1.png`);
  assert.equal(canceled,true);
});
test('reject unsupported images, outside hosts and ambiguous panels', () => {
  assert.equal(selectFigure(figure('Overview of our benchmark examples'), page), null);
  assert.equal(selectFigure(figure('Examples produced by our framework'), page), null);
  assert.equal(selectFigure(figure('Overview of our architecture', 'https://evil.example/x.png'), page), null);
  assert.equal(selectFigure(figure('Overview of our architecture', '../../x.png'), page), null);
  assert.equal(selectFigure('<figure><img src="a.png"><img src="b.png"><figcaption>Our framework</figcaption></figure>', page), null);
  assert.equal(selectFigure(figure('Accuracy scores'), page), null);
  assert.equal(selectFigure(figure('Framework'), 'https://evil.example/html/2604.12813'), null);
});
test('figure metadata requests deduplicate, cache and never fetch arbitrary URLs', async () => {
  let calls = 0;
  const service = createFigureService({ spacing: 0, fetchImpl: async url => {
    calls++; assert.equal(url, 'https://arxiv.org/html/2604.12813');
    return new Response(figure('Overview of our framework'));
  } });
  const results = await Promise.all([service('2604.12813'), service('2604.12813')]);
  assert.equal(calls, 1);
  assert.match((await results[0].json()).figure.url, /x1.png$/);
  await service('2604.12813');
  assert.equal(calls, 1);
  assert.equal((await service('../../private')).status, 400);
});
test('unavailable HTML gracefully returns no figure', async () => {
  const service = createFigureService({ spacing: 0, fetchImpl: async () => new Response('', { status: 404 }) });
  assert.deepEqual(await (await service('2604.12813')).json(), { figure: null });
});
test('a slow download does not block the next request start', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const calls = [];
  const service = createFigureService({ spacing: 0, fetchImpl: async url => {
    calls.push(url);
    if (url.endsWith('2604.12813')) await gate;
    return new Response('', {status:404});
  } });
  const first = service('2604.12813');
  const second = service('2604.12814');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls.length, 2);
  release();
  await Promise.all([first, second]);
});
test('architecture captions may describe examples and accuracy without being plots', () => {
  assert.ok(selectFigure(figure('Overview of our framework. Examples illustrate accuracy improvements.'), page));
});
test('nested framework panels preserve the parent caption and all images', () => {
  const html = `<figure>${figure('(a) Training', '2604.12813v1/train.png')}${figure('(b) Inference', '2604.12813v1/infer.svg')}<figcaption>Figure 2: Overview of our framework</figcaption></figure>`;
  const result = selectFigure(html, page);
  assert.deepEqual(result.panels, [`${page}/train.png`, `${page}/infer.svg`]);
  assert.equal(result.caption, 'Figure 2: Overview of our framework');
  assert.equal(selectFigure(html.slice(0, html.lastIndexOf('</figure>')), page), null);
});
test('a composite with an unsafe panel is rejected as a whole', () => {
  assert.equal(selectFigure(`<figure><img src="2604.12813v1/train.png"><img src="https://evil.example/a.png"><figcaption>Our framework</figcaption></figure>`, page), null);
});
test('system testbed diagrams match without an architecture keyword', () => {
  assert.ok(selectFigure(figure('Fig. 2: LANCE’s 5G testbed for 4K video quality assessment.'), page));
});
test('benchmark design SVG is detected before long subsequent sections', async () => {
  const html = '<figure id="S1.F1"><object type="image/svg+xml" data="2610.35847v1/Figure_01_benchmark_overall.svg"></object><figcaption><span>Figure 1: </span><b>NPC-RubricBench design and composition.</b> a, Longitudinal evaluation setting. Records are segmented into six care phases.</figcaption></figure>';
  let canceled = false;
  const response = new Response(new ReadableStream({start(c) { c.enqueue(new TextEncoder().encode(html)); },cancel() { canceled = true; }}));
  const figure = await readFigureResponse(response,'https://arxiv.org/html/2610.35847v1');
  assert.equal(figure.url,'https://arxiv.org/html/2610.35847v1/Figure_01_benchmark_overall.svg');
  assert.equal(canceled,true);
  assert.equal(selectFigure('<figure><img src="2610.35847v1/results.png"><figcaption>Accuracy results for our benchmark design.</figcaption></figure>','https://arxiv.org/html/2610.35847v1'),null);
});
test('missing revised HTML falls back to the preceding version with attribution', async () => {
  const urls = [];
  const service = createFigureService({spacing:0, fetchImpl:async url => {
    urls.push(url);
    return url.endsWith('v2') ? new Response('', {status:404}) : new Response(figure('Our framework'));
  }});
  const result = await (await service('2604.12813v2')).json();
  assert.equal(urls.length, 2);
  assert.equal(result.figure.sourceVersion, 1);
  assert.equal(result.figure.source, page);
});
test('temporary errors do not silently select an older revision', async () => {
  let count = 0;
  const service = createFigureService({spacing:0,fetchImpl:async () => { count++; return new Response('',{status:503}); }});
  const result = await (await service('2604.12813v2')).json();
  assert.equal(count, 1);
  assert.equal(result.retryable, true);
});
test('a temporary upstream failure is not cached and the next request can recover', async () => {
  let calls = 0;
  const service = createFigureService({spacing:0,fetchImpl:async () => {
    calls++;
    return calls === 1 ? new Response('',{status:503}) : new Response(figure('Our framework'));
  }});
  const failed = await service('2604.12813v1');
  assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  const recovered = await service('2604.12813v1');
  assert.ok((await recovered.json()).figure);
  assert.equal(calls, 2);
});

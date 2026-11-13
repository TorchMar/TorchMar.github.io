import test from 'node:test';
import assert from 'node:assert/strict';
import { findFigureRegions } from '../src/utils/pdfFigureLayout.js';
const text = (str, x = 60, y = 400, width = 260) => ({ str, width, height: 10, transform: [10, 0, 0, 10, x, y] });
test('generic figure captions work without hard-coded subject words', () => {
  assert.equal(findFigureRegions([text('Figure 12: A new approach')], [[60, 420, 400, 610]], 600, 800).length, 1);
});
test('fragmented caption tokens are assembled', () => {
  assert.equal(findFigureRegions([text('Figure', 60, 400, 30), text('2:', 93, 400, 10), text('Overview', 106, 400, 80)], [[60, 420, 400, 610]], 600, 800).length, 1);
});
test('adjacent panels are combined without selecting a single panel', () => {
  const result = findFigureRegions([text('Fig. 2: Framework')], [[60, 420, 220, 600], [230, 420, 400, 600]], 600, 800);
  assert.deepEqual(result[0].box, [60, 420, 400, 600]);
});
test('separate columns are not combined', () => {
  const result = findFigureRegions([text('Figure 1: Framework', 40, 400, 200)], [[40, 420, 240, 600], [340, 420, 540, 600]], 600, 800);
  assert.deepEqual(result[0].box, [40, 420, 240, 600]);
});
test('reject full page images, tiny logos and explicit plots', () => {
  assert.equal(findFigureRegions([text('Figure 1: Overview', 10, 0)], [[0, 10, 600, 800]], 600, 800).length, 0);
  assert.equal(findFigureRegions([text('Figure 1: Overview')], [[60, 420, 75, 435]], 600, 800).length, 0);
  assert.equal(findFigureRegions([text('Figure 1: Ablation study')], [[60, 420, 400, 610]], 600, 800).length, 0);
});
test('reference in body text is not a caption', () => {
  assert.equal(findFigureRegions([text('We describe Figure 1 here')], [[60, 420, 400, 610]], 600, 800).length, 0);
});
test('vector diagram is not merged with a shaded paragraph above it', () => {
  const items = [text('Figure 1: Framework'), ...[620, 635, 650].map(y => text('A long body paragraph containing detailed discussion that is not part of the diagram.', 60, y, 330))];
  const result = findFigureRegions(items, [[60, 420, 400, 600], [60, 610, 400, 680]], 600, 800);
  assert.deepEqual(result[0].box, [60, 420, 400, 600]);
});

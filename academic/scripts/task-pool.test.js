import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskPool } from '../src/utils/taskPool.js';

test('two figure jobs can run while later jobs wait; failures release a slot', async () => {
  const schedule = createTaskPool(2);
  const starts = [];
  let release;
  const first = schedule(() => { starts.push(1); return new Promise(resolve => { release = resolve; }); });
  const second = schedule(() => { starts.push(2); throw new Error('Unavailable'); });
  const third = schedule(() => { starts.push(3); return 'ready'; });
  await assert.rejects(second);
  assert.equal(await third, 'ready');
  assert.deepEqual(starts, [1, 2, 3]);
  release();
  await first;
});

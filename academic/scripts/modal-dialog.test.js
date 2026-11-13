import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('nested dialogs keep the page fixed until the last closes and restore its position', () => {
  const cleanups = [];
  const scrolls = [];
  const body = { overflow: 'auto', position: '', top: '', left: '', width: '', paddingRight: '4px' };
  const original = { ...body };
  class Element {
    isConnected = true;
    focus() { document.activeElement = this; }
  }
  const trigger = new Element();
  const document = { body: { style: body }, activeElement: trigger, documentElement: { clientWidth: 390 } };
  const context = {
    document, HTMLElement: Element,
    window: { scrollX: 0, scrollY: 720, innerWidth: 390, scrollTo: value => scrolls.push(value) },
    getComputedStyle: () => ({ paddingRight: '4px' }),
    requestAnimationFrame: callback => callback(),
    useEffect: callback => cleanups.push(callback()),
  };
  const source = readFileSync(new URL('../src/hooks/useModalDialog.js', import.meta.url), 'utf8')
    .replace('import { useEffect } from "react";', '').replace('export function', 'function');
  runInNewContext(source, context);
  const makeDialog = () => Object.assign(new Element(), {
    open: false, setAttribute() {}, showModal() { this.open = true; }, close() { this.open = false; },
  });
  const overview = makeDialog();
  context.useModalDialog({ current: overview });
  assert.equal(document.activeElement, overview);
  assert.equal(body.position, 'fixed');
  assert.equal(body.top, '-720px');
  context.useModalDialog({ current: makeDialog() });
  cleanups.pop()();
  assert.equal(body.position, 'fixed');
  assert.equal(scrolls.length, 0);
  cleanups.pop()();
  assert.deepEqual(body, original);
  assert.equal(scrolls[0].top, 720);
  assert.equal(document.activeElement, trigger);
});

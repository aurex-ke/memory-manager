import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/core/memory.js';
import { ProcessManager } from '../src/core/process.js';

test('first-fit allocates lowest free run', () => {
  const m = new Memory(8);
  assert.deepEqual(m.allocate(1, 2), { start: 0, pages: 2 });
  assert.deepEqual(m.allocate(2, 3), { start: 2, pages: 3 });
});

test('free releases only that pid and space is reusable', () => {
  const m = new Memory(4);
  m.allocate(1, 2);
  m.allocate(2, 2);
  assert.equal(m.free(1), 2);
  assert.deepEqual(m.frames, [null, null, 2, 2]);
  assert.deepEqual(m.allocate(3, 2), { start: 0, pages: 2 });
});

test('fragmentation: enough free pages, no contiguous block', () => {
  const m = new Memory(8);
  m.allocate(1, 2);
  m.allocate(2, 2);
  m.allocate(3, 2);
  m.free(2); // free: pages 2-3 and 6-7
  assert.equal(m.freePages(), 4);
  assert.equal(m.largestFreeBlock(), 2);
  assert.equal(m.allocate(4, 3), null);
});

test('ProcessManager launch/close lifecycle', () => {
  const pm = new ProcessManager({ RAM_MB: 64, PAGE_MB: 16 });
  const r = pm.launch('A', 20); // ceil(20/16) = 2 pages
  assert.equal(r.ok, true);
  assert.equal(r.proc.pages, 2);
  assert.equal(pm.launch('B', 48).ok, false); // needs 3, only 2 free
  assert.equal(pm.close(r.proc.pid), true);
  assert.equal(pm.getState().free, 4);
  assert.equal(pm.close(999), false);
});
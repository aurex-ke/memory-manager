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
  m.free(2);
  assert.equal(m.freePages(), 4);
  assert.equal(m.largestFreeBlock(), 2);
  assert.equal(m.allocate(4, 3), null);
});

test('ProcessManager launch/close lifecycle', () => {
  const pm = new ProcessManager({ RAM_MB: 64, PAGE_MB: 16 });
  const r = pm.launch('A', 20);
  assert.equal(r.ok, true);
  assert.equal(r.proc.pages, 2);
  assert.equal(pm.launch('B', 48).ok, false);
  assert.equal(pm.close(r.proc.pid), true);
  assert.equal(pm.getState().free, 4);
  assert.equal(pm.close(999), false);
});

test('owner can read and write its own page', () => {
  const m = new Memory(4);
  m.allocate(1, 2);
  assert.deepEqual(m.write(1, 0, 'hello'), { ok: true });
  assert.deepEqual(m.read(1, 0), { ok: true, value: 'hello' });
});

test('isolation: A cannot read or write B', () => {
  const m = new Memory(4);
  m.allocate(1, 2); // pages 0-1
  m.allocate(2, 2); // pages 2-3
  m.write(2, 2, 'B-secret');
  assert.equal(m.read(1, 2).ok, false);
  assert.equal(m.write(1, 2, 'hacked').ok, false);
  assert.equal(m.read(2, 2).value, 'B-secret'); // untouched
});

test('access to free or out-of-range pages is denied', () => {
  const m = new Memory(4);
  m.allocate(1, 1);
  assert.equal(m.read(1, 3).ok, false); // free
  assert.equal(m.read(1, 99).ok, false); // out of range
  assert.equal(m.read(1, -1).ok, false);
  assert.equal(m.read(1, NaN).ok, false);
});

test('freed pages are wiped before reuse', () => {
  const m = new Memory(2);
  m.allocate(1, 1);
  m.write(1, 0, 'secret');
  m.free(1);
  m.allocate(2, 1);
  assert.equal(m.read(2, 0).value, null);
});

test('ProcessManager logs allowed and blocked accesses', () => {
  const pm = new ProcessManager({ RAM_MB: 64, PAGE_MB: 16 });
  const a = pm.launch('A', 16).proc; // page 0
  const b = pm.launch('B', 16).proc; // page 1
  assert.equal(pm.access(a.pid, 'write', 0, 'x').ok, true);
  assert.equal(pm.access(a.pid, 'read', 1).ok, false);
  assert.equal(pm.access(999, 'read', 0).ok, false);
  const log = pm.getState().log;
  assert.equal(log.length, 2); // unknown pid is rejected before logging
  assert.equal(log[0].ok, false);
  assert.equal(log[1].ok, true);
  assert.ok(b.pid);
});
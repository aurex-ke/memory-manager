import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Memory } from '../src/core/memory.js';
import { ProcessManager } from '../src/core/process.js';

const cfg = { RAM_MB: 64, PAGE_MB: 16, DISK_MB: 64 }; // 4 RAM pages, 4 disk pages

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
  const pm = new ProcessManager(cfg);
  const r = pm.launch('A', 20); // 2 pages
  assert.equal(r.ok, true);
  assert.equal(r.proc.pages, 2);
  assert.deepEqual(r.proc.pageTable, [0, 1]);
  assert.equal(pm.launch('Big', 80).ok, false); // 5 pages > RAM
  assert.equal(pm.getState().swapped.length, 0); // hopeless launch evicts nothing
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
  m.allocate(1, 2);
  m.allocate(2, 2);
  m.write(2, 2, 'B-secret');
  assert.equal(m.read(1, 2).ok, false);
  assert.equal(m.write(1, 2, 'hacked').ok, false);
  assert.equal(m.read(2, 2).value, 'B-secret');
});

test('access to free or out-of-range pages is denied', () => {
  const m = new Memory(4);
  m.allocate(1, 1);
  assert.equal(m.read(1, 3).ok, false);
  assert.equal(m.read(1, 99).ok, false);
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

test('virtual access works and is logged', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 16).proc; // frame 0
  const b = pm.launch('B', 16).proc; // frame 1
  assert.equal(pm.access(b.pid, 'write', 0, 'bee').ok, true); // B's vpage 0 = frame 1
  assert.equal(pm.access(b.pid, 'read', 0).value, 'bee');
  assert.equal(pm.access(a.pid, 'read', 0).value, null); // A's vpage 0 is a different frame
  assert.equal(pm.access(999, 'read', 0).ok, false); // rejected before logging
  assert.equal(pm.getState().log.length, 3);
});

test('virtual out-of-range is a segfault', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 16).proc; // 1 page
  const r = pm.access(a.pid, 'read', 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /segfault/);
  assert.equal(pm.access(a.pid, 'read', -1).ok, false);
  assert.equal(pm.access(a.pid, 'read', NaN).ok, false);
});

test('rogue physical access to another process is blocked', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 16).proc; // frame 0
  const b = pm.launch('B', 16).proc; // frame 1
  pm.access(b.pid, 'write', 0, 'B-secret');
  const r = pm.access(a.pid, 'read', 1, null, 'physical');
  assert.equal(r.ok, false);
  assert.match(r.reason, /owned by pid 2/);
  assert.equal(pm.access(a.pid, 'write', 1, 'hacked', 'physical').ok, false);
  assert.equal(pm.access(b.pid, 'read', 0).value, 'B-secret'); // untouched
  assert.equal(pm.access(a.pid, 'write', 0, 'mine', 'physical').ok, true); // own frame is fine
});

test('launch swaps out the LRU process when RAM is full', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 32).proc;
  const b = pm.launch('B', 32).proc;
  pm.touch(a.pid); // B is now LRU
  assert.equal(pm.launch('C', 16).ok, true);
  assert.equal(pm.procs.get(b.pid).state, 'disk');
  assert.equal(pm.procs.get(b.pid).pageTable, null);
  assert.equal(pm.procs.get(a.pid).state, 'ram');
  assert.deepEqual(pm.getState().swapped.map((p) => p.pid), [b.pid]);
});

test('relocation on swap-in is invisible to the process', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 32).proc; // frames 0-1
  pm.access(a.pid, 'write', 0, 'keep-me');
  pm.access(a.pid, 'write', 1, 'keep-me-too');
  pm.launch('B', 32); // frames 2-3
  pm.launch('C', 32); // evicts A
  assert.equal(pm.procs.get(a.pid).state, 'disk');
  assert.equal(pm.touch(a.pid).ok, true); // swap-in evicts B, lands on frames 2-3
  assert.deepEqual(pm.procs.get(a.pid).pageTable, [2, 3]); // moved...
  assert.equal(pm.access(a.pid, 'read', 0).value, 'keep-me'); // ...same virtual addresses
  assert.equal(pm.access(a.pid, 'read', 1).value, 'keep-me-too');
});

test('swap-out leaves no data behind for the next owner', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 32).proc;
  pm.access(a.pid, 'write', 0, 'secret');
  pm.launch('B', 32);
  const c = pm.launch('C', 32).proc; // takes A's old frames 0-1
  assert.deepEqual(c.pageTable, [0, 1]);
  assert.equal(pm.access(c.pid, 'read', 0).value, null);
});

test('launch fails when the swap disk is full', () => {
  const pm = new ProcessManager({ RAM_MB: 32, PAGE_MB: 16, DISK_MB: 16 }); // 2 RAM, 1 disk
  pm.launch('A', 16);
  pm.launch('B', 16);
  assert.equal(pm.launch('C', 16).ok, true); // evicts A, disk now full
  assert.equal(pm.launch('D', 16).ok, false); // B cannot be evicted
});

test('closing a swapped process frees its disk space', () => {
  const pm = new ProcessManager(cfg);
  const a = pm.launch('A', 32).proc;
  pm.launch('B', 32);
  pm.launch('C', 32); // evicts A
  assert.equal(pm.getState().diskFree, 2);
  pm.close(a.pid);
  assert.equal(pm.getState().diskFree, 4);
});
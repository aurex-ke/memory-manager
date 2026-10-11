import { Memory } from './memory.js';
import { Disk, pickLruVictim } from './swap.js';

const LOG_LIMIT = 50;

export class ProcessManager {
  constructor(config) {
    this.config = config;
    this.totalPages = config.RAM_MB / config.PAGE_MB;
    this.memory = new Memory(this.totalPages);
    this.disk = new Disk(config.DISK_MB / config.PAGE_MB);
    // pid -> { pid, name, pages, state, lastUsed, pageTable }
    // pageTable[vpage] = physical frame; null while swapped to disk
    this.procs = new Map();
    this.nextPid = 1;
    this.clock = 0; // logical time for LRU
    this.log = []; // newest first
  }

  _log(kind, text) {
    this.log.unshift({ ok: kind !== 'blocked', kind, text });
    if (this.log.length > LOG_LIMIT) this.log.pop();
  }

  _buildTable(block) {
    return Array.from({ length: block.pages }, (_, i) => block.start + i);
  }

  _swapOut(proc) {
    if (proc.pages > this.disk.freePages()) return false;
    this.disk.store(proc.pid, this.memory.evict(proc.pid));
    proc.state = 'disk';
    proc.pageTable = null;
    this._log('swap', `SWAP OUT ${proc.name} (pid ${proc.pid}) -> disk (LRU)`);
    return true;
  }

  // Evict LRU processes until a contiguous block of `pages` exists.
  _makeRoom(pages) {
    if (pages > this.totalPages) return false;
    while (this.memory.largestFreeBlock() < pages) {
      const victim = pickLruVictim(this.procs.values());
      if (!victim || !this._swapOut(victim)) return false;
    }
    return true;
  }

  _swapIn(proc) {
    if (!this._makeRoom(proc.pages)) return false;
    const block = this.memory.load(proc.pid, this.disk.take(proc.pid));
    proc.state = 'ram';
    proc.pageTable = this._buildTable(block); // new frames, same virtual pages
    this._log('swap', `SWAP IN ${proc.name} (pid ${proc.pid}) <- disk`);
    return true;
  }

  // Virtual page -> physical frame, or a segfault.
  _translate(proc, vpage) {
    if (!Number.isInteger(vpage) || vpage < 0 || vpage >= proc.pages) {
      return { ok: false, reason: `segfault: virtual page out of range (0-${proc.pages - 1})` };
    }
    return { ok: true, frame: proc.pageTable[vpage] };
  }

  launch(name, mb) {
    const pages = Math.ceil(mb / this.config.PAGE_MB);
    if (!this._makeRoom(pages)) {
      return { ok: false, error: `Out of memory: ${name} needs ${pages} pages and nothing more can be swapped out` };
    }
    const pid = this.nextPid++;
    const block = this.memory.allocate(pid, pages);
    const proc = {
      pid,
      name,
      pages,
      state: 'ram',
      lastUsed: ++this.clock,
      pageTable: this._buildTable(block),
    };
    this.procs.set(pid, proc);
    return { ok: true, proc };
  }

  close(pid) {
    const proc = this.procs.get(pid);
    if (!proc) return false;
    if (proc.state === 'ram') this.memory.free(pid);
    else this.disk.discard(pid);
    this.procs.delete(pid);
    return true;
  }

  // Mark a process as recently used; swap it in if it is on disk.
  touch(pid) {
    const proc = this.procs.get(pid);
    if (!proc) return { ok: false, reason: 'no such process' };
    if (proc.state === 'disk' && !this._swapIn(proc)) {
      return { ok: false, reason: 'swap-in failed: not enough RAM or disk space' };
    }
    proc.lastUsed = ++this.clock;
    return { ok: true };
  }

  // op: 'read' | 'write'
  // space: 'virtual' (normal: addr is the process's own page number)
  //        'physical' (rogue: addr is a raw frame number, owner check still applies)
  access(pid, op, addr, value = null, space = 'virtual') {
    const proc = this.procs.get(pid);
    if (!proc) return { ok: false, reason: 'no such process' };
    const who = `${proc.name} (pid ${pid})`;
    const deny = (reason, target) => {
      this._log('blocked', `${who} ${op} ${target} -> BLOCKED (${reason})`);
      return { ok: false, reason };
    };

    const t = this.touch(pid); // page fault handling + LRU update
    if (!t.ok) return deny(t.reason, `${space === 'physical' ? 'frame' : 'vpage'} ${addr}`);

    let frame = addr;
    let target = `PHYSICAL frame ${addr}`;
    if (space === 'virtual') {
      const tr = this._translate(proc, addr);
      if (!tr.ok) return deny(tr.reason, `vpage ${addr}`);
      frame = tr.frame;
      target = `vpage ${addr} (frame ${frame})`;
    }

    const result =
      op === 'write' ? this.memory.write(pid, frame, value) : this.memory.read(pid, frame);
    if (!result.ok) return deny(result.reason, target);

    const detail = op === 'read' ? `value: ${JSON.stringify(result.value)}` : `wrote ${JSON.stringify(value)}`;
    this._log('allowed', `${who} ${op} ${target} -> ALLOWED (${detail})`);
    return result;
  }

  getState() {
    const procs = [...this.procs.values()].map((p) => ({
      ...p,
      pageTable: p.pageTable ? [...p.pageTable] : null,
    }));
    return {
      frames: [...this.memory.frames],
      procs,
      swapped: procs.filter((p) => p.state === 'disk').map((p) => ({ pid: p.pid, name: p.name, pages: p.pages })),
      free: this.memory.freePages(),
      largestFree: this.memory.largestFreeBlock(),
      diskTotal: this.disk.totalPages,
      diskFree: this.disk.freePages(),
      pageMb: this.config.PAGE_MB,
      log: [...this.log],
    };
  }
}
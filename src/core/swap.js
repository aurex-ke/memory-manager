// Simulated swap disk. Stores whole-process snapshots.
export class Disk {
  constructor(totalPages) {
    this.totalPages = totalPages;
    this.entries = new Map(); // pid -> { pages, data }
  }

  usedPages() {
    let n = 0;
    for (const e of this.entries.values()) n += e.pages;
    return n;
  }

  freePages() {
    return this.totalPages - this.usedPages();
  }

  store(pid, data) {
    if (data.length > this.freePages()) return false;
    this.entries.set(pid, { pages: data.length, data });
    return true;
  }

  take(pid) {
    const e = this.entries.get(pid);
    this.entries.delete(pid);
    return e ? e.data : null;
  }

  discard(pid) {
    this.entries.delete(pid);
  }
}

// LRU: the in-RAM process with the oldest lastUsed tick.
export function pickLruVictim(procs) {
  let victim = null;
  for (const p of procs) {
    if (p.state !== 'ram') continue;
    if (victim === null || p.lastUsed < victim.lastUsed) victim = p;
  }
  return victim;
}
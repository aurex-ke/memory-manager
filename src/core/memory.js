export class Memory {
    constructor(totalPages) {
      this.frames = new Array(totalPages).fill(null); // null = free, else owner pid
      this.data = new Array(totalPages).fill(null);   // simulated page contents
    }
  
    // Non-contiguous: take the lowest free frames. Returns frame numbers
    // (index = virtual page) or null if there are not enough free frames.
    allocate(pid, pages) {
      if (this.freePages() < pages) return null;
      const got = [];
      for (let i = 0; i < this.frames.length && got.length < pages; i++) {
        if (this.frames[i] === null) {
          this.frames[i] = pid;
          got.push(i);
        }
      }
      return got;
    }
  
    free(pid) {
      let freed = 0;
      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i] === pid) {
          this.frames[i] = null;
          this.data[i] = null; // wipe on free: no data leaks to the next owner
          freed++;
        }
      }
      return freed;
    }
  
    // Swap-out: copy contents in VIRTUAL page order, then free the frames.
    evict(pid, pageTable) {
      const saved = pageTable.map((f) => this.data[f]);
      this.free(pid);
      return saved;
    }
  
    // Swap-in: allocate frames and restore contents in virtual page order.
    load(pid, saved) {
      const frames = this.allocate(pid, saved.length);
      if (!frames) return null;
      saved.forEach((v, i) => {
        this.data[frames[i]] = v;
      });
      return frames;
    }
  
    // The isolation boundary. Every access goes through here.
    check(pid, page) {
      if (!Number.isInteger(page) || page < 0 || page >= this.frames.length) {
        return { ok: false, reason: 'page out of range' };
      }
      const owner = this.frames[page];
      if (owner === null) return { ok: false, reason: 'page is unallocated' };
      if (owner !== pid) return { ok: false, reason: `page owned by pid ${owner}` };
      return { ok: true };
    }
  
    read(pid, page) {
      const c = this.check(pid, page);
      return c.ok ? { ok: true, value: this.data[page] } : c;
    }
  
    write(pid, page, value) {
      const c = this.check(pid, page);
      if (!c.ok) return c;
      this.data[page] = value;
      return { ok: true };
    }
  
    freePages() {
      return this.frames.filter((f) => f === null).length;
    }
  
    // Kept for the stats line: shows how scattered free memory is.
    largestFreeBlock() {
      let best = 0;
      let run = 0;
      for (const f of this.frames) {
        run = f === null ? run + 1 : 0;
        if (run > best) best = run;
      }
      return best;
    }
  }
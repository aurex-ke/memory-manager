export class Memory {
    constructor(totalPages) {
      this.frames = new Array(totalPages).fill(null); // null = free, else owner pid
      this.data = new Array(totalPages).fill(null);   // simulated page contents
    }
  
    // First-fit: first contiguous run of free frames big enough.
    allocate(pid, pages) {
      let runStart = 0;
      let runLen = 0;
      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i] === null) {
          if (runLen === 0) runStart = i;
          runLen++;
          if (runLen === pages) {
            this.frames.fill(pid, runStart, runStart + pages);
            return { start: runStart, pages };
          }
        } else {
          runLen = 0;
        }
      }
      return null;
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
  
    // Swap-out: copy a process's page contents (frame order), then free its frames.
    evict(pid) {
      const saved = [];
      for (let i = 0; i < this.frames.length; i++) {
        if (this.frames[i] === pid) saved.push(this.data[i]);
      }
      this.free(pid);
      return saved;
    }
  
    // Swap-in: allocate a block and restore saved contents into it.
    load(pid, saved) {
      const block = this.allocate(pid, saved.length);
      if (!block) return null;
      saved.forEach((v, i) => {
        this.data[block.start + i] = v;
      });
      return block;
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
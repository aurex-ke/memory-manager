export class Memory {
    constructor(totalPages) {
      this.frames = new Array(totalPages).fill(null); // null = free, else owner pid
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
          freed++;
        }
      }
      return freed;
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
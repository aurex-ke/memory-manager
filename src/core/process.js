import { Memory } from './memory.js';

export class ProcessManager {
  constructor(config) {
    this.config = config;
    this.memory = new Memory(config.RAM_MB / config.PAGE_MB);
    this.procs = new Map();
    this.nextPid = 1;
  }

  launch(name, mb) {
    const pages = Math.ceil(mb / this.config.PAGE_MB);
    const pid = this.nextPid;
    const block = this.memory.allocate(pid, pages);
    if (!block) {
      return { ok: false, error: `Out of memory: ${name} needs ${pages} contiguous pages` };
    }
    this.nextPid++;
    const proc = { pid, name, pages, start: block.start };
    this.procs.set(pid, proc);
    return { ok: true, proc };
  }

  close(pid) {
    if (!this.procs.has(pid)) return false;
    this.memory.free(pid);
    this.procs.delete(pid);
    return true;
  }

  getState() {
    return {
      frames: [...this.memory.frames],
      procs: [...this.procs.values()],
      free: this.memory.freePages(),
      largestFree: this.memory.largestFreeBlock(),
      pageMb: this.config.PAGE_MB,
    };
  }
}
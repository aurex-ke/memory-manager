import { Memory } from './memory.js';

const LOG_LIMIT = 50;

export class ProcessManager {
  constructor(config) {
    this.config = config;
    this.memory = new Memory(config.RAM_MB / config.PAGE_MB);
    this.procs = new Map();
    this.nextPid = 1;
    this.log = []; // newest first
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

  // op: 'read' | 'write'
  access(pid, op, page, value = null) {
    const proc = this.procs.get(pid);
    if (!proc) return { ok: false, reason: 'no such process' };

    const result =
      op === 'write' ? this.memory.write(pid, page, value) : this.memory.read(pid, page);

    const who = `${proc.name} (pid ${pid})`;
    const detail = result.ok
      ? op === 'read'
        ? `value: ${JSON.stringify(result.value)}`
        : `wrote ${JSON.stringify(value)}`
      : result.reason;
    this.log.unshift({
      ok: result.ok,
      text: `${who} ${op} page ${page} -> ${result.ok ? 'ALLOWED' : 'BLOCKED'} (${detail})`,
    });
    if (this.log.length > LOG_LIMIT) this.log.pop();
    return result;
  }

  getState() {
    return {
      frames: [...this.memory.frames],
      procs: [...this.procs.values()],
      free: this.memory.freePages(),
      largestFree: this.memory.largestFreeBlock(),
      pageMb: this.config.PAGE_MB,
      log: [...this.log],
    };
  }
}
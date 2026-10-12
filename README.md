# Memory Resource Manager

A simulated memory manager that runs in the browser. No real RAM is touched: everything runs on a virtual model.

**Live demo:** https://aurex-ke.github.io/memory-manager/ | **[User manual](MANUAL.md)**

## Features

- **Allocation / deallocation**: launch an app and it gets frames, close it and they are freed.
- **Non-contiguous allocation**: any free frames, lowest first. No fragmentation failures.
- **Virtual addressing**: each process uses its own pages (v0, v1, ...), mapped to physical frames through a page table.
- **Process isolation**: an owner check on every physical access. Rogue access is blocked and logged.
- **Virtual memory**: when RAM is full, the least-recently-used process is swapped to a simulated disk. Touching it swaps it back in, possibly on different frames, invisibly.
- **Resource map**: pie charts for RAM and swap disk, plus a frame lookup table.
- **Auto-activity**: a timer touches random processes so LRU and swapping play out on their own.

## Run

```bash
npm start        # serves http://localhost:8000 (needs Python 3)
npm test         # core tests, Node's built-in runner, no install
```

ES modules do not load from `file://`, so a local server is required.

## Structure

```
index.html
src/
  config.js        RAM, page, disk sizes and preset apps
  core/            pure JS, no DOM
    memory.js      frames, allocate/free, owner check, evict/load
    process.js     processes, page tables, LRU swap logic
    swap.js        simulated disk and LRU victim picker
  ui/              reads core state, calls core actions
    app.js  grid.js  chart.js
tests/core.test.js
```

## Config

Edit `src/config.js`: `RAM_MB`, `PAGE_MB`, `DISK_MB`, `APPS`.

## Design limits (on purpose)

- Whole-process swapping, not per-page demand paging.
- No TLB, no multi-level page tables.
- LRU only.

## Extending

- New policies (e.g. FIFO, clock): add a picker next to `pickLruVictim` in `swap.js` and call it from `_makeRoom`.
- New UI panels: read `pm.getState()`, never touch `pm.memory` directly.
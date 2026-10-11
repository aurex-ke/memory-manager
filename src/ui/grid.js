export function pidColor(pid) {
    return `hsl(${(pid * 67) % 360} 65% 50%)`;
  }
  
  // frame -> { name, pid, v } built from each process's page table
  function ownerMap(procs) {
    const map = new Map();
    for (const p of procs) {
      if (!p.pageTable) continue;
      p.pageTable.forEach((frame, v) => map.set(frame, { name: p.name, pid: p.pid, v }));
    }
    return map;
  }
  
  export function renderGrid(el, frames, procs) {
    const owners = ownerMap(procs);
    el.innerHTML = frames
      .map((pid, i) => {
        if (pid === null) return `<div class="page free" title="Frame ${i}: free"></div>`;
        const o = owners.get(i);
        return `<div class="page" style="background:${pidColor(pid)}" title="Frame ${i}: ${o.name} (pid ${pid}), vpage ${o.v}"></div>`;
      })
      .join('');
  }
  
  export function renderTable(el, frames, procs, pageMb) {
    const owners = ownerMap(procs);
    el.innerHTML = frames
      .map((pid, i) => {
        const addr = '0x' + (i * pageMb * 1024 * 1024).toString(16).padStart(8, '0');
        if (pid === null) return `<tr><td>${i}</td><td>${addr}</td><td>Free</td><td>-</td><td>-</td></tr>`;
        const o = owners.get(i);
        return `<tr><td>${i}</td><td>${addr}</td><td>In RAM</td><td>${o.name} (pid ${pid})</td><td>${o.v}</td></tr>`;
      })
      .join('');
  }
  
  export function renderSwapTable(el, swapped, pageMb) {
    el.innerHTML = swapped.length
      ? swapped
          .map(
            (p) =>
              `<tr><td>${p.pid}</td><td>${p.name}</td><td>${p.pages}</td><td>${p.pages * pageMb} MB</td><td>Swapped</td></tr>`
          )
          .join('')
      : `<tr><td colspan="5">Swap disk empty</td></tr>`;
  }
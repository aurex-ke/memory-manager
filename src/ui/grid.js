export function pidColor(pid) {
    return `hsl(${(pid * 67) % 360} 65% 50%)`;
  }
  
  export function renderGrid(el, frames, procs) {
    const names = new Map(procs.map((p) => [p.pid, p.name]));
    el.innerHTML = frames
      .map((pid, i) =>
        pid === null
          ? `<div class="page free" title="Page ${i}: free"></div>`
          : `<div class="page" style="background:${pidColor(pid)}" title="Page ${i}: ${names.get(pid)} (pid ${pid})"></div>`
      )
      .join('');
  }
  
  export function renderTable(el, frames, procs, pageMb) {
    const names = new Map(procs.map((p) => [p.pid, p.name]));
    el.innerHTML = frames
      .map((pid, i) => {
        const addr = '0x' + (i * pageMb * 1024 * 1024).toString(16).padStart(8, '0');
        return pid === null
          ? `<tr><td>${i}</td><td>${addr}</td><td>Free</td><td>-</td></tr>`
          : `<tr><td>${i}</td><td>${addr}</td><td>In RAM</td><td>${names.get(pid)} (pid ${pid})</td></tr>`;
      })
      .join('');
  }
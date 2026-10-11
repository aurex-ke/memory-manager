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
import { pidColor } from './grid.js';

const FREE = '#e5e7eb';

function drawPie(ctx, x, title, slices, total, pageMb) {
  const cx = x + 100, cy = 100, r = 90;
  let angle = -Math.PI / 2;
  for (const s of slices) {
    if (s.pages === 0) continue;
    const sweep = (s.pages / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    angle += sweep;
  }

  ctx.textBaseline = 'middle';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#111';
  ctx.fillText(title, x + 200, 12);
  ctx.font = '12px system-ui, sans-serif';
  slices.forEach((s, i) => {
    const y = 34 + i * 16;
    ctx.fillStyle = s.color;
    ctx.fillRect(x + 200, y - 6, 12, 12);
    ctx.fillStyle = '#111';
    ctx.fillText(`${s.label}: ${s.pages * pageMb} MB`, x + 218, y);
  });
}

export function renderChart(canvas, s) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const names = new Map(s.procs.map((p) => [p.pid, p.name]));
  const counts = new Map();
  let free = 0;
  for (const pid of s.frames) {
    if (pid === null) free++;
    else counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const ram = [...counts].map(([pid, pages]) => ({
    label: `${names.get(pid)} #${pid}`,
    pages,
    color: pidColor(pid),
  }));
  ram.push({ label: 'Free', pages: free, color: FREE });

  const disk = s.swapped.map((p) => ({
    label: `${p.name} #${p.pid}`,
    pages: p.pages,
    color: pidColor(p.pid),
  }));
  disk.push({ label: 'Free', pages: s.diskFree, color: FREE });

  drawPie(ctx, 0, 'RAM', ram, s.frames.length, s.pageMb);
  drawPie(ctx, 380, 'Swap disk', disk, s.diskTotal, s.pageMb);
}
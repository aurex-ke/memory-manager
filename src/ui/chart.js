import { pidColor } from './grid.js';

export function renderChart(canvas, frames, procs, pageMb) {
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 90;

  const counts = new Map();
  let free = 0;
  for (const pid of frames) {
    if (pid === null) free++;
    else counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const slices = procs
    .filter((p) => counts.has(p.pid))
    .map((p) => ({ label: p.name, pages: counts.get(p.pid), color: pidColor(p.pid) }));
  slices.push({ label: 'Free', pages: free, color: '#e5e7eb' });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let angle = -Math.PI / 2;
  for (const s of slices) {
    if (s.pages === 0) continue;
    const sweep = (s.pages / frames.length) * Math.PI * 2;
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

  ctx.font = '13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  slices.forEach((s, i) => {
    const y = 20 + i * 22;
    ctx.fillStyle = s.color;
    ctx.fillRect(215, y - 7, 14, 14);
    ctx.fillStyle = '#111';
    ctx.fillText(`${s.label}: ${s.pages * pageMb} MB`, 237, y);
  });
}
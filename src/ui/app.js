import { CONFIG } from '../config.js';
import { ProcessManager } from '../core/process.js';
import { renderGrid, renderTable } from './grid.js';
import { renderChart } from './chart.js';

const pm = new ProcessManager(CONFIG);
const $ = (id) => document.getElementById(id);

function render(msg = '') {
  const s = pm.getState();
  renderGrid($('grid'), s.frames, s.procs);
  renderChart($('chart'), s.frames, s.procs, s.pageMb);
  renderTable($('pages'), s.frames, s.procs, s.pageMb);
  $('stats').textContent =
    `Free: ${s.free * s.pageMb} MB | Largest free block: ${s.largestFree * s.pageMb} MB`;
  $('procs').innerHTML = s.procs
    .map(
      (p) =>
        `<tr><td>${p.pid}</td><td>${p.name}</td><td>${p.pages * s.pageMb} MB</td><td>${p.start}</td>` +
        `<td><button data-close="${p.pid}">Close</button></td></tr>`
    )
    .join('');
  $('msg').textContent = msg;
}

$('apps').innerHTML = CONFIG.APPS.map(
  (a, i) => `<button data-app="${i}">${a.name} (${a.mb} MB)</button>`
).join('');

document.addEventListener('click', (e) => {
  const d = e.target.dataset;
  if (d.app !== undefined) {
    const a = CONFIG.APPS[Number(d.app)];
    const r = pm.launch(a.name, a.mb);
    render(r.ok ? '' : r.error);
  } else if (d.close !== undefined) {
    pm.close(Number(d.close));
    render();
  }
});

render();
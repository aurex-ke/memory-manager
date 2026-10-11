import { CONFIG } from '../config.js';
import { ProcessManager } from '../core/process.js';
import { renderGrid, renderTable, renderSwapTable } from './grid.js';
import { renderChart } from './chart.js';

const pm = new ProcessManager(CONFIG);
const $ = (id) => document.getElementById(id);

function render(msg = '') {
  const s = pm.getState();
  renderGrid($('grid'), s.frames, s.procs);
  renderChart($('chart'), s);
  renderTable($('pages'), s.frames, s.procs, s.pageMb);
  renderSwapTable($('swap'), s.swapped, s.pageMb);
  $('stats').textContent =
    `Free RAM: ${s.free * s.pageMb} MB | Largest free block: ${s.largestFree * s.pageMb} MB | ` +
    `Swap used: ${(s.diskTotal - s.diskFree) * s.pageMb} / ${s.diskTotal * s.pageMb} MB`;

  $('procs').innerHTML = s.procs
    .map(
      (p) =>
        `<tr><td>${p.pid}</td><td>${p.name}</td><td>${p.pages * s.pageMb} MB (${p.pages} pages)</td>` +
        `<td>${p.state === 'ram' ? 'RAM' : 'Swapped'}</td>` +
        `<td><button data-touch="${p.pid}">Touch</button><button data-close="${p.pid}">Close</button></td></tr>`
    )
    .join('');

  // Keep the selected actor across re-renders.
  const prev = $('actor').value;
  $('actor').innerHTML = s.procs
    .map((p) => `<option value="${p.pid}">${p.name} (pid ${p.pid})${p.state === 'disk' ? ' [swapped]' : ''}</option>`)
    .join('');
  if (s.procs.some((p) => String(p.pid) === prev)) $('actor').value = prev;

  const actor = s.procs.find((p) => String(p.pid) === $('actor').value);
  $('pt').textContent = !actor
    ? ''
    : actor.pageTable
      ? 'Page table: ' + actor.pageTable.map((f, v) => `v${v}→f${f}`).join('  ')
      : 'Page table: none (swapped to disk)';

  $('log').innerHTML = s.log.map((l) => `<li class="${l.kind}">${l.text}</li>`).join('');
  $('msg').textContent = msg;
}

$('apps').innerHTML = CONFIG.APPS.map(
  (a, i) => `<button data-app="${i}">${a.name} (${a.mb} MB)</button>`
).join('');

$('actor').addEventListener('change', () => render());

document.addEventListener('click', (e) => {
  const d = e.target.dataset;
  if (d.app !== undefined) {
    const a = CONFIG.APPS[Number(d.app)];
    const r = pm.launch(a.name, a.mb);
    render(r.ok ? '' : r.error);
  } else if (d.close !== undefined) {
    pm.close(Number(d.close));
    render();
  } else if (d.touch !== undefined) {
    const r = pm.touch(Number(d.touch));
    render(r.ok ? '' : r.reason);
  } else if (d.op !== undefined) {
    if (!$('actor').value) return render('Launch an app first.');
    const addr = parseInt($('target').value, 10);
    pm.access(Number($('actor').value), d.op, addr, $('value').value, $('space').value);
    render();
  }
});

render();
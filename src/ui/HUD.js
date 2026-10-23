import { crestSVG } from '../data.js';

/** Marcador, cronómetro, objetivos y avisos del partido (DOM sobre el canvas). */
export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="sb"><div class="sb-team" id="hH"></div><div class="sb-mid"><b id="hS">0</b><span id="hT">0'</span><b id="aS">0</b></div><div class="sb-team r" id="hA"></div></div>
      <button class="pause-btn" id="pauseBtn" aria-label="Pausa">❚❚</button>
      <div class="stam"><i id="stamBar"></i></div>
      <div class="objs" id="objs"></div>
      <div class="tut" id="tut" hidden></div>
      <div class="toasts" id="toasts"></div>
      <div class="banner" id="banner"></div>`;
    this.q = (id) => root.querySelector('#' + id);
    this.last = {};
  }
  setup(cfg) {
    this.q('hH').innerHTML = crestSVG(cfg.home.club, 30) + `<span>${cfg.home.short}</span>`;
    this.q('hA').innerHTML = `<span>${cfg.away.short}</span>` + crestSVG(cfg.away.club, 30);
    this.last = {};
    this.q('toasts').innerHTML = ''; this.q('banner').className = 'banner';
    this.q('tut').hidden = !cfg.tutorial;
  }
  set(k, html, el) { if (this.last[k] !== html) { this.last[k] = html; this.q(el).innerHTML = html; } }
  update(m, stam, objs) {
    this.set('hs', m.teams[0].score, 'hS'); this.set('as', m.teams[1].score, 'aS');
    this.set('t', m.cfg.tutorial ? 'TUTORIAL' : Math.min(90, Math.floor(m.gameMin)) + "'" + (m.gameMin > 90 ? ' +' : ''), 'hT');
    const s = this.q('stamBar'); const w = Math.round(stam) + '%'; if (this.last.st !== w) { this.last.st = w; s.style.width = w; s.classList.toggle('low', stam < 25); }
    if (objs) this.set('objs', objs.map((o) => `<div class="obj ${o.done ? 'done' : ''} ${o.fail ? 'fail' : ''}"><i>${o.done ? '✓' : o.fail ? '✗' : o.main ? '★' : '•'}</i>${o.title}${o.t > 1 ? ` <em>${Math.min(o.value, o.t)}/${o.t}</em>` : ''}</div>`).join(''), 'objs');
  }
  toast(txt, kind = 'info') {
    const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = txt;
    const box = this.q('toasts'); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => d.remove(), 2200);
  }
  banner(txt, sub = '', cls = '') {
    const b = this.q('banner'); b.className = 'banner'; void b.offsetWidth;
    b.innerHTML = `<b>${txt}</b>${sub ? `<small>${sub}</small>` : ''}`; b.className = 'banner show ' + cls;
    clearTimeout(this._bt); this._bt = setTimeout(() => { b.className = 'banner'; }, 2600);
  }
  tutorial(txt, n, total, done) {
    const t = this.q('tut'); t.hidden = false; t.className = 'tut' + (done ? ' ok' : '');
    t.innerHTML = `<small>PASO ${n}/${total}</small><b>${txt}</b>`;
  }
}

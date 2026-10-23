import { clamp } from '../util.js';

/**
 * Controles táctiles en DOM: joystick flotante (izquierda) + botones contextuales (derecha).
 * Los botones PASE/TIRO admiten gesto de arrastre: la dirección y la longitud definen el golpeo.
 */
export class TouchControls {
  constructor(root) {
    this.root = root;
    this.mx = 0; this.my = 0; this.ctx = 'defend'; this.lob = false; this.aim = null; this.enabled = true;
    root.innerHTML = `
      <div class="stick-zone" id="stickZone"><div class="stick-base" id="stickBase"><div class="stick-knob" id="stickKnob"></div></div><div class="stick-hint" id="stickHint">MOVER</div></div>
      <button class="act btn-b" id="btnB"><span id="lblB">PASE</span></button>
      <button class="act btn-a" id="btnA"><span id="lblA">TIRO</span></button>
      <button class="lob" id="btnLob">ALTO</button>`;
    this.zone = root.querySelector('#stickZone'); this.base = root.querySelector('#stickBase'); this.knob = root.querySelector('#stickKnob');
    this.a = root.querySelector('#btnA'); this.b = root.querySelector('#btnB'); this.lobBtn = root.querySelector('#btnLob');
    this.lblA = root.querySelector('#lblA'); this.lblB = root.querySelector('#lblB');
    this.onAction = () => {};
    this.bindStick(); this.bindButton(this.a, 'A'); this.bindButton(this.b, 'B');
    this.lobBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.lob = !this.lob; this.lobBtn.classList.toggle('on', this.lob); });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get R() { return clamp(Math.min(window.innerWidth, window.innerHeight) * 0.26, 90, 150); }

  bindStick() {
    let id = null, ox = 0, oy = 0;
    const R = 56;
    const upd = (e) => {
      let dx = e.clientX - ox, dy = e.clientY - oy; const l = Math.hypot(dx, dy);
      if (l > R * 1.9) { ox += dx / l * (l - R * 1.9); oy += dy / l * (l - R * 1.9); this.base.style.left = ox + 'px'; this.base.style.top = oy + 'px'; dx = e.clientX - ox; dy = e.clientY - oy; }
      const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
      this.mx = Math.cos(a) * m; this.my = Math.sin(a) * m;
      if (m < 0.05) this.mx = this.my = 0;
      this.knob.style.transform = `translate(${Math.cos(a) * Math.min(R, Math.hypot(dx, dy))}px,${Math.sin(a) * Math.min(R, Math.hypot(dx, dy))}px)`;
      this.base.classList.toggle('sprint', m >= 0.86);
    };
    this.zone.addEventListener('pointerdown', (e) => {
      if (id !== null || !this.enabled) return;
      e.preventDefault(); id = e.pointerId; this.zone.setPointerCapture(id);
      ox = e.clientX; oy = e.clientY;
      const r = this.zone.getBoundingClientRect();
      this.base.style.left = ox - r.left + 'px'; this.base.style.top = oy - r.top + 'px'; this.base.classList.add('on');
      ox -= r.left; oy -= r.top; this._r = r;
      upd({ clientX: e.clientX - r.left, clientY: e.clientY - r.top });
    });
    this.zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) upd({ clientX: e.clientX - this._r.left, clientY: e.clientY - this._r.top }); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.mx = this.my = 0; this.base.classList.remove('on', 'sprint'); this.knob.style.transform = ''; };
    this.zone.addEventListener('pointerup', end); this.zone.addEventListener('pointercancel', end);
    this.resetStick = () => { id = null; this.mx = this.my = 0; this.base.classList.remove('on', 'sprint'); this.knob.style.transform = ''; };
  }

  bindButton(el, which) {
    let id = null, sx = 0, sy = 0;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null || !this.enabled || el.classList.contains('off')) return;
      e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); sx = e.clientX; sy = e.clientY; el.classList.add('down');
      const kind = this.kindOf(which);
      this.aim = kind ? { kind, dx: 0, dy: 0, len: 0, power: 0 } : null;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !this.aim) return;
      const dx = e.clientX - sx, dy = e.clientY - sy, len = Math.hypot(dx, dy), R = this.R;
      this.aim.dx = dx; this.aim.dy = dy; this.aim.len = len; this.aim.power = clamp((len - 16) / (R - 16), 0, 1);
    });
    const end = (e) => {
      if (e.pointerId !== id) return; id = null; el.classList.remove('down');
      const kind = this.kindOf(which), aim = this.aim; this.aim = null;
      if (!kind) { this.onAction(which === 'A' ? { type: 'tackle' } : { type: this.ctx === 'support' ? 'call' : 'press' }); return; }
      if (e.type === 'pointercancel') return;
      if (!aim || aim.len < 16) this.onAction({ type: kind, tap: true, dx: 0, dy: -1, power: 0.6, lob: this.lob });
      else this.onAction({ type: kind, tap: false, dx: aim.dx, dy: aim.dy, power: aim.power, lob: this.lob });
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  /** Tipo de gesto asociado al botón según el contexto (null = pulsación simple). */
  kindOf(which) {
    if (this.ctx === 'attack') return which === 'A' ? 'shot' : 'pass';
    return null;
  }

  setContext(ctx) {
    if (ctx === this.ctx) return;
    this.ctx = ctx;
    const L = { attack: ['TIRO', 'PASE'], support: ['TIRO', 'PEDIR'], defend: ['ENTRADA', 'PRESIÓN'] }[ctx];
    this.lblA.textContent = L[0]; this.lblB.textContent = L[1];
    this.a.classList.toggle('off', ctx === 'support');
    this.root.dataset.ctx = ctx;
    if (ctx !== 'attack') this.aim = null;
  }

  setLefty(v) { this.root.classList.toggle('lefty', v); }
  reset() { this.resetStick?.(); this.aim = null; this.a.classList.remove('down'); this.b.classList.remove('down'); }
}

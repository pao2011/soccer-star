import { clamp, lerp } from '../util.js';

/** Cámara en perspectiva: mira al campo desde atrás y desde arriba. */
export class Cam {
  constructor() { this.x = 300; this.y = 600; this.W = 540; this.H = 960; this.Dc = 640; this.T = 0.8; this.resize(540, 960); }
  resize(W, H) {
    this.W = W; this.H = H;
    this.k = W > H ? H / 500 : Math.min(W / 400, H / 720); // en horizontal se acerca la cámara
    this.fy = H * (W > H ? 0.7 : 0.64);
  }
  /** Proyecta (wx, wy, z) del mundo a pantalla; escribe en out {x,y,s}. s = píxeles por unidad. */
  project(wx, wy, z, out) {
    let dy = wy - this.y;
    const lim = this.Dc * 0.78;
    if (dy > lim) dy = lim;
    const s = this.Dc / (this.Dc - dy);
    out.x = this.W / 2 + (wx - this.x) * s * this.k;
    out.y = this.fy + (this.T * dy * s - z * s * 0.95) * this.k;
    out.s = s * this.k;
    return out;
  }
  follow(m, dt) {
    const b = m.ball, h = m.hero;
    const focusY = b.owner === h || m.state === 'restart' ? h.y : lerp(h.y, b.y, 0.7);
    const focusX = lerp(h.x, b.x, b.owner === h ? 0.2 : 0.6);
    let ty = focusY - 110 - (h.team === 0 ? Math.min(0, h.vy) * 0.25 : 0), tx = focusX;
    ty = clamp(ty, 40, 900 - 130);
    const span = Math.max(0, 300 - 190 / this.k * 1.0);
    tx = clamp(tx, 300 - Math.max(60, span), 300 + Math.max(60, span));
    const k = 1 - Math.exp(-dt * 4.2);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
  }
  snap(m) { this.x = 300; this.y = clamp(m.hero.y - 110, 40, 770); }
}

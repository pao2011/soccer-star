import { clamp, lerp } from '../util.js';

/** Punto de enfoque de la cámara 3D: sigue al jugador y al balón con límites. */
export class Cam {
  constructor() { this.x = 300; this.y = 600; this.W = 540; this.H = 960; this.k = 1; }
  resize(W, H) { this.W = W; this.H = H; this.k = Math.min(W / 400, H / 720); }
  follow(m, dt) {
    const b = m.ball, h = m.hero;
    const focusY = b.owner === h || m.state === 'restart' ? h.y : lerp(h.y, b.y, 0.7);
    const focusX = lerp(h.x, b.x, b.owner === h ? 0.2 : 0.6);
    const ty = clamp(focusY - 110 - Math.min(0, h.vy) * 0.25, 40, 770);
    const span = 110;
    const tx = clamp(focusX, 300 - span - 60, 300 + span + 60);
    const k = 1 - Math.exp(-dt * 4.2);
    this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
  }
  snap(m) { this.x = 300; this.y = clamp(m.hero.y - 110, 40, 770); }
}

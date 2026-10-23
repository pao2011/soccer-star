import { PITCH } from '../config.js';
import { mulberry32 } from '../util.js';

const { W, L, GW, GD, BAR, PA_W, PA_D, GA_W, GA_D, CC_R, SPOT } = PITCH;
const A = { x: 0, y: 0, s: 1 }, B = { x: 0, y: 0, s: 1 }, C = { x: 0, y: 0, s: 1 }, D = { x: 0, y: 0, s: 1 };
const GRASS = [0x2f9e44, 0x37a94b];
const SEAT = [0x274c77, 0x6096ba, 0x8b2635, 0xc9a227];
const SHIRTS = [0xe63946, 0xf1faee, 0xffb703, 0x219ebc, 0x8ecae6, 0xfb8500, 0x90be6d, 0xb5179e];
const ADS = [0xd00000, 0x0077b6, 0xffb703, 0x2a9d8f, 0x7209b7, 0xf77f00];

function makeCrowd(seed, rows, per) {
  const r = mulberry32(seed), out = [];
  for (let i = 0; i < rows; i++) { const row = []; for (let j = 0; j < per; j++) row.push({ c: SHIRTS[(r() * SHIRTS.length) | 0], o: r() * 6.28, h: r() < 0.6 ? 0x3b2a1e : 0xe0b48a, on: r() < 0.9 }); out.push(row); }
  return out;
}

/** Dibuja campo, grada, publicidad y porterías en perspectiva. */
export class Pitch {
  constructor(cam) {
    this.cam = cam;
    this.far = makeCrowd(11, 8, 36); this.left = makeCrowd(12, 6, 48); this.right = makeCrowd(13, 6, 48);
    this.excite = 0; this.t = 0; this.low = false;
  }

  quad(g, x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4, color, alpha = 1) {
    const c = this.cam;
    c.project(x1, y1, z1, A); c.project(x2, y2, z2, B); c.project(x3, y3, z3, C); c.project(x4, y4, z4, D);
    g.fillStyle(color, alpha); g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.lineTo(C.x, C.y); g.lineTo(D.x, D.y); g.closePath(); g.fillPath();
  }
  line(g, x1, y1, z1, x2, y2, z2, w, color, alpha = 1) {
    const c = this.cam; c.project(x1, y1, z1, A); c.project(x2, y2, z2, B);
    g.lineStyle(Math.max(1, w * A.s), color, alpha); g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.strokePath();
  }
  poly(g, pts, w, color) {
    const c = this.cam; g.lineStyle(Math.max(1, w * this.cam.k * 0.9), color, 1); g.beginPath();
    pts.forEach(([x, y], i) => { c.project(x, y, 0, A); if (i) g.lineTo(A.x, A.y); else g.moveTo(A.x, A.y); });
    g.strokePath();
  }
  arc(g, cx, cy, r, a0, a1, w) {
    const pts = [], n = 28;
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    this.poly(g, pts, w, 0xffffff);
  }

  draw(g, dt) {
    const c = this.cam, t = (this.t += dt);
    g.clear();
    g.fillStyle(0x0a1a2f, 1); g.fillRect(0, 0, c.W, c.H);
    // resplandor de focos
    g.fillStyle(0x16324f, 1); g.fillRect(0, 0, c.W, c.H * 0.22);
    this.stands(g, t);
    // césped
    for (let i = -1; i <= 12; i++) {
      const y0 = Math.max(-70, i * 75), y1 = Math.min(L + 70, (i + 1) * 75);
      if (y1 <= y0) continue;
      this.quad(g, -70, y0, 0, W + 70, y0, 0, W + 70, y1, 0, -70, y1, 0, GRASS[(i + 2) & 1]);
    }
    this.markings(g);
    this.boards(g);
    this.benches(g);
    this.goal(g, 0, true);
  }

  markings(g) {
    const w = 2.4;
    this.poly(g, [[0, 0], [W, 0], [W, L], [0, L], [0, 0]], w, 0xffffff);
    this.poly(g, [[0, L / 2], [W, L / 2]], w, 0xffffff);
    this.arc(g, W / 2, L / 2, CC_R, 0, Math.PI * 2, w);
    for (const [gy, dir] of [[0, 1], [L, -1]]) {
      const pa = (W - PA_W) / 2, ga = (W - GA_W) / 2;
      this.poly(g, [[pa, gy], [pa, gy + dir * PA_D], [W - pa, gy + dir * PA_D], [W - pa, gy]], w, 0xffffff);
      this.poly(g, [[ga, gy], [ga, gy + dir * GA_D], [W - ga, gy + dir * GA_D], [W - ga, gy]], w, 0xffffff);
      const spy = gy + dir * SPOT;
      this.arc(g, W / 2, spy, 3, 0, Math.PI * 2, 4);
      if (dir > 0) this.arc(g, W / 2, spy, CC_R * 0.8, Math.PI / 2 - 0.9, Math.PI / 2 + 0.9, w); else this.arc(g, W / 2, spy, CC_R * 0.8, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9, w);
    }
    this.arc(g, W / 2, L / 2, 3, 0, 6.3, 4);
    // banderines
    for (const [x, y] of [[0, 0], [W, 0], [0, L], [W, L]]) {
      this.line(g, x, y, 0, x, y, 20, 1.6, 0xffffff);
      this.quad(g, x, y, 20, x, y, 14, x + (x ? -9 : 9), y, 17, x + (x ? -9 : 9), y, 17, 0xffd23f);
    }
  }

  boards(g) {
    const h = 12;
    const seg = (x1, y1, x2, y2, n, k) => {
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n;
        this.quad(g, x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, 0, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, 0, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, h, x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, h, ADS[(i + k) % ADS.length]);
        this.quad(g, x1 + (x2 - x1) * (a + 0.12 / n * n), y1 + (y2 - y1) * a, h * 0.35, x1 + (x2 - x1) * (b - 0.12 / n * n), y1 + (y2 - y1) * b, h * 0.35, x1 + (x2 - x1) * (b - 0.12 / n * n), y1 + (y2 - y1) * b, h * 0.7, x1 + (x2 - x1) * (a + 0.12 / n * n), y1 + (y2 - y1) * a, h * 0.7, 0xffffff, 0.85);
      }
    };
    seg(-56, -56, W + 56, -56, 9, 0); seg(-56, -56, -56, L + 56, 14, 2); seg(W + 56, -56, W + 56, L + 56, 14, 4);
  }

  benches(g) {
    for (const y of [L * 0.42, L * 0.58]) {
      this.quad(g, -92, y - 40, 0, -92, y + 40, 0, -92, y + 40, 16, -92, y - 40, 16, 0x555b6e);
      this.quad(g, -92, y - 40, 22, -92, y + 40, 22, -78, y + 40, 22, -78, y - 40, 22, 0x1d3557, 0.8);
    }
  }

  stands(g, t) {
    const c = this.cam, low = this.low, ex = this.excite, step = low ? 2 : 1;
    const dot = (wx, wy, z, d, k, row) => {
      c.project(wx, wy, z + 14 + (d.on ? Math.max(0, Math.sin(t * 5 + d.o)) * (1.5 + ex * 5) : 0), A);
      if (A.x < -10 || A.x > c.W + 10 || A.y < -10 || A.y > c.H) return;
      const r = Math.max(1.5, 4 * A.s);
      g.fillStyle(d.c, 1); g.fillRect(A.x - r, A.y, r * 2, r * 1.6);
      g.fillStyle(d.h, 1); g.fillRect(A.x - r * 0.7, A.y - r * 1.3, r * 1.4, r * 1.3);
    };
    // fondo (extremo lejano)
    const rows = this.far.length;
    for (let r = 0; r < rows; r++) {
      const y = -70 - r * 20, z = 8 + r * 20;
      this.quad(g, -150, y, z, W + 150, y, z, W + 150, y, z + 22, -150, y, z + 22, SEAT[r & 3], 1);
      this.quad(g, -150, y, z + 22, W + 150, y, z + 22, W + 150, y - 20, z + 22, -150, y - 20, z + 22, 0x1b2a41, 1);
    }
    const top = -70 - rows * 20, tz = 8 + rows * 20;
    this.quad(g, -150, top, tz, W + 150, top, tz, W + 150, top - 20, 520, -150, top - 20, 520, 0x0e2238, 1);
    for (let i = 0; i < 5; i++) { const lx = -100 + i * ((W + 200) / 4); c.project(lx, top - 20, tz + 120, A); g.fillStyle(0xfff6c9, 0.9); g.fillCircle(A.x, A.y, 7 * A.s); g.fillStyle(0xfff6c9, 0.15); g.fillCircle(A.x, A.y, 20 * A.s); }
    for (let r = 0; r < rows; r++) { const row = this.far[r]; for (let j = 0; j < row.length; j += step) dot(-140 + j * ((W + 280) / row.length), -72 - r * 20, 8 + r * 20, row[j], 0, r); }
    // laterales
    for (const [side, crowd] of [[-1, this.left], [1, this.right]]) {
      for (let r = 0; r < crowd.length; r++) {
        const x = side < 0 ? -110 - r * 22 : W + 110 + r * 22, z = 8 + r * 20;
        this.quad(g, x, -70, z, x, L + 70, z, x, L + 70, z + 22, x, -70, z + 22, SEAT[(r + 1) & 3], 1);
      }
      for (let r = 0; r < crowd.length; r++) {
        const x = side < 0 ? -112 - r * 22 : W + 112 + r * 22, row = crowd[r];
        for (let j = 0; j < row.length; j += step) {
          const wy = -60 + j * ((L + 120) / row.length), wyd = wy;
          c.project(x, wyd, 0, A); if (A.y < -20 || A.y > c.H + 20) continue;
          dot(x, wyd, 8 + r * 20, row[j]);
        }
      }
    }
  }

  /** Portería. near=false: va al fondo (y=0); near=true: se dibuja delante de los jugadores (y=L). */
  goal(g, which, far) {
    const gy = far ? 0 : L, dir = far ? -1 : 1, x1 = (W - GW) / 2, x2 = (W + GW) / 2, bd = gy + dir * GD;
    const net = 0xffffff;
    // red: panel trasero, laterales y techo
    for (let i = 0; i <= 8; i++) { const x = x1 + (GW * i) / 8; this.line(g, x, bd, 0, x, bd, BAR - 4, 0.5, net, 0.45); this.line(g, x, gy, BAR, x, bd, BAR - 4, 0.5, net, 0.35); }
    for (let j = 0; j <= 4; j++) { const z = ((BAR - 4) * j) / 4; this.line(g, x1, bd, z, x2, bd, z, 0.5, net, 0.45); this.line(g, x1, gy, z, x1, bd, z * 0.9, 0.5, net, 0.3); this.line(g, x2, gy, z, x2, bd, z * 0.9, 0.5, net, 0.3); }
    this.line(g, x1, bd, 0, x1, bd, BAR - 4, 1, 0xdddddd, 0.8); this.line(g, x2, bd, 0, x2, bd, BAR - 4, 1, 0xdddddd, 0.8);
    this.line(g, x1, gy, BAR, x1, bd, BAR - 4, 1, 0xdddddd, 0.8); this.line(g, x2, gy, BAR, x2, bd, BAR - 4, 1, 0xdddddd, 0.8);
    // postes y larguero
    this.line(g, x1, gy, 0, x1, gy, BAR, 3, 0xffffff); this.line(g, x2, gy, 0, x2, gy, BAR, 3, 0xffffff); this.line(g, x1, gy, BAR, x2, gy, BAR, 3, 0xffffff);
  }
  goalNear(g) { this.goal(g, 1, false); }
}

import { clamp } from '../util.js';

const P = { x: 0, y: 0, s: 1 };
const hex = (s) => parseInt(s.slice(1), 16);
const DIG = ['1110111', '0010010', '1011101', '1011011', '0111010', '1101011', '1101111', '1010010', '1111111', '1111011']; // 7 segmentos: arriba, sup-izq, sup-der, medio, inf-izq, inf-der, abajo
const SEG = [[0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 1, 1], [0, 1, 1, 1], [0, 1, 0, 2], [1, 1, 1, 2], [0, 2, 1, 2]];
const GK_COLORS = ['#f4c20d', '#2ec4b6', '#ff5d8f', '#9d4edd'];

export function gkKit(shirt, other) {
  const d = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255)); };
  return GK_COLORS.find((c) => d(c, shirt) > 120 && d(c, other) > 120) || '#ffffff';
}

export class Actors {
  constructor(cam) { this.cam = cam; this.list = []; this.t = 0; this.parts = []; this.low = false; this.gk = {}; }

  burst(x, y, n) {
    const m = this.low ? n >> 2 : n;
    for (let i = 0; i < m; i++) this.parts.push({ x, y, z: 20, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, vz: 150 + Math.random() * 250, c: [0xffd23f, 0xff5d8f, 0x4cc9f0, 0xffffff, 0x80ed99][i % 5], life: 2.2 });
  }

  digits(g, num, sx, sy, u, color) {
    const s = String(num), w = 2.2 * u, h = 2.2 * u, gap = 1 * u, total = s.length * w + (s.length - 1) * gap;
    g.lineStyle(Math.max(1, 0.7 * u), color, 1);
    for (let k = 0; k < s.length; k++) {
      const mask = DIG[+s[k]], ox = sx - total / 2 + k * (w + gap);
      g.beginPath();
      for (let i = 0; i < 7; i++) if (mask[i] === '1') { const sg = SEG[i]; g.moveTo(ox + sg[0] * w, sy + sg[1] * h - h); g.lineTo(ox + sg[2] * w, sy + sg[3] * h - h); }
      g.strokePath();
    }
  }

  draw(g, m, ctl, dt) {
    const cam = this.cam, t = (this.t += dt), b = m.ball, hero = m.hero;
    const list = this.list; list.length = 0;
    for (const p of m.players) list.push(p);
    list.push(b);
    list.sort((a, c) => a.y - c.y);
    g.clear();
    // sombras primero
    for (const o of list) {
      cam.project(o.x, o.y, 0, P);
      const isBall = o === b, h = isBall ? o.z : (o.jumpT > 0 ? Math.sin(Math.PI * (1 - o.jumpT / 0.5)) * 14 : 0);
      g.fillStyle(0x000000, clamp(0.3 - h * 0.003, 0.1, 0.3));
      g.fillEllipse(P.x, P.y, (isBall ? 12 : 17) * P.s, (isBall ? 4.5 : 6) * P.s);
    }
    // indicador del jugador controlado
    cam.project(hero.x, hero.y, 0, P);
    const pulse = 1 + Math.sin(t * 6) * 0.06;
    g.lineStyle(Math.max(2, 2.2 * P.s), 0x00e5ff, 0.95); g.strokeEllipse(P.x, P.y, 26 * P.s * pulse, 10 * P.s * pulse);
    g.fillStyle(0x00e5ff, 0.18); g.fillEllipse(P.x, P.y, 26 * P.s * pulse, 10 * P.s * pulse);
    // objetivos de pase resaltados
    if (ctl && ctl.hint && ctl.hint.target) {
      const tg = ctl.hint.target; cam.project(tg.x, tg.y, 0, P);
      g.lineStyle(Math.max(2, 2.5 * P.s), ctl.hint.color, 1); g.strokeEllipse(P.x, P.y, 28 * P.s, 11 * P.s);
    }
    for (const o of list) {
      if (o === b) this.ball(g, b); else this.player(g, o, m, t);
    }
    // flecha sobre el héroe
    cam.project(hero.x, hero.y, 56 + Math.sin(t * 6) * 2, P);
    g.fillStyle(0x00e5ff, 1); g.fillTriangle(P.x - 5 * P.s, P.y - 6 * P.s, P.x + 5 * P.s, P.y - 6 * P.s, P.x, P.y + 2 * P.s);
    if (hero.callT > 0) { g.fillStyle(0xffd23f, 1); g.fillCircle(P.x + 10 * P.s, P.y - 8 * P.s, 4 * P.s); }
    // confeti
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt; if (q.life <= 0) { this.parts.splice(i, 1); continue; }
      q.vz -= 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.8; q.vy *= 0.8; }
      cam.project(q.x, q.y, q.z, P); g.fillStyle(q.c, 1); g.fillRect(P.x, P.y, Math.max(2, 2.5 * P.s), Math.max(2, 1.6 * P.s));
    }
  }

  ball(g, b) {
    this.cam.project(b.x, b.y, b.z, P);
    const r = 6.3 * P.s;
    g.fillStyle(0xffffff, 1); g.fillCircle(P.x, P.y - r, r);
    g.fillStyle(0x222222, 1);
    for (let i = 0; i < 3; i++) { const a = b.roll * 2 + i * 2.1; g.fillCircle(P.x + Math.cos(a) * r * 0.5, P.y - r + Math.sin(a) * r * 0.5, r * 0.28); }
    g.lineStyle(1, 0x999999, 1); g.strokeCircle(P.x, P.y - r, r);
  }

  player(g, p, m, t) {
    const cam = this.cam;
    const lift = p.jumpT > 0 ? Math.sin(Math.PI * (1 - p.jumpT / 0.5)) * 14 : 0;
    const cel = p.celebrate > 0 ? Math.abs(Math.sin(t * 9)) * 6 : 0;
    cam.project(p.x, p.y, lift + cel, P);
    const u = P.s, sx = P.x, sy = P.y;
    const k = p.kit, gk = p.role === 'GK';
    const shirt = hex(gk ? (this.gk[p.team] || (this.gk[p.team] = gkKit(m.teams[0].kit.shirt, m.teams[1].kit.shirt))) : k.shirt);
    const trim = hex(gk ? '#111111' : k.trim), shorts = hex(gk ? '#222222' : k.shorts), socks = hex(gk ? '#222222' : k.socks);
    const skin = hex(p.look.skin), hair = hex(p.look.hair), boot = hex(p.look.boots);
    const fx = Math.cos(p.face), fy = Math.sin(p.face), front = fy > 0.15;
    const sp = p.speed, amp = clamp(sp / 150, 0, 1.2), ph = p.animT;
    const lean = clamp(p.vx / 200, -1, 1) * 2.2 * u;

    if (p.state === 'fall' || p.state === 'getup') {
      const gu = p.state === 'getup' ? 0.5 : 0;
      g.fillStyle(shorts, 1); g.fillEllipse(sx + 6 * u, sy - 3 * u, 12 * u, 6 * u);
      g.fillStyle(shirt, 1); g.fillEllipse(sx - 4 * u, sy - (4 + gu * 6) * u, 18 * u, (7 + gu * 8) * u);
      g.fillStyle(skin, 1); g.fillCircle(sx - 15 * u, sy - (5 + gu * 8) * u, 4.8 * u);
      g.fillStyle(hair, 1); g.fillCircle(sx - 15.5 * u, sy - (6.5 + gu * 8) * u, 4 * u);
      g.lineStyle(3 * u, socks, 1); g.beginPath(); g.moveTo(sx + 11 * u, sy - 3 * u); g.lineTo(sx + 19 * u, sy - 1 * u); g.strokePath();
      g.fillStyle(boot, 1); g.fillRect(sx + 18 * u, sy - 3 * u, 3.5 * u, 3 * u);
      return;
    }
    let hipH = 17, shH = 32, headH = 38;
    const dive = p.state === 'dive', slide = p.state === 'slide';
    if (slide) { hipH = 8; shH = 18; headH = 24; }
    if (m.cfg && p.state === 'idle' && sp < 20 && !gk) { /* postura de espera */ }
    // piernas
    const swing = Math.sin(ph) * amp;
    const legs = [[-3.2, swing], [3.2, -swing]];
    for (let i = 0; i < 2; i++) {
      const [ox, sw] = legs[i];
      let fyOff = sw * 6 * u, up = Math.max(0, -sw) * 3 * u;
      let fxo = 0;
      if (p.kickT > 0 && i === 0) { const kk = Math.sin(Math.PI * (1 - p.kickT / 0.3)); fyOff = fy * kk * 9 * u; fxo = fx * kk * 9 * u; up = kk * 3 * u; }
      if (slide) { fyOff = fy * 10 * u; fxo = fx * 14 * u; up = 0; }
      if (dive) { fxo = p.diveDir * (i ? 8 : 12) * u; fyOff = 0; }
      const hx = sx + ox * u + lean * 0.6, hy = sy - hipH * u, kx = hx + (fxo + sw * 0.5) * 0.5, ky = hy + (hipH * 0.5) * u + fyOff * 0.3 - up * 0.5;
      const ex = sx + ox * u * 1.1 + fxo + lean * 0.3, ey = sy + fyOff - up;
      g.lineStyle(4.4 * u, shorts, 1); g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.strokePath();
      g.lineStyle(3.6 * u, socks, 1); g.beginPath(); g.moveTo(kx, ky); g.lineTo(ex, ey - 1.5 * u); g.strokePath();
      g.fillStyle(boot, 1); g.fillRect(ex - 2.6 * u, ey - 2 * u, 5.2 * u, 2.6 * u);
    }
    // torso
    let tx = sx + lean, ty = sy - hipH * u, tt = sy - shH * u;
    if (dive) { tx = sx + p.diveDir * 5 * u; }
    const crouch = p.speed < 25 && !gk && m.ball.owner && m.ball.owner.team !== p.team && Math.hypot(m.ball.owner.x - p.x, m.ball.owner.y - p.y) < 45 ? 2 * u : 0;
    ty += crouch; tt += crouch * 1.5;
    g.fillStyle(shirt, 1); g.beginPath();
    g.moveTo(tx - 4.6 * u, ty); g.lineTo(tx + 4.6 * u, ty); g.lineTo(tx + 6.6 * u + lean * 0.3, tt); g.lineTo(tx - 6.6 * u + lean * 0.3, tt); g.closePath(); g.fillPath();
    g.fillStyle(trim, 1); g.fillRect(tx - 6.6 * u + lean * 0.3, tt, 13.2 * u, 2 * u);
    if (!gk && k.shirt !== k.trim) { g.fillStyle(trim, 0.9); g.fillRect(tx - 1.2 * u, tt, 2.4 * u, (ty - tt)); }
    // brazos
    const celebrating = p.celebrate > 0;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1, sw = Math.sin(ph + (i ? 0 : Math.PI)) * amp;
      const ax = tx + side * 7.2 * u + lean * 0.3, ay = tt + 2 * u;
      let hx = ax + side * 2 * u, hy = ay + 11 * u + sw * 4 * u;
      if (celebrating || dive) { hx = ax + side * 4 * u + (dive ? p.diveDir * 6 * u : 0); hy = ay - 12 * u - (dive ? 0 : 0); }
      g.lineStyle(3.2 * u, shirt, 1); g.beginPath(); g.moveTo(ax, ay); g.lineTo((ax + hx) / 2, (ay + hy) / 2); g.strokePath();
      g.lineStyle(2.8 * u, gk ? 0x222222 : skin, 1); g.beginPath(); g.moveTo((ax + hx) / 2, (ay + hy) / 2); g.lineTo(hx, hy); g.strokePath();
    }
    // cabeza
    const hx = tx + fx * 1.2 * u, hy = sy - headH * u + crouch * 1.5 + (amp > 0.5 ? 1.2 * u : 0);
    g.fillStyle(skin, 1); g.fillCircle(hx, hy, 5.2 * u);
    g.fillStyle(hair, 1);
    if (front) g.slice(hx, hy, 5.3 * u, Math.PI, Math.PI * 2, false), g.fillPath(); else g.fillCircle(hx, hy - 0.4 * u, 5.1 * u);
    if (front) { g.fillStyle(0x222222, 1); g.fillCircle(hx - 1.8 * u, hy + 0.4 * u, 0.7 * u); g.fillCircle(hx + 1.8 * u, hy + 0.4 * u, 0.7 * u); }
    // dorsal
    if (!front && u > 0.7) this.digits(g, p.number, tx + lean * 0.3, tt + 8.5 * u, u, gk || k.trim === k.shirt ? 0xffffff : trim);
  }
}

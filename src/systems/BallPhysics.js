import { PITCH } from '../config.js';

export const G = 700;
const ROLL_A = 45, ROLL_B = 0.55, AIR_B = 0.12;
const { W, L, GW, GD, BAR, POST_R, BALL_R } = PITCH;
const X1 = (W - GW) / 2, X2 = (W + GW) / 2;

export const speedOf = (b) => Math.hypot(b.vx, b.vy);

/** Velocidad inicial para que un balón rasante recorra d unidades y llegue con velocidad vf. */
export function speedForDistance(d, vf = 140) {
  const dist = (v0) => (1 / ROLL_B) * ((v0 - vf) - (ROLL_A / ROLL_B) * Math.log((ROLL_A + ROLL_B * v0) / (ROLL_A + ROLL_B * vf)));
  let lo = vf, hi = 1400;
  for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (dist(m) < d) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

export const newBall = () => ({ x: W / 2, y: L / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, roll: 0, goal: 0, shot: false, px: W / 2, py: L / 2, inNet: false });

/**
 * Avanza el balón libre. ev: {bounce(b), post(b,kind), goal(b,team), out(b,kind)}.
 * Los goles: team 0 (local, ataca arriba y=0) marca en y<0; team 1 marca en y>L.
 */
export function stepBall(b, dt, ev) {
  b.px = b.x; b.py = b.y;
  if (b.z > 0 || b.vz !== 0) b.vz -= G * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.z <= 0) {
    b.z = 0;
    if (b.vz < -70) { b.vz = -b.vz * 0.55; b.vx *= 0.92; b.vy *= 0.92; ev.bounce?.(b); } else b.vz = 0;
  }
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const dec = b.z < 1 ? ROLL_A + ROLL_B * sp : AIR_B * sp;
    const ns = Math.max(0, sp - dec * dt), f = ns / sp;
    b.vx *= f; b.vy *= f;
    if (ns < 3 && b.z < 1) b.vx = b.vy = 0;
  }
  if (b.vx || b.vy) b.roll += Math.hypot(b.vx, b.vy) * dt * 0.1;
  goalCollisions(b, dt, ev);
}

function bouncePost(b, px, py, ev) {
  const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy), r = POST_R + BALL_R;
  if (d >= r || b.z > BAR) return;
  const nx = d ? dx / d : 0, ny = d ? dy / d : -1;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) { b.vx -= 1.65 * vn * nx; b.vy -= 1.65 * vn * ny; ev.post?.(b, 'post'); }
  b.x = px + nx * (r + 0.1); b.y = py + ny * (r + 0.1);
  b.shot = false;
}

function goalCollisions(b, dt, ev) {
  for (const [gy, team] of [[0, 0], [L, 1]]) {
    const inward = gy === 0 ? -1 : 1; // dirección hacia fuera del campo
    bouncePost(b, X1, gy, ev); bouncePost(b, X2, gy, ev);
    const crossed = (b.py - gy) * inward <= 0 && (b.y - gy) * inward > 0; // cruza la línea de gol hacia fuera
    if (crossed && !b.inNet) {
      const t = (gy - b.py) / (b.y - b.py || 1e-6), cx = b.px + (b.x - b.px) * t, cz = b.z - b.vz * dt * (1 - t);
      const inMouth = cx > X1 + POST_R && cx < X2 - POST_R;
      if (inMouth && Math.abs(cz - BAR) < BALL_R * 0.9) {
        // larguero
        b.y = gy; b.vy = -b.vy * 0.55; b.vz = (cz >= BAR ? 1 : -1) * Math.abs(b.vz) * 0.4 + (cz >= BAR ? 60 : -30);
        b.shot = false; ev.post?.(b, 'bar');
      } else if (inMouth && cz < BAR) {
        b.inNet = true; b.goal = team + 1; ev.goal?.(b, team);
      } else {
        ev.out?.(b, 'end', gy === 0 ? 0 : 1, cx);
      }
    }
    if (b.inNet && Math.abs(b.y - gy) < GD + 30 && ((b.y - gy) * inward > -2)) netBounds(b, gy, inward);
  }
  if (!b.inNet && (b.x < 0 || b.x > W)) ev.out?.(b, 'side');
}

function netBounds(b, gy, inward) {
  const lo = X1 + POST_R + BALL_R * 0.5, hi = X2 - POST_R - BALL_R * 0.5;
  if (b.x < lo) { b.x = lo; b.vx = Math.abs(b.vx) * 0.2; }
  if (b.x > hi) { b.x = hi; b.vx = -Math.abs(b.vx) * 0.2; }
  const back = gy + inward * (GD - BALL_R);
  if ((b.y - back) * inward > 0) { b.y = back; b.vy *= -0.12; b.vx *= 0.5; }
  if ((b.y - gy) * inward < 0) { b.y = gy + inward * 0.1; b.vy = 0; } // no sale de la red
  if (b.z > BAR + 8) { b.z = BAR + 8; b.vz = -Math.abs(b.vz) * 0.2; }
}

/** Trayectoria aproximada (posiciones cada step s) para que la IA anticipe. */
export function predict(b, out, n = 14, step = 0.1) {
  let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 5; k++) {
      const dt = step / 5;
      vz -= G * dt; x += vx * dt; y += vy * dt; z += vz * dt;
      if (z <= 0) { z = 0; vz = vz < -70 ? -vz * 0.55 : 0; }
      const sp = Math.hypot(vx, vy);
      if (sp > 0) { const ns = Math.max(0, sp - (z < 1 ? ROLL_A + ROLL_B * sp : AIR_B * sp) * dt), f = ns / sp; vx *= f; vy *= f; }
    }
    const o = out[i] || (out[i] = {});
    o.x = x; o.y = y; o.z = z; o.t = (i + 1) * step;
  }
  return out;
}

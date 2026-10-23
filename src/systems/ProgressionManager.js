import { ATTRS, POSITIONS } from '../config.js';
import { clamp } from '../util.js';

export const startAttrs = (pos) => {
  const a = {};
  for (const t of ATTRS) a[t.k] = clamp(45 + (POSITIONS[pos].boost[t.k] || 0), 25, 70);
  return a;
};

const OVR_W = {
  DEL: { speed: 2, accel: 1.5, dribble: 1.5, control: 1, passing: 0.5, shotPower: 2, shotAcc: 2, finishing: 3, stamina: 0.5, balance: 0.5, positioning: 1, reaction: 1 },
  MED: { speed: 1, accel: 1, dribble: 1.5, control: 2.5, passing: 3, shotPower: 1, shotAcc: 1, finishing: 1, stamina: 2, balance: 1, positioning: 1.5, reaction: 1 },
  DEF: { speed: 1.5, accel: 1, dribble: 0.5, control: 1, passing: 1.5, shotPower: 0.5, shotAcc: 0.3, finishing: 0.2, stamina: 2, balance: 3, positioning: 3, reaction: 2 },
};
export function overall(attrs, pos) {
  const w = OVR_W[pos];
  let s = 0, t = 0;
  for (const k in w) { s += attrs[k] * w[k]; t += w[k]; }
  return Math.round(s / t);
}

/** XP necesaria para subir un atributo de v a v+1. Crece rápido por encima de 80. */
export const upgradeCost = (v) => Math.round(30 + (v * v) / 55 + (v > 80 ? (v - 80) * 18 : 0));

export function upgrade(save, key) {
  const v = save.attrs[key];
  const c = upgradeCost(v);
  if (v >= 99 || save.xp < c) return false;
  save.xp -= c;
  save.attrs[key] = v + 1;
  return true;
}

export function xpForMatch(r) {
  return Math.max(0, Math.round((r.rating - 4) * 22 + r.goals * 20 + r.assists * 12 + (r.result === 'W' ? 20 : r.result === 'D' ? 8 : 0)));
}

/** Valoración 1–10 con explicación. s: estadísticas del jugador; o: {main:n,sec:n}; result 'W'|'D'|'L'. */
export function computeRating(s, o = { main: 0, sec: 0 }, role = 'MID') {
  const parts = [];
  const add = (txt, d) => { if (Math.abs(d) >= 0.05) parts.push({ txt, d }); };
  let r = 6.0;
  add(`${s.goals} gol(es)`, (s.goals ? 1.1 + (s.goals - 1) * 0.7 : 0));
  add(`${s.assists} asistencia(s)`, s.assists * 0.8);
  add(`${s.chances} ocasión(es) creadas`, Math.min(s.chances, 5) * 0.3);
  if (s.passes >= 3) {
    const acc = s.passesOk / s.passes;
    add(`Pases: ${Math.round(acc * 100)}% de acierto`, (acc - 0.72) * 2 + Math.min(s.passesOk, 15) * 0.03);
  }
  add(`${s.recoveries} recuperación(es)`, Math.min(s.recoveries, 6) * 0.2);
  add(`${s.losses} pérdida(s) de balón`, -Math.min(s.losses, 12) * 0.1);
  add(`${s.errors} error(es) decisivo(s)`, -s.errors * 0.7);
  add(`${s.shots - s.onTarget} tiro(s) desviado(s)`, -Math.min(s.shots - s.onTarget, 6) * 0.06);
  add(`Objetivos: ${o.main} principal, ${o.sec} secundario(s)`, o.main * 0.4 + o.sec * 0.2);
  add(s.result === 'W' ? 'Victoria del equipo' : s.result === 'L' ? 'Derrota del equipo' : 'Empate', s.result === 'W' ? 0.4 : s.result === 'L' ? -0.35 : 0.05);
  if (role === 'DEF') add(`${s.conceded} gol(es) encajados`, s.conceded === 0 ? 0.3 : -0.12 * s.conceded);
  for (const p of parts) r += p.d;
  r = Math.round(clamp(r, 1, 10) * 10) / 10;
  const good = parts.filter((p) => p.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
  const bad = parts.filter((p) => p.d < 0).sort((a, b) => a.d - b.d).slice(0, 3);
  return { rating: r, good, bad };
}

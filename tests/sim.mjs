// Simula partidos completos sin navegador con un "bot" que maneja al héroe (prueba de humo del motor).
import { MatchManager } from '../src/systems/MatchManager.js';
import { SCENARIOS, pickObjectives } from '../src/data.js';
import { startAttrs } from '../src/systems/ProgressionManager.js';
import { PITCH } from '../src/config.js';

const seeds = +process.argv[2] || 3, dur = +process.argv[3] || 180, diff = process.argv[4] || 'normal';
let tot = { goals: [0, 0], shots: [0, 0], onT: [0, 0], passes: 0, ok: 0, restarts: {}, fails: 0 };
for (let s = 0; s < seeds; s++) {
  const restarts = {};
  const cfg = {
    home: { name: 'A', short: 'AAA', c1: '#d62828', c2: '#fff', rating: 55 }, away: { name: 'B', short: 'BBB', c1: '#1d4ed8', c2: '#facc15', rating: 55 },
    hero: { attrs: startAttrs('DEL'), pos: 'DEL', number: 9, skin: '#e0a97a', hair: '#000', boots: '#111' },
    difficulty: diff, durationSec: dur, scenario: SCENARIOS.normal, objectives: pickObjectives('FWD', 'normal'),
  };
  let ended = null;
  const m = new MatchManager(cfg, { restart: (k) => { restarts[k] = (restarts[k] || 0) + 1; }, end: (r) => { ended = r; } });
  const dt = 1 / 60; let guard = 0, tt = 0;
  while (!ended && guard++ < 60 * 60 * 12) {
    const h = m.hero, b = m.ball;
    // bot: corre hacia el balón o hacia el hueco; chuta cerca de la portería; pasa si presionado
    const inp = m.input;
    const tx = m.state === 'restart' || b.owner === h ? W2(h, b) : b.x, ty = b.owner === h ? 0 : b.y;
    let dx = tx - h.x, dy = ty - h.y; const n = Math.hypot(dx, dy) || 1;
    inp.mx = dx / n; inp.my = dy / n; if (n < 12) inp.mx = inp.my = 0;
    tt += dt;
    if (b.owner === h && tt > 0.4) {
      const dg = Math.hypot(h.x - 300, h.y);
      if (m.state === 'restart' && tt > 0.8) { inp.actions.push({ type: 'pass', tap: true }); tt = 0; }
      else if (dg < 260) { inp.actions.push({ type: 'shot', dx: 300 - h.x + (Math.random() - 0.5) * 80, dy: -h.y, power: 0.8 }); tt = 0; }
      else if (m.pressure(h) > 0.5 || tt > 1.5) { inp.actions.push({ type: 'pass', tap: true }); tt = 0; }
    } else if (b.owner && b.owner.team === 1 && Math.hypot(b.owner.x - h.x, b.owner.y - h.y) < 40) inp.actions.push({ type: 'tackle' });
    m.update(dt);
    for (const p of m.players) { if (!isFinite(p.x) || !isFinite(p.y)) throw new Error('NaN pos'); }
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.z)) throw new Error('NaN ball');
    if (b.x < -2 || b.x > 602) { if (m.state === 'play') tot.fails++; }
  }
  if (!ended) { console.log('STUCK', m.state, m.gameMin, m.rs.kind, m.rs.team, m.rs.taker.team, m.rs.taker.role, !!m.ball.owner, m.ball.owner && m.ball.owner.role, m.rs.taker.state, m.rs.taker.down); throw new Error('el partido no terminó'); }
  tot.goals[0] += ended.scoreFor; tot.goals[1] += ended.scoreAgainst;
  tot.shots[0] += ended.teamStats.shots[0]; tot.shots[1] += ended.teamStats.shots[1]; tot.onT[0] += ended.teamStats.onTarget[0]; tot.onT[1] += ended.teamStats.onTarget[1];
  tot.passes += ended.teamStats.passes[0] + ended.teamStats.passes[1]; tot.ok += ended.teamStats.passesOk[0] + ended.teamStats.passesOk[1];
  for (const k in restarts) tot.restarts[k] = (tot.restarts[k] || 0) + restarts[k];
  console.log(`partido ${s + 1}: ${ended.scoreFor}-${ended.scoreAgainst} rating ${ended.rating} hero`, JSON.stringify(ended.hero), 'poss', ended.teamStats.poss.join('/'), 'min', m.gameMin.toFixed(1), 't', m.time.toFixed(0));
}
console.log(JSON.stringify(tot));
function W2(h, b) { return b.owner === h ? 300 : b.x; }

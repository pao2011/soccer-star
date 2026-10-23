import assert from 'node:assert/strict';
import { stepBall, newBall, speedForDistance, G } from '../src/systems/BallPhysics.js';
import { validate, defaultSave } from '../src/systems/SaveManager.js';
import { newCareer, nextFixture, completeMatch, standings, acceptOffer, finishSeasonAndStartNext } from '../src/systems/CareerManager.js';
import { computeRating, upgrade, upgradeCost, overall } from '../src/systems/ProgressionManager.js';
import { pickObjectives, evalObjective } from '../src/data.js';

const run = (b, secs, ev = {}) => { for (let t = 0; t < secs; t += 1 / 120) stepBall(b, 1 / 120, ev); };

// 1) gol válido: tiro raso al centro de la portería rival
{ const b = newBall(); b.x = 300; b.y = 200; b.vy = -600; let goals = []; run(b, 1, { goal: (_, t) => goals.push(t) });
  assert.deepEqual(goals, [0], 'gol local'); assert.ok(b.y > -40 && b.y <= 0.5, 'queda dentro de la red'); }
// 2) fuera del arco no es gol
{ const b = newBall(); b.x = 100; b.y = 200; b.vy = -600; let g = 0, out = 0; run(b, 1, { goal: () => g++, out: () => out++ });
  assert.equal(g, 0); assert.ok(out > 0, 'balón fuera'); }
// 3) poste rebota
{ const b = newBall(); b.x = 235; b.y = 100; b.vy = -500; let post = 0, g = 0; run(b, 0.6, { post: () => post++, goal: () => g++ });
  assert.ok(post >= 1 && g === 0 && b.vy > 0, 'rebote en poste'); }
// 4) sobre el larguero no es gol
{ const b = newBall(); b.x = 300; b.y = 200; b.vy = -500; b.vz = 400; let g = 0; run(b, 1, { goal: () => g++ }); assert.equal(g, 0); }
// 5) el pase llega a destino
{ const b = newBall(); const v = speedForDistance(250, 150); b.x = 300; b.y = 700; b.vy = -v;
  let t = 0; while (b.y > 450 && t < 5) { stepBall(b, 1 / 120, {}); t += 1 / 120; }
  assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 150) < 25, 'velocidad de llegada ~150: ' + Math.hypot(b.vx, b.vy)); }
// 6) rebote de lob y gravedad
{ const b = newBall(); b.vz = 300; let bn = 0; run(b, 2.5, { bounce: () => bn++ }); assert.ok(bn >= 1 && b.z >= 0); }

// guardado: dañado lanza, válido pasa
assert.throws(() => validate({ v: 99 }));
assert.throws(() => validate(null));
{ const s = defaultSave(); const v = validate(JSON.parse(JSON.stringify(s))); assert.equal(v.profile, null); }

// carrera completa de 2 temporadas
{ const prof = { name: 'Test', nation: 'AR', pos: 'DEL', number: 9, age: 17, skin: '#fff', hair: '#000', boots: '#111' };
  const s = newCareer(prof, 12, { c1: '#f00', c2: '#fff' }); s.settings = defaultSave().settings; s.tutorialDone = false;
  validate(JSON.parse(JSON.stringify(s)));
  for (let i = 0; i < 10; i++) {
    const f = nextFixture(s); assert.ok(f && f.opp.id !== s.career.clubId);
    const r = completeMatch(s, { scoreFor: 2, scoreAgainst: i % 3, rating: 7.4, goals: 1, assists: 0, passes: 10, passesOk: 8, chances: 1, result: 2 > i % 3 ? 'W' : 'D' });
    assert.ok(r.xp > 0 && r.coins > 0);
  }
  assert.ok(s.career.seasonEnd, 'fin de temporada'); assert.equal(standings(s).length, 6);
  assert.ok(s.career.table[s.career.clubId].p === 10);
  const before = s.career.clubId; assert.ok(s.career.offers.length >= 0);
  if (s.career.offers.length) acceptOffer(s, 0);
  finishSeasonAndStartNext(s); assert.equal(s.career.season, 2); assert.equal(s.career.md, 0);
  validate(JSON.parse(JSON.stringify(s)));
  // progresión gradual
  s.xp = 100000; const o0 = overall(s.attrs, 'DEL'), sp0 = s.attrs.speed; for (let i = 0; i < 5; i++) upgrade(s, 'speed');
  assert.equal(s.attrs.speed, sp0 + 5);
  assert.ok(upgradeCost(90) > upgradeCost(50) * 2);
  assert.ok(overall(s.attrs, 'DEL') >= o0);
}
// valoración: asistir también puntúa alto
{ const base = { goals: 0, assists: 2, chances: 3, passes: 20, passesOk: 18, recoveries: 2, losses: 3, errors: 0, shots: 0, onTarget: 0, result: 'W', conceded: 0 };
  const r = computeRating(base, { main: 1, sec: 1 }, 'MID'); assert.ok(r.rating >= 8, 'asistente bien valorado ' + r.rating);
  const bad = computeRating({ ...base, assists: 0, chances: 0, passesOk: 8, losses: 12, errors: 1, result: 'L' }, { main: 0, sec: 0 }, 'MID'); assert.ok(bad.rating < 5); }
// objetivos
{ const o = pickObjectives('FWD', 'normal'); assert.equal(o.length, 3); assert.equal(new Set(o.map((x) => x.id)).size, 3);
  const e = evalObjective({ id: 'losses' }, { losses: 3 }); assert.ok(e.done); }
console.log('OK: todas las pruebas lógicas pasaron');

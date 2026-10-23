import { PITCH, FORMATION, POSITIONS, ATTRS, goalY, adv } from '../config.js';
import { Player, aiAttrs } from '../entities/Player.js';
import { newBall, stepBall, speedForDistance, speedOf, G } from './BallPhysics.js';
import { AIManager } from './AIManager.js';
import { computeRating } from './ProgressionManager.js';
import { evalObjective } from '../data.js';
import { DIFFICULTY, SKINS, HAIRS } from '../data.js';
import { clamp, lerp, rand, sym, pick, dist, angleDiff } from '../util.js';

const { W, L, GW, GA_D, PA_W, PA_D } = PITCH;
const ATTR_KEYS = ATTRS.map((a) => a.k);

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255; };
const cdist = (a, b) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255)); };
function kitFor(c1, c2, other) {
  let k = { shirt: c1, trim: c2, shorts: c2, socks: c1 };
  if (other && cdist(k.shirt, other.shirt) < 110) k = { shirt: c2, trim: c1, shorts: c1, socks: c2 };
  if (other && cdist(k.shirt, other.shirt) < 110) k = { shirt: lum(other.shirt) > 0.5 ? '#1b1b2f' : '#f4f4f4', trim: c1, shorts: '#222', socks: c1 };
  return k;
}

export class MatchManager {
  constructor(cfg, hooks = {}) {
    this.cfg = cfg; this.h = hooks;
    this.diff = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
    this.time = 0; this.ball = newBall(); this.players = []; this.state = 'intro'; this.stateT = 0;
    this.input = { mx: 0, my: 0, actions: [] };
    this.sc = cfg.scenario; this.gameMin = this.sc.startMin; this.minRate = 90 / cfg.durationSec;
    this.ending = false; this.endingT = 0; this.halfDone = this.sc.startMin >= 45;
    this.possTime = [0, 0]; this.possTeam = null; this.lastOwner = null; this.lastPass = null;
    this.counter = null; this.lastHeroLoss = null; this.heroGoWinning = false; this.rs = null;
    this.ev = {
      bounce: (b) => this.h.sfx?.('bounce', clamp(Math.abs(b.vz) / 300, 0.2, 1)),
      post: (b, k) => { this.h.sfx?.('post', 1); this.h.shake?.(0.004); },
      goal: (b, t) => this.onGoal(t),
      out: (b, kind, side, cx) => this.onOut(kind, side, cx),
    };
    const home = cfg.home, away = cfg.away;
    const hk = kitFor(home.c1, home.c2), ak = kitFor(away.c1, away.c2, hk);
    this.teams = [
      { id: 0, ...home, kit: hk, score: this.sc.hs, press: 0, pressCD: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, players: [] },
      { id: 1, ...away, kit: ak, score: this.sc.as, press: 0, pressCD: 0, shots: 0, onTarget: 0, passes: 0, passesOk: 0, players: [] },
    ];
    this.startAway = this.sc.as;
    this.hs = { goals: 0, assists: 0, passes: 0, passesOk: 0, chances: 0, shots: 0, onTarget: 0, outGoals: 0, losses: 0, errors: 0, recoveries: 0, counter: 0, moved: 0, sprintT: 0, tackles: 0, keyPassGiven: false };
    this.buildTeams();
    this.ai = new AIManager(this);
    this.setupKickoff(cfg.kickoffTeam ?? 0);
    this.state = 'intro';
  }

  get hero() { return this._hero; }

  buildTeams() {
    const cfg = this.cfg, pos = POSITIONS[cfg.hero.pos];
    for (const t of [0, 1]) {
      const team = this.teams[t], rating = team.rating * (t === 1 ? this.diff.opp : 1);
      const nums = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 14, 17].sort(() => Math.random() - 0.5);
      FORMATION.forEach((f, i) => {
        const hero = t === 0 && i === pos.slot;
        let attrs;
        if (hero) { attrs = { ...cfg.hero.attrs }; if (cfg.boost) for (const k of ATTR_KEYS) attrs[k] = Math.min(99, attrs[k] + 6); }
        else attrs = aiAttrs(t === 0 ? rating * 0.97 : rating, f.role, ATTR_KEYS);
        const p = new Player({
          team: t, role: f.role, slot: i, fx: t === 0 ? f.fx : 1 - f.fx, fy: f.fy, attrs, kit: team.kit, isHero: hero,
          number: hero ? cfg.hero.number : (i === 0 ? 1 : nums.pop()),
          look: hero ? { skin: cfg.hero.skin, hair: cfg.hero.hair, boots: cfg.hero.boots } : { skin: pick(SKINS), hair: pick(HAIRS), boots: '#111111' },
        });
        if (hero) this._hero = p;
        team.players.push(p); this.players.push(p);
      });
    }
    // dorsales únicos del jugador
    for (const p of this.teams[0].players) if (!p.isHero && p.number === this.hero.number) p.number = 12;
  }

  // ---------- utilidades de equipo ----------
  formationPos(p, out) {
    const t = p.team, b = this.ball;
    if (p.role === 'GK') { out.x = W / 2; out.y = t === 0 ? L - 24 : 24; return out; }
    const ballAdv = adv(t, b.y), push = this.possTeam === t ? 0.07 : -0.05;
    const fy = clamp(p.fy + (ballAdv - 0.5) * 0.42 + push, 0.1, 0.92);
    out.x = clamp(W * (0.06 + 0.88 * p.fx) + (b.x - W / 2) * 0.2, 24, W - 24);
    out.y = t === 0 ? L * (1 - fy) : L * fy;
    return out;
  }

  nearestOpp(p, maxD = 1e9, exclude = null) {
    let best = null, bd = maxD;
    for (const o of this.teams[1 - p.team].players) { if (o === exclude) continue; const d = dist(p.x, p.y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
    return best ? { o: best, d: bd } : null;
  }
  pressure(p) { const n = this.nearestOpp(p, 80); return n ? clamp(1 - n.d / 80, 0, 1) : 0; }

  // ---------- puestas en juego ----------
  setupKickoff(team) {
    for (const t of this.teams) for (const p of t.players) {
      const o = this.formationPos(p, {});
      p.x = clamp(o.x, 30, W - 30); p.y = p.team === 0 ? Math.max(o.y, L / 2 + (p.role === 'FWD' ? 18 : 6)) : Math.min(o.y, L / 2 - (p.role === 'FWD' ? 18 : 6));
      if (p.role !== 'GK' && Math.hypot(p.x - W / 2, p.y - L / 2) < 90 && p.team !== team) p.y += p.team === 0 ? 70 : -70;
      p.vx = p.vy = 0; p.setState('idle'); p.face = p.team === 0 ? -Math.PI / 2 : Math.PI / 2; p.stamina = Math.max(p.stamina, 60);
    }
    this.startRestart('kickoff', team, W / 2, L / 2, true);
  }

  startRestart(kind, team, x, y, silent) {
    const b = this.ball;
    b.owner = null; b.vx = b.vy = b.vz = 0; b.z = 0; b.x = x; b.y = y; b.inNet = false; b.goal = 0; b.shot = false;
    this.state = 'restart'; this.stateT = 0;
    const tm = this.teams[team].players;
    let taker;
    if (kind === 'goalkick') taker = tm[0];
    else {
      let best = 1e9;
      for (const p of tm) { if (p.role === 'GK' || (kind === 'kickoff' && p.role !== 'FWD' && !p.isHero)) continue; const d = dist(p.x, p.y, x, y) + (p.isHero ? -90 : 0); if (d < best) { best = d; taker = p; } }
      if (kind === 'kickoff') { const f = tm.find((p) => p.role === 'FWD'); taker = f; }
    }
    this.rs = { kind, team, x, y, taker, t: 0, wait: kind === 'kickoff' ? 1.2 : 1.1 };
    taker.x = clamp(x + (kind === 'throw' ? (x < W / 2 ? 6 : -6) : 0), 4, W - 4); taker.y = kind === 'kickoff' ? y + (team === 0 ? 12 : -12) : y;
    if (kind === 'corner') { taker.x = x < W / 2 ? 6 : W - 6; taker.y = y < L / 2 ? 6 : L - 6; }
    taker.vx = taker.vy = 0; taker.face = Math.atan2(L / 2 - taker.y, W / 2 - taker.x); if (kind === 'kickoff') taker.face = team === 0 ? -Math.PI / 2 : Math.PI / 2;
    taker.setState('idle');
    this.give(taker, true);
    this.rs.heroTakes = taker.isHero;
    if (!silent) this.h.restart?.(kind, team);
    if (kind === 'kickoff') this.h.sfx?.('whistle', 1);
  }

  onOut(kind, side, cx) {
    if (this.state !== 'play') return;
    const b = this.ball, lt = b.lastTeam ?? 0;
    this.h.sfx?.('out', 0.4);
    if (kind === 'side') {
      this.startRestart('throw', 1 - lt, b.x < W / 2 ? 2 : W - 2, clamp(b.y, 30, L - 30));
    } else {
      const atk = side; // el equipo que ataca esa línea de fondo: 0 arriba, 1 abajo
      if (lt === atk) this.startRestart('goalkick', 1 - atk, W / 2, side === 0 ? GA_D : L - GA_D);
      else this.startRestart('corner', atk, cx < W / 2 ? 0 : W, side === 0 ? 0 : L);
    }
  }

  // ---------- posesión ----------
  give(p, restart = false) {
    const b = this.ball, prev = this.lastOwner, hero = this.hero;
    b.owner = p; b.lastTouch = p; b.lastTeam = p.team; b.vz = 0; b.z = 0; b.shot = false;
    if (!restart || true) p.ownedAt = this.time;
    const pp = this.lastPass;
    if (pp && !pp.done) {
      pp.done = true;
      if (p.team === pp.team && p !== pp.from) {
        pp.ok = true; pp.completeT = this.time; pp.to = p;
        this.teams[pp.team].passesOk++;
        if (pp.from === hero) { this.hs.passesOk++; this.h.passOk?.(); }
      }
    }
    if (!restart && prev && prev.team !== p.team) {
      if (prev === hero && b.lastKick !== 'shot') {
        this.hs.losses++;
        if (hero.y > L * 0.66) this.lastHeroLoss = { t: this.time };
      }
      if (p.team === 0) {
        if (p === hero) { this.hs.recoveries++; this.h.toast?.('Recuperación', 'info'); }
        if (p.y > L * 0.4) this.counter = { t: this.time, heroTouched: p === hero, done: false };
      }
    }
    if (p.team === 0 && this.counter && p === hero) this.counter.heroTouched = true;
    this.possTeam = p.team; this.lastOwner = p;
    if (!restart) this.h.sfx?.('trap', 0.5);
  }

  release(p) { if (this.ball.owner === p) this.ball.owner = null; }

  // ---------- golpeos ----------
  strike(p, vx, vy, vz, kind) {
    const b = this.ball;
    b.owner = null; b.vx = vx; b.vy = vy; b.vz = vz; b.z = Math.max(b.z, 0.1); b.lastTouch = p; b.lastTeam = p.team; b.lastKick = kind; b.kickId = (b.kickId || 0) + 1;
    b.x = p.x + Math.cos(p.face) * 3; b.y = p.y + Math.sin(p.face) * 3;
    p.kickT = 0.3; p.noPick = this.time + 0.4;
    b.shot = kind === 'shot' || kind === 'header';
    this.h.sfx?.(kind === 'shot' ? 'shot' : 'kick', clamp(Math.hypot(vx, vy) / 700, 0.3, 1));
    if (this.state === 'restart') { this.state = 'play'; this.stateT = 0; this.rs = null; }
  }

  /** Pase. target: jugador o null; (ax, ay) dirección si no hay objetivo; power 0..1. */
  pass(p, target, ax, ay, power, o = {}) {
    const press = this.pressure(p);
    let tx, ty;
    if (target) {
      const lead = o.through ? 0.85 : 0.35, dir = this.teams[p.team].id === 0 ? -1 : 1;
      tx = target.x + target.vx * lead + (o.through ? 0 : 0); ty = target.y + target.vy * lead + (o.through ? dir * 28 : 0);
    } else { const d = 70 + power * 420, n = Math.hypot(ax, ay) || 1; tx = p.x + ax / n * d; ty = p.y + ay / n * d; }
    tx = clamp(tx, 6, W - 6); ty = clamp(ty, 6, L - 6);
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
    const sigma = (10 - p.attrs.passing * 0.085) * (1 + press * 0.7) * (o.first ? 1.5 : 1) * (o.lob ? 1.15 : 1) * (1 + (p.sprint ? 0.2 : 0)) * (o.sloppy || 1);
    const ang = Math.atan2(dy, dx) + sym() * sigma * Math.PI / 180;
    let sp, vz = 0;
    if (o.lob || d > 380) {
      const T = clamp(0.5 + d / 640, 0.62, 1.5); sp = d / T * 1.04; vz = G * T / 2;
    } else sp = clamp(speedForDistance(d, o.through ? 190 : 150), 190, 700);
    sp *= 1 + sym() * (6 - p.attrs.passing * 0.05) / 100;
    p.face = Math.atan2(dy, dx);
    this.strike(p, Math.cos(ang) * sp, Math.sin(ang) * sp, vz, 'pass');
    if (o.clear) { this.lastPass = null; return; }
    this.lastPass = { from: p, to: null, target, team: p.team, t: this.time, done: false, ok: false };
    this.teams[p.team].passes++;
    if (p === this.hero) { this.hs.passes++; this.h.passMade?.(); }
    this.h.sfx?.('pass', 0.5);
  }

  /** Disparo / remate. */
  shoot(p, ax, ay, power, o = {}) {
    const n = Math.hypot(ax, ay) || 1; ax /= n; ay /= n;
    const placed = power < 0.45 && !o.lob && !o.header;
    const pw = clamp(power, 0.2, 1), a = p.attrs;
    let sp = lerp(300, 300 + 480 * (0.55 + 0.45 * a.shotPower / 100), pw);
    if (placed) sp = lerp(330, 460, pw / 0.45) * (0.9 + a.shotPower / 800);
    if (o.header) sp *= 0.7;
    const press = this.pressure(p), dg = dist(p.x, p.y, W / 2, goalY(p.team));
    let sigma = (12 - a.shotAcc * 0.1) * (1 + press * 0.8) * (0.75 + pw * 0.6) * (o.first ? 1.4 : 1) * (o.header ? 1.5 : 1) * (p.sprint ? 1.15 : 1);
    if (placed) sigma *= 0.45;
    if (dg < 280 && press < 0.5) sigma *= 1 - (a.finishing - 50) / 220;
    if (o.lob) { sp *= 0.7; }
    const ang = Math.atan2(ay, ax) + sym() * sigma * Math.PI / 180;
    let vz = o.lob ? 230 + pw * 150 : (pw > 0.85 ? rand(0, 90) * (1 - a.shotAcc / 140) : placed ? 0 : rand(0, 30));
    if (o.header) vz = rand(20, 90);
    p.face = Math.atan2(ay, ax);
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    // ¿a puerta? (se evalúa con la trayectoria final real)
    const gy = goalY(p.team), tt = (gy - p.y) / (vy || 1e-6);
    let onT = false;
    if (tt > 0 && tt < 3) { const xx = p.x + vx * tt; onT = xx > (W - GW) / 2 - 4 && xx < (W + GW) / 2 + 4 && (vz === 0 || vz * tt - 0.5 * G * tt * tt < PITCH.BAR); }
    this.strike(p, vx, vy, vz, o.header ? 'header' : 'shot');
    this.ball.shotFrom = { x: p.x, y: p.y, p, outside: !(Math.abs(p.x - W / 2) < PA_W / 2 && Math.abs(p.y - gy) < PA_D) };
    this.ball.shotOnTarget = onT; this.ball.shotTeam = p.team;
    const tm = this.teams[p.team]; tm.shots++; if (onT) tm.onTarget++;
    if (p === this.hero) { this.hs.shots++; if (onT) this.hs.onTarget++; this.h.shotMade?.(onT); }
    // ocasión creada: el compañero que remata tras un pase del héroe
    const lp = this.lastPass;
    if (p !== this.hero && p.team === 0 && lp && lp.ok && lp.from === this.hero && lp.to === p && this.time - lp.completeT < 4 && !lp.key) { lp.key = true; this.hs.chances++; this.h.toast?.('Ocasión creada', 'info'); }
    if (p.team === 0 && this.counter && !this.counter.done && this.time - this.counter.t < 12) { this.counter.done = true; if (this.counter.heroTouched) { this.hs.counter++; this.h.toast?.('¡Contraataque!', 'good'); } }
    if (p.team === 1 && this.lastHeroLoss && this.time - this.lastHeroLoss.t < 6) { this.hs.errors++; this.lastHeroLoss = null; this.h.toast?.('Error en la salida', 'bad'); }
  }

  // ---------- entradas ----------
  tackle(d, a, slide = false) {
    d.tackleCD = 0.9; d.setState('slide', 0.35); const dd = dist(d.x, d.y, a.x, a.y) || 1;
    d.face = Math.atan2(a.y - d.y, a.x - d.x); d.vx = Math.cos(d.face) * 230; d.vy = Math.sin(d.face) * 230;
    const behind = (a.dirX * (d.x - a.x) + a.dirY * (d.y - a.y)) / dd < -0.2;
    const dm = d.team === 1 ? this.diff.tackle : 1;
    const chance = clamp((0.42 + d.attrs.reaction * 0.003 + d.attrs.positioning * 0.002 - a.attrs.dribble * 0.0042 - a.attrs.balance * 0.002 + (behind ? 0.12 : 0) + (slide ? 0.06 : 0)) * dm, 0.1, 0.85);
    this.h.sfx?.('tackle', 0.5);
    if (Math.random() < chance) {
      const b = this.ball;
      this.release(a); b.vx = Math.cos(d.face) * (120 + rand(0, 70)) + sym() * 40; b.vy = Math.sin(d.face) * (120 + rand(0, 70)) + sym() * 40; b.vz = 0;
      b.lastTouch = d; b.lastTeam = d.team; b.lastKick = 'tackle';
      a.noPick = this.time + 0.55; d.noPick = this.time;
      if (Math.random() < 0.4 - a.attrs.balance * 0.003) { a.setState('fall', 0.8); a.vx *= 0.2; a.vy *= 0.2; } else { a.setState('fall', 0.35); }
      if (d === this.hero) this.hs.tackles++;
      return true;
    }
    d.setState('fall', 0.5 - d.attrs.balance * 0.002);
    return false;
  }

  // ---------- eventos ----------
  onGoal(team) {
    if (this.state !== 'play') return;
    const b = this.ball, scorer = b.lastTouch, hero = this.hero;
    const before = [this.teams[0].score, this.teams[1].score];
    this.teams[team].score++;
    this.state = 'goal'; this.stateT = 0; this.rs = null;
    let assist = null;
    const own = scorer && scorer.team !== team;
    if (scorer && !own) {
      scorer.celebrate = 3;
      const pp = this.lastPass;
      if (pp && pp.ok && pp.team === team && pp.to === scorer && pp.from !== scorer && this.time - pp.completeT < 5) assist = pp.from;
      if (scorer === hero) {
        this.hs.goals++; if (b.shotFrom?.outside) this.hs.outGoals++;
        if (before[0] === before[1]) this.heroGoWinning = true;
      }
      if (assist === hero) this.hs.assists++;
    }
    if (team === 1 && this.teams[0].score === this.teams[1].score) this.heroGoWinning = false;
    if (team === 1 && this.lastHeroLoss && this.time - this.lastHeroLoss.t < 10 && !own) { this.hs.errors++; this.lastHeroLoss = null; }
    if (team === 0) this.counterGoalCheck();
    this.h.goal?.({ team, scorer, assist, own, minute: Math.floor(this.gameMin), heroScored: scorer === hero && !own, heroAssist: assist === hero });
    this.h.sfx?.('goal', 1);
  }
  counterGoalCheck() { /* el contraataque se registra al rematar */ }

  // ---------- bucle ----------
  update(dtRaw) {
    const dt = Math.min(dtRaw, 1 / 30);
    this.time += dt; this.stateT += dt;
    const st = this.state;
    if (st === 'intro') { if (this.stateT > 1.6) { this.state = 'restart'; this.stateT = 0; this.h.sfx?.('whistle', 1); } }
    if (st === 'half') { if (this.stateT > 2.6) { this.setupKickoff(1); } this.stepPlayers(dt); return; }
    if (st === 'end') { this.stepPlayers(dt, true); return; }
    if (this.state === 'goal') {
      if (this.stateT > 3.4) {
        if (this.ending) this.finish(); else this.setupKickoff(this.ball.goal === 1 ? 1 : 0);
        return;
      }
      this.heroInput(dt); this.ai.update(dt); this.updateBall(dt); this.stepPlayers(dt); return;
    }
    if (this.state === 'play') {
      this.gameMin += dt * this.minRate;
      if (this.possTeam !== null) this.possTime[this.possTeam] += dt;
      if (!this.halfDone && this.gameMin >= 45 && !this.cfg.tutorial) { this.halfDone = true; this.state = 'half'; this.stateT = 0; this.h.sfx?.('whistle', 1); this.h.banner?.('DESCANSO'); this.possTeam = null; return; }
      if (this.gameMin >= 90 && !this.cfg.tutorial) { this.ending = true; }
      if (this.ending) {
        this.endingT += dt;
        if (this.ball.owner || speedOf(this.ball) < 120 || this.endingT > 5) { this.finish(); return; }
      }
    }
    if (this.state === 'restart') {
      this.rs.t += dt;
      if (this.ending && this.rs.t > 0.4) { this.finish(); return; }
      this.restartTake(dt);
    }
    this.heroInput(dt);
    this.ai.update(dt);
    this.stepPlayers(dt);
    this.updateBall(dt);
    if (this.counter && this.time - this.counter.t > 12) this.counter = null;
  }

  restartTake(dt) {
    const rs = this.rs, tk = rs.taker;
    if (!tk || this.ball.owner !== tk) { this.state = 'play'; this.stateT = 0; this.rs = null; return; }
    if (tk.isHero) {
      if (rs.t > (rs.kind === 'kickoff' ? 6 : 4.5)) this.ai.autoKick(tk, rs.kind);
      return;
    }
    if (rs.t > rs.wait * (0.9 + this.diff.react * 0.2)) this.ai.autoKick(tk, rs.kind);
  }

  // ---------- héroe ----------
  heroInput(dt) {
    const h = this.hero, inp = this.input, st = this.state;
    const acts = inp.actions; inp.actions = [];
    const frozen = st === 'restart' && h === this.rs?.taker && this.rs.kind !== 'kickoff';
    const dead = st === 'goal' || st === 'half' || st === 'end' || st === 'intro';
    if (dead) { h.speedFrac = 0; h.wantX = h.wantY = 0; return; }
    h.callT = Math.max(0, (h.callT || 0) - dt);
    const mag = Math.min(1, Math.hypot(inp.mx, inp.my));
    h.wantX = h.wantY = 0; h.sprint = false;
    if (!h.busy && !frozen && mag > 0.12) {
      const nx = inp.mx / (mag || 1), ny = inp.my / (mag || 1);
      let frac = mag < 0.5 ? 0.5 : 1;
      if (mag >= 0.86 && h.stamina > 3) { h.sprint = true; frac = 1.3; }
      h.wantX = nx * h.runSpeed * frac; h.wantY = ny * h.runSpeed * frac;
      this.hs.moved += h.speed * dt;
      if (h.sprint) this.hs.sprintT += dt;
      if (st === 'restart' && this.rs.kind === 'kickoff' && h === this.rs.taker && h.speed > 40) { this.state = 'play'; this.stateT = 0; this.rs = null; }
    }
    if (h.sprint) h.stamina = Math.max(0, h.stamina - dt * 15 * (1.25 - h.attrs.stamina / 130)); else h.stamina = Math.min(100, h.stamina + dt * (mag > 0.12 ? 5 : 11) * (0.6 + h.attrs.stamina / 150));
    for (const a of acts) this.heroAct(a);
  }

  /** Objetivo de pase según el gesto: compañero cercano a la dirección + potencia = distancia. */
  passTargetFor(dx, dy, power) {
    const h = this.hero, n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, want = 90 + power * 400;
    let best = null, bs = 9;
    for (const t of this.teams[0].players) {
      if (t === h) continue;
      const vx = t.x - h.x, vy = t.y - h.y, d = Math.hypot(vx, vy) || 1;
      const ang = Math.acos(clamp((vx * ux + vy * uy) / d, -1, 1)) * 180 / Math.PI;
      if (ang > 24) continue;
      const s = ang / 24 + 0.45 * Math.abs(d - want) / want;
      if (s < bs) { bs = s; best = t; }
    }
    const through = !!best && power > 0.78 && (best.y - h.y) < -30;
    return { target: best, through };
  }

  canStrike() {
    const h = this.hero, b = this.ball;
    if (b.owner === h) return 'own';
    if (h.busy) return null;
    if (!b.owner && b.z < 56 && dist(h.x, h.y, b.x, b.y) < 36 && h.noPick <= this.time) return b.z > 26 ? 'head' : 'first';
    return null;
  }

  heroAct(a) {
    const h = this.hero, b = this.ball, st = this.state;
    if (st !== 'play' && st !== 'restart') return;
    if (a.type === 'call') { h.callT = 2.2; this.h.toast?.('¡Pide el balón!', 'info'); return; }
    if (a.type === 'press') { const tm = this.teams[0]; if (tm.pressCD <= 0) { tm.press = 5; tm.pressCD = 9; this.h.toast?.('¡Presión!', 'info'); } return; }
    if (a.type === 'tackle') {
      if (h.tackleCD > 0 || h.busy || st !== 'play') return;
      const c = b.owner && b.owner.team === 1 ? b.owner : null;
      if (c && dist(h.x, h.y, c.x, c.y) < 48) { this.tackle(h, c, true); }
      else {
        h.tackleCD = 0.8; h.setState('slide', 0.35); h.vx = h.dirX * 220; h.vy = h.dirY * 220;
        if (!b.owner && dist(h.x, h.y, b.x, b.y) < 46) { h.noPick = 0; this.give(h); }
      }
      return;
    }
    const mode = this.canStrike();
    if (!mode) { this.h.denied?.(a.type); return; }
    const first = mode === 'first', header = mode === 'head';
    if (st === 'restart' && h !== this.rs?.taker) return;
    const dx = a.dx, dy = a.dy;
    if (a.type === 'pass') {
      let tg, o = { first, lob: !!a.lob };
      if (a.tap) { tg = this.ai.bestPassTarget(h, true); o.lob = o.lob || (tg && dist(h.x, h.y, tg.x, tg.y) > 380); this.pass(h, tg, tg ? tg.x - h.x : 0, tg ? tg.y - h.y : -1, 0.5, o); return; }
      const r = this.passTargetFor(dx, dy, a.power);
      o.through = r.through;
      if (header) { o.lob = true; }
      this.pass(h, r.target, dx, dy, a.power, o);
    } else if (a.type === 'shot') {
      let ax = dx, ay = dy, pw = a.power;
      if (a.tap) { const gy = goalY(0); const gk = this.teams[1].players[0]; const tx = W / 2 + (gk.x < W / 2 ? 1 : -1) * 38; ax = tx - h.x; ay = gy - h.y; pw = 0.7; }
      this.shoot(h, ax, ay, pw, { lob: !!a.lob, first, header });
    }
  }

  // ---------- movimiento de jugadores ----------
  stepPlayers(dt, still = false) {
    const ps = this.players;
    for (const p of ps) {
      p.tackleCD = Math.max(0, p.tackleCD - dt); p.kickT = Math.max(0, p.kickT - dt); p.celebrate = Math.max(0, p.celebrate - dt);
      if (p.stateT > 0) { p.stateT -= dt; if (p.stateT <= 0) { if (p.state === 'fall') p.setState('getup', 0.4); else if (p.state !== 'idle') p.setState('idle'); } }
      let wx = p.wantX || 0, wy = p.wantY || 0;
      if (still || p.down || p.state === 'dive') { wx = wy = 0; }
      if (p.state === 'slide' || p.state === 'dive') { const f = Math.exp(-4 * dt); p.vx *= f; p.vy *= f; }
      else {
        const dvx = wx - p.vx, dvy = wy - p.vy, dl = Math.hypot(dvx, dvy), maxd = p.accel * dt * (wx || wy ? 1 : 1.6);
        if (dl > maxd) { p.vx += dvx / dl * maxd; p.vy += dvy / dl * maxd; } else { p.vx = wx; p.vy = wy; }
      }
      if (p.down) { const f = Math.exp(-5 * dt); p.vx *= f; p.vy *= f; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, 3, W - 3); p.y = clamp(p.y, 6, L - 6);
      const sp = p.speed;
      if (sp > 18 && !p.down && p.state !== 'dive') {
        const ta = Math.atan2(p.vy, p.vx), turn = (8 + p.attrs.accel * 0.08) * dt, df = angleDiff(p.face, ta);
        p.face += clamp(df, -turn, turn);
      } else if (p.faceTo != null && !p.down) {
        const df = angleDiff(p.face, p.faceTo); p.face += clamp(df, -6 * dt, 6 * dt);
      }
      p.animT += dt * (sp / 18 + 0.0);
      if (p.jumpT > 0) p.jumpT -= dt;
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], c = ps[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
      if (d < 17 && d > 0.01) {
        const push = (17 - d) / 2, nx = dx / d, ny = dy / d;
        const wa = a.down ? 0.2 : a.isHero ? 0.6 + a.attrs.balance / 300 : 1, wc = c.down ? 0.2 : c.isHero ? 0.6 + c.attrs.balance / 300 : 1, s = wa + wc;
        a.x -= nx * push * 2 * wc / s; a.y -= ny * push * 2 * wc / s; c.x += nx * push * 2 * wa / s; c.y += ny * push * 2 * wa / s;
      }
    }
    for (const t of this.teams) { t.press = Math.max(0, t.press - dt); t.pressCD = Math.max(0, t.pressCD - dt); }
  }

  // ---------- balón ----------
  updateBall(dt) {
    const b = this.ball;
    if (b.owner) { this.driveBall(dt); return; }
    const n = 2;
    for (let i = 0; i < n; i++) {
      stepBall(b, dt / n, this.ev);
      if (this.state === 'goal') continue;
      this.ballContacts();
      if (b.owner) return;
    }
  }

  driveBall(dt) {
    const b = this.ball, o = b.owner;
    if (o.down && o.state === 'fall') { this.release(o); return; }
    const sprintF = clamp((o.speed / o.runSpeed - 1) / 0.3, 0, 1);
    const off = 13 + (5 + 14 * sprintF) * (1.15 - o.attrs.control / 150) * (0.5 + 0.5 * Math.sin(o.animT * 1.1));
    let tx = o.x + Math.cos(o.face) * off, ty = o.y + Math.sin(o.face) * off;
    const k = Math.min(1, dt * 14);
    b.px = b.x; b.py = b.y;
    b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
    b.x = clamp(b.x, 2, W - 2); b.y = clamp(b.y, 2, L - 2);
    b.vx = o.vx; b.vy = o.vy; b.z = 0; b.vz = 0; b.roll += o.speed * dt * 0.1; b.inNet = false;
  }

  ballContacts() {
    const b = this.ball, sp = speedOf(b);
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.down || p.noPick > this.time || p.state === 'slide' && p.stateT < 0.1) continue;
      const d = dist(p.x, p.y, b.x, b.y);
      if (p.role === 'GK' && this.keeperTry(p, d, sp)) return;
      const r = p.reach();
      if (b.z > 58) continue;
      if (b.z > 26) { this.tryHeader(p, d); if (!b.owner && b.vz !== 0 && this.time < p.noPick) return; continue; }
      if (d >= r) continue;
      const rel = Math.hypot(b.vx - p.vx, b.vy - p.vy), lim = 250 + p.attrs.control * 2.3 + p.attrs.reaction * 1.1;
      if (rel < lim) { const s = d - p.attrs.control * 0.03 + Math.random() * 3; if (s < bd) { bd = s; best = p; } }
      else if (d < r * 0.8 && sp > 150) this.deflect(p);
    }
    if (best) this.give(best);
  }

  deflect(p) {
    const b = this.ball, dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; b.vx *= 0.75; b.vy *= 0.75; b.vx += sym() * 40; b.vy += sym() * 40; b.vz = Math.max(b.vz, 40);
    b.lastTouch = p; b.lastTeam = p.team; b.lastKick = 'block'; b.shot = false; p.noPick = this.time + 0.25;
    if (this.lastPass && !this.lastPass.done && p.team !== this.lastPass.team) { this.lastPass.done = true; }
    this.h.sfx?.('block', 0.6);
  }

  tryHeader(p, d) {
    if (p.isHero || d > 22 || p.noPick > this.time || p.state === 'dive') return;
    const b = this.ball;
    if (p.role === 'GK') return;
    if (p.headId === b.kickId) return; // una sola oportunidad por balón aéreo
    p.headId = b.kickId;
    const lp = this.lastPass;
    if (lp && !lp.done && lp.target === p) return; // el receptor espera a que baje
    if (Math.random() > 0.3 + p.attrs.reaction * 0.004) return;
    p.jumpT = 0.5; p.faceTo = null;
    const gy = goalY(p.team), dg = dist(p.x, p.y, W / 2, gy);
    p.noPick = this.time + 0.5;
    if (dg < 220 && p.role !== 'DEF') this.shoot(p, W / 2 + sym() * 40 - p.x, gy - p.y, 0.7, { header: true });
    else { const tgt = this.ai.bestPassTarget(p, false); this.pass(p, tgt, 0, p.team === 0 ? -1 : 1, 0.6, { lob: true, first: true }); }
  }

  keeperTry(gk, d, sp) {
    const b = this.ball;
    if (b.z > 64 || b.inNet) return false;
    const diving = gk.state === 'dive';
    const rx = 21 + (diving ? 30 : 0), ry = 20 + (diving ? 8 : 0);
    if (Math.abs(b.x - gk.x) > rx || Math.abs(b.y - gk.y) > ry) return false;
    const gm = gk.team === 1 ? this.diff.gk : 1;
    const lim = (300 + gk.attrs.reaction * 3.4 + gk.attrs.control * 1.2) * gm * (diving ? 0.85 : 1);
    if (b.shot && b.shotTeam !== gk.team) this.teams[gk.team].saves = (this.teams[gk.team].saves || 0) + 1;
    gk.kickT = 0; gk.holdT = 0;
    if (sp < lim) {
      this.give(gk);
      if (b.lastKick === 'shot' || sp > 250) { this.h.sfx?.('save', 1); this.h.toast?.(gk.team === 1 ? 'Parada del portero' : '¡Paradón!', 'info'); }
      return true;
    }
    // despeje / rechace
    const out = gk.team === 0 ? -1 : 1, ang = (out > 0 ? Math.PI / 2 : -Math.PI / 2) + sym() * 1.0;
    const nsp = sp * 0.42 + 90;
    b.vx = Math.cos(ang) * nsp + (b.x - gk.x) * 3; b.vy = Math.sin(ang) * nsp; b.vz = 70 + rand(0, 80);
    b.lastTouch = gk; b.lastTeam = gk.team; b.lastKick = 'save'; b.shot = false; gk.noPick = this.time + 0.45;
    this.h.sfx?.('save', 1); this.h.toast?.('¡Paradón!', 'info'); this.h.shake?.(0.006);
    return true;
  }

  // ---------- final ----------
  finish() {
    if (this.state === 'end') return;
    this.state = 'end'; this.h.sfx?.('whistle', 1);
    this.h.end?.(this.summary());
  }

  summary() {
    const t0 = this.teams[0].score, t1 = this.teams[1].score, result = t0 > t1 ? 'W' : t0 < t1 ? 'L' : 'D';
    const hs = this.hs, role = POSITIONS[this.cfg.hero.pos].role;
    const s = { ...hs, conceded: t1 - this.startAway, result, winnerGoal: result === 'W' && this.heroGoWinning ? 1 : 0, rating: 6 };
    if (role !== 'DEF') { /* conceded sólo penaliza a defensas */ }
    let rr = computeRating(s, { main: 0, sec: 0 }, role);
    s.rating = rr.rating;
    const objs = this.cfg.objectives.map((o) => evalObjective(o, s));
    const main = objs.filter((o) => o.main && o.done).length, sec = objs.filter((o) => !o.main && o.done).length;
    rr = computeRating(s, { main, sec }, role);
    s.rating = rr.rating;
    const objs2 = this.cfg.objectives.map((o) => evalObjective(o, s));
    let objXp = 0, objCoins = 0;
    for (const o of objs2) if (o.done) { objXp += o.xp; objCoins += o.coins; }
    const tot = this.possTime[0] + this.possTime[1] || 1;
    return {
      scoreFor: t0, scoreAgainst: t1, result, rating: s.rating, good: rr.good, bad: rr.bad, objectives: objs2, objXp, objCoins,
      hero: hs, teamStats: { shots: [this.teams[0].shots, this.teams[1].shots], onTarget: [this.teams[0].onTarget, this.teams[1].onTarget], passes: [this.teams[0].passes, this.teams[1].passes], passesOk: [this.teams[0].passesOk, this.teams[1].passesOk], poss: [Math.round(this.possTime[0] / tot * 100), Math.round(this.possTime[1] / tot * 100)] },
      goals: hs.goals, assists: hs.assists, passes: hs.passes, passesOk: hs.passesOk, chances: hs.chances, scenario: this.sc.id,
    };
  }

  liveStats() {
    const s = { ...this.hs, conceded: this.teams[1].score - this.startAway, result: this.teams[0].score > this.teams[1].score ? 'W' : 'L', winnerGoal: this.teams[0].score > this.teams[1].score && this.heroGoWinning ? 1 : 0, rating: 6 };
    return s;
  }
}

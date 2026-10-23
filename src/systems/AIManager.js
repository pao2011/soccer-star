import { PITCH, adv, goalY, ownGoalY } from '../config.js';
import { predict, speedOf } from './BallPhysics.js';
import { clamp, rand, sym, dist } from '../util.js';

const { W, L, GW, PA_W, PA_D } = PITCH;

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

export class AIManager {
  constructor(m) {
    this.m = m; this.path = []; this.chaser = [null, null]; this.chasePt = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.markT = 0; this.tmp = { x: 0, y: 0 }; this.pressers = [[], []]; this.bestScore = 0;
  }

  update(dt) {
    const m = this.m;
    predict(m.ball, this.path);
    this.computeChasers();
    this.markT -= dt;
    if (this.markT <= 0) { this.markT = 0.4; this.computeMarks(); }
    for (const p of m.players) if (!p.isHero) this.think(p, dt);
  }

  // ---- análisis de equipo ----
  computeChasers() {
    const m = this.m, lp = m.lastPass;
    for (const t of [0, 1]) {
      let best = null, bt = 1e9, bp = null;
      const spd = (p) => p.runSpeed * 1.15 * (t === 1 ? m.diff.speed : 1);
      for (const p of m.teams[t].players) {
        if (p.isHero || p.role === 'GK' || p.down) continue;
        for (let i = 0; i < this.path.length; i++) {
          const q = this.path[i];
          if (q.z > 34 && i < this.path.length - 1) continue;
          const T = Math.max(q.t, dist(p.x, p.y, q.x, q.y) / spd(p));
          if (T < bt) { bt = T; best = p; bp = q; }
        }
      }
      if (lp && !lp.done && lp.team === t && lp.target && !m.ball.owner) { best = lp.target.isHero ? null : lp.target; }
      this.chaser[t] = best;
      if (bp) { this.chasePt[t].x = bp.x; this.chasePt[t].y = bp.y; }
    }
  }

  computeMarks() {
    const m = this.m, c = m.ball.owner;
    this.pressers[0].length = this.pressers[1].length = 0;
    if (!c) return;
    const t = 1 - c.team, team = m.teams[t];
    const outfield = team.players.filter((p) => p.role !== 'GK' && !p.down);
    const sorted = outfield.slice().sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y));
    const k = team.press > 0 ? 2 : 1;
    for (let i = 0; i < k && i < sorted.length; i++) this.pressers[t].push(sorted[i]);
    const attackers = m.teams[c.team].players.filter((o) => o !== c && o.role !== 'GK');
    const used = new Set();
    for (const p of outfield) {
      p.mark = null;
      if (this.pressers[t].includes(p)) continue;
      let best = null, bd = 1e9;
      for (const o of attackers) { if (used.has(o)) continue; const d = dist(p.x, p.y, o.x, o.y) + (p.role === 'DEF' ? (adv(t, o.y) > 0.6 ? 0 : 120) : 0); if (d < bd) { bd = d; best = o; } }
      if (best) { used.add(best); p.mark = best; }
    }
  }

  // ---- movimiento ----
  goTo(p, x, y, frac) {
    const m = this.m, dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < 3) { p.wantX = p.wantY = 0; p.sprint = false; p.faceTo = Math.atan2(m.ball.y - p.y, m.ball.x - p.x); return; }
    let sp = p.runSpeed * frac * (p.team === 1 ? m.diff.speed : 1);
    if (d < 26) sp *= Math.max(0.3, d / 26);
    p.wantX = dx / d * sp; p.wantY = dy / d * sp; p.sprint = frac > 1.05; p.faceTo = null;
  }

  think(p, dt) {
    const m = this.m, st = m.state, b = m.ball;
    if (p.down || p.state === 'slide' || p.state === 'dive') { p.wantX = p.wantY = 0; return; }
    if (p.celebrate > 0) { p.wantX = p.wantY = 0; return; }
    if (p.hesitate > 0) { p.hesitate -= dt; p.wantX = p.wantY = 0; return; }
    if (st === 'intro' || st === 'half' || st === 'end') { p.wantX = p.wantY = 0; return; }
    if (st === 'goal') { m.formationPos(p, this.tmp); this.goTo(p, this.tmp.x, this.tmp.y, 0.9); return; }
    if (st === 'restart') { this.restartMove(p); return; }
    if (m.cfg.passive && p.team === 1 && p.role !== 'GK') { m.formationPos(p, this.tmp); this.goTo(p, this.tmp.x, this.tmp.y, 0.6); return; }
    if (p.role === 'GK') return this.gk(p, dt);
    if (b.owner === p) return this.withBall(p, dt);
    if (b.owner && b.owner.team === p.team) return this.support(p, dt);
    if (b.owner) return this.defend(p, dt);
    return this.loose(p, dt);
  }

  restartMove(p) {
    const m = this.m, rs = m.rs;
    if (p === rs.taker) { p.wantX = p.wantY = 0; return; }
    m.formationPos(p, this.tmp);
    let { x, y } = this.tmp;
    if (rs.kind === 'kickoff') {
      y = p.team === 0 ? Math.max(y, L / 2 + 8) : Math.min(y, L / 2 - 8);
      if (p.team !== rs.team && Math.hypot(x - W / 2, y - L / 2) < 85) y = L / 2 + (p.team === 0 ? 85 : -85);
    } else if (rs.kind === 'corner' && p.role !== 'GK') {
      const gy = rs.y < L / 2 ? 0 : L, inw = gy === 0 ? 1 : -1;
      const spots = [-45, 0, 45, -15, 25, 60];
      if (p.team === rs.team) { x = W / 2 + spots[p.slot % 6]; y = gy + inw * (50 + (p.slot % 3) * 18); }
      else { x = W / 2 + spots[(p.slot + 2) % 6] * 0.8; y = gy + inw * (34 + (p.slot % 3) * 16); }
    }
    this.goTo(p, x, y, 1.1);
  }

  autoKick(tk, kind) {
    const m = this.m, team = tk.team, fwd = team === 0 ? -1 : 1;
    if (kind === 'corner') {
      const gy = goalY(team), t = { x: W / 2 + sym() * 50, y: gy - fwd * (38 + rand(0, 30)), vx: 0, vy: 0 };
      m.pass(tk, t, 0, 0, 0.7, { lob: true });
      return;
    }
    if (kind === 'goalkick' || tk.role === 'GK') return this.distribute(tk);
    const best = this.bestPassTarget(tk, false);
    m.pass(tk, best, best ? best.x - tk.x : 0, fwd, 0.4, { lob: kind === 'throw' });
  }

  distribute(p) {
    const m = this.m, fwd = p.team === 0 ? -1 : 1, best = this.bestPassTarget(p, false);
    if (best && this.bestScore > 0.2) m.pass(p, best, 0, 0, 0.6, { lob: dist(p.x, p.y, best.x, best.y) > 330 });
    else m.pass(p, { x: W / 2 + sym() * 120, y: p.y + fwd * 360, vx: 0, vy: 0 }, 0, 0, 0.8, { lob: true, clear: true });
  }

  // ---- decisión de pase ----
  scorePass(p, t) {
    const m = this.m, d = dist(p.x, p.y, t.x, t.y);
    if (d < 40 || d > 520 || t.down) return -9;
    let blocked = 0, nearest = 200;
    for (const o of m.teams[1 - p.team].players) {
      const sd = segDist(o.x, o.y, p.x, p.y, t.x, t.y);
      if (sd < 26 && o.role !== 'GK') blocked = 1;
      const dd = dist(o.x, o.y, t.x, t.y); if (dd < nearest) nearest = dd;
    }
    const open = clamp(nearest / 90, 0, 1), fwd = adv(p.team, t.y) - adv(p.team, p.y);
    let s = 0.45 * open + 0.35 * clamp(fwd * 3 + 0.15, -0.5, 1) + 0.12 * (1 - clamp(Math.abs(d - 200) / 300, 0, 1)) - (d > 300 ? (d - 300) / 300 : 0) - blocked * (d > 300 ? 0.35 : 0.6);
    if (t.isHero) s += 0.1 + (t.callT > 0 ? 0.4 : 0);
    if (t.role === 'GK') s -= 0.6;
    return s;
  }

  bestPassTarget(p) {
    let best = null, bs = -9;
    for (const t of this.m.teams[p.team].players) {
      if (t === p) continue;
      const s = this.scorePass(p, t);
      if (s > bs) { bs = s; best = t; }
    }
    this.bestScore = bs;
    return best;
  }

  // ---- roles ----
  withBall(p, dt) {
    const m = this.m, team = p.team, gy = goalY(team), held = m.time - p.ownedAt, fwd = team === 0 ? -1 : 1;
    p.thinkT -= dt;
    if (p.thinkT <= 0) {
      p.thinkT = rand(0.18, 0.34) * (team === 1 ? m.diff.react : 1);
      const dg = dist(p.x, p.y, W / 2, gy), press = m.pressure(p);
      let acted = false;
      if (held > 0.35) {
        const range = p.role === 'FWD' ? 270 : p.role === 'MID' ? 210 : 110;
        const gk = m.teams[1 - team].players[0];
        if (dg < range && m.time > (p.shotCD || 0)) {
          let blocked = false;
          for (const o of m.teams[1 - team].players) if (o.role !== 'GK' && segDist(o.x, o.y, p.x, p.y, W / 2, gy) < 20) blocked = true;
          const ch = (1 - dg / range) * 0.5 + 0.12 - (blocked ? 0.25 : 0) + press * 0.1;
          p.shotCD = m.time + 1.2;
          if (Math.random() < ch) {
            const side = gk.x < W / 2 ? 1 : -1, tx = W / 2 + side * rand(18, GW / 2 - 12);
            m.shoot(p, tx - p.x, gy - p.y, dg < 130 ? rand(0.3, 0.42) : rand(0.7, 1), {});
            acted = true;
          }
        }
        if (!acted && p.role === 'DEF' && adv(team, p.y) < 0.3 && press > 0.35) {
          m.pass(p, { x: clamp(p.x + sym() * 160, 40, W - 40), y: p.y + fwd * 330, vx: 0, vy: 0 }, 0, 0, 0.8, { lob: true, sloppy: 1.3, clear: true });
          acted = true;
        }
        if (!acted) {
          const best = this.bestPassTarget(p), thr = 0.5 - press * 0.3 + (held > 2.2 ? 0.25 : 0);
          if (best && this.bestScore > thr) {
            m.pass(p, best, 0, 0, 0.5, { lob: false, through: best.role === 'FWD' && fwd * (best.y - p.y) > 80 && Math.random() < 0.3 });
            acted = true;
          }
        }
      }
      if (!acted) {
        let dx = W / 2 - p.x, dy = gy - p.y;
        const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
        const near = m.nearestOpp(p, 70);
        if (near) { const ax = p.x - near.o.x, ay = p.y - near.o.y, an = Math.hypot(ax, ay) || 1; dx += ax / an * 1.1; dy += ay / an * 0.5; }
        if (p.x < 40) dx += 0.6; if (p.x > W - 40) dx -= 0.6;
        const dn = Math.hypot(dx, dy) || 1;
        p.plan = { dx: dx / dn, dy: dy / dn, frac: !near && dg > 200 ? 1.2 : 1 };
      }
    }
    const pl = p.plan;
    if (pl) { const sp = p.runSpeed * pl.frac * (team === 1 ? m.diff.speed : 1); p.wantX = pl.dx * sp; p.wantY = pl.dy * sp; p.sprint = pl.frac > 1.05; p.faceTo = null; }
  }

  support(p, dt) {
    const m = this.m, team = p.team, c = m.ball.owner;
    p.runT -= dt;
    if (p.runT <= 0) {
      p.runT = rand(0.45, 0.8);
      m.formationPos(p, this.tmp);
      let bx = this.tmp.x, by = this.tmp.y;
      const push = p.role === 'FWD' ? 0.14 : p.role === 'MID' ? 0.08 : 0.02;
      by += (team === 0 ? -1 : 1) * L * push;
      let best = null, bs = -9;
      for (let k = -1; k < 6; k++) {
        const a = k * Math.PI / 3, r = k < 0 ? 0 : 60;
        const x = clamp(bx + Math.cos(a) * r, 30, W - 30), y = clamp(by + Math.sin(a) * r, 30, L - 30);
        let near = 200, blocked = 0;
        for (const o of m.teams[1 - team].players) { const d = dist(o.x, o.y, x, y); if (d < near) near = d; if (o.role !== 'GK' && segDist(o.x, o.y, c.x, c.y, x, y) < 22) blocked = 1; }
        let crowd = 0;
        for (const tm of m.teams[team].players) if (tm !== p && dist(tm.x, tm.y, x, y) < 50) crowd += 0.5;
        const dc = dist(c.x, c.y, x, y);
        const s = clamp(near / 90, 0, 1) * 0.5 + adv(team, y) * 0.4 - crowd - blocked * 0.5 - (dc < 70 ? 0.4 : dc > 320 ? 0.3 : 0) - k * 0.001 + (k < 0 ? 0.05 : 0);
        if (s > bs) { bs = s; best = { x, y }; }
      }
      p.runX = best.x; p.runY = best.y;
    }
    this.goTo(p, p.runX, p.runY, 1.0);
  }

  defend(p, dt) {
    const m = this.m, c = m.ball.owner, t = p.team, own = ownGoalY(t);
    if (this.pressers[t].includes(p)) {
      const lx = c.x + c.vx * 0.25, ly = c.y + c.vy * 0.25;
      this.goTo(p, lx, ly, 1.15);
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < 26 && p.tackleCD <= 0 && m.time - c.ownedAt > 0.45 && !c.down) {
        const rate = (0.9 + (m.teams[t].press > 0 ? 0.8 : 0)) * (t === 1 ? m.diff.tackle : 1);
        if (Math.random() < rate * dt) {
          if (Math.random() < 0.05 * (t === 1 ? m.diff.react : 1)) { p.hesitate = 0.5; return; }
          m.tackle(p, c, false);
        }
      }
      return;
    }
    let tx, ty;
    if (p.mark) {
      const o = p.mark;
      const gx = W / 2 - o.x, gdy = own - o.y, n = Math.hypot(gx, gdy) || 1;
      tx = o.x + gx / n * 26 + (c.x - o.x) * 0.08; ty = o.y + gdy / n * 26 + (c.y - o.y) * 0.08;
      if (p.role === 'DEF') { const lim = t === 0 ? L - 70 : 70; ty = t === 0 ? Math.min(ty, lim) : Math.max(ty, lim); }
    } else { m.formationPos(p, this.tmp); tx = this.tmp.x; ty = this.tmp.y; }
    this.goTo(p, tx, ty, 1.0);
  }

  loose(p, dt) {
    const m = this.m, t = p.team;
    if (this.chaser[t] === p) { const q = this.chasePt[t]; this.goTo(p, q.x, q.y, 1.25); return; }
    m.formationPos(p, this.tmp);
    this.goTo(p, this.tmp.x, this.tmp.y, 1.0);
  }

  gk(p, dt) {
    const m = this.m, b = m.ball, t = p.team, gy = ownGoalY(t);
    if (b.owner === p) {
      p.holdT += dt; p.wantX = p.wantY = 0;
      if (p.holdT > 0.9 + Math.random() * 0.5) { p.holdT = 0; this.distribute(p); }
      return;
    }
    p.holdT = 0;
    const sp = speedOf(b);
    const toward = (gy - b.y) * (b.vy) > 0 && sp > 160;
    if (b.shot && b.shotTeam !== t && toward) {
      const tt = (gy - b.y) / b.vy;
      if (tt > 0.05 && tt < 1.5) {
        const px = b.x + b.vx * tt * 0.9;
        if (Math.abs(px - W / 2) < GW / 2 + 36) {
          p.gkReact += dt;
          const gm = t === 1 ? m.diff.gk : 1, react = (0.12 + (100 - p.attrs.reaction) * 0.0024) / gm * (t === 1 ? m.diff.react : 1);
          if (p.gkReact >= react) {
            const err = (66 - p.attrs.reaction * 0.5) / gm, tx = px + sym() * err, dx = tx - p.x;
            if (Math.abs(dx) < 8) { p.wantX = 0; return; }
            p.vx = clamp(dx / Math.max(tt * 0.8, 0.2), -400, 400); p.vy = (b.y - p.y) / Math.max(tt, 0.25) * 0.3;
            p.setState('dive', 0.6); p.diveDir = Math.sign(dx); p.gkReact = 0;
            p.wantX = p.wantY = 0;
          } else { p.wantX = p.wantY = 0; }
          return;
        }
      }
    } else p.gkReact = 0;
    const inArea = Math.abs(b.x - W / 2) < PA_W / 2 && Math.abs(b.y - gy) < PA_D;
    if (!b.owner && inArea && sp < 280 && b.z < 30) {
      let mine = dist(p.x, p.y, b.x, b.y), nearer = false;
      for (const o of m.players) if (o !== p && !o.down && dist(o.x, o.y, b.x, b.y) < mine - 6) nearer = true;
      if (!nearer) { this.goTo(p, b.x, b.y, 1.2); return; }
    }
    const gx = W / 2, vx = b.x - gx, vy = b.y - gy, d = Math.hypot(vx, vy) || 1;
    const depth = clamp(d * 0.1, 14, 46);
    const tx = clamp(gx + vx / d * depth, W / 2 - GW / 2 + 8, W / 2 + GW / 2 - 8), ty = gy + vy / d * depth;
    this.goTo(p, tx, ty, 1.0);
  }
}

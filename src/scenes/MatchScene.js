import Phaser from 'phaser';
import { Cam } from '../render/Camera.js';
import { Stage3D } from '../render/Stage3D.js';
import { MatchManager } from '../systems/MatchManager.js';
import { evalObjective } from '../data.js';
import { clamp } from '../util.js';

const TUT = [
  { t: 'Mueve el joystick (izquierda) para correr con el balón', ok: (h) => h.moved > 140 },
  { t: 'Empuja el joystick hasta el borde para ESPRINTAR', ok: (h) => h.sprintT > 1.2 },
  { t: 'Arrastra desde PASE hacia un compañero y suelta', ok: (h) => h.passes >= 1 },
  { t: 'Pulsa PEDIR para reclamar el balón', ok: (h) => h.calls >= 1 },
  { t: 'Con el balón, arrastra desde TIRO hacia la portería', ok: (h) => h.shots >= 1 },
  { t: '¡Marca un gol! Elige tu mejor remate', ok: (h) => h.goals >= 1 },
  { t: 'Sin balón: acércate al rival y pulsa ENTRADA', ok: (h) => h.tackles >= 1 },
];

export class MatchScene extends Phaser.Scene {
  constructor() { super('Match'); }

  init(data) { this.data0 = data; }

  create() {
    const d = this.data0, ui = d.ui;
    this.ui = ui; this.paused = false; this.ended = false; this.acc = 0; this.frame = 0; this.tutStep = 0;
    this.cam = new Cam();
    this.cam.resize(window.innerWidth, window.innerHeight);
    const s = d.settings;
    this.stage = new Stage3D(document.getElementById('game'));
    this.stage.low = s.reduceFx; this.stage.resize(window.innerWidth, window.innerHeight);
    const A = ui.audio;
    const hooks = {
      sfx: (n, v) => A.sfx(n, v),
      toast: (t, k) => ui.hud.toast(t, k),
      banner: (t) => ui.hud.banner(t),
      goal: (g) => this.onGoal(g),
      end: (r) => { this.ended = true; A.stopAmbience(); this.game.events.emit('match-end', r); },
      restart: (k, team) => { if (k === 'corner') ui.hud.banner('SAQUE DE ESQUINA'); else if (k === 'goalkick') ui.hud.banner('SAQUE DE PUERTA'); else if (k === 'throw') ui.hud.banner('SAQUE DE BANDA'); },
      shake: (i) => { if (!s.reduceFx) this.stage.shake(i); },
      passMade: () => {}, shotMade: () => {},
      denied: () => ui.hud.toast('Necesitas estar cerca del balón', 'bad'),
    };
    this.m = new MatchManager(d.cfg, hooks);
    this.m.hs.calls = 0;
    this.stage.setup(this.m);
    this.cam.snap(this.m);
    this.ctl = ui.controls; this.ctl.reset(); this.ctl.enabled = true;
    this.ctl.onAction = (a) => {
      if (this.paused || this.ended) return;
      if (a.type === 'call') this.m.hs.calls++;
      this.m.input.actions.push(this.toWorld(a));
    };
    ui.hud.setup(d.cfg);
    A.startAmbience();
    this.onResize = () => { this.cam.resize(window.innerWidth, window.innerHeight); this.stage.resize(window.innerWidth, window.innerHeight); };
    window.addEventListener('resize', this.onResize);
    this.events.once('shutdown', () => { window.removeEventListener('resize', this.onResize); this.stage.dispose(); A.stopAmbience(); });
    ui.hud.banner(d.cfg.tutorial ? 'TUTORIAL' : d.cfg.home.short + ' vs ' + d.cfg.away.short, d.cfg.tutorial ? 'Aprende los controles' : d.cfg.scenarioName, 'intro');
    if (d.cfg.tutorial) this.showTut();
  }

  toWorld(a) { return a; }

  onGoal(g) {
    const ui = this.ui, m = this.m;
    ui.hud.banner(g.team === 0 ? '¡GOOOL!' : 'GOL RIVAL', g.scorer ? `${g.minute}' ${g.own ? 'En propia puerta' : g.heroScored ? 'Anotado por ti' : g.assist === m.hero ? 'Tu asistencia' : '#' + g.scorer.number}` : '', g.team === 0 ? 'goal' : 'bad');
    this.stage.burst(g.scorer ? g.scorer.x : 300, g.scorer ? g.scorer.y : 450, g.team === 0 ? 70 : 20);
    this.ui.audio.excite(1); this.excite = 1;
    if (g.heroScored) ui.hud.toast('¡Gol tuyo!', 'good');
    if (g.heroAssist) ui.hud.toast('¡Asistencia!', 'good');
    for (const p of g.team === 0 ? m.teams[0].players : []) if (p !== g.scorer) p.celebrate = 1.6;
  }

  showTut() {
    const s = TUT[this.tutStep];
    if (s) this.ui.hud.tutorial(s.t, this.tutStep + 1, TUT.length);
  }

  pause(v) { this.paused = v; if (v) { this.ctl.reset(); this.ui.audio.suspend(); } else this.ui.audio.resume(); }

  /** Datos del gesto en curso (o null) para dibujar la trayectoria en 3D. */
  hintFor() {
    const c = this.ctl, m = this.m, a = c.aim;
    c.hint = null;
    if (!a || a.len < 16) return null;
    const h = m.hero, n = Math.hypot(a.dx, a.dy) || 1, ux = a.dx / n, uy = a.dy / n;
    const color = a.kind === 'pass' ? 0x9bff9b : a.power > 0.8 ? 0xff3b30 : a.power < 0.45 ? 0x4cc9f0 : 0xffb703;
    let txt, tx, ty, target = null;
    if (a.kind === 'pass') {
      const r = m.passTargetFor(a.dx, a.dy, a.power);
      target = r.target;
      txt = (c.lob ? 'PASE ALTO' : r.through ? 'PASE FILTRADO' : a.power < 0.4 ? 'PASE CORTO' : 'PASE LARGO');
      if (target) { tx = target.x; ty = target.y; } else { tx = h.x + ux * (90 + a.power * 400); ty = h.y + uy * (90 + a.power * 400); }
    } else {
      const L = 120 + a.power * 480; tx = h.x + ux * L; ty = h.y + uy * L;
      txt = c.lob ? 'TIRO ELEVADO' : a.power < 0.45 ? 'TIRO COLOCADO' : a.power > 0.8 ? 'TIRO POTENTE' : 'TIRO';
    }
    c.hint = { target, color };
    return { x1: h.x, y1: h.y, x2: tx, y2: ty, color, txt, power: a.power, target };
  }

  update(time, delta) {
    if (this.paused || this.ended) { return; }
    const s = this.data0.settings;
    this.acc += delta;
    if (s.fps === 30 && this.acc < 31) return;
    const dt = Math.min(this.acc, 50) / 1000; this.acc = 0;
    const m = this.m, ctl = this.ctl;
    m.input.mx = ctl.mx; m.input.my = ctl.my;
    // contexto de botones
    const h = m.hero, b = m.ball;
    const near = (!b.owner && Math.hypot(h.x - b.x, h.y - b.y) < 44 && b.z < 58) || b.owner === h;
    ctl.setContext(near ? 'attack' : b.owner && b.owner.team === 0 ? 'support' : 'defend');
    // un único paso fijo de 1/60 s (dos si la caída de fps lo exige)
    const steps = dt > 0.026 ? 2 : 1;
    for (let i = 0; i < steps; i++) m.update(dt / steps);
    this.cam.follow(m, dt);
    this.excite = Math.max(0, (this.excite || 0) - dt * 0.25);
    this.stage.draw(m, this.cam, this.hintFor(), dt);
    if (this.frame++ % 6 === 0 || m.state === 'goal') this.ui.audio.excite(clamp((this.excite || 0) + (b.y < 250 || b.y > 650 ? 0.35 : 0.1), 0, 1));
    const objs = m.cfg.tutorial ? null : m.cfg.objectives.map((o) => {
      const e = evalObjective(o, m.liveStats());
      // victoria, nota y límites sólo se deciden al final del partido
      const final = e.mode === 'max' || e.id === 'win' || e.id === 'rating7';
      return { ...e, done: !final && e.done, fail: e.mode === 'max' && e.value > e.t };
    });
    this.ui.hud.update(m, h.stamina, objs);
    if (m.cfg.tutorial) this.tutorial();
    // objetivos cumplidos durante el partido
    if (objs) for (const o of objs) {
      if (o.done && !this.announced?.has(o.id)) { (this.announced ||= new Set()).add(o.id); this.ui.hud.toast('Objetivo: ' + o.title, 'good'); this.ui.audio.sfx('ok'); }
    }
  }

  tutorial() {
    const s = TUT[this.tutStep];
    if (!s) return;
    if (s.ok(this.m.hs)) {
      this.ui.hud.tutorial('¡Bien hecho!', this.tutStep + 1, TUT.length, true); this.ui.audio.sfx('ok');
      this.tutStep++;
      if (this.tutStep >= TUT.length) { this.ended = true; setTimeout(() => this.game.events.emit('tutorial-done'), 900); }
      else setTimeout(() => this.showTut(), 900);
    }
  }
}

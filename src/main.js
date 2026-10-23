import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MatchScene } from './scenes/MatchScene.js';
import { SaveManager } from './systems/SaveManager.js';
import { AudioManager } from './systems/AudioManager.js';
import { TouchControls } from './systems/TouchControls.js';
import { newCareer, nextFixture, completeMatch, heroClub, acceptOffer, finishSeasonAndStartNext, pickScenario } from './systems/CareerManager.js';
import { startAttrs } from './systems/ProgressionManager.js';
import { HUD } from './ui/HUD.js';
import { UI, lookOf } from './ui/Menus.js';
import { SCENARIOS, KIT_PRESETS, pickObjectives, evalObjective } from './data.js';
import { POSITIONS } from './config.js';
import { pick } from './util.js';

const $ = (id) => document.getElementById(id);

class App {
  constructor() {
    this.save = SaveManager.load();
    this.saveWarn = SaveManager.corrupted;
    this.audio = new AudioManager();
    this.pending = {}; this.inMatch = false; this.paused = false;
    this.hud = new HUD($('hud'));
    this.controls = new TouchControls($('controls'));
    this.ui = new UI(this, { screen: $('screen'), modal: $('modal') });
    $('modal').addEventListener('input', (e) => this.ui.onInput(e));
    $('screen').addEventListener('change', (e) => { const s = e.target.dataset?.sel; if (s) this.ui.draft[s] = e.target.value; });
    this.game = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', backgroundColor: '#07131f', scene: [BootScene, MatchScene],
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      render: { antialias: true, powerPreference: 'high-performance', batchSize: 2048 },
      input: { activePointers: 3, touch: { capture: true } },
      audio: { noAudio: true },
    });
    this.game.events.once('app-ready', () => this.ready());
    this.game.events.on('match-end', (r) => this.onMatchEnd(r));
    this.game.events.on('tutorial-done', () => this.onTutorialDone());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.inMatch && !this.paused) this.pause(); });
    window.addEventListener('pagehide', () => this.persist());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.game.scale.resize(window.innerWidth, window.innerHeight));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.inMatch) this.paused ? this.resume() : this.pause(); });
    $('hud').addEventListener('click', (e) => { if (e.target.closest('#pauseBtn')) this.pause(); });
    const unlock = () => { this.audio.init(); this.audio.setSettings(this.save.settings); this.syncMusic(); };
    document.addEventListener('pointerdown', unlock, { once: true });
  }

  ready() {
    $('loading').remove();
    this.game.loop.sleep();
    this.applySettings(false);
    this.ui.go('menu');
    window.__app = this; // útil para depurar y para las pruebas automáticas
  }

  persist() { SaveManager.save(this.save); }
  applySettings(persist = true) {
    this.audio.setSettings(this.save.settings);
    this.controls.setLefty(this.save.settings.lefty);
    this.syncMusic();
    if (persist) this.persist();
  }
  syncMusic() {
    const s = this.save.settings, on = !s.mute.music && s.vol.music > 0 && !this.inMatch;
    if (on) this.audio.startMusic(); else this.audio.stopMusic();
  }

  createCareer(d) {
    const prof = { name: d.name, nation: d.nation, pos: d.pos, number: d.number, age: 17, skin: d.skin, hair: d.hair, boots: d.boots };
    const nc = newCareer(prof, d.club, KIT_PRESETS[d.kit]);
    this.save = { ...nc, settings: this.save.settings, tutorialDone: this.save.tutorialDone };
    this.persist();
  }

  resetAll() {
    this.save = SaveManager.reset(); this.saveWarn = false;
    this.applySettings(false);
    this.ui.go('menu');
  }

  // ---------- configuración de partidos ----------
  cfgBase(homeClub, awayClub, scenario, o = {}) {
    const s = this.save, hero = s.profile;
    const teamOf = (c) => ({ club: c, name: c.name, short: c.short, c1: c.c1, c2: c.c2, rating: c.rating });
    const role = hero ? POSITIONS[hero.pos].role : 'FWD';
    return {
      home: teamOf(homeClub), away: teamOf(awayClub),
      hero: hero ? { attrs: s.attrs, pos: hero.pos, number: hero.number, ...lookOf(hero) } : { attrs: startAttrs('DEL'), pos: 'DEL', number: 9, skin: '#e0a97a', hair: '#1b1b1b', boots: '#111111' },
      difficulty: s.settings.difficulty, durationSec: s.settings.duration, scenario, scenarioName: scenario.n,
      objectives: pickObjectives(role, scenario.id), ...o,
    };
  }

  prepareCareerMatch() {
    const s = this.save, fx = nextFixture(s);
    if (!fx) return this.ui.go('seasonEnd');
    const cfg = this.cfgBase(heroClub(s), fx.opp, pickScenario());
    this.pending = { cfg, kind: 'career', boost: false };
    this.ui.go('prematch', { cfg, back: 'career', boost: false });
  }

  prepareQuick() {
    const s = this.save, mine = heroClub(s), clubs = s.career.clubs.filter((c) => c.id !== mine.id);
    const cfg = this.cfgBase(mine, pick(clubs), pick(Object.values(SCENARIOS)));
    this.pending = { cfg, kind: 'quick', boost: false };
    this.ui.go('prematch', { cfg, back: 'modes', quick: true });
  }

  kickoff() {
    const p = this.pending, s = this.save;
    if (p.boost && s.coins >= 80) { s.coins -= 80; p.cfg.boost = true; this.persist(); }
    this.startMatch(p.cfg, p.kind);
  }

  startTutorial() {
    const home = { id: 90, name: 'Tu Equipo', short: 'TÚ', c1: '#00a86b', c2: '#ffffff', rating: 52, tier: 3, shape: 'shield' };
    const away = { id: 91, name: 'Rival de Práctica', short: 'RIV', c1: '#c0392b', c2: '#ffffff', rating: 40, tier: 3, shape: 'round' };
    const cfg = this.cfgBase(home, away, SCENARIOS.normal, { tutorial: true, passive: true, objectives: [], scenarioName: 'Tutorial' });
    cfg.durationSec = 600;
    this.startMatch(cfg, 'tutorial');
  }

  startMatch(cfg, kind) {
    this.kind = kind; this.cfg = cfg; this.inMatch = true; this.paused = false;
    this.ui.hide(); this.ui.closeModal();
    $('hud').hidden = false; $('controls').hidden = false; $('game').classList.add('on');
    this.syncMusic();
    this.audio.init(); this.audio.setSettings(this.save.settings);
    this.game.loop.wake();
    this.game.scene.start('Match', { cfg, ui: { hud: this.hud, controls: this.controls, audio: this.audio }, settings: this.save.settings });
  }

  leaveMatch() {
    this.inMatch = false; this.paused = false;
    this.game.scene.stop('Match');
    $('hud').hidden = true; $('controls').hidden = true; $('game').classList.remove('on');
    this.game.loop.sleep();
    this.syncMusic();
  }

  scene() { return this.game.scene.getScene('Match'); }

  pause() {
    const sc = this.scene(); if (!this.inMatch || this.paused || !sc?.m || sc.ended) return;
    this.paused = true; sc.pause(true);
    const m = sc.m, st = this.save.settings;
    const objs = m.cfg.tutorial ? [] : m.cfg.objectives.map((o) => { const e = evalObjective(o, m.liveStats()); return { ...e, done: e.done && e.mode === 'min' && e.id !== 'win' && e.id !== 'rating7' }; });
    this.ui.modal(`<h3>PAUSA</h3><div class="pause-score"><b>${m.teams[0].short}</b> ${m.teams[0].score} - ${m.teams[1].score} <b>${m.teams[1].short}</b><small>${Math.floor(m.gameMin)}'</small></div>
      ${objs.length ? `<div class="panel"><h4>Objetivos</h4>${objs.map((o) => `<div class="ob ${o.done ? 'ok' : ''}"><i>${o.done ? '✓' : o.main ? '★' : '•'}</i>${o.title}<small>${Math.min(o.value, o.t)}/${o.t}</small></div>`).join('')}</div>` : ''}
      <div class="set"><span>Volumen</span><input type="range" min="0" max="100" value="${Math.round(st.vol.master * 100)}" data-vol="master"></div>
      <button class="btn primary big" data-act="resume">▶ REANUDAR</button>
      <button class="btn danger" data-act="quitAsk">Abandonar partido</button>`);
  }
  resume() { this.paused = false; this.ui.closeModal(); this.scene()?.pause(false); this.controls.reset(); }
  quitAsk() { this.ui.modal(`<h3>¿Abandonar el partido?</h3><p>${this.kind === 'career' ? 'Contará como derrota 0-3 en la liga.' : 'No se guardará ningún resultado.'}</p><div class="grid2"><button class="btn" data-act="resume">Seguir jugando</button><button class="btn danger" data-act="quitDo">Abandonar</button></div>`); }
  quitDo() {
    const kind = this.kind, cfg = this.cfg;
    this.ui.closeModal(); this.leaveMatch();
    if (kind === 'career') {
      const r = this.forfeitResult();
      this.finishCareerMatch(r, cfg);
    } else this.ui.go(kind === 'tutorial' ? 'menu' : 'modes');
  }
  forfeitResult() {
    return { scoreFor: 0, scoreAgainst: 3, result: 'L', rating: 3, good: [], bad: [{ txt: 'Partido abandonado', d: -3 }], objectives: this.cfg.objectives.map((o) => evalObjective(o, { goals: 0, assists: 0, passesOk: 0, chances: 0, outGoals: 0, losses: 0, rating: 3, counter: 0, recoveries: 0, winnerGoal: 0, conceded: 3, onTarget: 0, result: 'L' })), objXp: 0, objCoins: 0, hero: { goals: 0, assists: 0, passes: 0, passesOk: 0, chances: 0, shots: 0, onTarget: 0, losses: 0, recoveries: 0, tackles: 0, errors: 0 }, teamStats: { shots: [0, 0], onTarget: [0, 0], passes: [0, 0], passesOk: [0, 0], poss: [0, 0] }, goals: 0, assists: 0, passes: 0, passesOk: 0, chances: 0 };
  }

  onMatchEnd(res) {
    const cfg = this.cfg;
    setTimeout(() => {
      if (!this.inMatch) return;
      this.leaveMatch();
      this.finishCareerMatch(res, cfg);
    }, 1800);
    this.hud.banner('FINAL', `${res.scoreFor} - ${res.scoreAgainst}`);
  }

  finishCareerMatch(res, cfg) {
    const s = this.save;
    let reward;
    if (this.kind === 'career') reward = completeMatch(s, res);
    else reward = completeMatch(s, res, true), s.xp += reward.xp;
    this.persist();
    this.ui.go('results', { res, reward, cfg, quick: this.kind !== 'career' });
  }

  afterResults() {
    if (this.kind === 'career') this.ui.go(this.save.career.seasonEnd ? 'seasonEnd' : 'career');
    else this.ui.go('menu');
  }

  acceptOffer(i) { acceptOffer(this.save, i); this.finishSeason(); }
  finishSeason() { finishSeasonAndStartNext(this.save); this.persist(); this.ui.go('career'); }

  onTutorialDone() {
    this.save.tutorialDone = true; this.persist();
    this.leaveMatch(); this.ui.go('menu'); this.ui.toast('¡Tutorial completado!');
  }
}

new App();

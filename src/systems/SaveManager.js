import { SAVE_KEY, SAVE_VERSION, ATTRS } from '../config.js';
import { clamp } from '../util.js';

export const defaultSettings = () => ({
  vol: { master: 0.8, sfx: 0.9, crowd: 0.6, music: 0.5 },
  mute: { sfx: false, crowd: false, music: true },
  difficulty: 'normal', duration: 180, reduceFx: false, fps: 60, lefty: false,
});

export const defaultSave = () => ({
  v: SAVE_VERSION, profile: null, attrs: null, xp: 0, coins: 0, career: null,
  settings: defaultSettings(), tutorialDone: false,
});

const num = (v, d, a, b) => (typeof v === 'number' && isFinite(v) ? clamp(v, a, b) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const str = (v, d, max = 24) => (typeof v === 'string' ? v.slice(0, max) : d);

/** Valida y sanea un objeto de guardado. Lanza si no es recuperable. */
export function validate(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== SAVE_VERSION) throw new Error('versión inválida');
  const d = defaultSave();
  const s = { ...d, settings: defaultSettings() };
  const rs = raw.settings || {};
  for (const k of Object.keys(s.settings.vol)) s.settings.vol[k] = num(rs.vol?.[k], s.settings.vol[k], 0, 1);
  for (const k of Object.keys(s.settings.mute)) s.settings.mute[k] = bool(rs.mute?.[k], k === 'music');
  s.settings.difficulty = ['easy', 'normal', 'hard'].includes(rs.difficulty) ? rs.difficulty : 'normal';
  s.settings.duration = [120, 180, 300].includes(rs.duration) ? rs.duration : 180;
  s.settings.reduceFx = bool(rs.reduceFx, false);
  s.settings.fps = rs.fps === 30 ? 30 : 60;
  s.settings.lefty = bool(rs.lefty, false);
  s.tutorialDone = bool(raw.tutorialDone, false);
  if (raw.profile) {
    const p = raw.profile;
    if (!raw.attrs || !raw.career) throw new Error('perfil sin carrera');
    s.profile = {
      name: str(p.name, 'Jugador'), nation: str(p.nation, 'AR', 3), pos: ['DEL', 'MED', 'DEF'].includes(p.pos) ? p.pos : 'DEL',
      number: num(p.number, 9, 1, 99) | 0, age: num(p.age, 17, 15, 45) | 0,
      skin: str(p.skin, '#e0a97a', 9), hair: str(p.hair, '#1b1b1b', 9), boots: str(p.boots, '#111111', 9),
    };
    s.attrs = {};
    for (const a of ATTRS) s.attrs[a.k] = num(raw.attrs[a.k], 45, 20, 99) | 0;
    s.xp = num(raw.xp, 0, 0, 1e7) | 0;
    s.coins = num(raw.coins, 0, 0, 1e8) | 0;
    const c = raw.career;
    if (!Array.isArray(c.clubs) || c.clubs.length !== 18 || !Array.isArray(c.fixtures) || !c.contract) throw new Error('carrera dañada');
    s.career = c; // estructura interna generada por CareerManager; se comprueban los índices clave
    if (!c.clubs.some((x) => x.id === c.clubId)) throw new Error('club inexistente');
    c.md = num(c.md, 0, 0, c.fixtures.length) | 0;
    c.season = num(c.season, 1, 1, 999) | 0;
    c.history = Array.isArray(c.history) ? c.history.slice(-60) : [];
    c.trophies = Array.isArray(c.trophies) ? c.trophies : [];
    c.offers = Array.isArray(c.offers) ? c.offers : [];
  }
  return s;
}

export const SaveManager = {
  storage: (() => { try { return localStorage; } catch (e) { return null; } })(),
  corrupted: false,
  load() {
    try {
      const txt = this.storage?.getItem(SAVE_KEY);
      if (!txt) return defaultSave();
      return validate(JSON.parse(txt));
    } catch (e) {
      this.corrupted = true;
      try { this.storage?.setItem(SAVE_KEY + '_backup', this.storage.getItem(SAVE_KEY) || ''); } catch (_) { /* sin espacio */ }
      return defaultSave();
    }
  },
  save(data) {
    try { this.storage?.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  },
  reset() {
    try { this.storage?.removeItem(SAVE_KEY); } catch (_) { /* nada */ }
    this.corrupted = false;
    return defaultSave();
  },
};

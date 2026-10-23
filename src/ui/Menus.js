import { ATTRS, POSITIONS } from '../config.js';
import { NATIONS, SKINS, HAIRS, BOOTS, KIT_PRESETS, START_CLUBS, makeClubs, crestSVG, OBJ, DIFFICULTY } from '../data.js';
import { overall, upgradeCost, upgrade } from '../systems/ProgressionManager.js';
import { nextFixture, standings, club, heroClub } from '../systems/CareerManager.js';
import { esc, avatarSVG, jerseySVG, attrBar, lineupNames } from './avatar.js';
import { renderResults, renderSeasonEnd } from './MatchResults.js';

const nat = (id) => NATIONS.find((n) => n.id === id) || NATIONS[0];
const KITOF = (c) => ({ shirt: c.c1, trim: c.c2, shorts: c.c2, socks: c.c1 });
export const lookOf = (p) => ({ skin: p.skin, hair: p.hair, boots: p.boots });

export class UI {
  constructor(app, els) {
    this.app = app; this.el = els.screen; this.modalEl = els.modal; this.cur = null; this.draft = null; this.tab = 'matches';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.modalEl.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
  }

  get save() { return this.app.save; }
  hasCareer() { return !!this.save.profile; }

  go(name, params = {}) {
    this.cur = name; this.params = params;
    const sc = this.el.scrollTop;
    const fn = this['s_' + name];
    this.el.className = 'screen s-' + name;
    this.el.innerHTML = `<div class="wrap">${fn.call(this, params)}</div>`;
    this.el.hidden = false;
    if (params.keepScroll) this.el.scrollTop = sc; else this.el.scrollTop = 0;
    this.app.onScreen?.(name);
  }
  hide() { this.el.hidden = true; this.el.innerHTML = ''; }
  refresh() { this.go(this.cur, { ...this.params, keepScroll: true }); }

  header(title, back = 'menu', right = '') {
    return `<div class="top"><button class="back" data-go="${back}" aria-label="Volver">‹</button><h2>${title}</h2><div class="right">${right}</div></div>`;
  }

  // ---------- eventos ----------
  onClick(e) {
    const t = e.target.closest('[data-go],[data-act]');
    if (!t) return;
    this.app.audio.init(); this.app.audio.sfx('click');
    if (t.dataset.go) return this.go(t.dataset.go, t.dataset.arg ? JSON.parse(t.dataset.arg) : {});
    const act = t.dataset.act, v = t.dataset.v;
    this['a_' + act]?.(v, t);
  }
  onInput(e) {
    const t = e.target;
    if (t.id === 'inName') this.draft.name = t.value.slice(0, 16);
    if (t.dataset.vol) { this.save.settings.vol[t.dataset.vol] = +t.value / 100; this.app.applySettings(false); }
  }

  modal(html) { this.modalEl.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`; this.modalEl.hidden = false; }
  closeModal() { this.modalEl.hidden = true; this.modalEl.innerHTML = ''; }

  // ---------- menú principal ----------
  s_menu() {
    const s = this.save, c = s.profile && s.career, fx = c ? nextFixture(s) : null;
    const cont = !c ? `<button class="btn primary big" data-go="create">NUEVA CARRERA</button>`
      : fx ? `<button class="btn primary big next" data-act="playNext"><small>CONTINUAR CARRERA · J${fx.md + 1}</small><b>${esc(heroClub(s).short)} vs ${esc(fx.opp.short)}</b><span>JUGAR SIGUIENTE PARTIDO ▸</span></button>`
        : `<button class="btn primary big" data-go="seasonEnd">FIN DE TEMPORADA ▸</button>`;
    return `<div class="logo"><span>MINI</span><b>SOCCER</b><i>STAR STYLE</i></div>
      ${s.profile ? `<div class="mini-card">${avatarSVG(lookOf(s.profile), KITOF(heroClub(s)), s.profile.number, 54)}<div><b>${esc(s.profile.name)}</b><small>${nat(s.profile.nation).flag} ${POSITIONS[s.profile.pos].n} · VAL ${overall(s.attrs, s.profile.pos)}</small><small>${crestSVG(heroClub(s), 16)} ${esc(heroClub(s).name)}</small></div></div>` : ''}
      <div class="menu-list">${cont}
        <button class="btn" data-go="modes">🎮 Modos de juego</button>
        <div class="grid2"><button class="btn" data-go="profile">👤 Perfil</button><button class="btn" data-go="skills">⚡ Habilidades</button>
        <button class="btn" data-go="stats">📊 Estadísticas</button><button class="btn" data-go="history">🏆 Trofeos</button>
        <button class="btn" data-go="howto">❓ Tutorial</button><button class="btn" data-go="settings">⚙️ Ajustes</button></div></div>
      ${this.app.saveWarn ? `<p class="warn">⚠️ El guardado estaba dañado y se restauró una partida nueva.</p>` : ''}`;
  }

  s_modes() {
    return `${this.header('Modos de juego')}
      <div class="cards">
        <button class="card" data-act="${this.hasCareer() ? 'goCareer' : 'needCareer'}"><h3>🏟️ Carrera</h3><p>Crece desde un club modesto, juega la liga, cumple objetivos y consigue fichajes.</p></button>
        <button class="card" data-act="quick"><h3>⚡ Partido rápido</h3><p>Un amistoso contra un rival aleatorio. Da la mitad de experiencia y no afecta a la liga.</p></button>
        <button class="card" data-act="startTutorial"><h3>📖 Tutorial interactivo</h3><p>Aprende movimiento, pases, tiros y entradas con un rival pasivo.</p></button>
      </div>`;
  }

  s_howto() {
    return `${this.header('Cómo se juega')}
      <div class="howto">
        <div><b>🕹️ Joystick (izquierda)</b><p>Toca y arrastra en la mitad izquierda. Suave = toques cortos con el balón pegado; fuerte = carrera; al borde = <em>sprint</em> (menos control y se gasta resistencia).</p></div>
        <div><b>🎯 PASE</b><p>Arrastra desde el botón hacia un compañero: verás la trayectoria y se ajusta al compañero más cercano a tu dirección. Arrastre corto = pase corto, largo = pase largo, máximo = <em>pase filtrado</em> (al espacio). Un toque = pase automático al mejor compañero.</p></div>
        <div><b>💥 TIRO</b><p>Arrastra desde el botón hacia donde quieres disparar. Corto = colocado (preciso), largo = potente (menos preciso). Un toque = tiro a puerta. <em>ALTO</em> activa pases y tiros elevados.</p></div>
        <div><b>⚡ De primera</b><p>Pulsa PASE o TIRO cuando el balón llega cerca de ti para golpearlo sin controlar (más riesgo). Con balones aéreos, remata de cabeza.</p></div>
        <div><b>🛡️ Defensa</b><p>Sin balón: <em>ENTRADA</em> para robar al rival cercano; <em>PRESIÓN</em> manda a tus compañeros a presionar; <em>PEDIR</em> reclama el balón a un compañero.</p></div>
        <div><b>⭐ Valoración</b><p>Tu nota (1-10) depende de goles, asistencias, ocasiones creadas, pases, recuperaciones, pérdidas y objetivos, no sólo de marcar.</p></div>
      </div>
      <button class="btn primary big" data-act="startTutorial">EMPEZAR TUTORIAL INTERACTIVO</button>`;
  }

  // ---------- creación ----------
  s_create() {
    if (!this.draft) this.draft = { name: '', nation: 'AR', pos: 'DEL', number: 9, skin: SKINS[1], hair: HAIRS[0], boots: BOOTS[0], kit: 0, club: START_CLUBS[0] };
    const d = this.draft, clubs = makeClubs(), kp = KIT_PRESETS[d.kit], kit = { shirt: kp.c1, trim: kp.c2, shorts: kp.c2, socks: kp.c1 };
    const sw = (arr, key) => arr.map((c) => `<button class="sw ${d[key] === c ? 'on' : ''}" style="background:${c}" data-act="set" data-v='${JSON.stringify([key, c])}' aria-label="color"></button>`).join('');
    return `${this.header('Crea tu futbolista')}
      <div class="create">
        <div class="preview">${avatarSVG({ skin: d.skin, hair: d.hair, boots: d.boots }, kit, d.number, 130)}</div>
        <label>Nombre<input id="inName" maxlength="16" placeholder="Tu nombre" value="${esc(d.name)}" autocomplete="off"></label>
        <label>Nacionalidad<select data-sel="nation">${NATIONS.map((n) => `<option value="${n.id}" ${n.id === d.nation ? 'selected' : ''}>${n.flag} ${n.name}</option>`).join('')}</select></label>
        <div class="lbl">Posición</div>
        <div class="seg">${Object.entries(POSITIONS).map(([k, p]) => `<button class="${d.pos === k ? 'on' : ''}" data-act="set" data-v='${JSON.stringify(['pos', k])}'>${p.n}</button>`).join('')}</div>
        <div class="lbl">Dorsal</div>
        <div class="stepper"><button data-act="num" data-v="-1">−</button><b>${d.number}</b><button data-act="num" data-v="1">+</button></div>
        <div class="lbl">Piel</div><div class="sws">${sw(SKINS, 'skin')}</div>
        <div class="lbl">Cabello</div><div class="sws">${sw(HAIRS, 'hair')}</div>
        <div class="lbl">Botas</div><div class="sws">${sw(BOOTS, 'boots')}</div>
        <div class="lbl">Uniforme de tu club</div>
        <div class="sws kits">${KIT_PRESETS.map((k, i) => `<button class="kit ${d.kit === i ? 'on' : ''}" data-act="set" data-v='${JSON.stringify(['kit', i])}'>${jerseySVG({ shirt: k.c1, trim: k.c2 }, 44)}</button>`).join('')}</div>
        <div class="lbl">Club inicial (nivel Bronce)</div>
        <div class="cards">${START_CLUBS.map((id) => { const c = clubs[id]; return `<button class="card club ${d.club === id ? 'on' : ''}" data-act="set" data-v='${JSON.stringify(['club', id])}'>${crestSVG({ ...c, c1: kp.c1, c2: kp.c2 }, 40)}<div><b>${esc(c.name)}</b><small>Valoración ${c.rating}</small></div></button>`; }).join('')}</div>
        <p class="note">Tu club adopta los colores elegidos. Empiezas con 17 años y atributos básicos según tu posición.</p>
        <button class="btn primary big" data-act="createCareer">FIRMAR CONTRATO Y EMPEZAR</button>
      </div>`;
  }
  a_set(v) { const [k, val] = JSON.parse(v); this.draft[k] = val; this.refresh(); }
  a_num(v) { this.draft.number = ((this.draft.number - 1 + +v + 99) % 99) + 1; this.refresh(); }
  a_createCareer() {
    const d = this.draft;
    if (!d.name.trim()) { this.toast('Escribe un nombre'); return; }
    this.app.createCareer({ ...d, name: d.name.trim() });
    this.draft = null;
    this.go('howto');
  }
  toast(t) { const d = document.createElement('div'); d.className = 'ui-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }

  // ---------- perfil ----------
  s_profile() {
    const s = this.save; if (!s.profile) return this.noCareer();
    const p = s.profile, c = heroClub(s), kit = KITOF(c), ovr = overall(s.attrs, p.pos);
    return `${this.header('Perfil del jugador')}
      <div class="pcard"><div class="pc-l">${avatarSVG(lookOf(p), kit, p.number, 110)}</div>
        <div class="pc-r"><h3>${esc(p.name)}</h3><div class="ovr"><b>${ovr}</b><small>VALORACIÓN</small></div>
        <div class="tags"><span>${nat(p.nation).flag} ${nat(p.nation).name}</span><span>${POSITIONS[p.pos].n}</span><span>#${p.number}</span><span>${p.age} años</span></div></div></div>
      <div class="panel"><div class="row">${crestSVG(c, 38)}<div><b>${esc(c.name)}</b><small>Contrato: ${s.career.contract.years} temp. · ${s.career.contract.salary} 🪙/partido</small></div></div></div>
      <div class="panel attrs">${ATTRS.map((a) => attrBar(a, s.attrs[a.k])).join('')}</div>
      <div class="row2"><div class="chip">XP <b>${s.xp}</b></div><div class="chip">Monedas <b>${s.coins} 🪙</b></div></div>
      <button class="btn" data-go="skills">Mejorar habilidades ▸</button>`;
  }
  noCareer() { return `${this.header('Sin carrera')}<p class="center">Aún no has creado tu futbolista.</p><button class="btn primary big" data-go="create">CREAR FUTBOLISTA</button>`; }

  // ---------- carrera ----------
  s_career() {
    const s = this.save; if (!s.profile) return this.noCareer();
    const c = s.career, hc = heroClub(s), fx = nextFixture(s), st = standings(s), ss = c.seasonStats, avg = ss.matches ? (ss.ratingSum / ss.matches).toFixed(1) : '—';
    return `${this.header('Modo carrera', 'menu', `<span class="chip">🪙 ${s.coins}</span>`)}
      <div class="club-banner" style="--c1:${hc.c1};--c2:${hc.c2}">${crestSVG(hc, 56)}<div><h3>${esc(hc.name)}</h3><small>Temporada ${c.season} · ${['', 'Liga Élite', 'Liga Plata', 'Liga Bronce'][hc.tier]} · Contrato ${c.contract.years} temp.</small></div></div>
      ${fx ? `<button class="btn primary big next" data-act="playNext"><small>JORNADA ${fx.md + 1} / ${c.fixtures.length} · ${fx.heroHome ? 'LOCAL' : 'VISITANTE'}</small><b>${esc(hc.short)} vs ${esc(fx.opp.short)}</b><span>PREPARAR PARTIDO ▸</span></button>` : `<button class="btn primary big" data-go="seasonEnd">VER FIN DE TEMPORADA ▸</button>`}
      <div class="row2"><div class="chip">Partidos <b>${ss.matches}</b></div><div class="chip">Goles <b>${ss.goals}</b></div><div class="chip">Asist. <b>${ss.assists}</b></div><div class="chip">Nota <b>${avg}</b></div></div>
      <div class="panel"><h4>Clasificación</h4>${this.table(st, hc.id)}</div>
      <div class="panel"><h4>Objetivos de temporada</h4>${c.seasonGoals.map((g) => `<div class="sg">🎯 ${g.n}<small>+${g.xp} XP · +${g.coins} 🪙</small></div>`).join('')}</div>
      <div class="grid2"><button class="btn" data-go="calendar">📅 Calendario</button><button class="btn" data-go="skills">⚡ Habilidades</button></div>`;
  }
  table(st, me) {
    return `<table class="tbl"><tr><th>#</th><th class="l">Club</th><th>PJ</th><th>DG</th><th>PTS</th></tr>${st.map((r, i) => { const cl = club(this.save, r.id); return `<tr class="${r.id === me ? 'me' : ''} ${i < 2 ? 'up' : ''}"><td>${i + 1}</td><td class="l">${crestSVG(cl, 18)} ${esc(cl.short)}</td><td>${r.p}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`; }).join('')}</table>`;
  }

  s_calendar() {
    const s = this.save; if (!s.profile) return this.noCareer();
    const c = s.career;
    return `${this.header('Calendario', 'career')}
      <div class="list">${c.fixtures.map((round, i) => {
        const m = round.find((x) => x[0] === c.clubId || x[1] === c.clubId), home = m[0] === c.clubId, opp = club(s, home ? m[1] : m[0]);
        const played = m[2] !== null, sf = home ? m[2] : m[3], sa = home ? m[3] : m[2];
        const res = played ? (sf > sa ? 'W' : sf < sa ? 'L' : 'D') : '';
        return `<div class="fx ${i === c.md ? 'now' : ''} ${res}"><span class="md">J${i + 1}</span><span>${home ? 'vs' : '@'}</span>${crestSVG(opp, 24)}<b>${esc(opp.name)}</b><span class="sc">${played ? `${sf}-${sa}` : i === c.md ? 'PRÓXIMO' : '—'}</span></div>`;
      }).join('')}</div>`;
  }

  // ---------- previa ----------
  s_prematch(p) {
    const s = this.save, cfg = p.cfg, hero = s.profile;
    const hn = lineupNames(cfg.home.club.id * 7 + 3), an = lineupNames(cfg.away.club.id * 13 + 5);
    const slotRole = ['POR', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'DEL'];
    const hslot = POSITIONS[hero.pos].slot;
    const line = (names, tm, isHome) => names.map((n, i) => `<li><i>${slotRole[i]}</i>${isHome && i === hslot ? `<b>${esc(hero.name)} ★</b>` : esc(n)}</li>`).join('');
    const sc = cfg.scenario;
    return `${this.header('Preparación', p.back || 'career')}
      <div class="versus"><div class="vs-t">${crestSVG(cfg.home.club, 64)}<b>${esc(cfg.home.name)}</b><small>VAL ${cfg.home.rating}</small>${jerseySVG({ shirt: cfg.home.c1, trim: cfg.home.c2 }, 40)}</div><div class="vs">VS</div><div class="vs-t">${crestSVG(cfg.away.club, 64)}<b>${esc(cfg.away.name)}</b><small>VAL ${cfg.away.rating}</small>${jerseySVG({ shirt: cfg.away.c1, trim: cfg.away.c2 }, 40)}</div></div>
      <div class="scn"><b>${sc.n}</b><span>${sc.desc}</span><small>${sc.startMin ? `Minuto ${sc.startMin} · ${sc.hs}-${sc.as}` : '90 minutos'} · ${DIFFICULTY[s.settings.difficulty].n} · ${Math.round(s.settings.duration / 60 * 10) / 10} min reales</small></div>
      <div class="panel"><h4>Objetivos</h4>${cfg.objectives.map((o) => { const d = OBJ[o.id]; return `<div class="ob ${o.main ? 'main' : ''}">${o.main ? '★ Principal' : '• Secundario'}: ${d.title}<small>+${d.xp} XP · +${d.coins} 🪙</small></div>`; }).join('')}</div>
      <div class="lineups"><ul><h5>${esc(cfg.home.short)}</h5>${line(hn, 0, true)}</ul><ul><h5>${esc(cfg.away.short)}</h5>${line(an, 1, false)}</ul></div>
      ${p.quick ? '' : `<label class="boost"><input type="checkbox" data-act="boost" ${p.boost ? 'checked' : ''}><span>Energizante: +6 a todos los atributos este partido (<b>80 🪙</b>)${s.coins < 80 ? ' — monedas insuficientes' : ''}</span></label>`}
      <button class="btn primary big" data-act="kickoff">⚽ SALTAR AL CAMPO</button>`;
  }

  // ---------- resultados ----------
  s_results(p) { return renderResults(this, p); }
  s_seasonEnd() { return renderSeasonEnd(this); }

  // ---------- estadísticas ----------
  s_stats() {
    const s = this.save; if (!s.profile) return this.noCareer();
    const t = s.career.totals, ss = s.career.seasonStats, avg = t.matches ? (t.ratingSum / t.matches).toFixed(2) : '—', pa = t.passes ? Math.round(t.passesOk / t.passes * 100) + '%' : '—';
    const cell = (l, v) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`;
    return `${this.header('Estadísticas')}
      <h4 class="sec">Carrera</h4><div class="stats">${cell('Partidos', t.matches)}${cell('Victorias', t.wins)}${cell('Empates', t.draws)}${cell('Derrotas', t.losses)}${cell('Goles', t.goals)}${cell('Asistencias', t.assists)}${cell('Nota media', avg)}${cell('Pases ok', pa)}${cell('Ocasiones', t.chances)}</div>
      <h4 class="sec">Temporada ${s.career.season}</h4><div class="stats">${cell('Partidos', ss.matches)}${cell('Goles', ss.goals)}${cell('Asistencias', ss.assists)}${cell('Victorias', ss.wins)}${cell('Nota media', ss.matches ? (ss.ratingSum / ss.matches).toFixed(2) : '—')}</div>
      <h4 class="sec">Valoración</h4><div class="panel">${ATTRS.map((a) => attrBar(a, s.attrs[a.k])).join('')}</div>`;
  }

  // ---------- habilidades ----------
  s_skills() {
    const s = this.save; if (!s.profile) return this.noCareer();
    return `${this.header('Desarrollo de habilidades', 'menu', `<span class="chip">XP <b>${s.xp}</b></span>`)}
      <p class="note">Gana XP jugando. Subir un atributo cuesta más cuanto más alto está. Valoración actual: <b>${overall(s.attrs, s.profile.pos)}</b></p>
      <div class="panel attrs">${ATTRS.map((a) => { const v = s.attrs[a.k], cost = upgradeCost(v), can = s.xp >= cost && v < 99; return attrBar(a, v, `<button class="plus" ${can ? '' : 'disabled'} data-act="up" data-v="${a.k}">+${v >= 99 ? '' : cost}</button>`) + `<small class="ad">${a.d}</small>`; }).join('')}</div>`;
  }
  a_up(k) { if (upgrade(this.save, k)) { this.app.audio.sfx('ok'); this.app.persist(); } this.refresh(); }

  // ---------- historial ----------
  s_history() {
    const s = this.save; if (!s.profile) return this.noCareer();
    const c = s.career, tab = this.tab;
    const body = tab === 'trophies'
      ? (c.trophies.length ? `<div class="trophies">${c.trophies.slice().reverse().map((t) => `<div class="tr"><i>${t.icon}</i><b>${t.name}</b><small>Temporada ${t.season}</small></div>`).join('')}</div>` : `<p class="center">Aún no tienes trofeos. ¡Gana la liga o sé el MVP!</p>`)
      : (c.history.length ? `<div class="list">${c.history.slice().reverse().map((h) => { const o = club(s, h.opp); const r = h.sf > h.sa ? 'W' : h.sf < h.sa ? 'L' : 'D'; return `<div class="fx ${r}"><span class="md">T${h.season}·J${h.md}</span>${crestSVG(o, 22)}<b>${esc(o.short)}</b><span class="sc">${h.sf}-${h.sa}</span><span class="rt">${h.rating.toFixed(1)}</span></div>`; }).join('')}</div>` : `<p class="center">Todavía no has jugado partidos de liga.</p>`);
    return `${this.header('Historial y trofeos')}<div class="seg"><button class="${tab === 'matches' ? 'on' : ''}" data-act="tab" data-v="matches">Partidos</button><button class="${tab === 'trophies' ? 'on' : ''}" data-act="tab" data-v="trophies">Trofeos (${c.trophies.length})</button></div>${body}`;
  }
  a_tab(v) { this.tab = v; this.refresh(); }

  // ---------- ajustes ----------
  s_settings() {
    const st = this.save.settings;
    const sl = (k, n) => `<div class="set"><span>${n}</span><input type="range" min="0" max="100" value="${Math.round(st.vol[k] * 100)}" data-vol="${k}">${k === 'master' ? '' : `<label class="mute"><input type="checkbox" data-act="mute" data-v="${k}" ${st.mute[k] ? 'checked' : ''}> mute</label>`}</div>`;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${st[key] === v ? 'on' : ''}" data-act="opt" data-v='${JSON.stringify([key, v])}'>${n}</button>`).join('')}</div>`;
    const tg = (key, n) => `<label class="set tog"><span>${n}</span><input type="checkbox" data-act="tog" data-v="${key}" ${st[key] ? 'checked' : ''}></label>`;
    return `${this.header('Ajustes')}
      <div class="panel"><h4>Audio</h4>${sl('master', 'General')}${sl('sfx', 'Efectos')}${sl('crowd', 'Público y ambiente')}${sl('music', 'Música de menú')}</div>
      <div class="panel"><h4>Juego</h4><div class="lbl">Dificultad</div>${seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.n]))}<div class="lbl">Duración del partido</div>${seg('duration', [[120, '2 min'], [180, '3 min'], [300, '5 min']])}${tg('lefty', 'Modo zurdo (botones a la izquierda)')}</div>
      <div class="panel"><h4>Rendimiento</h4>${tg('reduceFx', 'Reducir efectos visuales')}<div class="lbl">Límite de fotogramas</div>${seg('fps', [[30, '30 FPS'], [60, '60 FPS']])}</div>
      <div class="panel danger"><h4>Datos</h4><button class="btn danger" data-act="resetAsk">🗑️ Reiniciar partida guardada</button></div>`;
  }
  a_mute(k, el) { this.save.settings.mute[k] = el.checked; this.app.applySettings(); }
  a_tog(k, el) { this.save.settings[k] = el.checked; this.app.applySettings(); }
  a_opt(v) { const [k, val] = JSON.parse(v); this.save.settings[k] = val; this.app.applySettings(); this.refresh(); }
  a_resetAsk() { this.modal(`<h3>¿Reiniciar todo?</h3><p>Se borrarán tu jugador, carrera, estadísticas y trofeos. Esta acción no se puede deshacer.</p><div class="grid2"><button class="btn" data-act="closeModal">Cancelar</button><button class="btn danger" data-act="resetDo">Sí, borrar todo</button></div>`); }
  a_closeModal() { this.closeModal(); }
  a_resetDo() { this.closeModal(); this.app.resetAll(); }

  // ---------- acciones de flujo ----------
  a_playNext() { this.app.prepareCareerMatch(); }
  a_quick() { if (!this.hasCareer()) return this.go('create'); this.app.prepareQuick(); }
  a_needCareer() { this.go('create'); }
  a_goCareer() { this.go('career'); }
  a_startTutorial() { this.app.startTutorial(); }
  a_kickoff() { this.app.kickoff(); }
  a_boost(v, el) { this.params.boost = el.checked; this.app.pending.boost = el.checked; }
  a_continue() { this.app.afterResults(); }
  a_accept(v) { this.app.acceptOffer(+v); }
  a_stay() { this.app.finishSeason(); }
  a_resume() { this.app.resume(); }
  a_quitAsk() { this.app.quitAsk(); }
  a_quitDo() { this.app.quitDo(); }
}

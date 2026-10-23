import { crestSVG } from '../data.js';
import { club, heroClub } from '../systems/CareerManager.js';
import { esc } from './avatar.js';

const bar = (a, b) => { const t = a + b || 1; return `<div class="cmp"><i style="width:${a / t * 100}%"></i></div>`; };

export function renderResults(ui, p) {
  const r = p.res, rw = p.reward, cfg = p.cfg;
  const verdict = r.result === 'W' ? 'VICTORIA' : r.result === 'D' ? 'EMPATE' : 'DERROTA';
  const col = r.rating >= 8 ? 'gold' : r.rating >= 6.5 ? 'green' : r.rating >= 5 ? 'amber' : 'red';
  const ts = r.teamStats, h = r.hero;
  const row = (l, a, b) => `<div class="cmp-row"><b>${a}</b><span>${l}</span><b>${b}</b>${bar(+a || 0, +b || 0)}</div>`;
  return `<div class="res-head ${r.result}"><small>${p.quick ? 'AMISTOSO' : 'FINAL DEL PARTIDO'}</small><h1>${verdict}</h1>
      <div class="res-score">${crestSVG(cfg.home.club, 52)}<b>${r.scoreFor}</b><i>-</i><b>${r.scoreAgainst}</b>${crestSVG(cfg.away.club, 52)}</div></div>
    <div class="rating ${col}"><div class="rv">${r.rating.toFixed(1)}</div><div><small>VALORACIÓN INDIVIDUAL</small>
      ${r.good.map((x) => `<div class="pl">▲ ${x.txt} <em>+${x.d.toFixed(1)}</em></div>`).join('')}${r.bad.map((x) => `<div class="mn">▼ ${x.txt} <em>${x.d.toFixed(1)}</em></div>`).join('')}</div></div>
    <div class="panel"><h4>Objetivos</h4>${r.objectives.map((o) => `<div class="ob ${o.done ? 'ok' : 'ko'}"><i>${o.done ? '✓' : '✗'}</i>${o.main ? '★ ' : ''}${o.title}<small>${o.done ? `+${o.xp} XP · +${o.coins} 🪙` : o.mode === 'max' ? 'Fallado' : `${Math.min(o.value, o.t)}/${o.t}`}</small></div>`).join('')}</div>
    <div class="panel"><h4>Tus estadísticas</h4><div class="stats">
      <div class="stat"><b>${h.goals}</b><small>Goles</small></div><div class="stat"><b>${h.assists}</b><small>Asistencias</small></div><div class="stat"><b>${h.passesOk}/${h.passes}</b><small>Pases</small></div>
      <div class="stat"><b>${h.chances}</b><small>Ocasiones</small></div><div class="stat"><b>${h.recoveries}</b><small>Recuperaciones</small></div><div class="stat"><b>${h.losses}</b><small>Pérdidas</small></div>
      <div class="stat"><b>${h.onTarget}/${h.shots}</b><small>Tiros a puerta</small></div><div class="stat"><b>${h.tackles}</b><small>Entradas ganadas</small></div><div class="stat"><b>${h.errors}</b><small>Errores</small></div></div></div>
    <div class="panel"><h4>Equipos</h4>${row('Tiros', ts.shots[0], ts.shots[1])}${row('A puerta', ts.onTarget[0], ts.onTarget[1])}${row('Pases', ts.passes[0], ts.passes[1])}${row('Posesión %', ts.poss[0], ts.poss[1])}</div>
    <div class="rewards"><div><small>EXPERIENCIA</small><b>+${rw.xp} XP</b></div><div><small>MONEDAS</small><b>+${rw.coins} 🪙</b></div></div>
    <button class="btn primary big" data-act="continue">CONTINUAR ▸</button>`;
}

export function renderSeasonEnd(ui) {
  const s = ui.save, c = s.career, e = c.seasonEnd;
  if (!e) return `${ui.header('Temporada', 'career')}<p class="center">La temporada sigue en marcha.</p>`;
  const hc = heroClub(s);
  const goalsHtml = c.seasonGoals.map((g) => `<div class="ob ${e.done[g.id] ? 'ok' : 'ko'}"><i>${e.done[g.id] ? '✓' : '✗'}</i>${g.n}<small>${e.done[g.id] ? `+${g.xp} XP · +${g.coins} 🪙` : 'No cumplido'}</small></div>`).join('');
  const offers = c.offers.map((o, i) => { const cl = club(s, o.clubId); return `<div class="offer">${crestSVG(cl, 44)}<div><b>${esc(cl.name)}</b><small>${o.renew ? 'Renovación' : ['', 'Liga Élite', 'Liga Plata', 'Liga Bronce'][cl.tier]} · ${o.years} temp. · ${o.salary} 🪙/partido · Bono ${o.bonus} 🪙</small></div><button class="btn primary" data-act="accept" data-v="${i}">${o.renew ? 'Renovar' : 'Fichar'}</button></div>`; }).join('');
  const msg = e.move === 'up' ? '¡Tu club asciende de categoría!' : e.move === 'down' ? 'Tu club desciende de categoría.' : '';
  return `<div class="res-head ${e.pos === 1 ? 'W' : 'D'}"><small>TEMPORADA ${c.season} COMPLETADA</small><h1>${e.pos === 1 ? '¡CAMPEÓN!' : `${e.pos}º PUESTO`}</h1><p>${msg}</p></div>
    <div class="panel"><h4>Clasificación final</h4>${ui.table(e.st, hc.id)}</div>
    <div class="panel"><h4>Objetivos de temporada</h4>${goalsHtml}<div class="rewards sm"><div><small>BONO</small><b>+${e.xp} XP · +${e.coins} 🪙</b></div></div></div>
    <div class="panel"><h4>${e.forced ? 'Tu contrato ha terminado: elige tu futuro' : 'Ofertas recibidas'}</h4>${offers || '<p class="center">No hay ofertas. Mejora tu rendimiento y atributos.</p>'}
    ${e.forced ? '<p class="note">Si no aceptas ninguna oferta, fichas por el club más modesto con contrato mínimo.</p>' : ''}</div>
    <button class="btn ${e.forced && offers ? '' : 'primary'} big" data-act="stay">${e.forced ? 'Rechazar y buscar club' : 'Seguir en ' + esc(hc.short) + ' ▸ Nueva temporada'}</button>`;
}

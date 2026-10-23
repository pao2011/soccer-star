import { makeClubs, SCENARIOS } from '../data.js';
import { startAttrs, overall, xpForMatch } from './ProgressionManager.js';
import { clamp, shuffle, rand } from '../util.js';
import { SAVE_VERSION } from '../config.js';


export function roundRobin(ids) {
  const n = ids.length, arr = ids.slice(), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const m = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      m.push(r % 2 ? [b, a, null, null] : [a, b, null, null]);
    }
    rounds.push(m);
    arr.splice(1, 0, arr.pop());
  }
  return [...rounds, ...rounds.map((m) => m.map(([h, a]) => [a, h, null, null]))];
}

export const club = (save, id) => save.career.clubs.find((c) => c.id === id);
export const heroClub = (save) => club(save, save.career.clubId);
export const leagueIds = (save) => save.career.clubs.filter((c) => c.tier === heroClub(save).tier).map((c) => c.id);
const emptyTable = (ids) => Object.fromEntries(ids.map((i) => [i, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
const emptySeason = () => ({ matches: 0, goals: 0, assists: 0, ratingSum: 0, wins: 0 });
export const emptyTotals = () => ({ matches: 0, goals: 0, assists: 0, wins: 0, draws: 0, losses: 0, ratingSum: 0, passesOk: 0, passes: 0, chances: 0 });

function seasonGoals(save) {
  const t = heroClub(save).tier, ovr = overall(save.attrs, save.profile.pos);
  const goalT = save.profile.pos === 'DEL' ? 4 : save.profile.pos === 'MED' ? 2 : 1;
  return [
    { id: 'pos', n: t === 1 ? 'Terminar entre los 3 primeros' : 'Terminar en el top 2 (ascenso)', xp: 150, coins: 150 },
    { id: 'goals', n: `Marcar ${goalT + (ovr > 60 ? 2 : 0)} goles o más`, t: goalT + (ovr > 60 ? 2 : 0), xp: 100, coins: 100 },
    { id: 'rating', n: 'Valoración media de 6.8 o más', t: 6.8, xp: 120, coins: 100 },
  ];
}

export function newCareer(profile, startClubId, kit) {
  const clubs = makeClubs();
  const sc = clubs.find((c) => c.id === startClubId);
  sc.c1 = kit.c1; sc.c2 = kit.c2; // tu club adopta los colores elegidos
  const attrs = startAttrs(profile.pos);
  const save = {
    v: SAVE_VERSION, profile, attrs, xp: 120, coins: 100,
    career: {
      clubs, clubId: startClubId, contract: { years: 2, salary: Math.round(sc.rating * 0.6) },
      season: 1, md: 0, fixtures: [], table: {}, history: [], trophies: [], offers: [], seasonEnd: null,
      seasonStats: emptySeason(), totals: emptyTotals(), goalsDone: {}, boosted: false,
    },
  };
  startSeason(save);
  return save;
}

export function startSeason(save) {
  const c = save.career, ids = leagueIds(save);
  c.fixtures = roundRobin(shuffle(ids));
  c.table = emptyTable(ids);
  c.md = 0; c.seasonStats = emptySeason(); c.seasonEnd = null; c.offers = [];
  c.seasonGoals = seasonGoals(save);
}

export function nextFixture(save) {
  const c = save.career;
  if (c.md >= c.fixtures.length) return null;
  const f = c.fixtures[c.md].find((m) => m[0] === c.clubId || m[1] === c.clubId);
  const heroHome = f[0] === c.clubId;
  return { md: c.md, home: club(save, f[0]), away: club(save, f[1]), heroHome, opp: club(save, heroHome ? f[1] : f[0]) };
}

export function pickScenario() {
  const all = Object.values(SCENARIOS);
  let r = rand(0, all.reduce((s, x) => s + x.w, 0));
  for (const s of all) { if ((r -= s.w) <= 0) return s; }
  return all[0];
}

const poisson = (l) => { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= Math.random(); } while (p > L); return k - 1; };
export function simScore(a, b) {
  const d = (a.rating - b.rating) / 40;
  return [poisson(clamp(1.35 + d, 0.3, 3)), poisson(clamp(1.1 - d, 0.3, 3))];
}

function applyResult(t, h, a, hs, as) {
  const H = t[h], A = t[a];
  H.p++; A.p++; H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
  if (hs > as) { H.w++; H.pts += 3; A.l++; } else if (hs < as) { A.w++; A.pts += 3; H.l++; } else { H.d++; A.d++; H.pts++; A.pts++; }
}

export const standings = (save) => {
  const c = save.career;
  return Object.entries(c.table).map(([id, r]) => ({ id: +id, ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.id - y.id);
};

/** r: {scoreFor, scoreAgainst, rating, goals, assists, passes, passesOk, chances, result} */
export function completeMatch(save, r, quick = false) {
  const c = save.career, fx = nextFixture(save);
  if (quick || !fx) return { xp: Math.round(xpForMatch(r) / 2), coins: 0 };
  const round = c.fixtures[c.md];
  for (const m of round) {
    if (m[0] === c.clubId || m[1] === c.clubId) {
      m[2] = fx.heroHome ? r.scoreFor : r.scoreAgainst; m[3] = fx.heroHome ? r.scoreAgainst : r.scoreFor;
    } else [m[2], m[3]] = simScore(club(save, m[0]), club(save, m[1]));
    applyResult(c.table, m[0], m[1], m[2], m[3]);
  }
  const t = c.totals, s = c.seasonStats;
  t.matches++; s.matches++; t.goals += r.goals; s.goals += r.goals; t.assists += r.assists; s.assists += r.assists;
  t.ratingSum += r.rating; s.ratingSum += r.rating; t.passes += r.passes; t.passesOk += r.passesOk; t.chances += r.chances;
  if (r.result === 'W') { t.wins++; s.wins++; } else if (r.result === 'D') t.draws++; else t.losses++;
  c.history.push({ season: c.season, md: c.md + 1, opp: fx.opp.id, home: fx.heroHome, sf: r.scoreFor, sa: r.scoreAgainst, rating: r.rating, goals: r.goals, assists: r.assists });
  if (c.history.length > 60) c.history.shift();
  const xp = xpForMatch(r) + (r.objXp || 0), coins = c.contract.salary + (r.objCoins || 0) + (r.result === 'W' ? 15 : 0);
  save.xp += xp; save.coins += coins;
  milestones(save, r);
  c.md++;
  c.boosted = false;
  if (c.md >= c.fixtures.length) endSeason(save);
  return { xp, coins };
}

function addTrophy(save, id, name, icon) {
  const c = save.career;
  if (c.trophies.some((t) => t.id === id && t.season === c.season)) return;
  c.trophies.push({ id, name, icon, season: c.season });
}
function milestones(save, r) {
  const c = save.career;
  if (r.goals >= 3) addTrophy(save, 'hat' + c.md, '¡Hat-trick!', '🎩');
  if (r.rating >= 9) addTrophy(save, 'motm' + c.md, 'Jugador del partido', '⭐');
  if (c.totals.wins === 1 && r.result === 'W') addTrophy(save, 'first-win', 'Primera victoria', '🏅');
}

export function heroValue(save) {
  const c = save.career, s = c.seasonStats, n = Math.max(1, s.matches);
  return overall(save.attrs, save.profile.pos) + (s.ratingSum / n - 6.5) * 8 + s.goals * 0.4 + s.assists * 0.3;
}

export function makeOffers(save) {
  const c = save.career, cur = heroClub(save), v = heroValue(save);
  const cand = c.clubs.filter((x) => x.id !== cur.id && x.tier <= cur.tier && x.tier >= cur.tier - 1 && x.rating <= v + 4).sort((a, b) => b.rating - a.rating).slice(0, 3);
  const offers = cand.map((cl) => ({ clubId: cl.id, years: 1 + Math.floor(rand(0, 3)), salary: Math.round(cl.rating * 0.62), bonus: Math.round(cl.rating * 3) }));
  return offers;
}

function endSeason(save) {
  const c = save.career, st = standings(save), pos = st.findIndex((x) => x.id === c.clubId) + 1, cur = heroClub(save);
  const s = c.seasonStats, avg = s.matches ? s.ratingSum / s.matches : 0;
  const done = { pos: pos <= (cur.tier === 1 ? 3 : 2), goals: s.goals >= c.seasonGoals[1].t, rating: avg >= 6.8 };
  let xp = 0, coins = 0;
  c.seasonGoals.forEach((g) => { if (done[g.id]) { xp += g.xp; coins += g.coins; } });
  save.xp += xp; save.coins += coins;
  if (pos === 1) addTrophy(save, 'liga' + cur.tier, `Campeón de ${['', 'la Liga Élite', 'la Liga Plata', 'la Liga Bronce'][cur.tier]}`, '🏆');
  if (s.goals >= 8) addTrophy(save, 'goleador', 'Máximo goleador', '👟');
  if (avg >= 7.5) addTrophy(save, 'mvp', 'Jugador de la temporada', '🌟');
  let move = null;
  // ascenso / descenso del club del jugador (intercambia categoría con el rival más cercano)
  const swap = (target) => {
    const pool = c.clubs.filter((x) => x.tier === target);
    const other = target < cur.tier ? pool.sort((a, b) => a.rating - b.rating)[0] : pool.sort((a, b) => b.rating - a.rating)[0];
    [cur.tier, other.tier] = [other.tier, cur.tier];
    return other;
  };
  if (pos <= 2 && cur.tier > 1) { swap(cur.tier - 1); move = 'up'; } else if (pos >= 6 && cur.tier < 3) { swap(cur.tier + 1); move = 'down'; }
  c.contract.years = Math.max(0, c.contract.years - 1);
  const offers = makeOffers(save);
  const renew = c.contract.years === 0 ? [{ clubId: c.clubId, years: 2, salary: Math.round(heroClub(save).rating * 0.66), bonus: Math.round(heroClub(save).rating * 2), renew: true }] : [];
  c.offers = [...renew, ...offers];
  c.seasonEnd = { pos, st, done, xp, coins, move, avg, goals: s.goals, assists: s.assists, forced: c.contract.years === 0 };
  save.profile.age++;
}

/** Acepta una oferta (traspaso o renovación). */
export function acceptOffer(save, idx) {
  const c = save.career, o = c.offers[idx];
  if (!o) return false;
  c.clubId = o.clubId; c.contract = { years: o.years, salary: o.salary };
  save.coins += o.bonus;
  return true;
}

/** Cierra la temporada (si el contrato expiró y no hay oferta aceptada, ficha por el club más modesto). */
export function finishSeasonAndStartNext(save) {
  const c = save.career;
  if (c.contract.years === 0) {
    const fallback = c.clubs.filter((x) => x.tier === 3).sort((a, b) => a.rating - b.rating)[0];
    c.clubId = fallback.id; c.contract = { years: 1, salary: Math.round(fallback.rating * 0.5) };
  }
  c.season++;
  startSeason(save);
}

import { mulberry32 } from './util.js';

export const NATIONS = [
  ['AR', 'Argentina', '🇦🇷'], ['BR', 'Brasil', '🇧🇷'], ['ES', 'España', '🇪🇸'], ['MX', 'México', '🇲🇽'],
  ['CO', 'Colombia', '🇨🇴'], ['CL', 'Chile', '🇨🇱'], ['UY', 'Uruguay', '🇺🇾'], ['PE', 'Perú', '🇵🇪'],
  ['PT', 'Portugal', '🇵🇹'], ['FR', 'Francia', '🇫🇷'], ['DE', 'Alemania', '🇩🇪'], ['IT', 'Italia', '🇮🇹'],
].map(([id, name, flag]) => ({ id, name, flag }));

export const SKINS = ['#f2c9a0', '#e0a97a', '#c68642', '#8d5524', '#5c3a1e'];
export const HAIRS = ['#1b1b1b', '#4a2c14', '#a0622d', '#d9b54a', '#c0392b'];
export const BOOTS = ['#111111', '#f1c40f', '#e74c3c', '#2ecc71', '#00c8ff'];
export const KIT_PRESETS = [
  { n: 'Rojo y blanco', c1: '#d62828', c2: '#ffffff' }, { n: 'Azul y amarillo', c1: '#1d4ed8', c2: '#facc15' },
  { n: 'Verde y blanco', c1: '#16a34a', c2: '#ffffff' }, { n: 'Naranja y negro', c1: '#f97316', c2: '#111827' },
  { n: 'Violeta y oro', c1: '#7c3aed', c2: '#fbbf24' }, { n: 'Celeste y blanco', c1: '#38bdf8', c2: '#ffffff' },
];

export const DIFFICULTY = {
  easy: { n: 'Fácil', opp: 0.88, react: 1.35, tackle: 0.7, gk: 0.8, speed: 0.94 },
  normal: { n: 'Normal', opp: 1, react: 1, tackle: 1, gk: 1, speed: 1 },
  hard: { n: 'Difícil', opp: 1.1, react: 0.75, tackle: 1.25, gk: 1.15, speed: 1.04 },
};

// tier 1 = élite; rating base del club
const CLUB_DEFS = [
  ['Gran Capital FC', 'GCF', 1, '#0b3d91', '#f5c518', 76], ['Atlético Meridiano', 'MER', 1, '#b3001b', '#ffffff', 74],
  ['Dragones 1910', 'DRA', 1, '#0f5132', '#f8f9fa', 72], ['Leones de Oro', 'LEO', 1, '#f2b705', '#1b1b1b', 70],
  ['Estelar City', 'EST', 1, '#4cc9f0', '#10002b', 69], ['Imperio SC', 'IMP', 1, '#5a189a', '#e0aaff', 68],
  ['Halcones del Norte', 'HAL', 2, '#264653', '#e9c46a', 64], ['Rayo Dorado', 'RAY', 2, '#e9c46a', '#264653', 62],
  ['Titanes FC', 'TIT', 2, '#6d6875', '#ffb4a2', 61], ['Olímpico Sur', 'OLS', 2, '#0077b6', '#ffffff', 60],
  ['Tormenta United', 'TOR', 2, '#240046', '#ff9e00', 59], ['Real Bahía', 'BAH', 2, '#006d77', '#edf6f9', 58],
  ['Real Montaña', 'MON', 3, '#7f5539', '#ede0d4', 55], ['Atlético Valle', 'VAL', 3, '#2d6a4f', '#d8f3dc', 53],
  ['Unión Costa', 'COS', 3, '#023e8a', '#caf0f8', 52], ['Deportivo Río Claro', 'RIO', 3, '#c1121f', '#fdf0d5', 50],
  ['Sporting Piedra', 'PIE', 3, '#495057', '#f8f9fa', 49], ['Juventud Alba', 'ALB', 3, '#ff7b00', '#ffffff', 47],
];
export const SHAPES = ['shield', 'round', 'diamond'];
export const makeClubs = () => CLUB_DEFS.map(([name, short, tier, c1, c2, rating], i) => ({ id: i, name, short, tier, c1, c2, rating, shape: SHAPES[i % 3] }));
export const START_CLUBS = [12, 13, 17]; // elegibles al empezar (nivel 3)

export function crestSVG(club, size = 48) {
  const { c1, c2, short, shape } = club;
  const body = shape === 'round' ? '<circle cx="32" cy="32" r="28"/>'
    : shape === 'diamond' ? '<path d="M32 3 L60 32 L32 61 L4 32Z"/>'
      : '<path d="M8 6h48v26c0 14-10 22-24 27C18 54 8 46 8 32Z"/>';
  const id = 'c' + club.id + Math.round(Math.random() * 1e5);
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><clipPath id="${id}">${body}</clipPath></defs>
  <g fill="${c1}" stroke="${c2}" stroke-width="3">${body}</g>
  <g clip-path="url(#${id})"><rect x="0" y="26" width="64" height="14" fill="${c2}" opacity=".9"/></g>
  <text x="32" y="37" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="14" fill="${c1}" stroke="${c1}" stroke-width=".3">${short}</text></svg>`;
}

export const SCENARIOS = {
  normal: { id: 'normal', n: 'Partido completo', startMin: 0, hs: 0, as: 0, w: 55, desc: 'Del minuto 0 al 90.' },
  remontada: { id: 'remontada', n: 'Remontada', startMin: 55, hs: 0, as: 1, w: 15, desc: 'Pierdes 0-1 desde el minuto 55. ¡Dale la vuelta!' },
  ventaja: { id: 'ventaja', n: 'Atacar con ventaja', startMin: 60, hs: 1, as: 0, w: 12, desc: 'Ganas 1-0 desde el minuto 60. Asegura el resultado.' },
  empate: { id: 'empate', n: 'Final igualado', startMin: 65, hs: 1, as: 1, w: 18, desc: '1-1 desde el minuto 65. Busca el gol de la victoria.' },
};

// ---- Objetivos ----
// val(s): progreso actual; t: meta; mode 'min' (>=) o 'max' (<=, solo se evalúa al final)
const O = (id, title, t, mode, val, xp, coins) => ({ id, title, t, mode, val, xp, coins });
export const OBJ = {
  win: O('win', 'Ganar el partido', 1, 'min', (s) => (s.result === 'W' ? 1 : 0), 60, 40),
  goal: O('goal', 'Marcar un gol', 1, 'min', (s) => s.goals, 60, 40),
  assist: O('assist', 'Dar una asistencia', 1, 'min', (s) => s.assists, 55, 35),
  passes5: O('passes5', 'Completar 5 pases', 5, 'min', (s) => s.passesOk, 35, 20),
  passes8: O('passes8', 'Completar 8 pases', 8, 'min', (s) => s.passesOk, 40, 25),
  chances2: O('chances2', 'Crear 2 ocasiones', 2, 'min', (s) => s.chances, 40, 25),
  chances3: O('chances3', 'Crear 3 ocasiones', 3, 'min', (s) => s.chances, 50, 30),
  outGoal: O('outGoal', 'Marcar desde fuera del área', 1, 'min', (s) => s.outGoals, 55, 35),
  losses: O('losses', 'Perder el balón 6 veces o menos', 6, 'max', (s) => s.losses, 30, 20),
  rating7: O('rating7', 'Calificación de 7.0 o más', 7, 'min', (s) => s.rating, 40, 25),
  counter: O('counter', 'Participar en un contraataque con tiro', 1, 'min', (s) => s.counter, 40, 25),
  recov3: O('recov3', 'Recuperar el balón 3 veces', 3, 'min', (s) => s.recoveries, 35, 20),
  winGoal: O('winGoal', 'Marcar el gol de la victoria', 1, 'min', (s) => s.winnerGoal, 70, 45),
  clean: O('clean', 'No encajar goles', 0, 'max', (s) => s.conceded, 45, 30),
  shots2: O('shots2', 'Hacer 2 disparos a puerta', 2, 'min', (s) => s.onTarget, 30, 20),
};
const POOLS = {
  FWD: { main: ['goal', 'win', 'shots2'], sec: ['outGoal', 'chances2', 'passes5', 'rating7', 'counter', 'losses', 'assist', 'shots2'] },
  MID: { main: ['assist', 'chances2', 'win'], sec: ['passes8', 'goal', 'outGoal', 'rating7', 'counter', 'losses', 'recov3'] },
  DEF: { main: ['win', 'clean', 'recov3'], sec: ['passes5', 'rating7', 'losses', 'counter', 'assist', 'chances2'] },
};
export function pickObjectives(role, scenario, rnd = Math.random) {
  const pool = POOLS[role] || POOLS.MID;
  let main = scenario === 'empate' ? 'winGoal' : scenario === 'remontada' || scenario === 'ventaja' ? 'win' : pool.main[Math.floor(rnd() * pool.main.length)];
  const secs = [];
  const cand = pool.sec.filter((x) => x !== main && !(main === 'clean' && x === 'win'));
  while (secs.length < 2 && cand.length) secs.push(cand.splice(Math.floor(rnd() * cand.length), 1)[0]);
  if (scenario === 'ventaja' && !secs.includes('clean')) secs[1] = 'clean';
  return [{ id: main, main: true }, ...secs.map((id) => ({ id }))];
}
export function evalObjective(o, s) {
  const d = OBJ[o.id];
  const v = d.val(s);
  const done = d.mode === 'min' ? v >= d.t : v <= d.t;
  return { ...d, main: !!o.main, value: v, done };
}
export { mulberry32 };

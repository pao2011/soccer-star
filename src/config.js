// Mundo del campo: x 0..W (izq→der), y 0..L. Portería rival arriba (y=0), la propia abajo (y=L).
export const PITCH = {
  W: 600, L: 900,
  GW: 130,      // ancho de portería
  GD: 34,       // profundidad de la red
  BAR: 52,      // altura del larguero
  POST_R: 3.5,
  BALL_R: 6,
  PA_W: 330, PA_D: 140, // área grande
  GA_W: 170, GA_D: 48,  // área pequeña
  CC_R: 75, SPOT: 100,
};

export const ATTRS = [
  { k: 'speed', n: 'Velocidad', i: '⚡', d: 'Velocidad punta al correr y esprintar' },
  { k: 'accel', n: 'Aceleración', i: '🚀', d: 'Rapidez para arrancar y girar' },
  { k: 'dribble', n: 'Regate', i: '🌀', d: 'Resistir entradas y llevar el balón cerca' },
  { k: 'control', n: 'Control', i: '🧲', d: 'Dominar pases fuertes y balones rápidos' },
  { k: 'passing', n: 'Precisión de pase', i: '🎯', d: 'Menos error en pases' },
  { k: 'shotPower', n: 'Potencia de tiro', i: '💥', d: 'Velocidad máxima del disparo' },
  { k: 'shotAcc', n: 'Precisión de tiro', i: '🔭', d: 'Menos desvío al disparar' },
  { k: 'finishing', n: 'Definición', i: '🥅', d: 'Acierto en situaciones favorables dentro del área' },
  { k: 'stamina', n: 'Resistencia', i: '❤️', d: 'Esprintar durante más tiempo' },
  { k: 'balance', n: 'Equilibrio', i: '⚖️', d: 'Aguantar empujones y caer menos' },
  { k: 'positioning', n: 'Posicionamiento', i: '📍', d: 'Mayor radio para interceptar y recoger balones' },
  { k: 'reaction', n: 'Reacción', i: '👁️', d: 'Controlar balones rápidos y rematar mejor' },
];

export const POSITIONS = {
  DEL: { n: 'Delantero', role: 'FWD', slot: 6, boost: { speed: 6, shotPower: 8, finishing: 10, shotAcc: 6, passing: -4, positioning: 4, stamina: -2 } },
  MED: { n: 'Mediocampista', role: 'MID', slot: 4, boost: { passing: 10, control: 8, dribble: 4, stamina: 6, shotPower: -2 } },
  DEF: { n: 'Defensa', role: 'DEF', slot: 2, boost: { balance: 10, positioning: 8, stamina: 6, shotAcc: -6, finishing: -10, dribble: -2 } },
};

// 1-2-3-1 (fútbol 7). fx: 0 izquierda..1 derecha, fy: 0 portería propia..1 portería rival
export const FORMATION = [
  { role: 'GK', fx: 0.5, fy: 0.03 },
  { role: 'DEF', fx: 0.3, fy: 0.22 },
  { role: 'DEF', fx: 0.7, fy: 0.22 },
  { role: 'MID', fx: 0.2, fy: 0.46 },
  { role: 'MID', fx: 0.5, fy: 0.4 },
  { role: 'MID', fx: 0.8, fy: 0.46 },
  { role: 'FWD', fx: 0.5, fy: 0.68 },
];

export const SAVE_KEY = 'mss_style_save';
export const SAVE_VERSION = 1;

// Ayudantes de orientación: el equipo 0 ataca hacia arriba (y=0), el 1 hacia abajo.
export const goalY = (team) => (team === 0 ? 0 : PITCH.L);
export const ownGoalY = (team) => (team === 0 ? PITCH.L : 0);
export const adv = (team, y) => (team === 0 ? 1 - y / PITCH.L : y / PITCH.L);

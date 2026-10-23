import { ATTRS } from '../config.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Jugador ilustrado en SVG (para perfil y creación). */
export function avatarSVG(look, kit, number, size = 120) {
  return `<svg class="avatar" width="${size}" height="${size * 1.35}" viewBox="0 0 100 135">
  <ellipse cx="50" cy="130" rx="26" ry="5" fill="rgba(0,0,0,.35)"/>
  <rect x="36" y="86" width="11" height="34" rx="4" fill="${kit.socks}"/><rect x="53" y="86" width="11" height="34" rx="4" fill="${kit.socks}"/>
  <rect x="33" y="118" width="16" height="9" rx="4" fill="${look.boots}"/><rect x="51" y="118" width="16" height="9" rx="4" fill="${look.boots}"/>
  <rect x="33" y="72" width="34" height="22" rx="5" fill="${kit.shorts}"/>
  <rect x="14" y="40" width="12" height="36" rx="6" fill="${kit.shirt}" transform="rotate(8 20 40)"/><rect x="74" y="40" width="12" height="36" rx="6" fill="${kit.shirt}" transform="rotate(-8 80 40)"/>
  <circle cx="17" cy="78" r="6" fill="${look.skin}"/><circle cx="83" cy="78" r="6" fill="${look.skin}"/>
  <path d="M28 38 Q50 30 72 38 L68 78 L32 78Z" fill="${kit.shirt}"/><rect x="46" y="38" width="8" height="40" fill="${kit.trim}" opacity=".85"/>
  <text x="50" y="66" text-anchor="middle" font-family="Impact,Arial Black,sans-serif" font-size="17" fill="${kit.trim}" stroke="#0006" stroke-width=".6">${number}</text>
  <circle cx="50" cy="22" r="14" fill="${look.skin}"/><path d="M36 20 Q37 6 50 7 Q63 6 64 20 Q57 12 50 13 Q43 12 36 20Z" fill="${look.hair}"/>
  <circle cx="45" cy="24" r="1.6" fill="#222"/><circle cx="55" cy="24" r="1.6" fill="#222"/><path d="M46 30 Q50 33 54 30" stroke="#7a3b2b" stroke-width="1.4" fill="none"/></svg>`;
}

export const jerseySVG = (kit, size = 44) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><path d="M20 8 L8 16 L2 30 L14 34 L16 28 L16 58 L48 58 L48 28 L50 34 L62 30 L56 16 L44 8 Q32 18 20 8Z" fill="${kit.shirt}" stroke="#0007" stroke-width="1.5"/><rect x="28" y="12" width="8" height="46" fill="${kit.trim}" opacity=".7"/></svg>`;

export const attrBar = (a, v, extra = '') => `<div class="attr"><span class="ai">${a.i}</span><span class="an">${a.n}</span><div class="bar"><i style="width:${v}%"></i></div><b>${v}</b>${extra}</div>`;
export { ATTRS };

const FN = ['Lucas', 'Mateo', 'Diego', 'Hugo', 'Iker', 'Leo', 'Nico', 'Pablo', 'Rafa', 'Sergio', 'Tomás', 'Ian', 'Bruno', 'Dani', 'Álex', 'Marco', 'Joel', 'Ezequiel'];
const LN = ['Vega', 'Rivas', 'Soto', 'Duarte', 'Lemos', 'Ibarra', 'Cruz', 'Morán', 'Paz', 'Quiroga', 'Ramos', 'Salas', 'Toledo', 'Urbina', 'Varela', 'Zamora', 'Ortega', 'Bravo'];
export function lineupNames(seed, n = 7) {
  let a = seed >>> 0; const r = () => { a = (Math.imul(a ^ (a >>> 15), 2246822507) + 374761393) >>> 0; return a / 4294967296; };
  return Array.from({ length: n }, () => FN[(r() * FN.length) | 0][0] + '. ' + LN[(r() * LN.length) | 0]);
}

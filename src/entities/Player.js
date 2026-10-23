import { PITCH } from '../config.js';
import { clamp } from '../util.js';

let uid = 0;
export class Player {
  constructor({ team, role, slot, fx, fy, number, attrs, kit, look, isHero = false, name = '' }) {
    this.id = uid++;
    this.team = team; this.role = role; this.slot = slot; this.fx = fx; this.fy = fy;
    this.number = number; this.attrs = attrs; this.kit = kit; this.look = look; this.isHero = isHero; this.name = name;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.face = team === 0 ? -Math.PI / 2 : Math.PI / 2; // ángulo de orientación (0 = derecha)
    this.state = 'idle'; this.stateT = 0; this.animT = Math.random() * 6; this.sprint = false;
    this.stamina = 100; this.noPick = 0; this.tackleCD = 0; this.kickT = 0; this.jumpT = 0;
    this.tx = 0; this.ty = 0; this.speedFrac = 0; this.thinkT = Math.random() * 0.4;
    this.mark = null; this.dive = null; this.celebrate = 0; this.runX = 0; this.runY = 0; this.runT = 0;
    this.ownedAt = 0; this.stats = null; this.diveDir = 0; this.gkReact = 0; this.holdT = 0;
  }
  get dirX() { return Math.cos(this.face); }
  get dirY() { return Math.sin(this.face); }
  get speed() { return Math.hypot(this.vx, this.vy); }
  /** Velocidad de carrera (u/s). */
  get runSpeed() { return 92 + this.attrs.speed * 1.0; }
  get accel() { return 260 + this.attrs.accel * 6; }
  reach() { return 17 + this.attrs.positioning * 0.06 + (this.role === 'GK' ? 8 : 0); }
  setState(s, t = 0) { this.state = s; this.stateT = t; }
  get down() { return this.state === 'fall' || this.state === 'getup'; }
  get busy() { return this.down || this.state === 'dive' || this.state === 'slide'; }
}

/** Modelo de atributos para jugadores controlados por la IA, a partir de la valoración del club. */
export function aiAttrs(rating, role, keys) {
  const a = {};
  for (const k of keys) a[k] = clamp(Math.round(rating + (Math.random() + Math.random() - 1) * 10), 25, 95);
  if (role === 'DEF') { a.balance += 6; a.positioning += 6; a.finishing -= 8; }
  if (role === 'FWD') { a.finishing += 6; a.shotPower += 5; a.speed += 4; }
  if (role === 'MID') { a.passing += 6; a.control += 4; }
  if (role === 'GK') { a.reaction += 8; a.positioning += 6; }
  return a;
}
export const FIELD = PITCH;

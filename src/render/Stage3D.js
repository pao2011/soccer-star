import * as THREE from 'three';
import { PITCH } from '../config.js';
import { clamp } from '../util.js';

const { W, L, GW, GD, BAR, PA_W, PA_D, GA_W, GA_D, CC_R, SPOT } = PITCH;
const hex = (s) => parseInt(s.slice(1), 16);
const GK_COLORS = ['#f4c20d', '#2ec4b6', '#ff5d8f', '#9d4edd'];
const ADS = ['#d00000', '#0077b6', '#ffb703', '#2a9d8f', '#7209b7', '#f77f00'];
const CROWD = ['#e63946', '#f1faee', '#ffb703', '#219ebc', '#8ecae6', '#fb8500', '#90be6d', '#b5179e'];

function gkKit(shirt, other) {
  const d = (a, b) => { const x = hex(a), y = hex(b); return Math.hypot((x >> 16) - (y >> 16), ((x >> 8) & 255) - ((y >> 8) & 255), (x & 255) - (y & 255)); };
  return GK_COLORS.find((c) => d(c, shirt) > 120 && d(c, other) > 120) || '#ffffff';
}
const canvasTex = (w, h, draw, rep) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function pitchTexture() {
  const S = 1.3, ox = 100, oy = 100;
  return canvasTex(Math.round(800 * S), Math.round(1100 * S), (g, w, h) => {
    const P = (x, y) => [(x + ox) * S, (y + oy) * S];
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#37a94b' : '#2f9e44'; g.fillRect(0, i * h / 16, w, h / 16 + 1); }
    g.strokeStyle = '#fff'; g.lineWidth = 2.6 * S; g.lineJoin = 'round';
    const rect = (x, y, ww, hh) => { const [a, b] = P(x, y); g.strokeRect(a, b, ww * S, hh * S); };
    rect(0, 0, W, L);
    g.beginPath(); g.moveTo(...P(0, L / 2)); g.lineTo(...P(W, L / 2)); g.stroke();
    g.beginPath(); g.arc(...P(W / 2, L / 2), CC_R * S, 0, 7); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(...P(W / 2, L / 2), 3 * S, 0, 7); g.fill();
    for (const [gy, d] of [[0, 1], [L, -1]]) {
      rect((W - PA_W) / 2, d > 0 ? 0 : L - PA_D, PA_W, PA_D); rect((W - GA_W) / 2, d > 0 ? 0 : L - GA_D, GA_W, GA_D);
      g.beginPath(); g.arc(...P(W / 2, gy + d * SPOT), 3 * S, 0, 7); g.fill();
      g.beginPath(); g.arc(...P(W / 2, gy + d * SPOT), CC_R * 0.8 * S, d > 0 ? 0.65 : Math.PI + 0.65, d > 0 ? Math.PI - 0.65 : Math.PI * 2 - 0.65); g.stroke();
    }
  });
}

export class Stage3D {
  constructor(parent) {
    this.parent = parent;
    this.r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.domElement.className = 'three'; this.r.domElement.style.cssText = 'display:block;touch-action:none';
    parent.appendChild(this.r.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0a1a2f); this.scene.fog = new THREE.Fog(0x0a1a2f, 700, 1800);
    this.cam = new THREE.PerspectiveCamera(70, 1, 5, 3000);
    this.scene.add(new THREE.HemisphereLight(0xdfeeff, 0x3a6b3a, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(-200, 500, 300); this.scene.add(sun);
    this.rigs = []; this.shakeT = 0; this.t = 0; this.parts = [];
    this.buildWorld();
    this.label = document.createElement('div'); this.label.className = 'aim-label'; this.label.hidden = true;
    document.getElementById('hud').appendChild(this.label);
    this.resize(window.innerWidth, window.innerHeight);
  }

  buildWorld() {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 1100), new THREE.MeshLambertMaterial({ map: pitchTexture() }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(W / 2, 0, L / 2); s.add(ground);
    const out = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), lam(0x1d3a2a)); out.rotation.x = -Math.PI / 2; out.position.set(W / 2, -0.5, L / 2); s.add(out);
    // gradas (planos inclinados con público) y muros
    const crowd = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#1b2a41'; g.fillRect(0, 0, w, h);
      for (let y = 6; y < h; y += 12) for (let x = 4; x < w; x += 10) { g.fillStyle = CROWD[(Math.random() * 8) | 0]; g.fillRect(x, y + 3, 7, 6); g.fillStyle = Math.random() < 0.6 ? '#3b2a1e' : '#e0b48a'; g.fillRect(x + 1.5, y, 4, 4); }
    }, [4, 1]);
    this.crowd = crowd;
    const stand = (cx, cz, len, rotY, tilt) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 230), new THREE.MeshBasicMaterial({ map: crowd, side: THREE.DoubleSide }));
      m.position.set(cx, 90, cz); m.rotation.set(0, rotY, 0); m.rotateX(-tilt); s.add(m);
    };
    stand(W / 2, -230, W + 600, 0, 0.62); stand(W / 2, L + 230, W + 600, Math.PI, 0.62);
    stand(-230, L / 2, L + 400, Math.PI / 2, 0.62); stand(W + 230, L / 2, L + 400, -Math.PI / 2, 0.62);
    // publicidad
    const ad = canvasTex(512, 32, (g, w, h) => { ADS.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * w / 6, 0, w / 6, h); g.fillStyle = '#ffffffcc'; g.fillRect(i * w / 6 + 10, 10, w / 6 - 20, 12); }); }, [3, 1]);
    const board = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 12, d), new THREE.MeshLambertMaterial({ map: ad })); m.position.set(x, 6, z); s.add(m); };
    board(W / 2, -58, W + 130, 3); board(W / 2, L + 58, W + 130, 3); board(-58, L / 2, 3, L + 110); board(W + 58, L / 2, 3, L + 110);
    // bancos de suplentes
    for (const z of [L * 0.42, L * 0.58]) { const b = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 70), lam(0x555b6e)); b.position.set(-100, 8, z); s.add(b); const r = new THREE.Mesh(new THREE.BoxGeometry(22, 2, 76), lam(0x1d3557, { transparent: true, opacity: 0.8 })); r.position.set(-100, 24, z); s.add(r); }
    // focos
    for (const [x, z] of [[-150, -150], [W + 150, -150], [-150, L + 150], [W + 150, L + 150]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 300), lam(0x666666)); p.position.set(x, 150, z); s.add(p);
      const l = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c9 })); l.position.set(x, 305, z); l.lookAt(W / 2, 0, L / 2); s.add(l);
    }
    // banderines y porterías
    for (const [x, z] of [[0, 0], [W, 0], [0, L], [W, L]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 20), lam(0xffffff)); p.position.set(x, 10, z); s.add(p);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), lam(0xffd23f, { side: THREE.DoubleSide })); f.position.set(x + (x ? -4.5 : 4.5), 17, z); s.add(f);
    }
    this.goal(0, 1); this.goal(L, -1);
    // elementos dinámicos
    this.ring = new THREE.Mesh(new THREE.RingGeometry(11, 13.5, 32), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; s.add(this.ring);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 4), new THREE.MeshBasicMaterial({ color: 0x00e5ff })); this.arrow.rotation.x = Math.PI; s.add(this.arrow);
    this.tring = this.ring.clone(); this.tring.material = new THREE.MeshBasicMaterial({ color: 0x9bff9b, transparent: true, side: THREE.DoubleSide }); this.tring.visible = false; s.add(this.tring);
    this.aimM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    this.aimBar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 1), this.aimM); this.aimHead = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 3), this.aimM);
    this.aimBar.visible = this.aimHead.visible = false; s.add(this.aimBar, this.aimHead);
    const ballTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#222'; for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(i * 16 + (j % 2) * 8 + 6, j * 22 + 10, 6, 0, 7); g.fill(); } });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(PITCH.BALL_R, 16, 12), new THREE.MeshLambertMaterial({ map: ballTex })); s.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(6, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.35 })); this.ballShadow.rotation.x = -Math.PI / 2; s.add(this.ballShadow);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(90 * 3), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(90 * 3), 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 5, vertexColors: true, sizeAttenuation: true })); this.pts.frustumCulled = false; s.add(this.pts);
  }

  goal(gy, dir) {
    const s = this.scene, x1 = (W - GW) / 2, x2 = (W + GW) / 2, white = lam(0xffffff);
    const net = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = '#ffffffcc'; g.lineWidth = 2; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }, [GW / 14, BAR / 14]);
    const nm = new THREE.MeshBasicMaterial({ map: net, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const post = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(PITCH.POST_R, PITCH.POST_R, BAR), white); m.position.set(x, BAR / 2, gy); s.add(m); };
    post(x1); post(x2);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(PITCH.POST_R, PITCH.POST_R, GW), white); bar.rotation.z = Math.PI / 2; bar.position.set(W / 2, BAR, gy); s.add(bar);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(GW, BAR), nm); back.position.set(W / 2, BAR / 2, gy + dir * -GD); back.rotation.y = 0; s.add(back);
    for (const x of [x1, x2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GD, BAR), nm); m.rotation.y = Math.PI / 2; m.position.set(x, BAR / 2, gy - dir * GD / 2); s.add(m); }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(GW, GD), nm); top.rotation.x = -Math.PI / 2; top.position.set(W / 2, BAR, gy - dir * GD / 2); s.add(top);
  }

  /** Construye los 14 futbolistas del partido. */
  setup(m) {
    for (const r of this.rigs) this.scene.remove(r.root);
    this.rigs = [];
    const gk = [0, 1].map((t) => gkKit(m.teams[0].kit.shirt, m.teams[1].kit.shirt));
    for (const p of m.players) this.rigs.push(this.rig(p, p.role === 'GK' ? { shirt: gk[p.team], trim: '#111111', shorts: '#222222', socks: '#222222' } : p.kit));
  }

  rig(p, k) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skin = lam(hex(p.look.skin)), shirt = lam(hex(k.shirt)), shorts = lam(hex(k.shorts)), socks = lam(hex(k.socks)), boot = lam(hex(p.look.boots));
    const limb = (x, y, len, r, mat, parent, extra) => { const g = new THREE.Group(); g.position.set(x, y, 0); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, len, 8), mat); m.position.y = -len / 2; g.add(m); extra?.(g); parent.add(g); return g; };
    const leg = (x) => limb(x, 17, 17, 2.2, socks, body, (g) => {
      const th = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.5, 8, 8), shorts); th.position.y = -4; g.add(th);
      const bt = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 7), boot); bt.position.set(0, -16.5, 1.4); g.add(bt);
    });
    const legL = leg(-3.3), legR = leg(3.3);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(13, 15, 7), shirt); torso.position.y = 24.5; body.add(torso);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 15.2, 7.2), lam(hex(k.trim))); stripe.position.y = 24.5; if (k.shirt !== k.trim) body.add(stripe);
    const arm = (x) => limb(x, 31, 12, 1.8, shirt, body, (g) => { const h = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), skin); h.position.y = -12; g.add(h); });
    const armL = arm(-7.8), armR = arm(7.8);
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.2, 14, 10), skin); head.position.y = 38; body.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(5.5, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), lam(hex(p.look.hair))); hair.position.set(0, 38.4, -0.6); body.add(hair);
    for (const x of [-1.9, 1.9]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 4), lam(0x222222)); e.position.set(x, 38.4, 4.9); body.add(e); }
    const numTex = canvasTex(64, 64, (g) => { g.fillStyle = k.shirt; g.fillRect(0, 0, 64, 64); g.fillStyle = k.shirt === k.trim ? '#fff' : k.trim; g.font = '900 44px Impact, Arial Black, sans-serif'; g.textAlign = 'center'; g.fillText(String(p.number), 32, 50); });
    const num = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: numTex })); num.position.set(0, 25, -3.6); num.rotation.y = Math.PI; body.add(num);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(9, 14), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.15; root.add(sh);
    this.scene.add(root);
    return { root, body, legL, legR, armL, armR, head, sh, p };
  }

  pose(r) {
    const p = r.p, { body, legL, legR, armL, armR } = r;
    const amp = clamp(p.speed / 150, 0, 1.2), sw = Math.sin(p.animT) * amp * 0.95;
    body.rotation.set(0, 0, 0); body.position.y = 0; legL.rotation.set(sw, 0, 0); legR.rotation.set(-sw, 0, 0); armL.rotation.set(-sw, 0, 0.1); armR.rotation.set(sw, 0, -0.1);
    r.sh.scale.setScalar(1);
    if (p.kickT > 0) legL.rotation.x = -Math.sin(Math.PI * (1 - p.kickT / 0.3)) * 1.4;
    if (p.jumpT > 0) { const j = Math.sin(Math.PI * (1 - p.jumpT / 0.5)); body.position.y = j * 14; r.sh.scale.setScalar(1 - j * 0.3); armL.rotation.x = armR.rotation.x = -2.6 * j; }
    if (p.celebrate > 0) { body.position.y = Math.abs(Math.sin(this.t * 9)) * 6; armL.rotation.x = armR.rotation.x = -3; }
    if (p.state === 'slide') { body.rotation.x = -1.0; body.position.y = 6; legL.rotation.x = legR.rotation.x = -1.2; }
    else if (p.state === 'fall') { body.rotation.x = -1.5; body.position.y = 6; }
    else if (p.state === 'getup') { body.rotation.x = -0.7; body.position.y = 3; }
    else if (p.state === 'dive') { const th = Math.PI / 2 - p.face; body.rotation.z = -p.diveDir * Math.sign(Math.cos(th) || 1) * 1.25; body.position.y = 8; armL.rotation.x = armR.rotation.x = -3; }
    else if (p.speed < 25 && p.role !== 'GK' && this.m.ball.owner && this.m.ball.owner.team !== p.team && Math.hypot(this.m.ball.owner.x - p.x, this.m.ball.owner.y - p.y) < 45) { body.rotation.x = 0.35; body.position.y = -2; }
    else if (amp > 0.5) body.rotation.x = 0.12;
  }

  burst(x, y, n) {
    for (let i = 0; i < n && this.parts.length < 90; i++) this.parts.push({ x, y, z: 20, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, vz: 150 + Math.random() * 250, c: new THREE.Color([0xffd23f, 0xff5d8f, 0x4cc9f0, 0xffffff, 0x80ed99][i % 5]), life: 2.2 });
  }
  shake(i) { this.shakeT = 0.14; this.shakeA = i * 1500; }

  resize(w, h) {
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 1.5)); this.r.setSize(w, h);
    this.cam.aspect = w / h; this.cam.fov = w > h ? 50 : 72; this.cam.updateProjectionMatrix();
  }

  /** aim: {x1,y1,x2,y2,color,txt,power,target} o null */
  draw(m, cam, aim, dt) {
    this.m = m; this.t += dt;
    const b = m.ball, hero = m.hero;
    // cámara detrás y encima del foco, mirando hacia la portería rival
    const asp = this.cam.aspect, d = clamp(125 / (Math.tan(this.cam.fov * Math.PI / 360) * asp), 240, 400), tilt = 0.8;
    const lx = cam.x, lz = cam.y + 60;
    let sx = 0, sy = 0; if (this.shakeT > 0) { this.shakeT -= dt; sx = (Math.random() - 0.5) * this.shakeA; sy = (Math.random() - 0.5) * this.shakeA; }
    this.cam.position.set(lx + sx, 12 + Math.sin(tilt) * d + sy, lz + Math.cos(tilt) * d);
    this.cam.lookAt(lx, 12, lz);
    for (const r of this.rigs) {
      const p = r.p; r.root.position.set(p.x, 0, p.y); r.root.rotation.y = Math.PI / 2 - p.face; this.pose(r);
    }
    this.ball.position.set(b.x, b.z + PITCH.BALL_R, b.y);
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 1) { this.ball.rotateOnWorldAxis(new THREE.Vector3(b.vy, 0, -b.vx).normalize(), sp * dt / PITCH.BALL_R); }
    this.ballShadow.position.set(b.x, 0.2, b.y); this.ballShadow.scale.setScalar(clamp(1 - b.z * 0.01, 0.4, 1));
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    this.ring.position.set(hero.x, 0.3, hero.y); this.ring.scale.setScalar(pulse);
    this.arrow.position.set(hero.x, 66 + Math.sin(this.t * 6) * 2, hero.y);
    // indicador de gesto
    const A = this.aimBar, H = this.aimHead;
    if (aim) {
      const dx = aim.x2 - aim.x1, dz = aim.y2 - aim.y1, len = Math.hypot(dx, dz) || 1, w = 2.5 + aim.power * 5, ang = Math.atan2(dx, dz);
      this.aimM.color.setHex(aim.color);
      A.visible = H.visible = true;
      A.scale.set(w, 1, Math.max(1, len - 14)); A.position.set(aim.x1 + dx / len * (len - 14) / 2, 1, aim.y1 + dz / len * (len - 14) / 2); A.rotation.y = ang;
      H.scale.set(w + 6, 14, w + 6); H.position.set(aim.x2 - dx / len * 7, 2, aim.y2 - dz / len * 7); H.rotation.set(Math.PI / 2, 0, 0); H.rotation.order = 'YXZ'; H.rotation.y = ang; 
      if (aim.target) { this.tring.visible = true; this.tring.position.set(aim.target.x, 0.4, aim.target.y); this.tring.material.color.setHex(aim.color); } else this.tring.visible = false;
      const v = new THREE.Vector3(aim.x2, 40, aim.y2).project(this.cam);
      this.label.hidden = false; this.label.textContent = aim.txt + '  ' + '▮'.repeat(Math.round(aim.power * 8) + 1);
      this.label.style.left = clamp((v.x * 0.5 + 0.5) * window.innerWidth, 140, window.innerWidth - 140) + 'px'; this.label.style.top = clamp((-v.y * 0.5 + 0.5) * window.innerHeight - 24, 110, window.innerHeight - 220) + 'px';
    } else { A.visible = H.visible = this.tring.visible = false; this.label.hidden = true; }
    this.crowd.offset.y = Math.abs(Math.sin(this.t * 4)) * 0.01 * (m.state === 'goal' ? 3 : 1);
    // confeti
    const pos = this.pts.geometry.attributes.position, col = this.pts.geometry.attributes.color;
    for (let i = this.parts.length - 1; i >= 0; i--) { const q = this.parts[i]; q.life -= dt; if (q.life <= 0) this.parts.splice(i, 1); else { q.vz -= 500 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z = Math.max(0, q.z + q.vz * dt); } }
    for (let i = 0; i < 90; i++) { const q = this.parts[i]; if (q) { pos.setXYZ(i, q.x, q.z, q.y); col.setXYZ(i, q.c.r, q.c.g, q.c.b); } else pos.setXYZ(i, 0, -50, 0); }
    pos.needsUpdate = col.needsUpdate = true;
    this.r.render(this.scene, this.cam);
  }

  dispose() { this.label.remove(); this.r.dispose(); this.r.domElement.remove(); }
}

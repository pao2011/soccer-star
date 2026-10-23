// Audio 100 % sintetizado con Web Audio API (sin archivos externos).
export class AudioManager {
  constructor() { this.ctx = null; this.bus = {}; this.settings = null; this.amb = null; this.musicOn = false; this.mt = null; this.step = 0; this.exc = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.bus.master = c.createGain(); this.bus.master.connect(c.destination);
    for (const k of ['sfx', 'crowd', 'music']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.bus.master); }
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.apply();
  }

  setSettings(s) { this.settings = s; this.apply(); }
  apply() {
    if (!this.ctx || !this.settings) return;
    const { vol, mute } = this.settings, t = this.ctx.currentTime;
    this.bus.master.gain.setTargetAtTime(vol.master, t, 0.02);
    for (const k of ['sfx', 'crowd', 'music']) this.bus[k].gain.setTargetAtTime(mute[k] ? 0 : vol[k], t, 0.02);
  }
  suspend() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }

  noise(dur, type, f, q, g, bus = 'sfx', when = 0, slideTo = null) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    if (slideTo) fl.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + when + dur);
    const gn = c.createGain(), t = c.currentTime + when;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + Math.min(0.01, dur / 3)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(gn); gn.connect(this.bus[bus]); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(f, dur, type, g, bus = 'sfx', when = 0, to = null) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(), gn = c.createGain(), t = c.currentTime + when;
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(this.bus[bus]); o.start(t); o.stop(t + dur + 0.05);
  }

  sfx(name, v = 1) {
    if (!this.ctx || !this.settings) return;
    switch (name) {
      case 'kick': this.noise(0.07, 'lowpass', 900, 1, 0.5 * v + 0.1); this.tone(150, 0.09, 'sine', 0.5 * v + 0.1, 'sfx', 0, 60); break;
      case 'pass': this.noise(0.05, 'lowpass', 700, 1, 0.25); this.tone(130, 0.06, 'sine', 0.25, 'sfx', 0, 70); break;
      case 'shot': this.noise(0.1, 'lowpass', 1400, 1, 0.8); this.noise(0.05, 'highpass', 3000, 1, 0.25); this.tone(110, 0.14, 'sine', 0.7, 'sfx', 0, 45); break;
      case 'post': this.tone(900, 0.5, 'sine', 0.5); this.tone(1350, 0.4, 'sine', 0.3); this.noise(0.04, 'highpass', 2500, 1, 0.4); break;
      case 'save': this.noise(0.08, 'lowpass', 500, 1, 0.7); this.noise(0.04, 'highpass', 2000, 1, 0.3); this.tone(90, 0.1, 'sine', 0.5, 'sfx', 0, 50); break;
      case 'block': this.noise(0.05, 'lowpass', 600, 1, 0.35); break;
      case 'tackle': this.noise(0.09, 'bandpass', 500, 0.8, 0.35); break;
      case 'trap': this.noise(0.03, 'lowpass', 400, 1, 0.15); break;
      case 'bounce': this.tone(100, 0.08, 'sine', 0.2 * v, 'sfx', 0, 60); break;
      case 'whistle': this.whistle(); break;
      case 'goal': this.cheer(1.6, 1); this.tone(220, 0.5, 'sawtooth', 0.12, 'sfx'); this.tone(330, 0.5, 'sawtooth', 0.1, 'sfx'); this.tone(440, 0.7, 'sawtooth', 0.1, 'sfx'); this.tone(440, 0.25, 'sawtooth', 0.1, 'sfx', 0.6); break;
      case 'click': this.tone(700, 0.05, 'square', 0.07, 'sfx', 0, 500); break;
      case 'ok': this.tone(520, 0.08, 'triangle', 0.15); this.tone(780, 0.12, 'triangle', 0.15, 'sfx', 0.08); break;
      case 'bad': this.tone(220, 0.18, 'sawtooth', 0.1, 'sfx', 0, 140); break;
      case 'oh': this.cheer(0.7, 0.4); break;
      default: break;
    }
  }
  whistle() {
    const c = this.ctx, t = c.currentTime;
    for (const [off, dur] of [[0, 0.22], [0.26, 0.5]]) {
      const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 2900; l.frequency.value = 34; lg.gain.value = 70; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(0.22, t + off + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + off + dur);
      o.connect(g); g.connect(this.bus.sfx); o.start(t + off); l.start(t + off); o.stop(t + off + dur + 0.05); l.stop(t + off + dur + 0.05);
    }
  }
  cheer(dur, v) { this.noise(dur, 'bandpass', 900, 0.7, 0.5 * v, 'crowd', 0, 1800); this.noise(dur * 1.2, 'bandpass', 500, 0.5, 0.35 * v, 'crowd'); }

  // ambiente del estadio: ruido filtrado cuya intensidad depende de la emoción
  startAmbience() {
    if (!this.ctx || this.amb) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = 0.12;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.22; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    s.connect(f); f.connect(g); g.connect(this.bus.crowd); s.start();
    this.amb = { s, g, f, lfo };
  }
  stopAmbience() { if (this.amb) { try { this.amb.s.stop(); this.amb.lfo.stop(); } catch (_) { /* ya parado */ } this.amb = null; } }
  excite(x) { if (this.amb) { const t = this.ctx.currentTime; this.amb.g.gain.setTargetAtTime(0.1 + x * 0.22, t, 0.4); this.amb.f.frequency.setTargetAtTime(500 + x * 700, t, 0.4); } }

  // música de menú opcional (secuenciador simple)
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true; this.step = 0;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    const tick = () => {
      if (!this.musicOn) return;
      const bar = (this.step >> 3) & 3, ch = chords[bar], i = this.step & 7;
      this.tone(ch[0] / 2, 0.22, 'triangle', 0.22, 'music');
      this.tone(ch[i % 3] * 2, 0.16, 'square', 0.05, 'music');
      if (i % 2 === 0) this.noise(0.04, 'highpass', 6000, 1, 0.05, 'music');
      this.step++;
    };
    tick(); this.mt = setInterval(tick, 260);
  }
  stopMusic() { this.musicOn = false; clearInterval(this.mt); }
}

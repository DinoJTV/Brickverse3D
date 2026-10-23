// audio.js — all sound is generated live with the Web Audio API (no audio files),
// so every sound is original and nothing needs licensing or downloading.
// Separate music and sound-effect volumes, plus a mute switch.

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  /** Browsers only allow audio after a click/keypress, so this is called on first input. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    this.sfxGain.connect(this.master); this.musicGain.connect(this.master);
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.applyVolumes();
    this.startMusic();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(s.sfx * 0.7, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.music * 0.22, t, 0.2);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, when = 0, attack = 0.005, slide = 0, dest } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, when = 0, freq = 2000, q = 1, type = 'bandpass' } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  /**
   * The brick "click": a hard plastic tap, a body knock whose pitch depends on the
   * piece size (big bricks sound deeper), and — when pressed onto studs — a crisp
   * second click as the tubes grip.
   */
  place(size = 2, stacked = false) {
    if (!this.ctx || this.settings.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.1;
    const body = Math.max(90, 300 - size * 22) * r;
    this.noise(0.025, { vol: 0.55, freq: 3600 * r, q: 2.5 });
    this.tone(body, 0.09, { type: 'triangle', vol: 0.3, slide: 0.55 });
    this.tone(body * 2.01, 0.05, { type: 'sine', vol: 0.12, slide: 0.7 });
    if (stacked) {
      this.noise(0.018, { vol: 0.45, freq: 5200 * r, q: 6, when: 0.035 });
      this.tone(1650 * r, 0.03, { type: 'square', vol: 0.05, when: 0.035 });
      this.noise(0.015, { vol: 0.3, freq: 6400 * r, q: 6, when: 0.055 });
    } else {
      this.noise(0.04, { vol: 0.2, freq: 900, q: 1, when: 0.01, type: 'lowpass' });
    }
  }

  play(name) {
    if (!this.ctx || this.settings.muted) return;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    switch (name) {
      case 'tick': this.noise(0.012, { vol: 0.06, freq: 5000, q: 4 }); break;
      case 'tear': this.noise(0.35, { vol: 0.4, freq: 2400, q: 0.4 }); this.noise(0.2, { vol: 0.3, freq: 5000, q: 1, when: 0.1 }); break;
      case 'clatter': for (let i = 0; i < 8; i++) this.noise(0.03, { vol: 0.25 * Math.random() + 0.1, freq: 2500 + Math.random() * 3500, q: 3, when: i * 0.035 + Math.random() * 0.03 }); break;
      case 'sort': this.noise(0.03, { vol: 0.35, freq: 3000 * r, q: 3 }); this.tone(520 * r, 0.06, { type: 'triangle', vol: 0.12 }); break;
      case 'click': this.noise(0.03, { vol: 0.15, freq: 3500, q: 2 }); break;
      case 'hover': this.tone(1400 * r, 0.03, { type: 'sine', vol: 0.03 }); break;
      case 'place': // plastic "click-clack"
        this.noise(0.04, { vol: 0.5, freq: 2600 * r, q: 3 });
        this.tone(180 * r, 0.08, { type: 'triangle', vol: 0.25, slide: 0.6 });
        this.noise(0.03, { vol: 0.25, freq: 5200 * r, q: 4, when: 0.03 });
        break;
      case 'connect': this.noise(0.03, { vol: 0.35, freq: 4200 * r, q: 5 }); this.tone(900 * r, 0.05, { type: 'square', vol: 0.05 }); break;
      case 'remove': this.noise(0.05, { vol: 0.3, freq: 1500 * r, q: 2 }); this.tone(300, 0.08, { type: 'triangle', vol: 0.15, slide: 1.5 }); break;
      case 'error': this.tone(160, 0.18, { type: 'sawtooth', vol: 0.12 }); this.tone(120, 0.22, { type: 'sawtooth', vol: 0.1, when: 0.08 }); break;
      case 'coin': [988, 1319].forEach((f, i) => this.tone(f, 0.25, { type: 'square', vol: 0.07, when: i * 0.07 })); break;
      case 'buy': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.18, when: i * 0.06 })); this.noise(0.15, { vol: 0.15, freq: 6000, when: 0.2 }); break;
      case 'page': this.noise(0.22, { vol: 0.22, freq: 2800, q: 0.5, type: 'highpass' }); this.noise(0.12, { vol: 0.12, freq: 900, q: 0.8, when: 0.08 }); break;
      case 'whoosh': this.noise(0.45, { vol: 0.35, freq: 800, q: 0.6, type: 'lowpass' }); break;
      case 'open': this.noise(0.35, { vol: 0.35, freq: 1200, q: 0.7 }); [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'sine', vol: 0.16, when: 0.25 + i * 0.07 })); break;
      case 'step': [659, 784, 988].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.16, when: i * 0.08 })); break;
      case 'complete':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, { type: 'triangle', vol: 0.17, when: i * 0.1 }));
        [262, 330, 392].forEach(f => this.tone(f, 1.4, { type: 'sine', vol: 0.12, when: 0.55, attack: 0.05 }));
        break;
      case 'levelup': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.4, { type: 'square', vol: 0.06, when: i * 0.09 })); break;
      case 'achievement': case 'sparkle': for (let i = 0; i < 6; i++) this.tone(1200 + i * 250 + Math.random() * 80, 0.18, { type: 'sine', vol: 0.08, when: i * 0.05 }); break;
      default: break;
    }
  }

  /** Gentle generative background music: soft chords and a plucked melody. */
  startMusic() {
    if (!this.ctx || this.musicTimer || this.holdMusic) return;
    const chords = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
    const scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5];
    const beat = 0.42;
    let next = this.ctx.currentTime + 0.2;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 1.2) {
        const bar = Math.floor(this.musicStep / 8) % chords.length;
        const stepInBar = this.musicStep % 8;
        const when = next - this.ctx.currentTime;
        if (stepInBar === 0) for (const f of chords[bar]) this.tone(f / 2, beat * 8, { type: 'sine', vol: 0.09, when, attack: 0.4, dest: this.musicGain });
        if ([0, 3, 5, 6].includes(stepInBar) && Math.random() < 0.8) {
          const f = scale[Math.floor(Math.random() * scale.length)];
          this.tone(f, 0.5, { type: 'triangle', vol: 0.05, when, dest: this.musicGain });
        }
        if (stepInBar % 4 === 0) this.tone(chords[bar][0] / 4, 0.6, { type: 'sine', vol: 0.12, when, dest: this.musicGain });
        this.musicStep++;
        next += beat;
      }
    };
    this.musicTimer = setInterval(schedule, 300);
    schedule();
  }
}

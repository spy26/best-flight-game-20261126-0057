// Skyline Harbor — synthesized sound: engine hum, wind and ring chimes.
// One clear job: every sound the game makes, built with WebAudio, no files.

export class SkyAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engineOscA = null;
    this.engineOscB = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windGain = null;
    this.muted = false;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call from Start / first key.
  ensureStarted() {
    if (this.started) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.context = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(ctx.destination);

      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOscA = ctx.createOscillator();
      this.engineOscA.type = 'sawtooth';
      this.engineOscA.frequency.value = 62;
      this.engineOscB = ctx.createOscillator();
      this.engineOscB.type = 'square';
      this.engineOscB.frequency.value = 93;
      const oscBGain = ctx.createGain();
      oscBGain.gain.value = 0.4;
      this.engineOscA.connect(this.engineFilter);
      this.engineOscB.connect(oscBGain);
      oscBGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOscA.start();
      this.engineOscB.start();

      // Wind: looped noise through a bandpass, loudness follows airspeed.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      noise.start();
      this.started = true;
    } catch (err) {
      // Audio is decoration: never break the game if it cannot start.
      this.context = null;
    }
  }

  setFlight(throttle, speedNorm, boosting) {
    if (!this.context || !this.started) return;
    const t = this.context.currentTime;
    const base = 55 + throttle * 55 + (boosting ? 22 : 0);
    this.engineOscA.frequency.setTargetAtTime(base, t, 0.1);
    this.engineOscB.frequency.setTargetAtTime(base * 1.5, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(320 + throttle * 900, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.1, t, 0.1);
    this.windGain.gain.setTargetAtTime(speedNorm * speedNorm * 0.16, t, 0.15);
  }

  setSilent() {
    if (!this.context || !this.started) return;
    const t = this.context.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.1);
    this.windGain.gain.setTargetAtTime(0, t, 0.1);
  }

  chime() {
    this.tone(880, 0.5, 0.35, 'sine');
    window.setTimeout(() => this.tone(1318, 0.4, 0.3, 'sine'), 90);
  }

  thud() {
    this.tone(70, 0.8, 0.5, 'triangle');
  }

  jingle() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, 0.4, 0.35, 'sine'), i * 110);
    });
  }

  tone(freq, volume, seconds, type) {
    if (!this.context || !this.started) return;
    try {
      const ctx = this.context;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + seconds + 0.05);
    } catch (err) {
      // Ignore: a missed chime is never worth an error.
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.context.currentTime, 0.05);
    }
    return this.muted;
  }
}

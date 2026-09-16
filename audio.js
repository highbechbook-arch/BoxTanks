(function () {
  "use strict";

  class BoxTanksAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.lastExplosionAt = 0;
    }

    ensureContext() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
        return this.ctx;
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;

      try {
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);
        return this.ctx;
      } catch (_) {
        this.ctx = null;
        this.master = null;
        return null;
      }
    }

    setMuted(value) {
      this.muted = !!value;
      if (this.master && this.ctx) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, now, 0.015);
      }
    }

    toggleMuted() {
      this.setMuted(!this.muted);
      if (!this.muted) this.playUi();
      return this.muted;
    }

    tone(startHz, endHz, duration, volume, type) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx || !this.master) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(Math.max(20, startHz), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + Math.min(0.008, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    noise(duration, volume, lowpassHz) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx || !this.master) return;

      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const fade = 1 - i / length;
        data[i] = (Math.random() * 2 - 1) * fade * fade;
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpassHz || 900;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(now);
    }

    playShot(fast) {
      if (fast) {
        this.tone(300, 95, 0.085, 0.24, "sawtooth");
        this.noise(0.055, 0.08, 1800);
      } else {
        this.tone(620, 240, 0.055, 0.18, "square");
      }
    }

    playMine() {
      this.tone(210, 430, 0.07, 0.15, "triangle");
    }

    playExplosion() {
      const nowMs = performance.now();
      if (nowMs - this.lastExplosionAt < 24) return;
      this.lastExplosionAt = nowMs;
      this.noise(0.19, 0.32, 700);
      this.tone(95, 42, 0.18, 0.19, "sine");
    }

    playRicochet() {
      this.tone(1050, 720, 0.035, 0.07, "triangle");
    }

    playUi() {
      this.tone(520, 720, 0.045, 0.08, "sine");
    }

    playClear() {
      if (this.muted) return;
      this.tone(520, 740, 0.08, 0.10, "sine");
      window.setTimeout(() => this.tone(740, 980, 0.10, 0.10, "sine"), 75);
    }
  }

  window.BoxTanksAudio = BoxTanksAudio;
})();

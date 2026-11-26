// audio.js — every sound is synthesized with WebAudio: a two-oscillator engine hum
// whose pitch follows the throttle, wind noise that grows with speed, and short
// cues for rings, deliveries, landings and crashes. No audio files, no network.
export function makeAudio() {
  const audio = {
    ctx: null, enabled: true, engineOsc: null, engineSub: null,
    engineGain: null, windGain: null, windFilter: null, started: false,
  };

  audio.ensure = function ensure() {
    if (audio.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AC();
      const ctx = audio.ctx;

      // Engine: sawtooth + sub sine through a lowpass, gain tied to throttle.
      audio.engineGain = ctx.createGain();
      audio.engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      audio.engineOsc = ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 62;
      audio.engineSub = ctx.createOscillator();
      audio.engineSub.type = 'sine';
      audio.engineSub.frequency.value = 31;
      const subGain = ctx.createGain();
      subGain.gain.value = 0.6;
      audio.engineOsc.connect(lp);
      audio.engineSub.connect(subGain);
      subGain.connect(lp);
      lp.connect(audio.engineGain);
      audio.engineGain.connect(ctx.destination);
      audio.engineOsc.start();
      audio.engineSub.start();

      // Wind: looped noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      audio.windFilter = ctx.createBiquadFilter();
      audio.windFilter.type = 'bandpass';
      audio.windFilter.frequency.value = 700;
      audio.windFilter.Q.value = 0.6;
      audio.windGain = ctx.createGain();
      audio.windGain.gain.value = 0;
      noise.connect(audio.windFilter);
      audio.windFilter.connect(audio.windGain);
      audio.windGain.connect(ctx.destination);
      noise.start();

      audio.started = true;
    } catch (e) {
      audio.ctx = null;
    }
  };

  // Called every frame with the flight state: engine pitch and wind follow the plane.
  audio.update = function update(flight, flying) {
    if (!audio.ctx || !audio.enabled) return;
    const t = audio.ctx.currentTime;
    const thr = flight.throttle;
    const rpm = 46 + thr * 58 + flight.speed * 0.55;
    audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    audio.engineSub.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    const engVol = flying ? 0.05 + thr * 0.075 : 0;
    audio.engineGain.gain.setTargetAtTime(engVol, t, 0.1);
    const windVol = flying ? Math.min(0.14, Math.max(0, (flight.speed - 14) * 0.0032)) : 0;
    audio.windGain.gain.setTargetAtTime(windVol, t, 0.15);
    audio.windFilter.frequency.setTargetAtTime(500 + flight.speed * 14, t, 0.2);
  };

  function blip(freq, dur, type, vol, when) {
    if (!audio.ctx || !audio.enabled) return;
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.16, ctx.currentTime + (when || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (when || 0) + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + (when || 0));
    osc.stop(ctx.currentTime + (when || 0) + dur + 0.02);
  }

  audio.ring = function ring() { blip(880, 0.16, 'sine', 0.18); blip(1318, 0.22, 'sine', 0.14, 0.09); };
  audio.delivered = function delivered() {
    blip(523, 0.16, 'triangle', 0.18); blip(659, 0.16, 'triangle', 0.18, 0.12); blip(784, 0.3, 'triangle', 0.18, 0.24);
  };
  audio.landed = function landed() { blip(392, 0.2, 'triangle', 0.14); };
  audio.crash = function crash() { blip(110, 0.5, 'sawtooth', 0.2); blip(55, 0.7, 'square', 0.14, 0.08); };
  audio.warning = function warning() { blip(660, 0.12, 'square', 0.1); blip(660, 0.12, 'square', 0.1, 0.18); };

  audio.toggle = function toggle() {
    audio.enabled = !audio.enabled;
    if (audio.ctx && audio.engineGain) {
      audio.engineGain.gain.value = 0;
      audio.windGain.gain.value = 0;
    }
    return audio.enabled;
  };

  return audio;
}

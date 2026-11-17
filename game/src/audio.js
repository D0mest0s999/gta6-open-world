// All sound is synthesized with WebAudio — no audio files. One context,
// created lazily on the first user gesture (browser autoplay rules), a
// master gain, short envelope blips for effects, and two continuous
// voices: the engine hum while driving and the police siren.

let ctx = null;
let master = null;
let engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenLfo = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch { ctx = null; }
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.25, freq = 1800, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  click: () => tone(660, 0.06, 'square', 0.12),
  shot: () => { noise(0.09, 0.3, 2600); tone(160, 0.08, 'sawtooth', 0.15, 60); },
  hit: () => noise(0.06, 0.2, 900),
  crash: (hard = 1) => { noise(0.22, 0.28 * hard, 500); tone(90, 0.2, 'triangle', 0.2 * hard, 40); },
  steal: () => { tone(392, 0.07, 'square', 0.14); tone(523, 0.09, 'square', 0.14, null, 0.07); },
  pickup: () => { tone(784, 0.07, 'square', 0.15); tone(1046, 0.1, 'square', 0.15, null, 0.06); },
  hurt: () => tone(220, 0.12, 'sawtooth', 0.16, 110),
  jingle: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'square', 0.16, null, i * 0.09)); },
  fail: () => { tone(330, 0.16, 'square', 0.15); tone(233, 0.24, 'square', 0.15, null, 0.14); },
};

// Continuous engine voice: call every frame while the player drives.
export function setEngine(on, speedRatio = 0) {
  if (!ctx) return;
  if (on && !engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.type = 'sawtooth';
    engineGain.gain.value = 0;
    engineOsc.connect(filter).connect(engineGain).connect(master);
    engineOsc.start();
  }
  if (engineOsc) {
    const target = on ? 0.05 + speedRatio * 0.05 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, ctx.currentTime, 0.08);
    if (!on && target === 0) {
      const osc = engineOsc; engineOsc = null; engineGain = null;
      setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 300);
    }
  }
}

// Continuous siren voice: level 0..1 by how close the nearest cop is.
export function setSiren(level) {
  if (!ctx) return;
  if (level > 0 && !sirenOsc) {
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenLfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 800;
    sirenLfo.frequency.value = 0.7;
    lfoGain.gain.value = 160;
    sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    sirenLfo.start();
  }
  if (sirenOsc) {
    sirenGain.gain.setTargetAtTime(level * 0.045, ctx.currentTime, 0.15);
    if (level <= 0) {
      const osc = sirenOsc, lfo = sirenLfo; sirenOsc = null; sirenLfo = null; sirenGain = null;
      setTimeout(() => { try { osc.stop(); lfo.stop(); } catch { /* already stopped */ } }, 400);
    }
  }
}

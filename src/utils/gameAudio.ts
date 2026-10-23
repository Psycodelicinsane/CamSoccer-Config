export type GameSound = 'start' | 'capture' | 'replay' | 'miss' | 'goal' | 'alert';

let audioContext: AudioContext | null = null;
let enabled = true;
let booNoiseBuffer: AudioBuffer | null = null;
const activeCrowdSources = new Set<AudioScheduledSourceNode>();

export function stopCrowdAudio() {
  activeCrowdSources.forEach(source => {
    try { source.stop(); } catch { /* La fuente ya había terminado. */ }
  });
  activeCrowdSources.clear();
}

export function setGameAudioEnabled(next: boolean) {
  enabled = next;
  if (!enabled) stopCrowdAudio();
}

export async function unlockGameAudio() {
  if (!enabled || typeof window === 'undefined') return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') await audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function tone(
  frequency: number,
  startsAt: number,
  duration: number,
  type: OscillatorType = 'square',
  endFrequency = frequency,
  volume = 0.035,
) {
  if (!enabled || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startsAt + duration);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
}

function trackCrowdSource(source: AudioScheduledSourceNode) {
  activeCrowdSources.add(source);
  source.addEventListener('ended', () => activeCrowdSources.delete(source), { once: true });
}

function booNoise(ctx: AudioContext) {
  if (booNoiseBuffer && booNoiseBuffer.sampleRate === ctx.sampleRate) return booNoiseBuffer;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < length; i += 1) {
    // Ruido ligeramente correlacionado: se parece más a una multitud que a
    // estática blanca y resulta mucho menos estridente en altavoces de móvil.
    previous = previous * 0.72 + (Math.random() * 2 - 1) * 0.28;
    channel[i] = previous;
  }
  booNoiseBuffer = buffer;
  return buffer;
}

/** Oleada de «buuu» de multitud. Devuelve false si está silenciada o bloqueada. */
export function playCrowdBoo(intensity = 0.5) {
  if (!enabled || !audioContext || audioContext.state !== 'running') return false;
  const ctx = audioContext;
  const strength = Math.max(0.15, Math.min(1, intensity));
  const now = ctx.currentTime;
  const duration = 1.45 + strength * 0.35;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(1050, now);
  lowpass.Q.setValueAtTime(0.45, now);
  const mix = ctx.createGain();
  mix.gain.setValueAtTime(0.82, now);
  lowpass.connect(mix);
  mix.connect(ctx.destination);

  const noise = ctx.createBufferSource();
  noise.buffer = booNoise(ctx);
  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(430 + strength * 90, now);
  formant.Q.setValueAtTime(0.65, now);
  const noiseGain = ctx.createGain();
  const noiseVolume = 0.022 + strength * 0.026;
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(noiseVolume, now + 0.16);
  noiseGain.gain.setValueAtTime(noiseVolume * 0.82, now + duration * 0.58);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  noise.connect(formant); formant.connect(noiseGain); noiseGain.connect(lowpass);
  trackCrowdSource(noise);
  noise.start(now); noise.stop(now + duration + 0.03);

  // Voces desafinadas con caída de tono: la suma produce el «booo» colectivo.
  const frequencies = [132, 161, 197, 239, 283];
  frequencies.forEach((frequency, index) => {
    const start = now + index * 0.024;
    const end = now + duration - index * 0.018;
    const oscillator = ctx.createOscillator();
    oscillator.type = index % 2 === 0 ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (0.70 + index * 0.018), end);
    oscillator.detune.setValueAtTime((index - 2) * 7, start);
    const voice = ctx.createGain();
    const volume = 0.007 + strength * 0.007;
    voice.gain.setValueAtTime(0.0001, start);
    voice.gain.exponentialRampToValueAtTime(volume, start + 0.13);
    voice.gain.setValueAtTime(volume * 0.84, start + (end - start) * 0.60);
    voice.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(voice); voice.connect(lowpass);
    trackCrowdSource(oscillator);
    oscillator.start(start); oscillator.stop(end + 0.03);
  });
  return true;
}

export function playGameSound(sound: GameSound) {
  if (!enabled || !audioContext || audioContext.state !== 'running') return;
  const now = audioContext.currentTime;

  switch (sound) {
    case 'start':
      tone(262, now, 0.09, 'square', 330, 0.025);
      tone(392, now + 0.1, 0.13, 'square', 523, 0.03);
      break;
    case 'capture':
      tone(520, now, 0.07, 'square', 760, 0.022);
      break;
    case 'replay':
      tone(330, now, 0.16, 'triangle', 880, 0.045);
      tone(880, now + 0.11, 0.11, 'square', 1100, 0.025);
      break;
    case 'miss':
      tone(190, now, 0.23, 'sawtooth', 75, 0.028);
      break;
    case 'goal':
      tone(392, now, 0.16, 'square', 392, 0.035);
      tone(523, now + 0.13, 0.18, 'square', 523, 0.04);
      tone(784, now + 0.28, 0.34, 'square', 988, 0.05);
      break;
    case 'alert':
      tone(660, now, 0.075, 'triangle', 760, 0.022);
      tone(880, now + 0.09, 0.11, 'triangle', 1040, 0.026);
      break;
  }
}

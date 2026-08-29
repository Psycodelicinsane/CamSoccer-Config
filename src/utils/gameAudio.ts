export type GameSound = 'start' | 'capture' | 'replay' | 'miss' | 'goal';

let audioContext: AudioContext | null = null;
let enabled = true;

export function setGameAudioEnabled(next: boolean) {
  enabled = next;
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
  }
}

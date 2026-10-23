import { MAX_COMBO } from '../levels';
import { GameMode } from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(Number.isFinite(value) ? value : 0, 0, 1);
const safeDuration = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

/** Puntuación continua de un objetivo en antena. No incluye bonus de captura o repetición. */
export function trackingScore(
  dt: number,
  importance: number,
  combo: number,
  framing: number,
  scoreMultiplier = 1,
): number {
  const q = clamp01(framing);
  const quality = 0.5 + q * 1.2 + (q > 0.72 ? 0.3 : 0);
  return safeDuration(dt) * 34 * Math.max(0, scoreMultiplier) * Math.max(0, importance) * Math.max(1, combo) * quality;
}

export function trackingCombo(dt: number, combo: number, importance: number, framing: number, difficultyCombo = 1): number {
  const q = clamp01(framing);
  return clamp(combo + safeDuration(dt) * (0.16 + Math.max(0, importance) * 0.04) * (0.4 + q) * difficultyCombo, 1, MAX_COMBO);
}

export function trackingAudience(dt: number, importance: number, framing: number, recovery = 1): number {
  return safeDuration(dt) * (2 + Math.max(0, importance) * 4) * (0.45 + clamp01(framing)) * recovery;
}

export function offAirAudienceLoss(dt: number, priorityImportance: number, drain = 1): number {
  return safeDuration(dt) * (3.2 + Math.min(Math.max(0, priorityImportance), 2.5) * 0.9) * drain;
}

export function offAirScoreLoss(dt: number, drain = 1): number {
  return safeDuration(dt) * 3 * drain;
}

export function offAirCombo(dt: number, combo: number): number {
  return clamp(combo - safeDuration(dt) * 0.45, 1, MAX_COMBO);
}

export function initialReplayCharges(mode: GameMode): number {
  return mode === 'cup' ? 3 : 2;
}

export type AudienceCollapse = {
  kind: 'finish' | 'arcade' | 'rescue';
  audience: number;
  scorePenalty: number;
  rescues: number;
};

/** Una salida por cada fotograma con audiencia a cero; Arcade nunca devuelve "finish". */
export function resolveAudienceCollapse(mode: GameMode, score: number, rescues: number): AudienceCollapse {
  const safeScore = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
  if (mode === 'arcade') {
    return { kind: 'arcade', audience: 30, scorePenalty: Math.min(250, safeScore), rescues: 0 };
  }
  if (rescues > 0) {
    return { kind: 'rescue', audience: 45, scorePenalty: Math.min(100, safeScore), rescues: Math.max(0, Math.floor(rescues) - 1) };
  }
  return { kind: 'finish', audience: 0, scorePenalty: 0, rescues: 0 };
}

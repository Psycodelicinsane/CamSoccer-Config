import { describe, expect, it } from 'vitest';
import { ARCADE_LEVELS, CUP_ROUND_RULES, DIFFICULTY_PRESETS, LEVELS, MAX_COMBO, scoreMultiplierForMode } from '../levels';
import { GameMode, LevelConfig } from '../types';
import {
  initialReplayCharges,
  offAirAudienceLoss,
  offAirCombo,
  offAirScoreLoss,
  resolveAudienceCollapse,
  trackingAudience,
  trackingCombo,
  trackingScore,
} from './balance';

function simulateBallOnly(level: LevelConfig, dutyCycle: number, mode: GameMode = 'career', cupRound = 0) {
  const difficulty = DIFFICULTY_PRESETS[level.difficulty];
  const multiplier = scoreMultiplierForMode(mode, cupRound);
  const dt = 0.1;
  let score = 0;
  let combo = 1;
  // Ciclos de 10 segundos: el jugador mantiene un plano normal y pierde
  // periódicamente la señal. No captura incidentes ni usa mejoras o repeticiones.
  for (let step = 0; step < Math.round(level.duration / dt); step += 1) {
    if (step % 100 < dutyCycle * 100) {
      score += trackingScore(dt, 1, combo, 0.55, multiplier);
      combo = trackingCombo(dt, combo, 1, 0.55, difficulty.combo);
    } else {
      score = Math.max(0, score - offAirScoreLoss(dt, difficulty.drain));
      combo = offAirCombo(dt, combo);
    }
  }
  return { score, combo };
}

describe('equilibrio de partida', () => {
  it('permite ganar el primer bronce con un seguimiento imperfecto y sin mejoras', () => {
    const result = simulateBallOnly(LEVELS[0], 0.45);
    expect(result.score).toBeGreaterThanOrEqual(LEVELS[0].cups.bronze);
    expect(result.score).toBeLessThan(LEVELS[0].cups.gold);
  });

  it.each(LEVELS.map((level, index) => ({ level, index })))(
    'mantiene alcanzable el bronce de $level.id con un 70% de seguimiento',
    ({ level }) => {
      expect(simulateBallOnly(level, 0.7).score).toBeGreaterThanOrEqual(level.cups.bronze);
    },
  );

  it.each(ARCADE_LEVELS.map(level => ({ level })))(
    'mantiene alcanzable el bronce de $level.id con el multiplicador Arcade',
    ({ level }) => {
      expect(simulateBallOnly(level, 0.7, 'arcade').score).toBeGreaterThanOrEqual(level.cups.bronze);
    },
  );

  it('exige más precisión en la final que en la inauguración', () => {
    expect(simulateBallOnly(LEVELS[0], 0.45).score).toBeGreaterThanOrEqual(LEVELS[0].cups.bronze);
    expect(simulateBallOnly(LEVELS[4], 0.45).score).toBeLessThan(LEVELS[4].cups.bronze);
    expect(DIFFICULTY_PRESETS[1].startAudience).toBeGreaterThan(DIFFICULTY_PRESETS[5].startAudience);
    expect(offAirAudienceLoss(1, 1, DIFFICULTY_PRESETS[1].drain)).toBeLessThan(offAirAudienceLoss(1, 1, DIFFICULTY_PRESETS[5].drain));
  });

  it('limita el combo y recompensa un mejor encuadre sin valores infinitos', () => {
    let combo = 1;
    for (let i = 0; i < 600; i += 1) combo = trackingCombo(0.1, combo, 1, 1, 1.1);
    expect(combo).toBe(MAX_COMBO);
    expect(trackingScore(1, 1, 2, 1)).toBeGreaterThan(trackingScore(1, 1, 2, 0.5));
    expect(trackingAudience(1, 1, 1)).toBeGreaterThan(trackingAudience(1, 1, 0.2));
    expect(trackingScore(Number.NaN, 1, 1, 1)).toBe(0);
  });

  it('aplica una sola segunda oportunidad en Iniciación', () => {
    expect(DIFFICULTY_PRESETS[1].rescues).toBe(1);
    expect(Object.values(DIFFICULTY_PRESETS).slice(1).every(preset => preset.rescues === 0)).toBe(true);
    const rescued = resolveAudienceCollapse('career', 80, 1);
    expect(rescued).toEqual({ kind: 'rescue', audience: 45, scorePenalty: 80, rescues: 0 });
    expect(resolveAudienceCollapse('career', 80, rescued.rescues).kind).toBe('finish');
  });

  it('recupera Arcade indefinidamente con una penalización acotada', () => {
    expect(resolveAudienceCollapse('arcade', 900, 0)).toEqual({ kind: 'arcade', audience: 30, scorePenalty: 250, rescues: 0 });
    expect(resolveAudienceCollapse('arcade', 90, 0)).toEqual({ kind: 'arcade', audience: 30, scorePenalty: 90, rescues: 0 });
    expect(resolveAudienceCollapse('arcade', 0, 0).kind).not.toBe('finish');
  });

  it('usa multiplicadores de modo y cargas iniciales coherentes', () => {
    expect(scoreMultiplierForMode('career')).toBe(1);
    expect(scoreMultiplierForMode('arcade')).toBe(1.15);
    CUP_ROUND_RULES.forEach((rule, index) => expect(scoreMultiplierForMode('cup', index)).toBe(rule.score));
    expect(initialReplayCharges('career')).toBe(2);
    expect(initialReplayCharges('arcade')).toBe(2);
    expect(initialReplayCharges('cup')).toBe(3);
  });
});

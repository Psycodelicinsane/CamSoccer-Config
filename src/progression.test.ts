import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, ARCADE_LEVELS, CUP_ROUNDS, LEVELS } from './levels';
import { applyRunToProfile, DEFAULT_PROFILE, directorRank, purchaseUpgrade, rewardsForRun, sanitizeProfile, UPGRADE_EFFECTS, upgradeCost } from './progression';

const stats = { captures: 12, golden: 4, replays: 2, bestCombo: 3.4 };

describe('contenido y progresión', () => {
  it('ofrece niveles únicos, una copa válida y objetivos ordenados', () => {
    expect(LEVELS).toHaveLength(5);
    expect(ARCADE_LEVELS).toHaveLength(3);
    expect(new Set(ALL_LEVELS.map(level => level.id)).size).toBe(ALL_LEVELS.length);
    expect(CUP_ROUNDS).toEqual([1, 2, 3]);
    expect(LEVELS.map(level => level.difficulty)).toEqual([1, 2, 3, 4, 5]);
    CUP_ROUNDS.forEach(levelIndex => expect(LEVELS[levelIndex]).toBeDefined());
    ALL_LEVELS.forEach(level => {
      expect(level.cups.bronze).toBeLessThan(level.cups.silver);
      expect(level.cups.silver).toBeLessThan(level.cups.gold);
      expect(level.duration).toBeGreaterThanOrEqual(60);
    });
  });

  it('cobrar una mejora descuenta monedas y nunca supera el nivel máximo', () => {
    const first = purchaseUpgrade(DEFAULT_PROFILE, 'stabilizer');
    expect(upgradeCost(DEFAULT_PROFILE, 'stabilizer')).toBe(100);
    expect(first.credits).toBe(DEFAULT_PROFILE.credits - 100);
    expect(first.upgrades.stabilizer).toBe(1);
    const rich = { ...DEFAULT_PROFILE, credits: 10000, upgrades: { stabilizer: 3, focus: 0, replay: 0 } };
    expect(purchaseUpgrade(rich, 'stabilizer')).toBe(rich);
  });

  it('guarda la mejor medalla sin degradarla y suma recompensas', () => {
    const base = { ...DEFAULT_PROFILE, medals: { 'career-local': 'gold' as const } };
    const { profile, rewards } = applyRunToProfile(base, 'career-local', 5000, 'silver', 'career', stats, false);
    expect(profile.medals['career-local']).toBe('gold');
    expect(profile.captures).toBe(12);
    expect(profile.bestCombo).toBe(3.4);
    expect(rewards.xp).toBeGreaterThan(0);
    expect(rewards.credits).toBeGreaterThan(0);
  });

  it('otorga el premio de campeón una sola vez por resultado', () => {
    const { profile } = applyRunToProfile(DEFAULT_PROFILE, 'cup:career-international', 10000, 'gold', 'cup', stats, true);
    expect(profile.cupsWon).toBe(1);
    expect(profile.credits).toBeGreaterThan(DEFAULT_PROFILE.credits + 300);
  });

  it('mantiene las mejoras acotadas y sin bonificaciones ocultas', () => {
    expect(UPGRADE_EFFECTS).toEqual({ stabilizer: 0.025, focus: 0.12, replayCapacity: 1 });
    const maxed = sanitizeProfile({ upgrades: { stabilizer: 99, focus: 99, replay: 99 } });
    expect(maxed.upgrades).toEqual({ stabilizer: 3, focus: 3, replay: 3 });
    expect(maxed.upgrades.stabilizer * UPGRADE_EFFECTS.stabilizer).toBeCloseTo(0.075);
    expect(maxed.upgrades.focus * UPGRADE_EFFECTS.focus).toBeCloseTo(0.36);
  });

  it('no multiplica dos veces las recompensas de Arcade', () => {
    const career = rewardsForRun(2400, 'silver', 'career', false);
    const arcade = rewardsForRun(2400, 'silver', 'arcade', false);
    expect(arcade).toEqual(career);
    const champion = rewardsForRun(2400, 'silver', 'cup', true);
    expect(champion.xp - career.xp).toBe(250);
    expect(champion.credits - career.credits).toBe(300);
  });

  it('guarda las medallas de Copa sin alterar las de Carrera', () => {
    const base = { ...DEFAULT_PROFILE, medals: { 'career-regional': 'gold' as const } };
    const { profile } = applyRunToProfile(base, 'cup:career-regional', 3000, 'bronze', 'cup', stats, false);
    expect(profile.medals['career-regional']).toBe('gold');
    expect(profile.medals['cup:career-regional']).toBe('bronze');
  });

  it('recupera un perfil corrupto sin producir valores inválidos', () => {
    const result = sanitizeProfile({ xp: -40, credits: Number.NaN, upgrades: { replay: 99 }, medals: { x: 'platinum' } });
    expect(result.xp).toBe(0);
    expect(result.credits).toBe(DEFAULT_PROFILE.credits);
    expect(result.upgrades.replay).toBe(3);
    expect(result.medals).toEqual({});
    expect(directorRank(result.xp).level).toBe(1);
  });
});

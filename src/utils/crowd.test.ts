import { describe, expect, it } from 'vitest';
import { createCrowdReaction, crowdOccupancy, seatThreshold, spectatorPresent, updateCrowdReaction } from './crowd';

describe('ocupación de la grada', () => {
  it('pasa de gradas llenas a vacías sin espectadores con audiencia cero', () => {
    expect(crowdOccupancy(100)).toBe(1);
    expect(crowdOccupancy(0)).toBe(0);
    for (let seed = 0; seed < 4; seed += 1) {
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 20; col += 1) {
          expect(spectatorPresent(seed, row, col, 0)).toBe(false);
        }
      }
    }
  });

  it('conserva los mismos asientos y nunca pierde gente al recuperar audiencia', () => {
    for (let seed = 0; seed < 6; seed += 1) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          expect(seatThreshold(seed, row, col)).toBe(seatThreshold(seed, row, col));
          if (spectatorPresent(seed, row, col, 35)) expect(spectatorPresent(seed, row, col, 80)).toBe(true);
        }
      }
    }
  });
});

describe('reacción sonora de la grada', () => {
  it('no abuchea con audiencia estable o creciente', () => {
    const state = createCrowdReaction(80);
    expect(updateCrowdReaction(state, 80, 1000)).toBe(0);
    expect(updateCrowdReaction(state, 90, 2000)).toBe(0);
  });

  it('espera una caída sostenida y separa las oleadas de abucheos', () => {
    const state = createCrowdReaction(80);
    expect(updateCrowdReaction(state, 79.9, 1000)).toBe(0);
    expect(updateCrowdReaction(state, 79.8, 1500)).toBe(0);
    expect(updateCrowdReaction(state, 79.7, 1700)).toBeGreaterThan(0);
    expect(updateCrowdReaction(state, 79.6, 2000)).toBe(0);
    expect(updateCrowdReaction(state, 79.5, 4600)).toBeGreaterThan(0);
  });

  it('cancela la espera al recuperar y reacciona antes con la grada crítica', () => {
    const recovered = createCrowdReaction(60);
    updateCrowdReaction(recovered, 59.9, 1000);
    expect(updateCrowdReaction(recovered, 62, 1300)).toBe(0);
    expect(updateCrowdReaction(recovered, 61.9, 1600)).toBe(0);

    const critical = createCrowdReaction(20);
    updateCrowdReaction(critical, 19.9, 1000);
    const intensity = updateCrowdReaction(critical, 19.8, 1700);
    expect(intensity).toBeGreaterThan(0.7);
    expect(updateCrowdReaction(critical, 19.7, 3200)).toBeGreaterThan(0);
  });
});

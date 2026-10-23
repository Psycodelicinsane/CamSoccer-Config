const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Porcentaje de localidades ocupadas. La audiencia cero deja la grada vacía. */
export function crowdOccupancy(audience: number) {
  return clamp(Number.isFinite(audience) ? audience : 0, 0, 100) / 100;
}

/** Hash estable: un espectador conserva su asiento aunque cambie el encuadre. */
export function seatThreshold(seed: number, row: number, col: number) {
  let hash = (Math.imul(seed + 11, 374761393) + Math.imul(row + 17, 668265263) + Math.imul(col + 23, 2246822519)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function spectatorPresent(seed: number, row: number, col: number, audience: number) {
  const index = seed + row * 131 + col * 71;
  // Pasillos y asientos reservados: incluso un estadio lleno no es una rejilla perfecta.
  if (Math.abs(index) % 17 === 0) return false;
  return seatThreshold(seed, row, col) < crowdOccupancy(audience);
}

export interface CrowdReactionState {
  previousAudience: number;
  losingSince: number | null;
  lastBooAt: number;
}

export function createCrowdReaction(audience: number): CrowdReactionState {
  return { previousAudience: clamp(audience, 0, 100), losingSince: null, lastBooAt: Number.NEGATIVE_INFINITY };
}

/**
 * Devuelve la intensidad de una nueva oleada de abucheos, o cero si todavía no toca.
 * Sólo reacciona a una caída sostenida; una recuperación cancela la espera.
 */
export function updateCrowdReaction(state: CrowdReactionState, audience: number, now: number) {
  const current = clamp(Number.isFinite(audience) ? audience : 0, 0, 100);
  const losing = current < state.previousAudience - 0.001;
  if (losing) {
    if (state.losingSince === null) state.losingSince = now;
  } else {
    state.losingSince = null;
  }
  state.previousAudience = current;

  if (!losing || state.losingSince === null || now - state.losingSince < 650) return 0;
  const cooldown = current < 25 ? 1450 : current < 50 ? 2100 : 2800;
  if (now - state.lastBooAt < cooldown) return 0;
  state.lastBooAt = now;
  return clamp(0.32 + (70 - current) / 100, 0.32, 1);
}

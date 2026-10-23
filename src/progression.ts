import { CupResult, GameMode, PlayerProfile, RunRewards, RunStats, UpgradeKey } from './types';

export const PROFILE_STORAGE_KEY = 'camsoccer_profile_v1';

export const UPGRADE_EFFECTS = {
  stabilizer: 0.025,
  focus: 0.12,
  replayCapacity: 1,
} as const;

export const DEFAULT_PROFILE: PlayerProfile = {
  version: 1,
  xp: 0,
  credits: 120,
  matches: 0,
  captures: 0,
  cupsWon: 0,
  bestCombo: 1,
  medals: {},
  upgrades: { stabilizer: 0, focus: 0, replay: 0 },
  tutorialSeen: false,
};

export const UPGRADES: Array<{
  key: UpgradeKey;
  name: string;
  shortName: string;
  description: string;
  costs: number[];
}> = [
  {
    key: 'stabilizer', name: 'Estabilizador óptico', shortName: 'Estabilizador',
    description: 'Añade 2,5 puntos de calidad al encuadre por nivel (máx. +7,5).', costs: [100, 240, 450],
  },
  {
    key: 'focus', name: 'Enfoque predictivo', shortName: 'Autoenfoque',
    description: 'Captura un 12% más rápido por nivel (máx. +36%).', costs: [120, 280, 520],
  },
  {
    key: 'replay', name: 'Servidor de repeticiones', shortName: 'Repeticiones',
    description: 'Añade 1 al máximo almacenable. No regala cargas al empezar.', costs: [150, 340, 600],
  },
];

const medalValue: Record<CupResult, number> = { failed: 0, bronze: 1, silver: 2, gold: 3 };

export function directorRank(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 350)) + 1;
  const currentFloor = 350 * (level - 1) ** 2;
  const nextFloor = 350 * level ** 2;
  return {
    level,
    current: Math.max(0, xp - currentFloor),
    needed: nextFloor - currentFloor,
    progress: Math.max(0, Math.min(1, (xp - currentFloor) / (nextFloor - currentFloor))),
  };
}

export function sanitizeProfile(input: unknown): PlayerProfile {
  if (!input || typeof input !== 'object') return { ...DEFAULT_PROFILE, medals: {}, upgrades: { ...DEFAULT_PROFILE.upgrades } };
  const value = input as Partial<PlayerProfile>;
  const safeNumber = (candidate: unknown, fallback = 0) => typeof candidate === 'number' && Number.isFinite(candidate) ? Math.max(0, candidate) : fallback;
  const upgrades = value.upgrades ?? DEFAULT_PROFILE.upgrades;
  const medals: PlayerProfile['medals'] = {};
  if (value.medals && typeof value.medals === 'object') {
    Object.entries(value.medals).forEach(([id, medal]) => {
      if (medal === 'bronze' || medal === 'silver' || medal === 'gold') medals[id] = medal;
    });
  }
  return {
    version: 1,
    xp: safeNumber(value.xp),
    credits: safeNumber(value.credits, DEFAULT_PROFILE.credits),
    matches: Math.floor(safeNumber(value.matches)),
    captures: Math.floor(safeNumber(value.captures)),
    cupsWon: Math.floor(safeNumber(value.cupsWon)),
    bestCombo: Math.max(1, safeNumber(value.bestCombo, 1)),
    medals,
    upgrades: {
      stabilizer: Math.min(3, Math.floor(safeNumber(upgrades.stabilizer))),
      focus: Math.min(3, Math.floor(safeNumber(upgrades.focus))),
      replay: Math.min(3, Math.floor(safeNumber(upgrades.replay))),
    },
    tutorialSeen: Boolean(value.tutorialSeen),
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? sanitizeProfile(JSON.parse(raw)) : sanitizeProfile(null);
  } catch {
    return sanitizeProfile(null);
  }
}

export function upgradeCost(profile: PlayerProfile, key: UpgradeKey): number | null {
  const upgrade = UPGRADES.find(item => item.key === key);
  if (!upgrade) return null;
  const level = profile.upgrades[key];
  return level >= upgrade.costs.length ? null : upgrade.costs[level];
}

export function purchaseUpgrade(profile: PlayerProfile, key: UpgradeKey): PlayerProfile {
  const cost = upgradeCost(profile, key);
  if (cost == null || profile.credits < cost) return profile;
  return {
    ...profile,
    credits: profile.credits - cost,
    upgrades: { ...profile.upgrades, [key]: profile.upgrades[key] + 1 },
  };
}

export function rewardsForRun(score: number, cup: CupResult, _mode: GameMode, cupChampion: boolean): RunRewards {
  const medalBonus = cup === 'gold' ? 90 : cup === 'silver' ? 50 : cup === 'bronze' ? 25 : 0;
  // Arcade ya multiplica la puntuación en partida; volver a multiplicar aquí
  // inflaba la economía. `_mode` mantiene compatibilidad con la API pública.
  void _mode;
  return {
    xp: Math.round(Math.max(15, score / 28) + medalBonus) + (cupChampion ? 250 : 0),
    credits: Math.round(Math.max(8, score / 170) + medalBonus * 0.65) + (cupChampion ? 300 : 0),
  };
}

export function applyRunToProfile(
  profile: PlayerProfile,
  levelId: string,
  score: number,
  cup: CupResult,
  mode: GameMode,
  stats: RunStats,
  cupChampion: boolean,
): { profile: PlayerProfile; rewards: RunRewards } {
  const rewards = rewardsForRun(score, cup, mode, cupChampion);
  const previousMedal = profile.medals[levelId];
  const medals = { ...profile.medals };
  if (cup !== 'failed' && (!previousMedal || medalValue[cup] > medalValue[previousMedal])) medals[levelId] = cup;
  return {
    rewards,
    profile: {
      ...profile,
      xp: profile.xp + rewards.xp,
      credits: profile.credits + rewards.credits,
      matches: profile.matches + 1,
      captures: profile.captures + stats.captures,
      cupsWon: profile.cupsWon + (cupChampion ? 1 : 0),
      bestCombo: Math.max(profile.bestCombo, stats.bestCombo),
      medals,
    },
  };
}

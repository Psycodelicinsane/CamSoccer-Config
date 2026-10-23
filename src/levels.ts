import { DifficultyLevel, GameMode, LevelConfig } from './types';

// Una sola curva gobierna audiencia, captura y combo. Los valores extremos son
// exigentes, pero nunca quitan más del ~6 % de audiencia por segundo sin señal.
export const DIFFICULTY_PRESETS: Record<DifficultyLevel, {
  label: string;
  startAudience: number;
  drain: number;
  recovery: number;
  capture: number;
  combo: number;
  rescues: number;
}> = {
  1: { label: 'Iniciación', startAudience: 85, drain: 0.52, recovery: 1.18, capture: 1.25, combo: 1.10, rescues: 1 },
  2: { label: 'Fácil', startAudience: 82, drain: 0.68, recovery: 1.10, capture: 1.15, combo: 1.06, rescues: 0 },
  3: { label: 'Normal', startAudience: 78, drain: 0.84, recovery: 1.04, capture: 1.07, combo: 1, rescues: 0 },
  4: { label: 'Difícil', startAudience: 74, drain: 1, recovery: 1, capture: 1, combo: 1, rescues: 0 },
  5: { label: 'Leyenda', startAudience: 70, drain: 1.12, recovery: 0.94, capture: 0.95, combo: 0.95, rescues: 0 },
};

// La carrera enseña una idea nueva en cada estadio. Todas las duraciones son
// deliberadamente cortas para que una partida quepa en una pausa en el móvil.
export const LEVELS: LevelConfig[] = [
  {
    id: 'career-local', name: 'Partido de Pueblo', duration: 90, eventInterval: 2500, rareChance: 0.05,
    icon: '🏟️', color: '#8bd450', pace: 0.95, difficulty: 1,
    incidentKinds: ['coach'], incidentGap: 22000,
    tagline: 'Primer directo · Domina el balón y el banquillo',
    stadium: { grass1: '#4a7a3a', grass2: '#3e6c32', stands: '#2a1e16', trim: '#8b7355' },
    cups: { bronze: 1500, silver: 2600, gold: 4200 },
  },
  {
    id: 'career-regional', name: 'Copa Regional', duration: 100, eventInterval: 2100, rareChance: 0.08,
    icon: '🏆', color: '#ffb703', pace: 1.12, difficulty: 2,
    incidentKinds: ['coach', 'dog', 'mascot'], incidentGap: 17000,
    tagline: 'Nueva grada · Perro y mascota en el directo',
    stadium: { grass1: '#3a8a54', grass2: '#317c49', stands: '#1a2438', trim: '#3a5a7a' },
    cups: { bronze: 2200, silver: 3600, gold: 5500 },
  },
  {
    id: 'career-national', name: 'Liga Nacional', duration: 110, eventInterval: 1800, rareChance: 0.1,
    icon: '🌟', color: '#42a5f5', pace: 1.28, difficulty: 3,
    incidentKinds: ['coach', 'dog', 'fight', 'drone'], incidentGap: 13000,
    tagline: 'Más velocidad · Drones y drama en las gradas',
    stadium: { grass1: '#2f8c4a', grass2: '#277d40', stands: '#162848', trim: '#4a6a9a' },
    cups: { bronze: 3000, silver: 4800, gold: 7200 },
  },
  {
    id: 'career-international', name: 'Copa Internacional', duration: 120, eventInterval: 1500, rareChance: 0.13,
    icon: '🌍', color: '#b388ff', pace: 1.45, difficulty: 4,
    incidentKinds: ['coach', 'dog', 'fight', 'streaker', 'mascot', 'drone', 'sprinkler'], incidentGap: 10000,
    tagline: 'Señal mundial · Aspersores y decisiones rápidas',
    stadium: { grass1: '#258a42', grass2: '#1d7a38', stands: '#18204a', trim: '#5a7ac0' },
    cups: { bronze: 4000, silver: 6300, gold: 9200 },
  },
  {
    id: 'career-final', name: 'Gran Final', duration: 120, eventInterval: 1300, rareChance: 0.16,
    icon: '👑', color: '#ffd166', pace: 1.65, difficulty: 5,
    incidentKinds: ['dog', 'fight', 'streaker', 'coach', 'mascot', 'drone', 'sprinkler', 'flare'], incidentGap: 7500,
    tagline: 'Estadio de gala · El directo definitivo',
    stadium: { grass1: '#1e9040', grass2: '#168434', stands: '#0e1836', trim: '#ffd166' },
    cups: { bronze: 5100, silver: 7800, gold: 11400 },
  },
];

// Niveles arcade independientes: entran todos los incidentes y el multiplicador
// de modo hace que sean ideales para perseguir récords sin frenar la carrera.
export const ARCADE_LEVELS: LevelConfig[] = [
  {
    id: 'arcade-rush', name: 'Fiebre del Gol', duration: 60, eventInterval: 1200, rareChance: 0.18,
    icon: '⚡', color: '#ff8a50', pace: 1.50, difficulty: 2,
    incidentKinds: ['coach', 'dog', 'mascot', 'drone'], incidentGap: 10500,
    tagline: '60 segundos · Ritmo alto y puntos ×1,15',
    stadium: { grass1: '#368e50', grass2: '#2b7a43', stands: '#282038', trim: '#ff8a50' },
    cups: { bronze: 1600, silver: 2800, gold: 4500 },
  },
  {
    id: 'arcade-chaos', name: 'Caos en Directo', duration: 75, eventInterval: 1000, rareChance: 0.24,
    icon: '💥', color: '#ff5d73', pace: 1.80, difficulty: 4,
    incidentKinds: ['coach', 'dog', 'fight', 'streaker', 'mascot', 'drone', 'sprinkler', 'flare'], incidentGap: 5800,
    tagline: 'Incidentes sin pausa · Reflejos al límite',
    stadium: { grass1: '#267a48', grass2: '#206a3d', stands: '#341a36', trim: '#ff5d73' },
    cups: { bronze: 2700, silver: 4500, gold: 7000 },
  },
  {
    id: 'arcade-legend', name: 'Noche de Leyenda', duration: 90, eventInterval: 850, rareChance: 0.3,
    icon: '🔥', color: '#e9c46a', pace: 2.00, difficulty: 5,
    incidentKinds: ['dog', 'fight', 'streaker', 'coach', 'mascot', 'drone', 'sprinkler', 'flare'], incidentGap: 5000,
    tagline: 'El desafío experto · Todo puede pasar',
    stadium: { grass1: '#1e7844', grass2: '#17663a', stands: '#17152f', trim: '#e9c46a' },
    cups: { bronze: 3900, silver: 6400, gold: 9600 },
  },
];

export const ALL_LEVELS = [...LEVELS, ...ARCADE_LEVELS];
export const CUP_ROUNDS = [1, 2, 3];
export const CUP_ROUND_NAMES = ['Clasificatorio', 'Semifinal', 'Final'];
export const CUP_ROUND_RULES = [
  { score: 1, incidentGap: 1, label: 'Reglas equilibradas' },
  { score: 1.05, incidentGap: 0.94, label: 'Más acción · puntos ×1,05' },
  { score: 1.10, incidentGap: 0.88, label: 'Final · puntos ×1,10' },
];
export const ARCADE_SCORE_MULTIPLIER = 1.15;
export const MAX_COMBO = 4;

export function scoreMultiplierForMode(mode: GameMode, cupRound = 0): number {
  if (mode === 'arcade') return ARCADE_SCORE_MULTIPLIER;
  if (mode === 'cup') return CUP_ROUND_RULES[cupRound]?.score ?? 1;
  return 1;
}

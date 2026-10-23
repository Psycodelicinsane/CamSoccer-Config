export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';
export type GameMode = 'career' | 'cup' | 'arcade';
export type CupResult = 'gold' | 'silver' | 'bronze' | 'failed';
export type UpgradeKey = 'stabilizer' | 'focus' | 'replay';
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export type EventType =
  | 'player'
  | 'shot'
  | 'goal'
  | 'coach'
  | 'nearMiss'
  | 'streaker'
  | 'dog'
  | 'fight'
  | 'boring';

export interface Event {
  id: string;
  type: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  points: number;
  audienceBoost: number;
  isRare: boolean;
  isActive: boolean;
  label: string;
}

export interface CaptureLog {
  id: string;
  type: string;
  success: boolean;
  points: number;
  timestamp: number;
}

export interface HighScore {
  score: number;
  level: string;
  date: string;
  mode?: GameMode;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  duration: number;
  eventInterval: number;
  rareChance: number;
  icon: string;
  color: string;
  pace: number;
  difficulty: DifficultyLevel;
  incidentKinds: Array<'dog' | 'streaker' | 'fight' | 'coach' | 'mascot' | 'drone' | 'sprinkler' | 'flare'>;
  incidentGap: number;
  tagline: string;
  stadium: { grass1: string; grass2: string; stands: string; trim: string };
  cups: { bronze: number; silver: number; gold: number };
}

export interface PlayerProfile {
  version: 1;
  xp: number;
  credits: number;
  matches: number;
  captures: number;
  cupsWon: number;
  bestCombo: number;
  medals: Record<string, Exclude<CupResult, 'failed'>>;
  upgrades: Record<UpgradeKey, number>;
  tutorialSeen: boolean;
}

export interface RunStats {
  captures: number;
  golden: number;
  replays: number;
  bestCombo: number;
}

export interface RunRewards {
  xp: number;
  credits: number;
}

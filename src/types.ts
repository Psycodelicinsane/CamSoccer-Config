export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';

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
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface LevelConfig {
  name: string;
  duration: number;
  eventInterval: number;
  rareChance: number;
  icon: string;
  color: string;
  pace: number;
  /** Tipos de incidente permitidos en este nivel (progresión de dificultad) */
  incidentKinds: Array<'dog' | 'streaker' | 'fight' | 'coach'>;
  /** Separación base (ms) entre incidentes; menor = más caos */
  incidentGap: number;
  /** Etiqueta corta para la pantalla de selección */
  tagline: string;
  /** Colores del estadio: césped, gradas, contorno */
  stadium: { grass1: string; grass2: string; stands: string; trim: string; };
  /** Puntuación necesaria para copa / pasar de fase */
  cups: { bronze: number; silver: number; gold: number };
}

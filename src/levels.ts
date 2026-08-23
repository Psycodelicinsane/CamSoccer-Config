import { LevelConfig } from './types';

// Cada partido = 2 minutos. Dificultad en ascenso.
// Estadios progresivamente más lujosos.
export const LEVELS: LevelConfig[] = [
  {
    name: 'Partido de Pueblo', duration: 120, eventInterval: 2500, rareChance: 0.05,
    icon: '🏟️', color: '#4CAF50', pace: 1.15,
    incidentKinds: ['coach'], incidentGap: 22000,
    tagline: 'Campo de tierra · Solo el entrenador se enfada',
    stadium: { grass1: '#4a7a3a', grass2: '#3e6c32', stands: '#2a1e16', trim: '#8b7355' },
    cups: { bronze: 2600, silver: 4200, gold: 6200 },
  },
  {
    name: 'Copa Regional', duration: 120, eventInterval: 2100, rareChance: 0.08,
    icon: '🏆', color: '#FF9800', pace: 1.28,
    incidentKinds: ['coach', 'dog'], incidentGap: 17000,
    tagline: 'Césped decente · A veces se cuela un perro',
    stadium: { grass1: '#3a8a54', grass2: '#317c49', stands: '#1a2438', trim: '#3a5a7a' },
    cups: { bronze: 4300, silver: 6500, gold: 9000 },
  },
  {
    name: 'Liga Nacional', duration: 120, eventInterval: 1800, rareChance: 0.1,
    icon: '🌟', color: '#2196F3', pace: 1.42,
    incidentKinds: ['coach', 'dog', 'fight'], incidentGap: 13000,
    tagline: 'Estadio municipal · Peleas en la grada',
    stadium: { grass1: '#2f8c4a', grass2: '#277d40', stands: '#162848', trim: '#4a6a9a' },
    cups: { bronze: 6500, silver: 9200, gold: 12500 },
  },
  {
    name: 'Copa Internacional', duration: 120, eventInterval: 1500, rareChance: 0.13,
    icon: '🌍', color: '#9C27B0', pace: 1.58,
    incidentKinds: ['coach', 'dog', 'fight', 'streaker'], incidentGap: 10000,
    tagline: 'Gran estadio · ¡Hasta intrusos!',
    stadium: { grass1: '#258a42', grass2: '#1d7a38', stands: '#18204a', trim: '#5a7ac0' },
    cups: { bronze: 9000, silver: 12500, gold: 16500 },
  },
  {
    name: 'Gran Final', duration: 120, eventInterval: 1300, rareChance: 0.16,
    icon: '⚽', color: '#FFD700', pace: 1.78,
    incidentKinds: ['dog', 'fight', 'streaker', 'coach'], incidentGap: 7500,
    tagline: 'Estadio de gala · Locura total',
    stadium: { grass1: '#1e9040', grass2: '#168434', stands: '#0e1836', trim: '#ffd166' },
    cups: { bronze: 12500, silver: 17000, gold: 22500 },
  },
];

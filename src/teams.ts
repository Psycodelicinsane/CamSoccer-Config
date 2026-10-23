import { GameMode } from './types';

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves' | 'band';

export interface TeamKit {
  primary: string;
  secondary: string;
  shorts: string;
  socks: string;
  number: string;
  pattern: KitPattern;
}

export interface TeamIdentity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  /** Color luminoso derivado de la identidad, legible sobre la interfaz oscura. */
  accent: string;
  kit: TeamKit;
  goalkeeperKit: TeamKit;
}

export interface MatchFixture {
  id: string;
  home: TeamIdentity;
  away: TeamIdentity;
}

const goalkeeper = (
  primary: string,
  secondary: string,
  shorts: string,
  socks = secondary,
): TeamKit => ({ primary, secondary, shorts, socks, number: readableTextColor(primary), pattern: 'solid' });

export const HOME_TEAM: TeamIdentity = {
  id: 'camsoccer', name: 'CamSoccer Club', shortName: 'CAM', city: 'Huelva', accent: '#ff6577',
  kit: { primary: '#e5484d', secondary: '#ffe3e3', shorts: '#7a1f24', socks: '#f4eee8', number: '#fff5f5', pattern: 'band' },
  goalkeeperKit: goalkeeper('#ffd93d', '#6b4e00', '#75600b', '#ffe888'),
};

export const TEAMS: readonly TeamIdentity[] = [
  HOME_TEAM,
  {
    id: 'costa', name: 'Atlético Costero', shortName: 'COS', city: 'Costa Azul', accent: '#68a0ff',
    kit: { primary: '#2f6bed', secondary: '#ffe08a', shorts: '#123a86', socks: '#dfe8f3', number: '#fff7d6', pattern: 'hoops' },
    goalkeeperKit: goalkeeper('#2fd47a', '#0b3d24', '#12643c', '#a8f0c8'),
  },
  {
    id: 'verde', name: 'Real Verde', shortName: 'VER', city: 'Sierra Clara', accent: '#45d69b',
    kit: { primary: '#159a68', secondary: '#efffcf', shorts: '#0d503c', socks: '#e5f6df', number: '#f4ffe9', pattern: 'stripes' },
    goalkeeperKit: goalkeeper('#ad7de8', '#3d235c', '#4c3468', '#dec8ff'),
  },
  {
    id: 'violeta', name: 'Unión Violeta', shortName: 'VIO', city: 'Villa Norte', accent: '#ae8aff',
    kit: { primary: '#8054c7', secondary: '#f4d35e', shorts: '#39255e', socks: '#eee5fa', number: '#fff3ae', pattern: 'sash' },
    goalkeeperKit: goalkeeper('#42d7c5', '#123f42', '#185c5b', '#b9fff2'),
  },
  {
    id: 'naranja', name: 'Naranja Deportivo', shortName: 'NAR', city: 'Puerto Sol', accent: '#ffab5c',
    kit: { primary: '#ed8125', secondary: '#243447', shorts: '#243447', socks: '#ffe0bc', number: '#172535', pattern: 'halves' },
    goalkeeperKit: goalkeeper('#4aa8ff', '#153b68', '#24548a', '#c0e3ff'),
  },
  {
    id: 'turquesa', name: 'Turquesa FC', shortName: 'TUR', city: 'Bahía Nueva', accent: '#4edbd0',
    kit: { primary: '#16aca8', secondary: '#103c49', shorts: '#103c49', socks: '#d7faf4', number: '#092e38', pattern: 'halves' },
    goalkeeperKit: goalkeeper('#ff70a6', '#671f43', '#8a355d', '#ffd0e3'),
  },
  {
    id: 'alba', name: 'Alba Sporting', shortName: 'ALB', city: 'Campo Blanco', accent: '#e6eef2',
    kit: { primary: '#edf2f4', secondary: '#c93448', shorts: '#24334b', socks: '#edf2f4', number: '#9f2337', pattern: 'sash' },
    goalkeeperKit: goalkeeper('#4f7ca8', '#172d43', '#294d6c', '#c2d9ec'),
  },
  {
    id: 'canario', name: 'Canario Atlético', shortName: 'CAN', city: 'Isla Dorada', accent: '#f5d765',
    kit: { primary: '#efc83f', secondary: '#27364b', shorts: '#27364b', socks: '#fff1a8', number: '#263248', pattern: 'stripes' },
    goalkeeperKit: goalkeeper('#4275d4', '#172d5c', '#27478c', '#bfd3ff'),
  },
  {
    id: 'rosa', name: 'Rosa Unión', shortName: 'ROS', city: 'Jardín Real', accent: '#ff83bb',
    kit: { primary: '#dc5a98', secondary: '#fff0f6', shorts: '#702448', socks: '#ffe4ef', number: '#fff5fa', pattern: 'hoops' },
    goalkeeperKit: goalkeeper('#9bd35a', '#354d16', '#567d2c', '#e3fac4'),
  },
  {
    id: 'nocturno', name: 'Nocturno CF', shortName: 'NOC', city: 'Ciudad Luna', accent: '#93a7d2',
    kit: { primary: '#354052', secondary: '#e0c56e', shorts: '#171d29', socks: '#303a4a', number: '#f4dc8b', pattern: 'solid' },
    goalkeeperKit: goalkeeper('#48c6d9', '#173e50', '#245f72', '#c0f3fa'),
  },
] as const;

const TEAM_BY_ID = new Map(TEAMS.map(team => [team.id, team]));

const LEVEL_OPPONENTS: Record<string, string> = {
  'career-local': 'costa',
  'career-regional': 'verde',
  'career-national': 'violeta',
  'career-international': 'naranja',
  'career-final': 'alba',
  'arcade-rush': 'turquesa',
  'arcade-chaos': 'rosa',
  'arcade-legend': 'nocturno',
};

const CUP_OPPONENTS = ['canario', 'turquesa', 'nocturno'] as const;

export function getTeam(teamId: string): TeamIdentity {
  return TEAM_BY_ID.get(teamId) ?? HOME_TEAM;
}

/** Devuelve un partido estable: reintentar no cambia el rival bajo los pies del jugador. */
export function fixtureForLevel(levelId: string, mode: GameMode, cupRound = 0): MatchFixture {
  const round = Number.isFinite(cupRound) ? Math.max(0, Math.floor(cupRound)) : 0;
  const opponentId = mode === 'cup'
    ? CUP_OPPONENTS[round % CUP_OPPONENTS.length]
    : LEVEL_OPPONENTS[levelId] ?? TEAMS[1 + (Math.abs(hashString(levelId)) % (TEAMS.length - 1))].id;
  return {
    id: `${mode}:${levelId}${mode === 'cup' ? `:${round}` : ''}`,
    home: HOME_TEAM,
    away: getTeam(opponentId),
  };
}

export const DEFAULT_FIXTURE = fixtureForLevel('career-local', 'career');
export const PRACTICE_FIXTURE = DEFAULT_FIXTURE;

export function teamKit(fixture: MatchFixture, team: 'home' | 'away', gk = false): TeamKit {
  const identity = fixture[team];
  return gk ? identity.goalkeeperKit : identity.kit;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return hash;
}

/** Contraste WCAG sencillo para texto sólido sobre los colores de cada club. */
export function readableTextColor(hex: string): '#101820' | '#f7fbff' {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map(part => part + part).join('') : normalized;
  if (!/^[\da-f]{6}$/i.test(full)) return '#f7fbff';
  const channels = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // Umbral en el que el texto oscuro y el claro ofrecen el mismo contraste.
  return luminance > 0.179 ? '#101820' : '#f7fbff';
}

import { describe, expect, it } from 'vitest';
import { ARCADE_LEVELS, CUP_ROUNDS, LEVELS } from './levels';
import { DEFAULT_FIXTURE, fixtureForLevel, readableTextColor, TEAMS, teamKit } from './teams';

describe('equipos y equipaciones', () => {
  it('ofrece un plantel variado con identidades y colores válidos', () => {
    expect(TEAMS.length).toBeGreaterThanOrEqual(9);
    expect(new Set(TEAMS.map(team => team.id)).size).toBe(TEAMS.length);
    expect(new Set(TEAMS.map(team => team.kit.pattern)).size).toBeGreaterThanOrEqual(5);
    TEAMS.forEach(team => {
      expect(team.name.length).toBeGreaterThan(3);
      expect(team.shortName).toHaveLength(3);
      expect(team.kit.primary).toMatch(/^#[\da-f]{6}$/i);
      expect(team.goalkeeperKit.primary).not.toBe(team.kit.primary);
    });
  });

  it('cambia el rival y el color entre los partidos de Carrera y Arcade', () => {
    const fixtures = [...LEVELS, ...ARCADE_LEVELS].map(level => fixtureForLevel(level.id, level.id.startsWith('arcade') ? 'arcade' : 'career'));
    fixtures.forEach(fixture => {
      expect(fixture.away.id).not.toBe(fixture.home.id);
      expect(fixture.away.kit.primary).not.toBe(fixture.home.kit.primary);
      expect(fixture.away.goalkeeperKit.primary).not.toBe(fixture.home.goalkeeperKit.primary);
    });
    expect(new Set(fixtures.map(fixture => fixture.away.id)).size).toBe(fixtures.length);
    expect(new Set(fixtures.map(fixture => fixture.away.accent)).size).toBe(fixtures.length);
  });

  it('asigna tres rivales diferentes en Copa y conserva el partido al reintentar', () => {
    const fixtures = CUP_ROUNDS.map((levelIndex, round) => fixtureForLevel(LEVELS[levelIndex].id, 'cup', round));
    expect(new Set(fixtures.map(fixture => fixture.away.id)).size).toBe(3);
    expect(fixtureForLevel(LEVELS[1].id, 'cup', 0)).toEqual(fixtures[0]);
    expect(fixtureForLevel(LEVELS[1].id, 'cup', 0)).not.toEqual(fixtureForLevel(LEVELS[1].id, 'career'));
  });

  it('selecciona el uniforme de portero y texto legible para la interfaz', () => {
    expect(teamKit(DEFAULT_FIXTURE, 'home', true)).toBe(DEFAULT_FIXTURE.home.goalkeeperKit);
    expect(teamKit(DEFAULT_FIXTURE, 'away')).toBe(DEFAULT_FIXTURE.away.kit);
    expect(readableTextColor('#ffffff')).toBe('#101820');
    expect(readableTextColor('#101820')).toBe('#f7fbff');
    expect(readableTextColor('#ed8125')).toBe('#101820');
    expect(readableTextColor('#2f6bed')).toBe('#f7fbff');
    expect(readableTextColor('invalid')).toBe('#f7fbff');
  });
});

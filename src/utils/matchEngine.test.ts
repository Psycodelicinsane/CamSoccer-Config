import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '../levels';
import { createMatchSim, EngineIncident, EngineMoment, IncidentKind, runMatchSelfTest, spawnIncident, updateMatchSim } from './matchEngine';

describe('motor del partido', () => {
  it('supera una simulación completa con goles, pases y balón controlado', () => {
    const result = runMatchSelfTest(120, 30);
    expect(result.ok).toBe(true);
    expect(result.goals).toBeGreaterThanOrEqual(1);
    expect(result.passes).toBeGreaterThan(0);
    expect(result.maxBallIdleMs).toBeLessThanOrEqual(2500);
  });

  it('mantiene los invariantes con la configuración de todos los niveles', () => {
    ALL_LEVELS.forEach(level => {
      const sim = createMatchSim(0);
      const incidents: EngineIncident[] = [];
      const moments: EngineMoment[] = [];
      for (let frame = 1; frame <= 30 * 20; frame += 1) {
        const now = frame * (1000 / 30);
        updateMatchSim(sim, incidents, moments, 1 / 30, now, {
          pace: level.pace,
          incidentKinds: level.incidentKinds,
          incidentGap: level.incidentGap,
        });
        expect(sim.players).toHaveLength(22);
        expect(Number.isFinite(sim.ball.x) && Number.isFinite(sim.ball.y)).toBe(true);
        if (sim.ball.ownerId != null) expect(sim.players.some(player => player.id === sim.ball.ownerId)).toBe(true);
      }
    });
  });

  it('genera los ocho incidentes con coordenadas y duración válidas', () => {
    const kinds: IncidentKind[] = ['dog', 'streaker', 'fight', 'coach', 'mascot', 'drone', 'sprinkler', 'flare'];
    kinds.forEach(kind => {
      const incident = spawnIncident(1000, [kind]);
      expect(incident.kind).toBe(kind);
      expect(Number.isFinite(incident.x) && Number.isFinite(incident.y)).toBe(true);
      expect(Number.isFinite(incident.vx) && Number.isFinite(incident.vy)).toBe(true);
      expect(incident.expiresAt).toBeGreaterThan(1000);
      expect(incident.label.length).toBeGreaterThan(3);
    });
  });

  it('mantiene el movimiento de los incidentes durante la celebración', () => {
    const sim = createMatchSim(0);
    sim.phase = 'goal';
    sim.goalPauseUntil = 5000;
    sim.pendingKickoffTeam = 'away';
    const incident = spawnIncident(0, ['dog']);
    incident.x = 50; incident.y = 50; incident.vx = 4; incident.vy = 0; incident.expiresAt = 10000;
    updateMatchSim(sim, [incident], [], 1, 1000, { pace: 1, incidentKinds: [], incidentGap: 1000 });
    expect(incident.x).toBeCloseTo(54);
  });

  it('emite un aviso cuando aparece un incidente especial', () => {
    const sim = createMatchSim(0);
    sim.phase = 'open';
    sim.nextIncidentAt = 0;
    const events = updateMatchSim(sim, [], [], 1 / 30, 1000, { pace: 1, incidentKinds: ['drone'], incidentGap: 10000 });
    expect(events.some(event => event.type === 'incident' && event.label.includes('Dron'))).toBe(true);
  });
});

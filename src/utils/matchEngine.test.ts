import { describe, expect, it } from 'vitest';
import { ALL_LEVELS } from '../levels';
import { createMatchSim, EngineIncident, EngineMoment, IncidentKind, runMatchSelfTest, spawnIncident, Team, updateMatchSim } from './matchEngine';

function prepareOutBall(x: number, y: number, possession: Team) {
  const sim = createMatchSim(0);
  const receiver = sim.players.find(player => player.team === possession && player.role !== 'GK') ?? sim.players[0];
  sim.phase = 'pass';
  sim.possession = possession;
  sim.nextDecisionAt = 10000;
  sim.nextIncidentAt = Number.POSITIVE_INFINITY;
  sim.forcedGoalAt = Number.POSITIVE_INFINITY;
  sim.players.forEach(player => { player.hasBall = false; });
  Object.assign(sim.ball, {
    x, y, vx: 0, vy: 0, ownerId: null, targetOwnerId: receiver.id,
    shotBy: null, looseSince: 0, leadX: x, leadY: y,
  });
  return sim;
}

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

  it('resuelve un saque de banda en la banda correcta y para el rival', () => {
    const sim = prepareOutBall(50, -2, 'home');
    const events = updateMatchSim(sim, [], [], 0, 1000, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const owner = sim.players.find(player => player.id === sim.ball.ownerId);
    expect(events.some(event => event.label === 'Banda')).toBe(true);
    expect(owner?.team).toBe('away');
    expect(sim.ball.y).toBe(2);
    expect(owner?.x).toBe(sim.ball.x);
    expect(owner?.y).toBe(sim.ball.y);
  });

  it('distingue saque de portería y córner según la línea que cruza el pase', () => {
    const goalKick = prepareOutBall(102, 50, 'home');
    const goalEvents = updateMatchSim(goalKick, [], [], 0, 1000, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const keeper = goalKick.players.find(player => player.id === goalKick.ball.ownerId);
    expect(goalEvents.some(event => event.label === 'Portería')).toBe(true);
    expect(keeper?.team).toBe('away');
    expect(keeper?.role).toBe('GK');
    expect(goalKick.ball.x).toBe(96);

    const corner = prepareOutBall(-1, 20, 'home');
    const cornerEvents = updateMatchSim(corner, [], [], 0, 1000, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const taker = corner.players.find(player => player.id === corner.ball.ownerId);
    expect(cornerEvents.some(event => event.label === 'Corner')).toBe(true);
    expect(taker?.team).toBe('away');
    expect(taker?.role).not.toBe('GK');
    expect(corner.ball.x).toBe(2);
    expect(corner.ball.y).toBe(2);
  });

  it('resuelve el gol garantizado y limpia el estado antes del siguiente saque', () => {
    const sim = createMatchSim(0);
    sim.phase = 'open';
    sim.forcedGoalAt = 0;
    sim.nextIncidentAt = Number.POSITIVE_INFINITY;

    const shotEvents = updateMatchSim(sim, [], [], 0, 0, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const scoring = sim.ball.shotBy;
    expect(shotEvents.some(event => event.type === 'shot')).toBe(true);
    expect(scoring).not.toBeNull();
    expect(sim.forcedGoalDone).toBe(true);
    expect(sim.phase).toBe('shot');

    Object.assign(sim.ball, { x: scoring === 'home' ? 101 : -1, y: 50, vx: 0, vy: 0, looseSince: 0 });
    const goalEvents = updateMatchSim(sim, [], [], 0, 1600, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const expectedKickoff = scoring === 'home' ? 'away' : 'home';
    expect(goalEvents.some(event => event.type === 'goal' && event.team === scoring)).toBe(true);
    expect(sim.homeGoals + sim.awayGoals).toBe(1);
    expect(sim.phase).toBe('goal');
    expect(sim.pendingKickoffTeam).toBe(expectedKickoff);

    updateMatchSim(sim, [], [], 0, sim.goalPauseUntil + 1, { pace: 1, incidentKinds: [], incidentGap: 10000 });
    const starter = sim.players.find(player => player.id === sim.ball.ownerId);
    expect(sim.phase).toBe('kickoff');
    expect(sim.pendingKickoffTeam).toBeNull();
    expect(sim.goalPauseUntil).toBe(0);
    expect(starter?.team).toBe(expectedKickoff);
    expect(sim.ball.x).toBe(50);
    expect(sim.ball.shotBy).toBeNull();
  });
});

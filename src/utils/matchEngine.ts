// Motor de simulación de partido puro (sin DOM/React).
// Permite ejecutarlo en el juego y en el self-test headless.

export type Team = 'home' | 'away';
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export type MatchPhase = 'kickoff' | 'open' | 'pass' | 'shot' | 'goal';
export type MomentKind = 'pass' | 'longpass' | 'shot' | 'goal' | 'save' | 'tackle' | 'recover' | 'dribble' | 'foul';
export type IncidentKind = 'dog' | 'streaker' | 'fight' | 'coach';

export interface EnginePlayer {
  id: number;
  team: Team;
  number: number;
  role: Role;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  targetX: number;
  targetY: number;
  speed: number;
  hasBall: boolean;
}

export interface EngineBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number | null;
  targetOwnerId: number | null;
  shotBy: Team | null;
  looseSince: number | null;
  /** Punto de llegada previsto: el receptor corre a recibirla ahí (sin teletransportes) */
  leadX: number;
  leadY: number;
}

export interface EngineMoment {
  id: string;
  kind: MomentKind;
  x: number;
  y: number;
  label: string;
  importance: number;
  color: string;
  expiresAt: number;
  caught: boolean;
}

export interface EngineIncident {
  id: string;
  kind: IncidentKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  label: string;
  color: string;
  importance: number;
  expiresAt: number;
  caught: boolean;
  /** Momento de aparición: permite avisar al realizador antes de que sea tarde */
  bornAt: number;
}

export interface MatchEvent {
  type: 'goal' | 'save' | 'shot' | 'pass' | 'longpass' | 'tackle' | 'recover' | 'dribble' | 'foul';
  x: number;
  y: number;
  label: string;
  team?: Team;
}

export interface MatchSim {
  players: EnginePlayer[];
  ball: EngineBall;
  possession: Team;
  phase: MatchPhase;
  homeGoals: number;
  awayGoals: number;
  nextDecisionAt: number;
  nextIncidentAt: number;
  kickoffUntil: number;
  lastComment: string;
  /** Jugador que hizo el último pase (para paredes / ida y vuelta) */
  lastPasserId: number | null;
  /** Tras un centro al área: la siguiente decisión dispara con mucha probabilidad */
  shotBias: number;
  /** Evita paredes en bucle A↔B */
  passStreak: number;
  /** Garantiza al menos 1 gol por partido */
  forcedGoalAt: number;
  forcedGoalDone: boolean;
  /** Mantiene la pelota dentro de la red antes del saque de centro */
  goalPauseUntil: number;
  pendingKickoffTeam: Team | null;
}

export interface SelfTestResult {
  ok: boolean;
  seconds: number;
  goals: number;
  passes: number;
  tackles: number;
  saves: number;
  maxBallIdleMs: number;
}

export interface MatchTuning {
  /** Multiplicador global de ritmo (1 = tranquilo, >1 = frenético) */
  pace: number;
  /** Incidentes permitidos según el nivel */
  incidentKinds: IncidentKind[];
  /** Separación base (ms) entre incidentes */
  incidentGap: number;
}

const DEFAULT_TUNING: MatchTuning = {
  pace: 1,
  incidentKinds: ['dog', 'streaker', 'fight', 'coach'],
  incidentGap: 14000,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const attackDir = (team: Team) => team === 'home' ? 1 : -1;

// 4-3-3 con laterales y extremos pegados a las bandas (y ≈ 9 y 91)
const FORMATION: Array<[Role, number, number]> = [
  ['GK', 7, 50],
  ['DEF', 20, 9], ['DEF', 20, 36], ['DEF', 20, 64], ['DEF', 20, 91],
  ['MID', 42, 24], ['MID', 42, 50], ['MID', 42, 76],
  ['FWD', 66, 9], ['FWD', 70, 50], ['FWD', 66, 91],
];

let seq = 1;
const uid = (prefix: string) => `${prefix}${seq++}`;

export function createPlayers(): EnginePlayer[] {
  const players: EnginePlayer[] = [];
  let id = 1;

  FORMATION.forEach(([role, x, y], index) => {
    players.push({
      id: id++,
      team: 'home',
      number: index + 1,
      role,
      x,
      y,
      baseX: x,
      baseY: y,
      targetX: x,
      targetY: y,
      speed: role === 'GK' ? 6 : role === 'FWD' ? 11 : 9,
      hasBall: false,
    });
  });

  FORMATION.forEach(([role, x, y], index) => {
    const mirrorX = 100 - x;
    players.push({
      id: id++,
      team: 'away',
      number: index + 1,
      role,
      x: mirrorX,
      y,
      baseX: mirrorX,
      baseY: y,
      targetX: mirrorX,
      targetY: y,
      speed: role === 'GK' ? 6 : role === 'FWD' ? 11 : 9,
      hasBall: false,
    });
  });

  return players;
}

export function createMatchSim(now: number): MatchSim {
  const players = createPlayers();
  const possession: Team = Math.random() > 0.5 ? 'home' : 'away';
  const starter = players.find(p => p.team === possession && p.role === 'MID') ?? players[0];
  starter.x = 50;
  starter.y = 50;
  starter.hasBall = true;

  return {
    players,
    possession,
    phase: 'kickoff',
    ball: { x: 50, y: 50, vx: 0, vy: 0, ownerId: starter.id, targetOwnerId: null, shotBy: null, looseSince: null, leadX: 50, leadY: 50 },
    homeGoals: 0,
    awayGoals: 0,
    nextDecisionAt: now + 1400,
    nextIncidentAt: now + 9000 + Math.random() * 9000,
    kickoffUntil: now + 900,
    lastComment: `Saca el equipo ${possession === 'home' ? 'rojo' : 'azul'}`,
    lastPasserId: null,
    shotBias: 0,
    passStreak: 0,
    // Entre el min 0:45 y 1:40 fuerza un gol si aún no ha habido
    forcedGoalAt: now + 45000 + Math.random() * 55000,
    forcedGoalDone: false,
    goalPauseUntil: 0,
    pendingKickoffTeam: null,
  };
}

const DEFAULT_INCIDENTS: IncidentKind[] = ['dog', 'streaker', 'fight', 'coach'];

export function spawnIncident(now: number, allowed: IncidentKind[] = DEFAULT_INCIDENTS): EngineIncident {
  const pool = allowed.length > 0 ? allowed : DEFAULT_INCIDENTS;
  const kind = pool[Math.floor(Math.random() * pool.length)];

  if (kind === 'dog') {
    // El perro aparece desde cualquiera de los 4 lados y cruza el campo hacia otro lado
    const entrySide = Math.floor(Math.random() * 4); // 0: Izq, 1: Der, 2: Arriba, 3: Abajo
    let startX = 0, startY = 0, targetX = 0, targetY = 0;
    if (entrySide === 0) {
      startX = -8; startY = 20 + Math.random() * 60;
      targetX = 108; targetY = 20 + Math.random() * 60;
    } else if (entrySide === 1) {
      startX = 108; startY = 20 + Math.random() * 60;
      targetX = -8; targetY = 20 + Math.random() * 60;
    } else if (entrySide === 2) {
      startX = 15 + Math.random() * 70; startY = -12;
      targetX = 15 + Math.random() * 70; targetY = 112;
    } else {
      startX = 15 + Math.random() * 70; startY = 112;
      targetX = 15 + Math.random() * 70; targetY = -12;
    }
    const duration = 8.5; // Tarda ~8.5s en cruzar
    const vx = (targetX - startX) / duration;
    const vy = (targetY - startY) / duration;
    return {
      id: uid('inc_'),
      kind: 'dog',
      x: startX,
      y: startY,
      vx,
      vy,
      label: '¡Perro en el campo!',
      color: '#f4a261',
      importance: 3.2,
      expiresAt: now + duration * 1000,
      caught: false,
      bornAt: now,
    };
  }
  if (kind === 'streaker') {
    const fromTop = Math.random() > 0.5;
    const startX = 20 + Math.random() * 60;
    const startY = fromTop ? -10 : 110;
    const targetY = fromTop ? 110 : -10;
    const duration = 7.5;
    return {
      id: uid('inc_'),
      kind: 'streaker',
      x: startX,
      y: startY,
      vx: (Math.random() - 0.5) * 6,
      vy: (targetY - startY) / duration,
      label: '¡Intruso corriendo!',
      color: '#ff3366',
      importance: 3.8,
      expiresAt: now + duration * 1000,
      caught: false,
      bornAt: now,
    };
  }
  if (kind === 'fight') {
    // La bronca puede estallar en cualquiera de las 4 gradas
    const side = Math.floor(Math.random() * 4);
    let fx = 20 + Math.random() * 60;
    let fy = -14;
    if (side === 1) { fy = 114; }
    else if (side === 2) { fx = -14; fy = 15 + Math.random() * 70; }
    else if (side === 3) { fx = 114; fy = 15 + Math.random() * 70; }
    const zone = side === 0 ? 'norte' : side === 1 ? 'sur' : side === 2 ? 'oeste' : 'este';
    return {
      id: uid('inc_'),
      kind: 'fight',
      x: fx,
      y: fy,
      vx: 0,
      vy: 0,
      label: `¡Pelea en la grada ${zone}!`,
      color: '#ffb703',
      importance: 3.4,
      expiresAt: now + 7500,
      caught: false,
      bornAt: now,
    };
  }
  // Entrenador cabreado: sale de su banquillo (arriba o abajo) a protestar al área técnica
  const isTopBench = Math.random() > 0.5;
  const startX = 40 + Math.random() * 20;
  const startY = isTopBench ? -5.5 : 105.5;
  const walkVx = (Math.random() - 0.5) * 4;
  return {
    id: uid('inc_'),
    kind: 'coach',
    x: startX,
    y: startY,
    vx: walkVx,
    vy: isTopBench ? 2.2 : -2.2, // camina hacia la línea de banda
    label: '¡Entrenador fuera de sí!',
    color: '#9c27b0',
    importance: 2.5,
    expiresAt: now + 7000,
    caught: false,
    bornAt: now,
  };
}

function setBallOwner(sim: MatchSim, owner: EnginePlayer) {
  sim.players.forEach(p => { p.hasBall = p.id === owner.id; });
  const b = sim.ball;
  // Si el balón estaba suelto, NO movemos la pelota hasta el jugador:
  // el jugador llega a la pelota. Así no aparece/desaparece en recepciones,
  // robos y paradas.
  // La pelota es la autoridad visual: cuando alguien la recupera, el jugador
  // llega hasta ella. Nunca recolocamos la pelota junto al jugador, porque eso
  // produce el salto/teletransporte que se ve como una desaparición.
  const preserveBall = b.ownerId == null && b.looseSince != null;
  if (preserveBall) {
    owner.x = clamp(b.x, 1, 99);
    owner.y = clamp(b.y, 2, 98);
  }
  b.ownerId = owner.id;
  b.targetOwnerId = null;
  b.shotBy = null;
  b.vx = 0;
  b.vy = 0;
  b.looseSince = null;
  if (!preserveBall) {
    b.x = owner.x;
    b.y = owner.y;
  }
  b.leadX = owner.x;
  b.leadY = owner.y;
  sim.possession = owner.team;
  sim.phase = 'open';
}

function nearestPlayer(sim: MatchSim, x: number, y: number, excludeId?: number): EnginePlayer | null {
  let best: EnginePlayer | null = null;
  let bestDist = Infinity;
  for (const p of sim.players) {
    if (p.id === excludeId) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

function choosePassTarget(sim: MatchSim, carrier: EnginePlayer): EnginePlayer {
  const dir = attackDir(carrier.team);
  // SOLO compañeros de equipo. Nunca al contrario.
  let mates = sim.players.filter(p => p.team === carrier.team && p.id !== carrier.id && p.role !== 'GK');
  // Evitar devolver al que acaba de pasar (rompe bucles A↔B)
  if (sim.lastPasserId != null && mates.length > 1) {
    mates = mates.filter(p => p.id !== sim.lastPasserId);
  }
  // Priorizar por delante, y también por banda (variedad de recorrido)
  const ahead = mates.filter(p => (p.x - carrier.x) * dir > 3);
  const wing = mates.filter(p => Math.abs(p.baseY - 50) > 22 && (p.x - carrier.x) * dir > -4);
  const nearby = mates.filter(p => (p.x - carrier.x) * dir > -8);
  let pool = ahead.length > 0 ? ahead : nearby.length > 0 ? nearby : mates;
  // 35% de las veces abre a la banda aunque haya opciones centrales
  if (wing.length > 0 && Math.random() < 0.35) pool = wing;
  pool = [...pool].sort((a, b) => (b.x - carrier.x) * dir - (a.x - carrier.x) * dir);
  if (pool.length > 1 && Math.random() < 0.4) {
    return pool[1 + Math.floor(Math.random() * Math.min(3, pool.length - 1))];
  }
  return pool[0] ?? sim.players.find(p => p.team === carrier.team && p.id !== carrier.id) ?? carrier;
}

// Pase de 3 puntos: busca el compañero MÁS adelantado (cambio de juego)
function chooseLongPassTarget(sim: MatchSim, carrier: EnginePlayer): EnginePlayer {
  const dir = attackDir(carrier.team);
  const mates = sim.players.filter(p => p.team === carrier.team && p.id !== carrier.id && p.role !== 'GK');
  const forward = mates.filter(p => (p.x - carrier.x) * dir > 14);
  const pool = forward.length > 0 ? forward : mates;
  let best = pool[0];
  let bestProgress = -Infinity;
  for (const p of pool) {
    const progress = (p.x - carrier.x) * dir;
    if (progress > bestProgress) {
      bestProgress = progress;
      best = p;
    }
  }
  return best;
}

function addMoment(
  sim: MatchSim,
  moments: EngineMoment[],
  kind: MomentKind,
  x: number,
  y: number,
  label: string,
  importance: number,
  color: string,
  now: number,
  life: number,
) {
  sim.lastComment = label;
  moments.push({ id: uid('m_'), kind, x, y, label, importance, color, expiresAt: now + life, caught: false });
}

function resetForKickoff(sim: MatchSim, now: number, possession: Team) {
  sim.players = createPlayers();
  const starter = sim.players.find(p => p.team === possession && p.role === 'MID') ?? sim.players[0];
  starter.x = 50;
  starter.y = 50;
  starter.hasBall = true;
  sim.ball = { x: 50, y: 50, vx: 0, vy: 0, ownerId: starter.id, targetOwnerId: null, shotBy: null, looseSince: null, leadX: 50, leadY: 50 };
  sim.possession = possession;
  sim.phase = 'kickoff';
  sim.kickoffUntil = now + 1000;
  sim.nextDecisionAt = now + 1500;
  sim.lastPasserId = null;
  sim.shotBias = 0;
  sim.passStreak = 0;
}

/**
 * Avanza la simulación un paso. `dt` en segundos, `now` en ms.
 * Garantías: el balón nunca queda sin dueño más de ~2s, los tiros siem­
 * pre se resuelven y no se produce NaN.
 */
export function updateMatchSim(
  sim: MatchSim,
  incidents: EngineIncident[],
  moments: EngineMoment[],
  dt: number,
  now: number,
  tuning: MatchTuning = DEFAULT_TUNING,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const pace = tuning.pace;

  // ---- Fase de GOL ----
  if (sim.phase === 'goal') {
    if (now > sim.goalPauseUntil) {
      resetForKickoff(sim, now, sim.pendingKickoffTeam ?? (sim.possession === 'home' ? 'away' : 'home'));
    } else {
      // El balón rueda lento y se frena dentro de la red
      const b = sim.ball;
      b.vx *= Math.exp(-4 * dt);
      b.vy *= Math.exp(-4 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // Mantener dentro de la red
      if (sim.pendingKickoffTeam === 'home') {
        // Marcó el visitante (away), portería izquierda (x=0)
        b.x = clamp(b.x, -4, 1.5);
      } else {
        // Marcó el local (home), portería derecha (x=100)
        b.x = clamp(b.x, 98.5, 104);
      }
      b.y = clamp(b.y, 41, 59);

      // Comportamiento de los jugadores durante el festejo
      for (const p of sim.players) {
        const isScoringTeam = p.team !== sim.pendingKickoffTeam;
        if (isScoringTeam) {
          // El equipo que marcó corre a celebrar saltando
          p.targetX = sim.pendingKickoffTeam === 'home' ? 14 : 86; // bandera de córner rival
          p.targetY = 22 + (p.id % 4) * 12;
          // Velocidad de festejo animada (saltando arriba y abajo)
          const d = dist(p.x, p.y, p.targetX, p.targetY);
          const step = Math.min(d, p.speed * 1.2 * dt);
          if (d > 1) {
            p.x += ((p.targetX - p.x) / d) * step;
            p.y += ((p.targetY - p.y) / d) * step;
          }
        } else {
          // El equipo que encajó camina cabizbajo
          p.targetX = p.baseX;
          p.targetY = p.baseY;
          const d = dist(p.x, p.y, p.targetX, p.targetY);
          const step = Math.min(d, p.speed * 0.4 * dt);
          if (d > 1) {
            p.x += ((p.targetX - p.x) / d) * step;
            p.y += ((p.targetY - p.y) / d) * step;
          }
        }
      }
      return events; // no se procesa nada más durante el festejo
    }
  }

  if (sim.phase === 'kickoff' && now > sim.kickoffUntil) sim.phase = 'open';

  // ---- Incidentes de grada (progresión por nivel) ----
  if (now > sim.nextIncidentAt) {
    if (tuning.incidentKinds.length > 0) {
      incidents.push(spawnIncident(now, tuning.incidentKinds));
    }
    // Gap con variación aleatoria; niveles altos = más caos
    sim.nextIncidentAt = now + tuning.incidentGap + Math.random() * tuning.incidentGap * 0.8;
  }
  for (let i = incidents.length - 1; i >= 0; i -= 1) {
    const inc = incidents[i];
    inc.x += inc.vx * dt;
    inc.y += inc.vy * dt;
    // Los límites cubren las 4 gradas (-20..120): si no, los incidentes de
    // grada lateral se eliminarían nada más aparecer.
    if (now >= inc.expiresAt || inc.x < -22 || inc.x > 122 || inc.y < -22 || inc.y > 122) incidents.splice(i, 1);
  }
  for (let i = moments.length - 1; i >= 0; i -= 1) {
    if (now >= moments[i].expiresAt) moments.splice(i, 1);
  }

  const ball = sim.ball;
  const owner = ball.ownerId != null ? sim.players.find(p => p.id === ball.ownerId) ?? null : null;

  // ---- Movimiento de jugadores ----
  for (const player of sim.players) {
    const isAttacking = player.team === sim.possession;
    const laneNoise = Math.sin(now * 0.001 + player.id * 1.7) * 2.2;
    const push = isAttacking ? 9 * attackDir(player.team) : -5 * attackDir(player.team);

    if (player.hasBall) {
      // El portador avanza y mezcla banda / interior según su baseY
      const wingPull = (player.baseY - 50) * 0.35;
      player.targetX = clamp(player.x + attackDir(player.team) * (8 + Math.random() * 3), 5, 95);
      player.targetY = clamp(player.y * 0.35 + (player.baseY + wingPull) * 0.65 + Math.sin(now * 0.0011 + player.id) * 6, 8, 92);
    } else if (player.id === ball.targetOwnerId && ball.looseSince != null) {
      // El receptor CORRE a recibir el balón: nada de teletransportes
      player.targetX = clamp(ball.leadX, 5, 95);
      player.targetY = clamp(ball.leadY, 5, 95);
    } else if (player.role === 'GK') {
      player.targetX = player.team === 'home' ? 7 : 93;
      player.targetY = clamp(ball.y, 36, 64);
    } else {
      const ballBias = player.team === sim.possession ? 0.18 : 0.32;
      // Laterales y extremos se mantienen abiertos; interiores más centrados
      const laneKeep = Math.abs(player.baseY - 50) > 22 ? 0.75 : 0.45;
      player.targetX = clamp(player.baseX + push + (ball.x - 50) * ballBias, 7, 93);
      player.targetY = clamp(player.baseY * laneKeep + ball.y * (1 - laneKeep) * 0.55 + laneNoise, 8, 92);
    }

    if (!player.hasBall) {
      const toTarget = dist(player.x, player.y, player.targetX, player.targetY);
      const step = Math.min(toTarget, player.speed * dt * (sim.phase === 'kickoff' ? 0.35 : 1));
      if (toTarget > 0.05) {
        player.x += ((player.targetX - player.x) / toTarget) * step;
        player.y += ((player.targetY - player.y) / toTarget) * step;
      }
    }
  }

  // ---- Balón en posesión ----
  if (owner) {
    const dribbleStep = owner.speed * 0.58 * dt;
    const moveDist = dist(owner.x, owner.y, owner.targetX, owner.targetY);
    if (moveDist > 0.1) {
      owner.x += ((owner.targetX - owner.x) / moveDist) * dribbleStep;
      owner.y += ((owner.targetY - owner.y) / moveDist) * dribbleStep;
    }
    owner.x = clamp(owner.x, 3, 97);
    owner.y = clamp(owner.y, 4, 96);
    ball.x = clamp(owner.x + attackDir(owner.team) * 0.9, 1, 99);
    ball.y = clamp(owner.y, 2, 98);
  } else {
    // ---- Balón suelto ----
    if (ball.looseSince == null) ball.looseSince = now;
    // Frenado dependiente de dt (independiente del refresco).
    // Los tiros rozan menos para llegar a la línea; los pases frena menos
    // para que el receptor la atrape corriendo (sin pelotas perdidas).
    const drag = Math.exp((sim.phase === 'shot' ? -0.45 : -0.75) * dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= drag;
    ball.vy *= drag;
    if (ball.y < 1 || ball.y > 99) {
      ball.y = clamp(ball.y, 1, 99);
      ball.vy *= -0.7;
    }

    const looseTime = now - ball.looseSince;

    // Pase: recepción, intercepción o salida
    if (sim.phase === 'pass' && ball.targetOwnerId != null) {
      const receiver = sim.players.find(p => p.id === ball.targetOwnerId) ?? null;
      if (receiver && dist(ball.x, ball.y, receiver.x, receiver.y) < 4.6) {
        const passerId = sim.lastPasserId;
        const passer = passerId != null ? sim.players.find(p => p.id === passerId) : null;
        setBallOwner(sim, receiver);
        sim.nextDecisionAt = now + 500 + Math.random() * 700;
        sim.lastComment = 'Pase recibido';
        events.push({ type: 'recover', x: receiver.x, y: receiver.y, label: 'Pase recibido' });
        // Centro largo al área: el receptor remata con mucha probabilidad
        if (passer && dist(passer.x, passer.y, receiver.x, receiver.y) > 22) sim.shotBias = 1;

        // Pared puntual: solo 1 ida y vuelta, nunca en bucle
        if (passerId != null && sim.passStreak < 1 && Math.random() < 0.18) {
          const passer = sim.players.find(p => p.id === passerId);
          if (passer && passer.team === receiver.team && passer.id !== receiver.id) {
            receiver.hasBall = false;
            ball.ownerId = null;
            ball.targetOwnerId = passer.id;
            ball.shotBy = null;
            sim.lastPasserId = receiver.id;
            sim.passStreak += 1;
            const backX = clamp(passer.x + attackDir(passer.team) * 6, 6, 94);
            const backY = clamp(passer.y + (Math.random() - 0.5) * 5, 8, 92);
            const travel = (0.8 + Math.random() * 0.3) / pace;
            ball.vx = (backX - ball.x) / travel;
            ball.vy = (backY - ball.y) / travel;
            ball.leadX = backX;
            ball.leadY = backY;
            sim.phase = 'pass';
            sim.nextDecisionAt = now + 1000;
            addMoment(sim, moments, 'pass', ball.x, ball.y, 'Pared · ida y vuelta', 1.55, '#4dd2ff', now, 1800);
            events.push({ type: 'pass', x: ball.x, y: ball.y, label: 'Pared' });
          }
        } else {
          sim.passStreak = 0;
        }
      } else if (looseTime > 550) {
        // Intercepción rara y solo si el rival está encima del balón
        const challenger = nearestPlayer(sim, ball.x, ball.y, receiver ? receiver.id : undefined);
        if (
          challenger &&
          receiver &&
          challenger.team !== receiver.team &&
          dist(challenger.x, challenger.y, ball.x, ball.y) < 1.8 &&
          Math.random() < 0.35
        ) {
          setBallOwner(sim, challenger);
          sim.nextDecisionAt = now + 450;
          sim.passStreak = 0;
          addMoment(sim, moments, 'tackle', ball.x, ball.y, 'Pase interceptado', 1.7, '#00ff88', now, 1800);
          events.push({ type: 'tackle', x: ball.x, y: ball.y, label: 'Interceptado' });
        }
      }

      // Saque de banda o de portería según el lado y la zona
      if (sim.phase === 'pass' && (ball.x < 2 || ball.x > 98)) {
        const outLeft = ball.x < 2;
        const outAtGoalkeeper = (outLeft && ball.y > 32 && ball.y < 68) || (!outLeft && ball.y > 32 && ball.y < 68);
        const team: Team = sim.possession;
        // Si salió por la línea de FONDO y no está en área → saque de PORTERÍA para el portero rival
        if (outAtGoalkeeper) {
          const defending: Team = team === 'home' ? 'away' : 'home';
          const gk = sim.players.find(p => p.team === defending && p.role === 'GK') ?? sim.players[0];
          gk.x = outLeft ? 4 : 96;
          gk.y = clamp(ball.y, 36, 64);
          sim.possession = defending;
          setBallOwner(sim, gk);
          sim.nextDecisionAt = now + 1000;
          sim.lastComment = 'Saque de portería';
          sim.passStreak = 0;
            addMoment(sim, moments, 'recover', gk.x, gk.y, 'SAQUE DE PORTERÍA', 1.6, '#9be7ff', now, 1800);
          events.push({ type: 'recover', x: gk.x, y: gk.y, label: 'Portería' });
        } else {
          // SAQUE DE BANDA (lateral) o de ESQUINA según la salida
          const isCorner =
            (outLeft && (ball.x < 1 || ball.x > 99)) ||
            (!outLeft && (ball.x < 1 || ball.x > 99));
          if (isCorner && (ball.x <= 0 || ball.x >= 100) && (ball.y <= 0 || ball.y >= 100)) {
            // Esquina: saca el rival con un valor alto
            const defending: Team = team === 'home' ? 'away' : 'home';
            const taker = sim.players
              .filter(p => p.team === defending && p.role !== 'GK')
              .sort((a, b) => dist(b.x, b.y, ball.x, ball.y) - dist(a.x, a.y, ball.x, ball.y))[0]
              ?? sim.players.find(p => p.team === defending && p.role !== 'GK') ?? sim.players[0];
            taker.x = clamp(ball.x, 2, 98);
            taker.y = ball.y <= 0 ? 2 : 98;
            sim.possession = defending;
            setBallOwner(sim, taker);
            sim.nextDecisionAt = now + 900;
            sim.passStreak = 0;
            sim.shotBias = 1; // un saque de esquina siempre precede a un gol
            sim.lastComment = 'Saque de esquina';
            addMoment(sim, moments, 'recover', taker.x, taker.y, '¡CÓRNER!', 2.4, '#ffd166', now, 2000);
            events.push({ type: 'recover', x: taker.x, y: taker.y, label: 'Corner' });
          } else {
            const nextTeam: Team = team === 'home' ? 'away' : 'home';
            const taker = sim.players
              .filter(p => p.team === nextTeam && p.role !== 'GK')
              .sort((a, b) => dist(b.x, b.y, ball.x, ball.y) - dist(a.x, a.y, ball.x, ball.y))[0]
              ?? sim.players.find(p => p.team === nextTeam && p.role !== 'GK') ?? sim.players[0];
            taker.x = clamp(ball.x, 8, 92);
            taker.y = clamp(ball.y, 12, 88);
            sim.possession = nextTeam;
            setBallOwner(sim, taker);
            sim.nextDecisionAt = now + 700;
            sim.passStreak = 0;
            sim.lastComment = 'Saque de banda';
            addMoment(sim, moments, 'recover', taker.x, taker.y, 'SAQUE DE BANDA', 1.7, '#9be7ff', now, 1800);
            events.push({ type: 'recover', x: taker.x, y: taker.y, label: 'Banda' });
          }
        }
      }
    }

    // Palos / marco: si toca la portería, SIEMPRE es gol
    if (sim.phase === 'shot' && ball.shotBy && ball.ownerId == null) {
      const gx = ball.shotBy === 'home' ? 100 : 0;
      const postsY = [40, 60];
      const distToPost = Math.min(...postsY.map(py => Math.hypot(ball.x - gx, ball.y - py)));
      if (distToPost < 2.0) {
        const scoring: Team = ball.shotBy;
        if (scoring === 'home') sim.homeGoals += 1;
        else sim.awayGoals += 1;
        const scoreX = scoring === 'home' ? 96 : 4;
        addMoment(sim, moments, 'goal', scoreX, 50, '¡GOL DE PALO!', 5.8, '#ff3366', now, 5000);
        const benchY = scoring === 'home' ? -3 : 103;
        addMoment(sim, moments, 'recover', 50, benchY, '¡BANQUILLO LOCO!', 2.1, scoring === 'home' ? '#ff4d6d' : '#22d3ee', now, 3800);
        events.push({ type: 'goal', x: scoreX, y: 50, label: 'GOL DE PALO', team: scoring });
        sim.players.forEach(p => { p.hasBall = false; });
        ball.ownerId = null;
        ball.targetOwnerId = null;
        ball.shotBy = null;
        ball.vx = 0;
        ball.vy = 0;
        ball.x = scoring === 'home' ? 102 : -2;
        ball.y = distToPost < 1 ? (ball.y < 50 ? 40 : 60) : 50;
        ball.leadX = ball.x;
        ball.leadY = ball.y;
        ball.looseSince = null;
        sim.phase = 'goal';
        sim.goalPauseUntil = now + 1800;
        sim.pendingKickoffTeam = scoring === 'home' ? 'away' : 'home';
        sim.possession = scoring;
        sim.passStreak = 0;
        sim.shotBias = 0;
      }
    }

    // Tiros: parada del portero por cercanía o resolución en la línea
    if (sim.phase === 'shot' && ball.shotBy && ball.ownerId == null) {
      const defending: Team = ball.shotBy === 'home' ? 'away' : 'home';
      const keeper = sim.players.find(p => p.team === defending && p.role === 'GK') ?? null;
      const reachedLine = ball.x < 0 || ball.x > 100;

      if (keeper && dist(ball.x, ball.y, keeper.x, keeper.y) < 3.1) {
        setBallOwner(sim, keeper);
        sim.nextDecisionAt = now + 900;
        addMoment(sim, moments, 'save', keeper.x, keeper.y, 'Paradón del portero', 2.2, '#9be7ff', now, 2500);
        events.push({ type: 'save', x: keeper.x, y: keeper.y, label: 'Paradón' });
      } else if (reachedLine || looseTime > 1500) {
        const onTarget = Math.abs(ball.y - 50) < 16;
        // Si es el gol forzado pendiente, entra siempre
        const mustScore = sim.forcedGoalDone && (sim.homeGoals + sim.awayGoals) === 0;
        // Si toca red/línea de portería entre postes, es gol siempre.
        if (onTarget || mustScore) {
          const scoring: Team = ball.shotBy ?? 'home';
          if (scoring === 'home') sim.homeGoals += 1;
          else sim.awayGoals += 1;
          const gx = scoring === 'home' ? 96 : 4;
          addMoment(sim, moments, 'goal', gx, 50, 'GOOOOOL', 5.6, '#ff3366', now, 4800);
          // Banquillo local celebrando: la cámara puede subir a filmarlo
          const benchY = scoring === 'home' ? -3 : 103;
          addMoment(sim, moments, 'recover', 50, benchY, '¡BANQUILLO LOCO!', 2.1, scoring === 'home' ? '#ff4d6d' : '#22d3ee', now, 3800);
          events.push({ type: 'goal', x: gx, y: 50, label: 'GOOOOL', team: scoring });
          // La pelota queda dentro de la red antes del saque de centro.
          sim.players.forEach(p => { p.hasBall = false; });
          ball.ownerId = null;
          ball.targetOwnerId = null;
          ball.shotBy = null;
          ball.vx = 0;
          ball.vy = 0;
          ball.x = scoring === 'home' ? 102 : -2;
          ball.y = 50;
          ball.leadX = ball.x;
          ball.leadY = ball.y;
          ball.looseSince = null;
          sim.phase = 'goal';
          sim.goalPauseUntil = now + 1800;
          sim.pendingKickoffTeam = scoring === 'home' ? 'away' : 'home';
          sim.possession = scoring;
          sim.passStreak = 0;
          sim.shotBias = 0;
        } else {
          const k = keeper ?? sim.players.find(p => p.team === defending) ?? sim.players[0];
          k.x = defending === 'home' ? 7 : 93;
          k.y = clamp(ball.y, 36, 64);
          setBallOwner(sim, k);
          sim.nextDecisionAt = now + 900;
          addMoment(sim, moments, 'save', k.x, k.y, 'Parada', 3.0, '#9be7ff', now, 2400);
          events.push({ type: 'save', x: k.x, y: k.y, label: 'Parada' });
        }
      }
    }

    // WATCHDOG: si el balón se pierde, lo recoge un compañero del equipo en posesión
    // (o el más cercano del equipo receptor del pase). Nunca "al azar al contrario".
    if (ball.ownerId == null && sim.phase !== 'kickoff' && looseTime > 1200) {
      const preferredTeam =
        (ball.targetOwnerId != null
          ? sim.players.find(p => p.id === ball.targetOwnerId)?.team
          : null) ?? sim.possession;
      const mates = sim.players.filter(p => p.team === preferredTeam && p.role !== 'GK');
      let picker = mates[0] ?? null;
      let best = Infinity;
      for (const p of mates) {
        const d = dist(p.x, p.y, ball.x, ball.y);
        if (d < best) { best = d; picker = p; }
      }
      const fallback = nearestPlayer(sim, ball.x, ball.y);
      const chosen = picker ?? fallback ?? sim.players.find(p => p.team === preferredTeam && p.role === 'GK') ?? sim.players[0];
      setBallOwner(sim, chosen);
      sim.nextDecisionAt = now + 500;
      sim.passStreak = 0;
      sim.lastComment = 'Recogida del balón';
      events.push({ type: 'recover', x: chosen.x, y: chosen.y, label: 'Recogida' });
    }
  }

  // ---- Gol forzado: garantiza al menos 1 gol por partido ----
  if (!sim.forcedGoalDone && now >= sim.forcedGoalAt && (sim.homeGoals + sim.awayGoals) === 0 && sim.phase !== 'shot') {
    const team: Team = Math.random() < 0.5 ? 'home' : 'away';
    const attacker = sim.players.find(p => p.team === team && p.role === 'FWD')
      ?? sim.players.find(p => p.team === team && p.role !== 'GK')
      ?? sim.players[0];
    // Coloca al delantero cerca del área y lanza un tiro centrado
    attacker.x = team === 'home' ? 82 : 18;
    attacker.y = 50;
    sim.players.forEach(p => { p.hasBall = false; });
    ball.ownerId = null;
    ball.targetOwnerId = null;
    ball.shotBy = team;
    ball.x = attacker.x;
    ball.y = attacker.y;
    const goalX = team === 'home' ? 101 : -1;
    const goalY = 50;
    const travel = 1.1 / pace;
    ball.vx = (goalX - ball.x) / travel;
    ball.vy = (goalY - ball.y) / travel;
    ball.leadX = goalX;
    ball.leadY = goalY;
    ball.looseSince = now;
    sim.phase = 'shot';
    sim.forcedGoalDone = true;
    sim.shotBias = 0;
    sim.passStreak = 0;
    sim.possession = team;
    addMoment(sim, moments, 'shot', ball.x, ball.y, '¡Disparo a puerta!', 3.8, '#ffd166', now, 2800);
    events.push({ type: 'shot', x: ball.x, y: ball.y, label: 'Disparo' });
  }

  // ---- Decisiones del portador del balón ----
  const carrier = ball.ownerId != null ? sim.players.find(p => p.id === ball.ownerId) : null;
  if (carrier && sim.phase !== 'kickoff') {
    const opponents = sim.players.filter(p => p.team !== carrier.team && p.role !== 'GK');
    let nearestOpponent: EnginePlayer | null = null;
    let nearestDist = Infinity;
    for (const p of opponents) {
      const d = dist(p.x, p.y, carrier.x, carrier.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestOpponent = p;
      }
    }

    if (nearestOpponent && nearestDist < 6.5) {
      if (nearestDist < 3.2 && Math.random() < dt * 0.28) {
        if (Math.random() < 0.35) {
          // ¡FALTA! el portador mantiene el balón y se reanuda rápido
          sim.nextDecisionAt = now + 1000;
          sim.passStreak = 0;
          addMoment(sim, moments, 'foul', carrier.x, carrier.y, (carrier.team === 'home' ? carrier.x > 76 : carrier.x < 24) ? '¡Penalti!' : '¡Falta! · Saque', 2.8, '#ff4058', now, 2400);
          events.push({ type: 'foul', x: carrier.x, y: carrier.y, label: 'Falta' });
        } else {
          setBallOwner(sim, nearestOpponent);
          sim.nextDecisionAt = now + 450;
          sim.passStreak = 0;
          addMoment(sim, moments, 'tackle', nearestOpponent.x, nearestOpponent.y, 'Robo de balón', 1.8, '#00ff88', now, 1900);
          events.push({ type: 'tackle', x: nearestOpponent.x, y: nearestOpponent.y, label: 'Robo' });
        }
      } else if (nearestDist >= 3.2 && Math.random() < dt * 0.55) {
        // ¡REGATE! se va del rival hacia delante / banda
        carrier.targetX = clamp(carrier.x + attackDir(carrier.team) * 12, 5, 95);
        carrier.targetY = clamp(carrier.baseY + (Math.random() - 0.5) * 10, 10, 90);
        nearestOpponent.x = clamp(nearestOpponent.x - (carrier.x - nearestOpponent.x) * 0.25, 7, 93);
        nearestOpponent.y = clamp(nearestOpponent.y - (carrier.y - nearestOpponent.y) * 0.25, 9, 91);
        sim.nextDecisionAt = now + 1100;
        sim.passStreak = 0;
        addMoment(sim, moments, 'dribble', carrier.x, carrier.y, '¡Regate!', 1.9, '#ff9f43', now, 2100);
        events.push({ type: 'dribble', x: carrier.x, y: carrier.y, label: 'Regate' });
      } else if (now > sim.nextDecisionAt) {
        // Presionado: prefiere soltar un pase a un compañero libre
        const mate = choosePassTarget(sim, carrier);
        carrier.hasBall = false;
        ball.ownerId = null;
        ball.targetOwnerId = mate.id;
        ball.shotBy = null;
        sim.lastPasserId = carrier.id;
        sim.shotBias = 0;
        sim.passStreak = 0;
        const leadX = clamp(mate.x + attackDir(carrier.team) * 4, 6, 94);
        const leadY = clamp(mate.y + (Math.random() - 0.5) * 4, 8, 92);
        const travel = (1.0 + Math.random() * 0.3) / pace;
        ball.vx = (leadX - ball.x) / travel;
        ball.vy = (leadY - ball.y) / travel;
        ball.leadX = leadX;
        ball.leadY = leadY;
        sim.phase = 'pass';
        sim.nextDecisionAt = now + 1000 / pace;
        addMoment(sim, moments, 'pass', ball.x, ball.y, 'Pase de seguridad', 1.15, '#58a6ff', now, 1300);
        events.push({ type: 'pass', x: ball.x, y: ball.y, label: 'Pase' });
      }
    } else if (now > sim.nextDecisionAt) {
      const distanceToGoal = carrier.team === 'home' ? 100 - carrier.x : carrier.x;
      const lateral = Math.abs(carrier.y - 50);
      const onWing = lateral > 24;
      const roll = Math.random();

      // CENTRO desde la banda: lleva el balón al área y suele acabar en tiro
      if (onWing && distanceToGoal < 22 && roll < 0.5) {
        const goalEdgeX = carrier.team === 'home' ? 95 : 5;
        const target = sim.players
          .filter(p => p.team === carrier.team && p.role !== 'GK' && p.id !== carrier.id)
          .sort((a, b) => dist(a.x, a.y, goalEdgeX, 50) - dist(b.x, b.y, goalEdgeX, 50))[0]
          ?? choosePassTarget(sim, carrier);
        carrier.hasBall = false;
        ball.ownerId = null;
        ball.targetOwnerId = target.id;
        ball.shotBy = null;
        sim.lastPasserId = carrier.id;
        sim.passStreak = 0;
        const leadX = clamp((goalEdgeX + target.x) / 2 + attackDir(carrier.team) * 2, 6, 94);
        const leadY = clamp(50 + (Math.random() - 0.5) * 14, 14, 86);
        const travel = (1.0 + Math.random() * 0.4) / pace;
        ball.vx = (leadX - ball.x) / travel;
        ball.vy = (leadY - ball.y) / travel;
        ball.leadX = leadX;
        ball.leadY = leadY;
        sim.phase = 'pass';
        sim.nextDecisionAt = now + (800 + Math.random() * 400) / pace;
        addMoment(sim, moments, 'longpass', ball.x, ball.y, '¡Centro al área!', 2.5, '#ffd166', now, 2100);
        events.push({ type: 'longpass', x: ball.x, y: ball.y, label: 'Centro' });
      } else if (distanceToGoal < 30 && lateral < 44 && roll < (sim.shotBias > 0 ? 0.95 : 0.85)) {
        // DISPARO a puerta (zona y frecuencia ampliadas) → lo más rentable de grabar
        carrier.hasBall = false;
        ball.ownerId = null;
        ball.targetOwnerId = null;
        ball.shotBy = carrier.team;
        sim.shotBias = 0;
        const goalX = carrier.team === 'home' ? 101 : -1;
        const goalY = 50 + (Math.random() - 0.5) * 24;
        // Vuelo visible: la pelota se sigue a simple vista hasta la línea
        const travel = (1.0 + Math.random() * 0.3) / pace;
        ball.vx = (goalX - ball.x) / travel;
        ball.vy = (goalY - ball.y) / travel;
        ball.leadX = clamp(goalX, -1, 101);
        ball.leadY = goalY;
        sim.phase = 'shot';
        addMoment(sim, moments, 'shot', ball.x, ball.y, '¡Disparo a puerta!', 3.6, '#ffd166', now, 2800);
        events.push({ type: 'shot', x: ball.x, y: ball.y, label: 'Disparo' });
      } else if (Math.random() < 0.72) {
        const isLong = Math.random() < 0.38;
        const receiver = isLong ? chooseLongPassTarget(sim, carrier) : choosePassTarget(sim, carrier);
        carrier.hasBall = false;
        ball.ownerId = null;
        ball.targetOwnerId = receiver.id;
        ball.shotBy = null;
        sim.lastPasserId = carrier.id;
        sim.shotBias = 0;
        sim.passStreak = 0;
        const leadX = clamp(receiver.x + attackDir(receiver.team) * (isLong ? 12 : 4 + Math.random() * 4), 6, 94);
        const leadY = clamp(receiver.y + (Math.random() - 0.5) * 3, 8, 92);
        // Pase controlado: el receptor corre a recibirlo sin que se pierda
        const travel = (isLong ? 1.3 + Math.random() * 0.4 : 1.1 + Math.random() * 0.4) / pace;
        ball.vx = (leadX - ball.x) / travel;
        ball.vy = (leadY - ball.y) / travel;
        ball.leadX = leadX;
        ball.leadY = leadY;
        sim.phase = 'pass';
        sim.nextDecisionAt = now + (isLong ? 1500 : 1300 + Math.random() * 500) / pace;
        addMoment(
          sim, moments,
          isLong ? 'longpass' : 'pass',
          ball.x, ball.y,
          isLong ? '¡Pase de 3 puntos!' : 'Pase peligroso',
          isLong ? 1.85 : 1.25,
          isLong ? '#ffd166' : '#58a6ff',
          now,
          isLong ? 2300 : 1500,
        );
        events.push({ type: isLong ? 'longpass' : 'pass', x: ball.x, y: ball.y, label: isLong ? 'Pase 3 ptos' : 'Pase' });
      } else {
        // En vez de quedarse quieto: pase corto lateral para mantener la circulación
        const mate = choosePassTarget(sim, carrier);
        carrier.hasBall = false;
        ball.ownerId = null;
        ball.targetOwnerId = mate.id;
        ball.shotBy = null;
        sim.lastPasserId = carrier.id;
        sim.shotBias = 0;
        const leadX = clamp(mate.x + attackDir(carrier.team) * (2 + Math.random() * 3), 6, 94);
        const leadY = clamp(mate.y + (Math.random() - 0.5) * 2, 8, 92);
        const travel = (0.9 + Math.random() * 0.3) / pace;
        ball.vx = (leadX - ball.x) / travel;
        ball.vy = (leadY - ball.y) / travel;
        ball.leadX = leadX;
        ball.leadY = leadY;
        sim.phase = 'pass';
        sim.nextDecisionAt = now + (900 + Math.random() * 600) / pace;
        addMoment(sim, moments, 'pass', ball.x, ball.y, 'Pase corto', 1.1, '#58a6ff', now, 1200);
        events.push({ type: 'pass', x: ball.x, y: ball.y, label: 'Pase' });
      }
    }
  }

  // ---- Saque de puerta ----
  if (sim.phase === 'kickoff') {
    ball.x = 50;
    ball.y = 50;
  }

  return events;
}

/**
 * Self-test headless: simula un partido completo y verifica invariantes.
 * - El balón no se queda suelto más de 2,5s (bloqueo).
 * - Sin valores NaN/infinitos.
 * - Siempre hay 22 jugadores y el partido genera jugadas.
 */
export function runMatchSelfTest(seconds = 240, fps = 60): SelfTestResult {
  const sim = createMatchSim(0);
  const incidents: EngineIncident[] = [];
  const moments: EngineMoment[] = [];
  const dt = 1 / fps;
  let goals = 0;
  let passes = 0;
  let tackles = 0;
  let saves = 0;
  let issues = 0;
  let maxBallIdleMs = 0;
  const total = Math.floor(seconds * fps);

  const tuning: MatchTuning = { pace: 1.4, incidentKinds: ['dog', 'streaker', 'fight', 'coach'], incidentGap: 9000 };
  for (let i = 1; i <= total; i += 1) {
    const now = i * dt * 1000;
    const evs = updateMatchSim(sim, incidents, moments, dt, now, tuning);
    for (const e of evs) {
      if (e.type === 'goal') goals += 1;
      else if (e.type === 'pass') passes += 1;
      else if (e.type === 'tackle') tackles += 1;
      else if (e.type === 'save') saves += 1;
    }

    const b = sim.ball;
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx) || !Number.isFinite(b.vy)) issues += 1;
    if (sim.players.length !== 22) issues += 1;
    if (b.ownerId != null && !sim.players.some(p => p.id === b.ownerId)) issues += 1;

    if (b.ownerId == null) {
      const idle = b.looseSince != null ? now - b.looseSince : 0;
      if (idle > maxBallIdleMs) maxBallIdleMs = idle;
      if (idle > 2500) issues += 1;
    }
  }

  return {
    ok: issues === 0 && goals >= 1 && passes >= 1,
    seconds,
    goals,
    passes,
    tackles,
    saves,
    maxBallIdleMs,
  };
}

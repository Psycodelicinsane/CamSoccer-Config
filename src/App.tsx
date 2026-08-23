import { useCallback, useEffect, useRef, useState } from 'react';
import { StartScreen } from './components/StartScreen';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { GameOverScreen } from './components/GameOverScreen';
import { HowToPlay } from './components/HowToPlay';
import { CaptureLog, GamePhase, HighScore } from './types';
import { LEVELS } from './levels';
import {
  EngineIncident,
  EngineMoment,
  MatchSim,
  MatchTuning,
  SelfTestResult,
  createMatchSim,
  updateMatchSim,
  runMatchSelfTest,
} from './utils/matchEngine';
import './App.css';

const STORAGE_KEY = 'camsoccer_highscores';
const UNLOCK_KEY = 'camsoccer_unlocked';
const FIELD_RATIO = 1.56;

// Recorte del encuadre (alejado un poco para ver la jugada completa)
const FRAME_W = 19;
const FRAME_H = 10.8;
// Terreno de fuera de juego (pista perimetral) entre el césped y las gradas
const TRACK = 7;
const STAND_MIN = -20;
const STAND_MAX = 120;

interface CameraState { x: number; y: number; }

interface Rect { x: number; y: number; w: number; h: number; }
interface Panel { x: number; y: number; w: number; h: number; inner: Rect; }
interface FieldMap { ppuX: number; ppuY: number; ox: number; oy: number; }
interface Layout { tactical: Panel; broadcast: Panel; minimap: Panel; }

interface InterestTarget {
  id: string;
  kind: string;
  x: number;
  y: number;
  label: string;
  importance: number;
  color: string;
  caught?: boolean;
}

interface Popup { x: number; y: number; text: string; color: string; born: number; life: number; big: boolean; }

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
// Equipación: los PORTEROS visten distinto (amarillo local / verde visitante)
const teamColor = (t: 'home' | 'away', gk = false) =>
  gk ? (t === 'home' ? '#ffd93d' : '#2fd47a') : (t === 'home' ? '#e5484d' : '#2f6bed');
const teamTrim = (t: 'home' | 'away', gk = false) =>
  gk ? (t === 'home' ? '#6b4e00' : '#0b3d24') : (t === 'home' ? '#ffe3e3' : '#ffe08a');
const teamShort = (t: 'home' | 'away', gk = false) =>
  gk ? (t === 'home' ? '#8a6d00' : '#12643c') : (t === 'home' ? '#7a1f24' : '#123a86');

// La cámara puede salir del césped por los 4 lados para enfocar TODAS las gradas
const clampCamera = (c: CameraState) => ({
  x: clamp(c.x, STAND_MIN + FRAME_W / 2, STAND_MAX - FRAME_W / 2),
  y: clamp(c.y, STAND_MIN + FRAME_H / 2, STAND_MAX - FRAME_H / 2),
});

const frameBounds = (c: CameraState) => ({
  minX: c.x - FRAME_W / 2, maxX: c.x + FRAME_W / 2,
  minY: c.y - FRAME_H / 2, maxY: c.y + FRAME_H / 2,
});

const inFrame = (t: { x: number; y: number }, c: CameraState, pad = 0) => {
  const b = frameBounds(c);
  return t.x >= b.minX + pad && t.x <= b.maxX - pad && t.y >= b.minY + pad && t.y <= b.maxY - pad;
};

const framingQuality = (t: { x: number; y: number }, c: CameraState) => {
  const dx = (t.x - c.x) / (FRAME_W / 2);
  const dy = (t.y - c.y) / (FRAME_H / 2);
  return clamp(1 - Math.hypot(dx, dy) / 0.9, 0, 1);
};

// Mapeo completo del estadio: incluye las 4 gradas (arriba, abajo, izquierda y derecha)
const MAP_MIN_X = -22;
const MAP_MAX_X = 122;
const MAP_MIN_Y = -20;
const MAP_MAX_Y = 120;
const MAP_SPAN_X = MAP_MAX_X - MAP_MIN_X;
const MAP_SPAN_Y = MAP_MAX_Y - MAP_MIN_Y;

function fitField(inner: Rect): FieldMap {
  let ppuY = inner.h / MAP_SPAN_Y;
  let ppuX = ppuY * FIELD_RATIO;
  if (ppuX * MAP_SPAN_X > inner.w) {
    ppuX = inner.w / MAP_SPAN_X;
    ppuY = ppuX / FIELD_RATIO;
  }
  const uW = ppuX * MAP_SPAN_X;
  const uH = ppuY * MAP_SPAN_Y;
  const cx = inner.x + (inner.w - uW) / 2;
  const cy = inner.y + (inner.h - uH) / 2;
  return {
    ppuX,
    ppuY,
    ox: cx - MAP_MIN_X * ppuX,
    oy: cy - MAP_MIN_Y * ppuY,
  };
}

// Ajusta el "encuadre" dentro del monitor de antena (close-up)
function fitWindow(inner: Rect, c: CameraState): FieldMap {
  const ppu = Math.min(inner.w / FRAME_W, inner.h / FRAME_H);
  const uW = ppu * FRAME_W, uH = ppu * FRAME_H;
  const bx = inner.x + (inner.w - uW) / 2, by = inner.y + (inner.h - uH) / 2;
  return { ppuX: ppu, ppuY: ppu, ox: bx - (c.x - FRAME_W / 2) * ppu, oy: by - (c.y - FRAME_H / 2) * ppu };
}

const mMap = (m: FieldMap, wx: number, wy: number) => ({ x: m.ox + wx * m.ppuX, y: m.oy + wy * m.ppuY });

function computeLayout(W: number, H: number): Layout {
  const titleH = 16;
  const gap = 6;
  const pad = 6;
  const panel = (x: number, y: number, w: number, h: number): Panel => ({
    x, y, w, h,
    inner: { x: x + pad, y: y + titleH, w: Math.max(10, w - pad * 2), h: Math.max(10, h - titleH - pad) },
  });

  if (W >= 760) {
    // ARRIBA zoom cercano · MEDIO mapa grande · ABAJO control de cámara
    const topPad = 48;
    const botPad = 8;
    const avail = H - topPad - botPad;
    const zoomH = Math.round(avail * 0.36);
    const mapH = Math.round(avail * 0.40);
    const ctrlH = avail - zoomH - mapH - gap * 2;
    const zoomY = topPad;
    const mapY = zoomY + zoomH + gap;
    const ctrlY = mapY + mapH + gap;
    return {
      broadcast: panel(8, zoomY, W - 16, zoomH),
      tactical: panel(8, mapY, W - 16, mapH),
      minimap: panel(8, ctrlY, W - 16, ctrlH),
    };
  }
  const topPad = 84;
  const avail = H - topPad - 6;
  const zoomH = Math.round(avail * 0.34);
  const mapH = Math.round(avail * 0.36);
  const zoomY = topPad;
  const mapY = zoomY + zoomH + gap;
  const ctrlY = mapY + mapH + gap;
  return {
    broadcast: panel(0, zoomY, W, zoomH),
    tactical: panel(0, mapY, W, mapH),
    minimap: panel(0, ctrlY, W, H - ctrlY - 4),
  };
}

function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [audience, setAudience] = useState(70);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [unlockedLevel, setUnlockedLevel] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [slowMoCharges, setSlowMoCharges] = useState(3);
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [trackingFeedback, setTrackingFeedback] = useState<'good' | 'bad' | null>(null);
  const [scoreLine, setScoreLine] = useState('0 - 0');
  const [directorCue, setDirectorCue] = useState('Sigue el balón');
  const [framing, setFraming] = useState(0);
  const [replayReady, setReplayReady] = useState(false);
  const [shake, setShake] = useState(0);
  const [cupResult, setCupResult] = useState<'gold' | 'silver' | 'bronze' | 'failed'>('failed');
  const [selfTest, setSelfTest] = useState<SelfTestResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  // Multi-touch real: cada puntero se registra por id, así el joystick y el
  // clic en el mapa central pueden usarse SIMULTÁNEAMENTE sin pisarse.
  const pointersRef = useRef<Map<number, 'minimap' | 'tactical'>>(new Map());
  const matchRef = useRef<MatchSim | null>(null);
  const momentsRef = useRef<EngineMoment[]>([]);
  const incidentsRef = useRef<EngineIncident[]>([]);
  const cameraRef = useRef<CameraState>({ x: 50, y: 50 });
  const layoutRef = useRef<Layout | null>(null);
  const followRef = useRef<{ tx: number; ty: number; active: boolean }>({ tx: 50, ty: 50, active: false });
  const popupsRef = useRef<Popup[]>([]);
  const framingRef = useRef(0);
  const flashRef = useRef<{ until: number; color: string }>({ until: 0, color: '#fff' });
  const goalFlashRef = useRef<{ until: number; side: 'left' | 'right' } | null>(null);
  const goalBannerRef = useRef<{ until: number; text: string } | null>(null);
  const streakRef = useRef(0);
  const replayReadyRef = useRef(false);
  const scoreRef = useRef(0);
  const audienceRef = useRef(70);
  const comboRef = useRef(1);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const slowMoRemainingRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastHudUpdateRef = useRef(0);
  const lastTimeHudRef = useRef(0);
  const slowMoEndRef = useRef(0);
  const nextChargeAtRef = useRef(0);
  const endedRef = useRef(false);
  const joystickRef = useRef<{ x: number; y: number; dx: number; dy: number; active: boolean }>({ x: 0, y: 0, dx: 0, dy: 0, active: false });
  const minimapTouchRef = useRef<{ active: boolean }>({ active: false });

  useEffect(() => {
    const id = window.setTimeout(() => { try { setSelfTest(runMatchSelfTest(240)); } catch { setSelfTest(null); } }, 350);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    try {
      const scores = localStorage.getItem(STORAGE_KEY);
      const unlocked = localStorage.getItem(UNLOCK_KEY);
      if (scores) setHighScores(JSON.parse(scores));
      if (unlocked) setUnlockedLevel(Number(unlocked) || 0);
    } catch { setHighScores([]); }
  }, []);

  const saveHighScore = useCallback((finalScore: number, levelName: string) => {
    const entry: HighScore = { score: finalScore, level: levelName, date: new Date().toLocaleDateString() };
    setHighScores(prev => {
      const next = [entry, ...prev].sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const pushCapture = useCallback((kind: string, points: number) => {
    const labels: Record<string, string> = {
      pass: 'PASE', longpass: 'CENTRO', shot: 'TIRO', goal: 'GOL', save: 'PARADA',
      tackle: 'ROBO', dribble: 'REGATE', foul: 'FALTA',
      dog: 'PERRO', streaker: 'INTRUSO', fight: 'PELEA', coach: 'BANQUILLO',
    };
    const log: CaptureLog = {
      id: 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      type: labels[kind] ?? kind.toUpperCase(), success: true, points, timestamp: Date.now(),
    };
    setRecentCaptures(prev => [log, ...prev].slice(0, 5));
  }, []);
  const [recentCaptures, setRecentCaptures] = useState<CaptureLog[]>([]);

  const addPopup = useCallback((x: number, y: number, text: string, color: string, big = false) => {
    popupsRef.current.push({ x, y, text, color, born: performance.now(), life: big ? 1500 : 950, big });
    if (popupsRef.current.length > 24) popupsRef.current.shift();
  }, []);

  const finishGame = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    const finalScore = Math.floor(scoreRef.current);
    const cup = finalScore >= LEVELS[currentLevel].cups.gold ? 'gold'
      : finalScore >= LEVELS[currentLevel].cups.silver ? 'silver'
      : finalScore >= LEVELS[currentLevel].cups.bronze ? 'bronze'
      : 'failed';
    setCupResult(cup);
    saveHighScore(finalScore, LEVELS[currentLevel].name);
    if (cup !== 'failed' && currentLevel < LEVELS.length - 1) {
      const nu = Math.max(unlockedLevel, currentLevel + 1);
      setUnlockedLevel(nu);
      localStorage.setItem(UNLOCK_KEY, String(nu));
    }
    setScore(finalScore);
    setPhase('gameover');
  }, [currentLevel, saveHighScore, unlockedLevel]);

  const startGame = useCallback((levelIndex: number) => {
    const now = performance.now();
    matchRef.current = createMatchSim(now);
    momentsRef.current = [];
    incidentsRef.current = [];
    cameraRef.current = { x: 50, y: 50 };
    scoreRef.current = 0;
    audienceRef.current = 70;
    comboRef.current = 1;
    endedRef.current = false;
    startTimeRef.current = now;
    lastFrameTimeRef.current = now;
    lastHudUpdateRef.current = 0;
    lastTimeHudRef.current = 0;
    slowMoEndRef.current = 0;
    nextChargeAtRef.current = now + 11000;
    popupsRef.current = [];
    streakRef.current = 0;
    framingRef.current = 0;
    flashRef.current = { until: 0, color: '#fff' };
    followRef.current = { tx: 50, ty: 50, active: false };
    setCurrentLevel(levelIndex);
    setTimeRemaining(LEVELS[levelIndex].duration);
    setAudience(70);
    setScore(0);
    setCombo(1);
    setScoreLine('0 - 0');
    setDirectorCue('Sigue el balón');
    setRecentCaptures([]);
    setSlowMoCharges(3);
    setSlowMoActive(false);
    setCupResult('failed');
    setFraming(0);
    setReplayReady(false);
    setTrackingFeedback(null);
    setPhase('playing');
  }, []);

  const togglePause = useCallback(() => {
    if (phase === 'playing') {
      pausedAtRef.current = performance.now();
      slowMoRemainingRef.current = Math.max(0, slowMoEndRef.current - pausedAtRef.current);
      setPhase('paused');
    } else if (phase === 'paused') {
      const d = performance.now() - pausedAtRef.current;
      const sim = matchRef.current;
      if (sim) {
        sim.nextDecisionAt += d; sim.nextIncidentAt += d; sim.kickoffUntil += d;
        if (sim.ball.looseSince != null) sim.ball.looseSince += d;
      }
      momentsRef.current.forEach(m => { m.expiresAt += d; });
      incidentsRef.current.forEach(i => { i.expiresAt += d; i.bornAt += d; });
      startTimeRef.current += d;
      nextChargeAtRef.current += d;
      slowMoEndRef.current = performance.now() + slowMoRemainingRef.current;
      lastFrameTimeRef.current = performance.now();
      setPhase('playing');
    }
  }, [phase]);

  const getTargets = useCallback((now: number): InterestTarget[] => {
    const sim = matchRef.current;
    if (!sim) return [];
    const owner = sim.ball.ownerId != null ? sim.players.find(p => p.id === sim.ball.ownerId) : null;
    const ballLabel = owner ? `${owner.team === 'home' ? 'Rojo' : 'Azul'} #${owner.number}` : 'Balón suelto';
    const ballImportance = sim.phase === 'shot' ? 3.6 : sim.phase === 'pass' ? 1.4 : 1.0;
    const moments: InterestTarget[] = momentsRef.current.filter(m => now < m.expiresAt).map(m => ({
      id: m.id, kind: m.kind,
      x: (m.kind === 'shot' || m.kind === 'pass' || m.kind === 'longpass' || m.kind === 'dribble') ? sim.ball.x : m.x,
      y: (m.kind === 'shot' || m.kind === 'pass' || m.kind === 'longpass' || m.kind === 'dribble') ? sim.ball.y : m.y,
      label: m.label, importance: m.importance, color: m.color, caught: m.caught,
    }));
    const incs: InterestTarget[] = incidentsRef.current.filter(i => now < i.expiresAt).map(i => ({
      id: i.id, kind: i.kind, x: i.x, y: i.y, label: i.label, importance: i.importance, color: i.color, caught: i.caught,
    }));
    return [
      ...moments, ...incs,
      { id: 'ball', kind: 'ball', x: sim.ball.x, y: sim.ball.y, label: ballLabel, importance: ballImportance, color: '#ffffff' },
    ].sort((a, b) => b.importance - a.importance);
  }, []);

  const processBroadcastScore = useCallback((dt: number, now: number) => {
    const sim = matchRef.current;
    if (!sim) return;
    const target = getTargets(now)[0];
    if (!target) return;
    const cam = cameraRef.current;
    const inside = inFrame(target, cam, 1);
    const q = inside ? framingQuality(target, cam) : 0;
    framingRef.current = q;
    const golden = q > 0.72;
    replayReadyRef.current = inside && q > 0.4 && target.importance >= 1.8;

    if (inside) {
      const quality = 0.5 + q * 1.2 + (golden ? 0.3 : 0);
      scoreRef.current += dt * 34 * target.importance * comboRef.current * quality;
      audienceRef.current = clamp(audienceRef.current + dt * (2 + target.importance * 4) * (0.45 + q), 0, 100);
      comboRef.current = clamp(comboRef.current + dt * (0.2 + target.importance * 0.05) * (0.4 + q), 1, 6);

      const oneShot = target.kind !== 'ball' && target.kind !== 'pass';
      if (oneShot && !target.caught) {
        const bonus = Math.round(target.importance * 150 * (0.6 + q));
        scoreRef.current += bonus;
        audienceRef.current = clamp(audienceRef.current + target.importance * 4.5 * (0.5 + q), 0, 100);
        streakRef.current += 1;
        pushCapture(target.kind, bonus);
        addPopup(target.x, target.y, `+${bonus}`, golden ? '#ffd166' : '#3ddc97', target.importance > 2.6);
        if (golden) addPopup(target.x, target.y - 4, '¡PLANO DE ORO!', '#ffd166', true);
        if (streakRef.current > 0 && streakRef.current % 3 === 0) addPopup(target.x, target.y - 8, `RACHA ×${streakRef.current}`, '#22d3ee', true);
        if (target.importance > 3) { flashRef.current = { until: now + 160, color: target.color }; setShake(1); window.setTimeout(() => setShake(0), 130); }
        momentsRef.current.forEach(m => { if (m.id === target.id) m.caught = true; });
        incidentsRef.current.forEach(i => { if (i.id === target.id) i.caught = true; });
      }
      setTrackingFeedback('good');
    } else {
      audienceRef.current = clamp(audienceRef.current - dt * (4.4 + target.importance * 1.8), 0, 100);
      scoreRef.current = Math.max(0, scoreRef.current - dt * 5);
      comboRef.current = clamp(comboRef.current - dt * 0.5, 1, 6);
      if (streakRef.current > 2) addPopup(cam.x, cam.y, 'RACHA PERDIDA', '#ff4d6d', false);
      streakRef.current = 0;
      setTrackingFeedback(target.importance > 2 ? 'bad' : null);
    }

    if (now - lastHudUpdateRef.current > 110) {
      setScore(Math.floor(scoreRef.current));
      setAudience(audienceRef.current);
      setCombo(comboRef.current);
      setDirectorCue(target.label);
      setFraming(q);
      setReplayReady(replayReadyRef.current);
      lastHudUpdateRef.current = now;
    }
    if (audienceRef.current <= 0) finishGame();
  }, [addPopup, finishGame, getTargets, pushCapture]);

  // ¡TOMA! corta a repetición: gran bonus si está bien encuadrado, castigo si cortas a destiempo
  const triggerReplay = useCallback(() => {
    if (slowMoCharges <= 0 || slowMoActive) return;
    const now = performance.now();
    setSlowMoCharges(prev => prev - 1);
    setSlowMoActive(true);
    slowMoEndRef.current = now + 2600;
    const cam = cameraRef.current;
    const target = getTargets(now)[0];
    if (!target) return;
    const inside = inFrame(target, cam, 1);
    const q = inside ? framingQuality(target, cam) : 0;
    if (inside && target.importance >= 1.8 && q > 0.4) {
      const perfect = q > 0.75;
      const bonus = Math.round(target.importance * (perfect ? 620 : 340) * (0.7 + q));
      scoreRef.current += bonus;
      audienceRef.current = clamp(audienceRef.current + (perfect ? 16 : 9), 0, 100);
      comboRef.current = clamp(comboRef.current + (perfect ? 1.1 : 0.6), 1, 6);
      streakRef.current += 1;
      flashRef.current = { until: now + 220, color: perfect ? '#ffd166' : '#3ddc97' };
      addPopup(target.x, target.y - 6, perfect ? '¡TOMA PERFECTA!' : '¡BUENA TOMA!', perfect ? '#ffd166' : '#3ddc97', true);
      addPopup(target.x, target.y, `+${bonus}`, perfect ? '#ffd166' : '#3ddc97', true);
      pushCapture(perfect ? 'TOMA PERFECTA' : 'REPETICIÓN', bonus);
      setShake(1);
      window.setTimeout(() => setShake(0), 180);
    } else {
      audienceRef.current = clamp(audienceRef.current - 7, 0, 100);
      comboRef.current = 1;
      streakRef.current = 0;
      addPopup(cam.x, cam.y, 'TOMA FALLIDA', '#ff4d6d', true);
    }
  }, [addPopup, getTargets, pushCapture, slowMoActive, slowMoCharges]);

  const moveCamera = useCallback((dt: number) => {
    const cam = cameraRef.current;
    const follow = followRef.current;
    const keyMove = keysRef.current.has('ArrowUp') || keysRef.current.has('ArrowDown') ||
      keysRef.current.has('ArrowLeft') || keysRef.current.has('ArrowRight') ||
      keysRef.current.has('KeyW') || keysRef.current.has('KeyA') || keysRef.current.has('KeyS') || keysRef.current.has('KeyD');
    if (follow.active && !keyMove) {
      const k = Math.min(1, dt * 12);
      cam.x += (follow.tx - cam.x) * k;
      cam.y += (follow.ty - cam.y) * k;
      if (Math.hypot(follow.tx - cam.x, follow.ty - cam.y) < 0.3) follow.active = false;
    }
    const speed = 62 * dt;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) cam.y -= speed;
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) cam.y += speed;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) cam.x -= speed;
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) cam.x += speed;
    if (keyMove) follow.active = false;
    const c = clampCamera(cam);
    cam.x = c.x; cam.y = c.y;
  }, []);

  const levelStadium = () => LEVELS[currentLevel]?.stadium ?? { grass1: '#3a8a54', grass2: '#317c49', stands: '#1a2438', trim: '#3a5a7a' };

  // Suplente sentado en el banquillo (frente o de espaldas al partido)
  const drawSeated = (ctx: CanvasRenderingContext2D, m: FieldMap, wx: number, wy: number, team: 'home' | 'away', gk = false, facingUp = false, now = 0) => {
    const p = mMap(m, wx, wy);
    const u = m.ppuX;
    if (u < 2.2) return;
    // Balanceo sutil de nervios (los suplentes no están quietos)
    const jig = Math.sin(now * 0.004 + wx * 0.6) * u * 0.05;
    const px = p.x + jig;

    // Pantalón/piernas dobladas
    ctx.fillStyle = '#23262e';
    ctx.fillRect(px - u * 0.55, p.y, u * 1.1, u * 0.55);
    ctx.fillRect(px - u * 0.55, p.y, u * 0.42, u * 0.9);
    ctx.fillRect(px + u * 0.13, p.y, u * 0.42, u * 0.9);
    // Botas
    ctx.fillStyle = '#0e1015';
    ctx.fillRect(px - u * 0.55, p.y + u * 0.85, u * 0.4, u * 0.2);
    ctx.fillRect(px + u * 0.15, p.y + u * 0.85, u * 0.4, u * 0.2);

    // Torso (camiseta oficial del equipo)
    ctx.fillStyle = teamColor(team, gk);
    ctx.fillRect(px - u * 0.62, p.y - u * 1.25, u * 1.24, u * 1.4);
    // Franja central del trim
    ctx.fillStyle = teamTrim(team, gk);
    ctx.fillRect(px - u * 0.1, p.y - u * 1.25, u * 0.2, u * 1.4);
    // Hombros con sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px - u * 0.62, p.y - u * 1.25, u * 1.24, u * 0.18);

    if (facingUp) {
      // De espaldas: el cuello aparece bajo el pelo y no se ve la cara
      ctx.fillStyle = '#f0c199';
      ctx.fillRect(px - u * 0.15, p.y - u * 1.35, u * 0.3, u * 0.16);
      ctx.fillStyle = team === 'home' ? '#3a2416' : '#20202a';
      ctx.fillRect(px - u * 0.4, p.y - u * 2.1, u * 0.8, u * 0.8);
      // Sombra del cráneo (contorno más oscuro por la nuca)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px - u * 0.4, p.y - u * 1.55, u * 0.8, u * 0.1);
    } else {
      // De frente: cara + pelo arriba
      ctx.fillStyle = '#f0c199';
      ctx.fillRect(px - u * 0.4, p.y - u * 2.1, u * 0.8, u * 0.85);
      ctx.fillStyle = team === 'home' ? '#3a2416' : '#20202a';
      ctx.fillRect(px - u * 0.4, p.y - u * 2.1, u * 0.8, u * 0.3);
      // Ojos
      if (u > 3) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(px - u * 0.24, p.y - u * 1.7, 2, 2);
        ctx.fillRect(px + u * 0.14, p.y - u * 1.7, 2, 2);
      }
    }
  };

  // Caseta acristalada del banquillo (paneles transparentes + estructura)
  const drawDugout = (ctx: CanvasRenderingContext2D, m: FieldMap, x1: number, x2: number, yB: number, trim: string) => {
    const a = mMap(m, x1, yB - 4.6);
    const b = mMap(m, x2, yB + 3.5);
    const rx = a.x, ry = a.y;
    const rw = b.x - a.x, rh = b.y - a.y;
    // Sombra del alero
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(rx - 3, ry + rh + 2, rw + 6, 4);
    // Base metálica trasera (parte oculta)
    ctx.fillStyle = '#14171d';
    ctx.fillRect(rx, ry, rw, rh);
    // Techo curvo (barra superior con el color del club)
    ctx.fillStyle = trim;
    ctx.fillRect(rx - 2, ry - 3, rw + 4, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(rx - 2, ry - 3, rw + 4, 1);
    // Cristal principal (semi-transparente) para dejar ver a los suplentes por detrás
    ctx.fillStyle = 'rgba(180,220,255,0.22)';
    ctx.fillRect(rx + 3, ry + 3, rw - 6, rh - 8);
    // Marcos verticales de aluminio
    ctx.fillStyle = '#5a6478';
    ctx.fillRect(rx, ry, 3, rh);
    ctx.fillRect(rx + rw - 3, ry, 3, rh);
    ctx.fillStyle = '#3a4152';
    const cols = 4;
    for (let i = 1; i < cols; i += 1) {
      const cx = rx + (rw / cols) * i;
      ctx.fillRect(cx - 1, ry + 2, 2, rh - 4);
    }
    // Barra horizontal a media altura
    ctx.fillStyle = '#3a4152';
    ctx.fillRect(rx + 3, ry + rh * 0.55, rw - 6, 2);
    // Reflejos diagonales en el cristal
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.15, ry + 2);
    ctx.lineTo(rx + rw * 0.45, ry + 2);
    ctx.lineTo(rx + rw * 0.30, ry + rh * 0.5);
    ctx.lineTo(rx + rw * 0.05, ry + rh * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.60, ry + 2);
    ctx.lineTo(rx + rw * 0.80, ry + 2);
    ctx.lineTo(rx + rw * 0.55, ry + rh * 0.55);
    ctx.lineTo(rx + rw * 0.35, ry + rh * 0.55);
    ctx.closePath();
    ctx.fill();
  };

  // ─────── Render de sprites ───────
  const drawField = (ctx: CanvasRenderingContext2D, m: FieldMap, now: number) => {
    const st = levelStadium();

    // ── Terreno de fuera de juego (pista perimetral) ──
    const t0 = mMap(m, -TRACK - 8, -TRACK), t1 = mMap(m, 100 + TRACK + 8, 100 + TRACK);
    ctx.fillStyle = '#8a4636';
    ctx.fillRect(t0.x, t0.y, t1.x - t0.x, t1.y - t0.y);
    // Carriles de tartán
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
      const off = (TRACK / 4) * i;
      const a = mMap(m, -TRACK - 8, -TRACK + off), b = mMap(m, 100 + TRACK + 8, -TRACK + off);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const c2 = mMap(m, -TRACK - 8, 100 + TRACK - off), d2 = mMap(m, 100 + TRACK + 8, 100 + TRACK - off);
      ctx.beginPath(); ctx.moveTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.stroke();
    }
    // Franja de seguridad de césped junto a la línea
    const s0 = mMap(m, -2.5, -2.5), s1 = mMap(m, 102.5, 102.5);
    ctx.fillStyle = st.grass2;
    ctx.fillRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);

    // ── Césped ──
    const tl = mMap(m, 0, 0), br = mMap(m, 100, 100);
    const w = br.x - tl.x, h = br.y - tl.y;
    const stripe = w / 12;
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 === 0 ? st.grass1 : st.grass2; ctx.fillRect(tl.x + stripe * i, tl.y, stripe + 1, h); }
    ctx.strokeStyle = 'rgba(240,255,240,0.9)';
    ctx.lineWidth = Math.max(1, m.ppuX * 0.13);
    ctx.strokeRect(tl.x, tl.y, w, h);
    const mid = mMap(m, 50, 0), midB = mMap(m, 50, 100);
    ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(midB.x, midB.y); ctx.stroke();
    const c = mMap(m, 50, 50);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 9.5 * m.ppuX, 9.5 * m.ppuY, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(240,255,240,0.9)'; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1.5, m.ppuY * 0.3), 0, Math.PI * 2); ctx.fill();
    const boxes: Array<[number, number]> = [[0, 16], [84, 100]];
    boxes.forEach(([x1, x2]) => {
      const a = mMap(m, x1, 30), b = mMap(m, x2, 70);
      ctx.strokeRect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x), b.y - a.y);
    });

    // ── Porterías con red ──
    const flash = goalFlashRef.current;
    const drawGoal = (side: 'left' | 'right') => {
      const lineX = side === 'left' ? 0 : 100;
      const depth = side === 'left' ? -5 : 5;
      const a = mMap(m, lineX, 40);
      const b = mMap(m, lineX + depth, 60);
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
      const y0 = a.y, y1 = b.y;
      const gw = x1 - x0, gh = y1 - y0;
      const lit = flash && flash.side === side && now < flash.until;
      // Red
      ctx.fillStyle = lit ? 'rgba(255,209,102,0.55)' : 'rgba(235,245,255,0.20)';
      ctx.fillRect(x0, y0, gw, gh);
      // Malla
      ctx.strokeStyle = lit ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      const cells = 5;
      for (let i = 0; i <= cells; i += 1) {
        const xx = x0 + (gw / cells) * i;
        ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke();
        const yy = y0 + (gh / cells) * i;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      }
      // Marco (postes)
      const pw = Math.max(2, m.ppuX * 0.4);
      ctx.fillStyle = lit ? '#fff3c4' : '#ffffff';
      ctx.fillRect(x0, y0 - pw / 2, gw, pw);
      ctx.fillRect(x0, y1 - pw / 2, gw, pw);
      const backX = side === 'left' ? x0 : x1 - pw;
      ctx.fillRect(backX, y0 - pw / 2, pw, gh + pw);
      // Postes en la línea de gol
      ctx.fillStyle = lit ? '#ffd166' : '#ffffff';
      ctx.fillRect(a.x - pw / 2, y0 - pw, pw, pw * 2);
      ctx.fillRect(a.x - pw / 2, y1 - pw, pw, pw * 2);
    };
    drawGoal('left');
    drawGoal('right');

    // ── Banquillos acristalados con suplentes DELANTE (para verlos de espaldas) ──
    // topBench: banquillo local ARRIBA (suplentes miran hacia abajo al partido)
    // bottomBench: banquillo visitante ABAJO (suplentes están de espaldas mirando arriba al partido)
    const drawBench = (x1: number, x2: number, benchY: number, team: 'home' | 'away', facingUp: boolean) => {
      // Caseta acristalada
      drawDugout(ctx, m, x1, x2, benchY, st.trim);
      // Los suplentes se dibujan DELANTE del cristal (hacia el partido)
      const seats = 5;
      const rowY = facingUp ? benchY - 1.6 : benchY + 1.6;
      for (let s = 0; s < seats; s += 1) {
        const wx = x1 + ((x2 - x1) / seats) * (s + 0.5);
        const isGK = s === seats - 1;
        drawSeated(ctx, m, wx, rowY, team, isGK, facingUp, now);
      }
    };
    drawBench(36, 50, -5.5, 'home', false);
    drawBench(50, 64, -5.5, 'home', false);
    drawBench(36, 50, 105.5, 'away', true);
    drawBench(50, 64, 105.5, 'away', true);
  };

  const drawPlayerTiny = (ctx: CanvasRenderingContext2D, m: FieldMap, p: { x: number; y: number; team: 'home' | 'away'; hasBall: boolean; role?: string }) => {
    const s = mMap(m, p.x, p.y);
    const gk = p.role === 'GK';
    const r = Math.max(2, m.ppuX * 0.9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y + r * 0.5, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = teamColor(p.team, gk);
    ctx.fillRect(Math.round(s.x - r), Math.round(s.y - r * 1.6), Math.round(r * 2), Math.round(r * 2.6));
    ctx.fillStyle = teamTrim(p.team, gk);
    ctx.fillRect(Math.round(s.x - r), Math.round(s.y - r * 0.4), Math.max(1, r * 0.4), Math.round(r * 2.6));
    ctx.fillStyle = '#f0c199';
    ctx.fillRect(Math.round(s.x - r * 0.6), Math.round(s.y - r * 2.4), Math.round(r * 1.2), Math.round(r * 0.9));
    if (p.hasBall) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5; ctx.strokeRect(Math.round(s.x - r - 2), Math.round(s.y - r * 2.6 - 2), Math.round(r * 2 + 4), Math.round(r * 3.4 + 4)); }
  };

  const drawPlayerBig = (ctx: CanvasRenderingContext2D, m: FieldMap, p: { x: number; y: number; team: 'home' | 'away'; number?: number; hasBall: boolean; moving: boolean; phase: number; role?: string; celebrating?: boolean; sad?: boolean }) => {
    const sp = mMap(m, p.x, p.y);
    const gk = p.role === 'GK';
    const u = m.ppuX;
    const H = u * 3.4, w = H * 0.44;
    
    // Si celebra, salta arriba y abajo de forma graciosa
    let jumpY = 0;
    if (p.celebrating) {
      jumpY = -Math.abs(Math.sin(p.phase * 1.5)) * H * 0.35;
    }
    
    const x = sp.x, foot = sp.y + jumpY;
    const stride = p.moving ? Math.sin(p.phase) * w * 0.28 : 0;
    
    // Sombra en el suelo (no salta)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, sp.y, w * 0.62, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    
    // Nube de polvo si corre rápido
    if (p.moving && Math.random() < 0.22 && u > 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(x - stride * 1.5, sp.y + (Math.random() - 0.5) * 3, u * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const legH = H * 0.30, legW = Math.max(2, w * 0.32);
    ctx.fillStyle = '#23262e';
    ctx.fillRect(x - legW - 1 + stride, foot - legH, legW, legH);
    ctx.fillRect(x + 1 - stride, foot - legH, legW, legH);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(x - legW - 1 + stride, foot - 2, legW, 2);
    ctx.fillRect(x + 1 - stride, foot - 2, legW, 2);
    const shortsH = H * 0.15, shortsY = foot - legH - shortsH;
    ctx.fillStyle = teamShort(p.team, gk);
    ctx.fillRect(x - w / 2, shortsY, w, shortsH);
    
    // Torso doblado si está triste
    const shirtH = H * 0.30;
    const shirtY = shortsY - shirtH;
    ctx.fillStyle = teamColor(p.team, gk);
    ctx.fillRect(x - w / 2, shirtY, w, shirtH);
    
    // Brazos alzados si celebra, o caídos si está triste
    const armW = Math.max(2, w * 0.24);
    if (p.celebrating) {
      // Brazos arriba
      ctx.fillRect(x - w / 2 - armW, shirtY - shirtH * 0.4, armW, shirtH * 0.72);
      ctx.fillRect(x + w / 2, shirtY - shirtH * 0.4, armW, shirtH * 0.72);
    } else if (p.sad) {
      // Brazos caídos
      ctx.fillRect(x - w / 2 - armW * 0.5, shirtY + shirtH * 0.4, armW * 0.8, shirtH * 0.65);
      ctx.fillRect(x + w / 2 - armW * 0.3, shirtY + shirtH * 0.4, armW * 0.8, shirtH * 0.65);
    } else {
      ctx.fillRect(x - w / 2 - armW, shirtY + 1, armW, shirtH * 0.62);
      ctx.fillRect(x + w / 2, shirtY + 1, armW, shirtH * 0.62);
    }

    // Guantes del portero o manos
    ctx.fillStyle = gk ? (p.team === 'home' ? '#ff8c1a' : '#0ea5e9') : '#f0c199';
    if (p.celebrating) {
      ctx.fillRect(x - w / 2 - armW, shirtY - shirtH * 0.45, armW, armW * 0.9);
      ctx.fillRect(x + w / 2, shirtY - shirtH * 0.45, armW, armW * 0.9);
    } else if (p.sad) {
      ctx.fillRect(x - w / 2 - armW * 0.5, shirtY + shirtH * 0.95, armW * 0.8, armW * 0.9);
      ctx.fillRect(x + w / 2 - armW * 0.3, shirtY + shirtH * 0.95, armW * 0.8, armW * 0.9);
    } else {
      ctx.fillRect(x - w / 2 - armW, shirtY + shirtH * 0.55, armW, armW * 0.9);
      ctx.fillRect(x + w / 2, shirtY + shirtH * 0.55, armW, armW * 0.9);
    }

    ctx.fillStyle = teamTrim(p.team, gk);
    ctx.fillRect(x - Math.max(1, w * 0.08), shirtY, Math.max(2, w * 0.16), shirtH);
    if (p.number && H > 30) {
      ctx.fillStyle = teamTrim(p.team, gk);
      ctx.font = `bold ${Math.round(H * 0.15)}px "Roboto Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number), x, shirtY + shirtH * 0.5);
    }

    // Cabeza: agachada si está triste
    const headR = H * 0.17;
    const headTilt = p.sad ? headR * 0.55 : 0;
    const headCY = shirtY - headR * 0.9 + headTilt;
    ctx.fillStyle = '#f0c199';
    ctx.fillRect(x - headR, headCY - headR, headR * 2, headR * 2);
    ctx.fillStyle = p.team === 'home' ? '#3a2416' : '#20202a';
    ctx.fillRect(x - headR, headCY - headR, headR * 2, headR * 0.75);
    if (headR > 3.5) {
      ctx.fillStyle = '#1a1a1a';
      const eo = headR * 0.45, es = Math.max(1.5, headR * 0.28);
      ctx.fillRect(x - eo - es / 2, headCY, es, es);
      ctx.fillRect(x + eo - es / 2, headCY, es, es);
    }

    // Emoticonos/Efectos graciosos
    if (p.celebrating && Math.random() < 0.12 && u > 4) {
      // Estrella o corazón flotando
      ctx.fillStyle = Math.random() < 0.5 ? '#ff4d6d' : '#ffd166';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(Math.random() < 0.5 ? '⭐' : '❤️', x + (Math.random() - 0.5) * H * 0.6, headCY - headR - 6);
    } else if (p.sad && Math.random() < 0.08 && u > 4) {
      // Lágrima cayendo
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(x - headR * 0.4, headCY + headR * 0.3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.moving && Math.random() < 0.05 && u > 4) {
      // Gotitas de sudor si corre
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(x + (Math.random() - 0.5) * w, headCY - headR * 0.3, 1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p.hasBall) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; const top = headCY - headR - 3; ctx.strokeRect(x - w / 2 - 3, top, w + 6, foot - top + 3); }
  };

  const drawStands = (ctx: CanvasRenderingContext2D, m: FieldMap, now: number) => {
    const st = levelStadium();

    // Rellena un rectángulo de pantalla con público animado
    const fillCrowd = (rx: number, ry: number, rw: number, rh: number, seed: number) => {
      if (rw < 2 || rh < 2) return;
      ctx.fillStyle = st.stands;
      ctx.fillRect(rx, ry, rw, rh);

      // Escalones de hormigón
      const unit = Math.max(2.2, m.ppuY * 1.15);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let sy = ry + unit * 2.4; sy < ry + rh; sy += unit * 2.4) {
        ctx.fillRect(rx, sy, rw, 1);
      }

      const stepX = unit * 1.85;
      const stepY = unit * 2.4;
      const cols = Math.floor(rw / stepX);
      const rows = Math.floor(rh / stepY);
      if (cols < 1 || rows < 1) return;

      const shirts = ['#e7c85a', '#d75a5a', '#5aa9e7', '#3ddc97', '#c9d3da', '#ff9f43', '#9c6ade'];
      const skins = ['#f0c199', '#d99b72', '#a96946', '#70432f'];
      const hairs = ['#3a2416', '#20202a', '#5a3d1a', '#8a8f98'];

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const idx = seed + row * 131 + col * 71;
          // Algunos huecos vacíos para que no parezca una cuadrícula perfecta
          if (idx % 17 === 0) continue;

          const px = rx + col * stepX + stepX * 0.5 + (row % 2) * stepX * 0.3;
          const py = ry + row * stepY + stepY * 0.75;
          if (px > rx + rw - unit * 0.4) continue;

          const shirt = shirts[idx % shirts.length];
          const skin = skins[idx % skins.length];
          const hair = hairs[idx % hairs.length];

          // Ola: se levantan por oleadas según su posición
          const wave = Math.sin(now * 0.0035 + px * 0.055 + row * 0.4);
          const excited = wave > 0.55;
          const lift = excited ? Math.abs(Math.sin(now * 0.012 + idx)) * unit * 0.9 : 0;
          const y = py - lift;

          // Piernas
          ctx.fillStyle = '#1a2130';
          ctx.fillRect(px - unit * 0.32, y + unit * 0.28, unit * 0.26, unit * 0.5);
          ctx.fillRect(px + unit * 0.06, y + unit * 0.28, unit * 0.26, unit * 0.5);

          // Torso
          ctx.fillStyle = shirt;
          ctx.fillRect(px - unit * 0.42, y - unit * 0.35, unit * 0.84, unit * 0.7);

          // Brazos: arriba si está animado
          if (excited) {
            ctx.fillRect(px - unit * 0.66, y - unit * 1.0, unit * 0.22, unit * 0.75);
            ctx.fillRect(px + unit * 0.44, y - unit * 1.0, unit * 0.22, unit * 0.75);
          } else {
            ctx.fillRect(px - unit * 0.62, y - unit * 0.28, unit * 0.2, unit * 0.6);
            ctx.fillRect(px + unit * 0.42, y - unit * 0.28, unit * 0.2, unit * 0.6);
          }

          // Cabeza y pelo
          ctx.fillStyle = skin;
          ctx.beginPath();
          ctx.arc(px, y - unit * 0.62, unit * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = hair;
          ctx.fillRect(px - unit * 0.3, y - unit * 0.9, unit * 0.6, unit * 0.22);

          // Alguna bufanda ondeando
          if (idx % 11 === 0 && unit > 3) {
            ctx.fillStyle = shirts[(idx + 3) % shirts.length];
            const sway = Math.sin(now * 0.01 + idx) * unit * 0.35;
            ctx.fillRect(px - unit * 0.1 + sway, y - unit * 1.35, unit * 0.5, unit * 0.18);
          }
        }
      }
    };

    // Coordenadas de mundo → pantalla para cada una de las 4 gradas
    const band = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
      const a = mMap(m, x0, y0);
      const b = mMap(m, x1, y1);
      fillCrowd(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), seed);
    };

    // Grada NORTE y SUR (cubren todo el ancho, incluidas las esquinas)
    band(STAND_MIN, STAND_MIN, STAND_MAX, -TRACK, 7);
    band(STAND_MIN, 100 + TRACK, STAND_MAX, STAND_MAX, 23);
    // Grada OESTE y ESTE (fondos, detrás de las porterías)
    band(STAND_MIN, -TRACK, -TRACK, 100 + TRACK, 41);
    band(100 + TRACK, -TRACK, STAND_MAX, 100 + TRACK, 59);
  };

  const drawBall = (ctx: CanvasRenderingContext2D, m: FieldMap, ball: { x: number; y: number; vx?: number; vy?: number }, bold = false) => {
    const p = mMap(m, ball.x, ball.y);
    const r = Math.max(bold ? 4 : 2.4, m.ppuX * (bold ? 0.85 : 0.6));
    const speed = Math.hypot(ball.vx ?? 0, ball.vy ?? 0);
    const angle = Math.atan2(ball.vy ?? 0, ball.vx ?? 0);
    // Marca de posición visible incluso quieta (anillo pulsante en el mapa grande)
    if (bold) {
      const pulse = 1.2 + Math.sin(performance.now() * 0.006) * 0.4;
      ctx.strokeStyle = `rgba(255,255,255,${0.32 + Math.sin(performance.now() * 0.01) * 0.18})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Estela cometaria: deja la estela DETRÁS, no flecha al frente
    if (speed > 3) {
      const segs = bold ? 8 : 6;
      const spacing = Math.min(bold ? 16 : 8, speed * m.ppuX * 0.02 + 3);
      const shot = speed > 22;
      for (let i = segs; i >= 1; i -= 1) {
        const t = i / segs;
        ctx.fillStyle = shot ? `rgba(255,209,102,${(1 - t) * 0.6 + 0.12})` : `rgba(255,255,255,${(1 - t) * 0.55 + 0.1})`;
        ctx.beginPath();
        ctx.arc(p.x - Math.cos(angle) * spacing * i, p.y - Math.sin(angle) * spacing * i, Math.max(1, r * (1 - t * 0.7)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.75, r * 1.05, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    // Pelota de fútbol: base blanca + sombreado
    ctx.save();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#f5f7fa';
    ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(88,104,128,0.35)';
    ctx.fillRect(p.x - r, p.y + r * 0.35, r * 2, r * 0.75);
    // Pentágonos negros
    const pent = (cx: number, cy: number, pr: number, rot: number) => {
      ctx.fillStyle = '#161a22';
      ctx.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = rot + (k * Math.PI * 2) / 5;
        const px = cx + Math.cos(a) * pr;
        const py = cy + Math.sin(a) * pr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    };
    if (r > 4) {
      pent(p.x, p.y, r * 0.42, -Math.PI / 2);
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + Math.PI * 0.4 + (k * Math.PI * 2) / 5;
        pent(p.x + Math.cos(a) * r * 0.85, p.y + Math.sin(a) * r * 0.85, r * 0.32, a);
      }
    } else {
      ctx.fillStyle = '#161a22';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    // Brillo
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(p.x - r * 0.38, p.y - r * 0.42, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,14,20,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  };

  const drawIncidentBig = (ctx: CanvasRenderingContext2D, m: FieldMap, inc: { x: number; y: number; kind: string; color: string }, now: number) => {
    const p = mMap(m, inc.x, inc.y);
    const u = m.ppuX;
    const run = Math.sin(now * 0.025);

    if (inc.kind === 'dog') {
      // Sombra
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 1.4, u * 2.4, u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      
      // Polvo levantado por las patas
      if (Math.random() < 0.4 && u > 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(p.x - run * u * 2, p.y + u * 1.2 + (Math.random() - 0.5) * 3, u * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cuerpo del perro
      ctx.fillStyle = inc.color;
      ctx.fillRect(p.x - u * 2.2, p.y - u * 0.6, u * 4, u * 1.8);
      // Cabeza
      ctx.fillRect(p.x + u * 1.4, p.y - u * 1.6, u * 1.7, u * 1.6);
      // Hocico
      ctx.fillRect(p.x + u * 2.8, p.y - u * 0.9, u * 1.2, u * 0.8);
      ctx.fillStyle = '#111'; // nariz
      ctx.fillRect(p.x + u * 3.7, p.y - u * 0.9, u * 0.4, u * 0.4);
      
      // Orejas caídas flapeando
      ctx.fillStyle = '#b9763a';
      const earFlap = Math.sin(now * 0.03) * u * 0.3;
      ctx.fillRect(p.x + u * 1.4, p.y - u * 2.4 + earFlap, u * 0.8, u * 1.1);

      // Cola moviéndose super rápido
      ctx.fillStyle = inc.color;
      ctx.save();
      ctx.translate(p.x - u * 2.2, p.y - u * 0.4);
      ctx.rotate(run * 0.7);
      ctx.fillRect(-u * 1.6, -u * 0.3, u * 1.6, u * 0.5);
      ctx.restore();

      // Patas al galope
      ctx.fillStyle = '#8a5a2b';
      const lp1 = run * u * 1.1;
      const lp2 = -run * u * 1.1;
      ctx.fillRect(p.x - u * 1.8, p.y + u * 0.9, u * 0.6, u * 1.1 + lp1);
      ctx.fillRect(p.x - u * 0.6, p.y + u * 0.9, u * 0.6, u * 1.1 + lp2);
      ctx.fillRect(p.x + u * 0.8, p.y + u * 0.9, u * 0.6, u * 1.1 + lp1);
      ctx.fillRect(p.x + u * 1.8, p.y + u * 0.9, u * 0.6, u * 1.1 + lp2);

      // Lengua fuera
      ctx.fillStyle = '#ff5a7a';
      ctx.fillRect(p.x + u * 3.2, p.y - u * 0.3, u * 0.6, u * 0.8);

      // Ojo tierno
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x + u * 2.2, p.y - u * 1.2, u * 0.4, u * 0.4);

      // Bocadillo de ladrido gracioso
      if (Math.sin(now * 0.009) > 0.2 && u > 3.5) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const bx = p.x + u * 3;
        const by = p.y - u * 4;
        ctx.fillRect(bx - u * 3.5, by - 6, u * 7, 13);
        ctx.strokeRect(bx - u * 3.5, by - 6, u * 7, 13);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 10px "Roboto Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('¡GUAU! 🐶', bx, by + 1);
      }
      return;
    }

    if (inc.kind === 'fight') {
      const sh = Math.sin(now * 0.05) * u * 0.4;
      // Nube de polvo de pelea cómica
      ctx.fillStyle = 'rgba(240,240,240,0.65)';
      ctx.beginPath(); ctx.arc(p.x + sh, p.y, u * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Jugadores peleando dentro
      drawPlayerBig(ctx, m, { x: inc.x - 1.4, y: inc.y + 1.6, team: 'home', hasBall: false, moving: true, phase: now * 0.035 });
      drawPlayerBig(ctx, m, { x: inc.x + 1.4, y: inc.y + 1.6, team: 'away', hasBall: false, moving: true, phase: now * 0.035 + 2 });

      // Puños y estrellas saltando
      ctx.fillStyle = '#fff23c';
      for (let i = 0; i < 5; i++) {
        const a = now * 0.02 + (i * Math.PI * 2) / 5;
        ctx.fillRect(p.x + Math.cos(a) * u * 2.5 - 1, p.y - u * 0.5 + Math.sin(a) * u * 1.8 - 1, u * 0.8, u * 0.8);
      }

      // Bocadillo de bronca
      if (u > 3) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const bx = p.x;
        const by = p.y - u * 4.2;
        ctx.fillRect(bx - u * 4, by - 7, u * 8, 14);
        ctx.strokeRect(bx - u * 4, by - 7, u * 8, 14);
        ctx.fillStyle = '#ff3366';
        ctx.font = 'bold 10px "Orbitron", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('¡PELEA! 👊💥', bx, by + 1);
      }
      return;
    }

    if (inc.kind === 'streaker') {
      // Intruso (streaker) desnudo corriendo
      drawPlayerBig(ctx, m, { x: inc.x, y: inc.y + 1.8, team: 'home', hasBall: false, moving: true, phase: now * 0.04 });
      ctx.fillStyle = '#f0c199'; 
      ctx.fillRect(mMap(m, inc.x, inc.y - 0.2).x - u * 0.75, mMap(m, inc.x, inc.y - 0.2).y, u * 1.5, u * 1.4);
      // Barra de censura negra (pixelada)
      ctx.fillStyle = '#111'; 
      const cb = mMap(m, inc.x, inc.y + 1); 
      ctx.fillRect(cb.x - u * 0.9, cb.y, u * 1.8, u * 0.7);

      // Guardias de seguridad persiguiéndole
      const goingRight = inc.x < 50;
      const gx = inc.x - (goingRight ? 3 : -3);
      const gy = inc.y + (Math.sin(now * 0.015) * 1.5);
      const spGuard = mMap(m, gx, gy);
      const H = u * 3.4, w = H * 0.44;
      const foot = spGuard.y;
      const stride = Math.sin(now * 0.03) * w * 0.28;
      
      // Sombra del guardia
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(spGuard.x, foot, w * 0.62, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      
      // Piernas del guardia
      ctx.fillStyle = '#111522';
      ctx.fillRect(spGuard.x - Math.max(2, w * 0.32) - 1 + stride, foot - H * 0.30, Math.max(2, w * 0.32), H * 0.30);
      ctx.fillRect(spGuard.x + 1 - stride, foot - H * 0.30, Math.max(2, w * 0.32), H * 0.30);
      
      // Chaleco naranja fluorescente de seguridad
      ctx.fillStyle = '#ff6b00';
      ctx.fillRect(spGuard.x - w / 2, foot - H * 0.75, w, H * 0.45);
      // Franjas reflectantes amarillas
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(spGuard.x - w / 2, foot - H * 0.70, w, 2);
      ctx.fillRect(spGuard.x - w / 2, foot - H * 0.50, w, 2);
      
      // Brazos estirados para atraparle
      ctx.fillStyle = '#111522';
      const armW = Math.max(2, w * 0.24);
      ctx.fillRect(spGuard.x + (goingRight ? w / 2 : -w / 2 - armW), foot - H * 0.68, armW * 1.4, H * 0.25);
      ctx.fillStyle = '#f0c199';
      ctx.fillRect(spGuard.x + (goingRight ? w / 2 + armW : -w / 2 - armW * 1.4), foot - H * 0.68, armW * 0.8, armW * 0.8);
      
      // Cabeza del guardia con gorra azul de policía
      const headR = H * 0.17, headCY = foot - H * 0.75 - headR * 0.9;
      ctx.fillStyle = '#f0c199';
      ctx.fillRect(spGuard.x - headR, headCY - headR, headR * 2, headR * 2);
      ctx.fillStyle = '#10234a'; // gorra azul
      ctx.fillRect(spGuard.x - headR - 1, headCY - headR - 1, headR * 2 + 2, headR * 0.75);
      ctx.fillStyle = '#ffd166'; // placa dorada de gorra
      ctx.fillRect(spGuard.x - 1, headCY - headR, 2, 2);

      // Bocadillo de grito gracioso
      if (Math.sin(now * 0.008) > 0.4 && u > 4) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        const bx = spGuard.x + (goingRight ? -u * 4 : u * 4);
        const by = headCY - headR * 2 - 8;
        ctx.fillRect(bx - u * 3.5, by - 6, u * 7, 13);
        ctx.strokeRect(bx - u * 3.5, by - 6, u * 7, 13);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 9px "Roboto Mono", monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('¡ALTO! 👮', bx, by + 1);
      }
      return;
    }

    // ── ENTRENADOR FUERA DE SÍ (Coach) ──
    const sp = p;
    const H = u * 3.6, w = H * 0.44;
    const foot = sp.y;
    const stomp = Math.abs(Math.sin(now * 0.025)) * u * 0.25;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(sp.x, foot, w * 0.65, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();

    // Piernas (traje elegante / chándal oficial)
    const legH = H * 0.32, legW = Math.max(2, w * 0.34);
    ctx.fillStyle = '#161e2e'; // pantalón traje oscuro
    ctx.fillRect(sp.x - legW - 1, foot - legH - stomp, legW, legH + stomp);
    ctx.fillRect(sp.x + 1, foot - legH, legW, legH);
    ctx.fillStyle = '#0a0d14'; // zapatos
    ctx.fillRect(sp.x - legW - 2, foot - 2, legW + 2, 3);
    ctx.fillRect(sp.x + 1, foot - 2, legW + 2, 3);

    // Torso con chaqueta / corbata
    const shirtH = H * 0.32;
    const shirtY = foot - legH - shirtH - stomp * 0.5;
    ctx.fillStyle = '#1c2838'; // chaqueta traje
    ctx.fillRect(sp.x - w / 2, shirtY, w, shirtH);
    ctx.fillStyle = '#ffffff'; // camisa blanca centro
    ctx.fillRect(sp.x - w * 0.15, shirtY, w * 0.3, shirtH * 0.8);
    ctx.fillStyle = '#ff3366'; // corbata roja
    ctx.fillRect(sp.x - w * 0.06, shirtY + 2, w * 0.12, shirtH * 0.6);

    // Brazos agitando en la banda
    const armWave = Math.sin(now * 0.03) * u * 0.8;
    const armW = Math.max(2, w * 0.26);
    ctx.fillStyle = '#1c2838';
    // Brazo izquierdo en jarras o señalando
    ctx.fillRect(sp.x - w / 2 - armW, shirtY - armWave * 0.5, armW, shirtH * 0.7);
    // Brazo derecho levantado protestando
    ctx.fillRect(sp.x + w / 2, shirtY - shirtH * 0.4 + armWave, armW, shirtH * 0.8);
    // Manos
    ctx.fillStyle = '#f0c199';
    ctx.fillRect(sp.x - w / 2 - armW, shirtY + shirtH * 0.65 - armWave * 0.5, armW, armW);
    ctx.fillRect(sp.x + w / 2, shirtY - shirtH * 0.45 + armWave, armW, armW);

    // Cabeza roja de furia
    const headR = H * 0.18;
    const headCY = shirtY - headR * 0.9;
    // Cara sonrojada/furia
    ctx.fillStyle = Math.sin(now * 0.02) > 0 ? '#ff6b6b' : '#f0c199';
    ctx.fillRect(sp.x - headR, headCY - headR, headR * 2, headR * 2);
    // Pelo canoso de Mánager
    ctx.fillStyle = '#d0d7de';
    ctx.fillRect(sp.x - headR - 1, headCY - headR - 1, headR * 2 + 2, headR * 0.7);

    // Ojos furiosos y boca gritando
    if (u > 2.5) {
      ctx.fillStyle = '#000';
      // Cejas enfadadas (diagonales)
      ctx.beginPath();
      ctx.moveTo(sp.x - headR * 0.7, headCY - headR * 0.2);
      ctx.lineTo(sp.x - headR * 0.1, headCY + headR * 0.1);
      ctx.moveTo(sp.x + headR * 0.7, headCY - headR * 0.2);
      ctx.lineTo(sp.x + headR * 0.1, headCY + headR * 0.1);
      ctx.stroke();

      // Boca gritando
      ctx.fillStyle = '#8b0000';
      ctx.fillRect(sp.x - headR * 0.35, headCY + headR * 0.3, headR * 0.7, headR * 0.5);
    }

    // Humo / vapor saliendo de las orejas
    if (u > 3) {
      ctx.fillStyle = 'rgba(240,240,240,0.7)';
      const steamY = headCY - Math.abs(Math.sin(now * 0.02)) * u * 0.8;
      ctx.beginPath();
      ctx.arc(sp.x - headR * 1.3, steamY, u * 0.3, 0, Math.PI * 2);
      ctx.arc(sp.x + headR * 1.3, steamY, u * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Símbolo de furia cómica 💢
      ctx.fillStyle = '#ff3366';
      ctx.font = 'bold 12px "Orbitron", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💢', sp.x + headR * 1.4, headCY - headR * 1.2);
    }

    // Bocadillo de protesta cómica
    if (u > 3.5) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      const bx = sp.x;
      const by = headCY - headR * 2 - 10;
      ctx.fillRect(bx - u * 4.5, by - 7, u * 9, 14);
      ctx.strokeRect(bx - u * 4.5, by - 7, u * 9, 14);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 9px "Roboto Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const phrases = ['¡¡ÁRBITRO!! 😤', '¡¡MANO!! 🤬', '¡¡FALTA!! 💥', '#@$%!! ⚡'];
      const pIdx = Math.floor((now * 0.001) % phrases.length);
      ctx.fillText(phrases[pIdx], bx, by + 1);
    }
  };

  const drawPanelChrome = (ctx: CanvasRenderingContext2D, p: Panel, title: string, accent: string, active = false) => {
    ctx.fillStyle = 'rgba(4,9,16,0.82)';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = active ? accent : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    ctx.fillStyle = accent;
    ctx.font = 'bold 10px "Roboto Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(title, p.x + 8, p.y + 9);
  };

  const renderFrame = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => {
    const sim = matchRef.current;
    if (!sim) return;
    const layout = computeLayout(W, H);
    layoutRef.current = layout;
    const cam = cameraRef.current;
    const targets = getTargets(now);
    const top = targets[0];
    const topInside = top ? inFrame(top, cam, 0) : false;
    const q = framingRef.current;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070b13'; ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake) { ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake); }

    // ── MEDIO: mapa grande para verlo todo ──
    const t = layout.tactical;
    drawPanelChrome(ctx, t, 'MAPA · TOCA UNA ZONA PARA LLEVAR LA CÁMARA', '#22d3ee');
    ctx.save();
    ctx.beginPath(); ctx.rect(t.inner.x, t.inner.y, t.inner.w, t.inner.h); ctx.clip();
    const tm = fitField(t.inner);
    drawStands(ctx, tm, now);
    drawField(ctx, tm, now);
    // ── EVENTOS: iconos grandes y pulsantes para que se vean claramente ──
    for (const inc of incidentsRef.current) {
      const ip = mMap(tm, inc.x, inc.y);
      const pulse = 1 + Math.sin(now * 0.008 + inc.x * 0.1) * 0.25;
      
      // Halo pulsante detrás del icono
      ctx.fillStyle = inc.color + '40';
      ctx.beginPath();
      ctx.arc(ip.x, ip.y, 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Icono del evento
      ctx.fillStyle = inc.color;
      ctx.beginPath();
      ctx.arc(ip.x, ip.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Etiqueta del evento
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px "Roboto Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = inc.kind === 'fight' ? '👊' : inc.kind === 'streaker' ? '🏃' : inc.kind === 'dog' ? '🐕' : inc.kind === 'coach' ? '😤' : '?';
      ctx.fillText(icon, ip.x, ip.y);
    }

    // ── JUGADORES ──
    for (const pl of sim.players) drawPlayerTiny(ctx, tm, pl);

    // ── BALÓN: más grande, con flecha direccional y trayectoria visible ──
    drawBall(ctx, tm, sim.ball, true);
    
    // Flecha direccional en el balón mostrando hacia dónde va
    if (sim.ball.ownerId == null && (Math.abs(sim.ball.vx) > 5 || Math.abs(sim.ball.vy) > 5)) {
      const ballP = mMap(tm, sim.ball.x, sim.ball.y);
      const angle = Math.atan2(sim.ball.vy, sim.ball.vx);
      const arrowLen = 12;
      
      ctx.save();
      ctx.translate(ballP.x, ballP.y);
      ctx.rotate(angle);
      
      // Flecha
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(arrowLen, 0);
      ctx.moveTo(arrowLen, 0);
      ctx.lineTo(arrowLen - 4, -3);
      ctx.moveTo(arrowLen, 0);
      ctx.lineTo(arrowLen - 4, 3);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Si el balón va hacia un receptor, dibujar línea de trayectoria
    if (sim.ball.targetOwnerId != null && sim.ball.ownerId == null) {
      const receiver = sim.players.find(p => p.id === sim.ball.targetOwnerId);
      if (receiver) {
        const ballP = mMap(tm, sim.ball.x, sim.ball.y);
        const recvP = mMap(tm, receiver.x, receiver.y);
        
        // Línea punteada del balón al receptor
        ctx.strokeStyle = 'rgba(255,209,102,0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(ballP.x, ballP.y);
        ctx.lineTo(recvP.x, recvP.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Marcador en el receptor con etiqueta
        ctx.fillStyle = 'rgba(255,209,102,0.5)';
        ctx.beginPath();
        ctx.arc(recvP.x, recvP.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Etiqueta "RECEPTOR"
        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 8px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('RECEPTOR', recvP.x, recvP.y - 12);
      }
    }

    // ── RECUADRO DEL ENCUADRE ──
    const a = mMap(tm, cam.x - FRAME_W / 2, cam.y - FRAME_H / 2);
    const b = mMap(tm, cam.x + FRAME_W / 2, cam.y + FRAME_H / 2);
    ctx.fillStyle = topInside ? 'rgba(61,220,151,0.12)' : 'rgba(255,77,109,0.10)';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = topInside ? '#3ddc97' : '#ff4d6d';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 4]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.setLineDash([]);
    
    // Esquinas del encuadre
    ctx.lineWidth = 3;
    const cl = 9;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => {
      const cx = sx > 0 ? b.x : a.x, cy = sy > 0 ? b.y : a.y;
      ctx.beginPath();
      ctx.moveTo(cx, cy - sy * cl);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - sx * cl, cy);
      ctx.stroke();
    });

    // ── MARCADORES DE EVENTOS IMPORTANTES FUERA DE ENCUADRE ──
    for (const tgt of targets) {
      if (tgt.importance < 2.0 || inFrame(tgt, cam, 0)) continue;
      const sp = mMap(tm, tgt.x, tgt.y);
      const pulse = 1 + Math.sin(now * 0.01) * 0.3;
      
      // Anillo pulsante grande
      ctx.strokeStyle = tgt.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      
      // Punto central con icono
      ctx.fillStyle = tgt.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Etiqueta de texto clara
      ctx.fillStyle = tgt.color;
      ctx.font = 'bold 9px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ENFOCAR', sp.x, sp.y + 18);
    }
    ctx.restore();

    // ── ARRIBA: zoom cercano / señal al aire ──
    const bp = layout.broadcast;
    drawPanelChrome(ctx, bp, slowMoActive ? '◀◀ REPETICIÓN · ZOOM' : '● ZOOM CERCANO · SEÑAL AL AIRE', topInside ? '#3ddc97' : '#ff4d6d', topInside);
    ctx.save();
    ctx.beginPath(); ctx.rect(bp.inner.x, bp.inner.y, bp.inner.w, bp.inner.h); ctx.clip();
    const bm = fitWindow(bp.inner, cam);
    drawStands(ctx, bm, now);
    drawField(ctx, bm, now);
    // Recordatorio de estadio: barras de grada/banquillo en los BORDES de la pantalla central
    // aunque la cámara esté en el centro del campo. Se dibujan como franjas
    // pixeladas fuera del césped visible, dando la sensación de estar dentro del recinto.
    const bnd = frameBounds(cam);
    if (bnd.minY > 2) {
      const gap = mMap(bm, 0, 0).y - bp.inner.y;
      if (gap > 4) {
        // Franja superior: fila de asientos animados
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fillRect(bp.inner.x, bp.inner.y, bp.inner.w, Math.min(gap, 22));
        const cellSize = 4;
        for (let sx = bp.inner.x; sx < bp.inner.x + bp.inner.w; sx += cellSize) {
          const bob = Math.sin(now * 0.006 + sx * 0.3) > 0.5 ? -1 : 0;
          const cIdx = (Math.floor(sx / cellSize) % 5);
          ctx.fillStyle = cIdx === 0 ? '#e7c85a' : cIdx === 1 ? '#d75a5a' : cIdx === 2 ? '#5aa9e7' : cIdx === 3 ? '#3ddc97' : '#c9d3da';
          ctx.fillRect(sx, bp.inner.y + 3 + bob, cellSize - 1, cellSize - 1);
        }
      }
    }
    if (bnd.maxY < 98) {
      const bottomFieldY = mMap(bm, 0, 100).y;
      const gap = (bp.inner.y + bp.inner.h) - bottomFieldY;
      if (gap > 4) {
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fillRect(bp.inner.x, bp.inner.y + bp.inner.h - Math.min(gap, 22), bp.inner.w, Math.min(gap, 22));
        const cellSize = 4;
        for (let sx = bp.inner.x; sx < bp.inner.x + bp.inner.w; sx += cellSize) {
          const bob = Math.sin(now * 0.006 + sx * 0.3 + 1.5) > 0.5 ? -1 : 0;
          const cIdx = (Math.floor(sx / cellSize) % 5);
          ctx.fillStyle = cIdx === 0 ? '#c9d3da' : cIdx === 1 ? '#e7c85a' : cIdx === 2 ? '#d75a5a' : cIdx === 3 ? '#5aa9e7' : '#3ddc97';
          ctx.fillRect(sx, bp.inner.y + bp.inner.h - 6 + bob, cellSize - 1, cellSize - 1);
        }
      }
    }
    // Laterales: pista de tartán + grada lateral animada si asoma
    if (bnd.minX > 2) {
      const gapL = mMap(bm, 0, 0).x - bp.inner.x;
      if (gapL > 4) {
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fillRect(bp.inner.x, bp.inner.y, Math.min(gapL, 22), bp.inner.h);
        const cs = 4;
        for (let sy = bp.inner.y; sy < bp.inner.y + bp.inner.h; sy += cs) {
          const bob = Math.sin(now * 0.006 + sy * 0.3) > 0.5 ? -1 : 0;
          const cIdx = (Math.floor(sy / cs) % 5);
          ctx.fillStyle = cIdx === 0 ? '#d75a5a' : cIdx === 1 ? '#e7c85a' : cIdx === 2 ? '#5aa9e7' : cIdx === 3 ? '#3ddc97' : '#c9d3da';
          ctx.fillRect(bp.inner.x + 3 + bob, sy, cs - 1, cs - 1);
        }
      }
    }
    if (bnd.maxX < 98) {
      const rightFieldX = mMap(bm, 100, 0).x;
      const gapR = (bp.inner.x + bp.inner.w) - rightFieldX;
      if (gapR > 4) {
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fillRect(bp.inner.x + bp.inner.w - Math.min(gapR, 22), bp.inner.y, Math.min(gapR, 22), bp.inner.h);
        const cs = 4;
        for (let sy = bp.inner.y; sy < bp.inner.y + bp.inner.h; sy += cs) {
          const bob = Math.sin(now * 0.006 + sy * 0.3 + 2) > 0.5 ? -1 : 0;
          const cIdx = (Math.floor(sy / cs) % 5);
          ctx.fillStyle = cIdx === 0 ? '#5aa9e7' : cIdx === 1 ? '#e7c85a' : cIdx === 2 ? '#d75a5a' : cIdx === 3 ? '#3ddc97' : '#c9d3da';
          ctx.fillRect(bp.inner.x + bp.inner.w - 6 + bob, sy, cs - 1, cs - 1);
        }
      }
    }
    const drawables: Array<{ y: number; fn: () => void }> = [];
    for (const pl of sim.players) {
      const moving = Math.hypot(pl.x - pl.targetX, pl.y - pl.targetY) > 0.4 || pl.hasBall;
      // Detección de festejo de gol por equipo
      const isCelebrate = sim.phase === 'goal';
      const celebrating = isCelebrate && pl.team !== sim.pendingKickoffTeam;
      const sad = isCelebrate && pl.team === sim.pendingKickoffTeam;
      
      drawables.push({
        y: pl.y,
        fn: () => drawPlayerBig(ctx, bm, {
          x: pl.x, y: pl.y, team: pl.team, number: pl.number,
          hasBall: pl.hasBall, moving, phase: now * 0.025 + pl.id,
          role: pl.role, celebrating, sad
        })
      });
    }
    for (const inc of incidentsRef.current) drawables.push({ y: inc.y, fn: () => drawIncidentBig(ctx, bm, inc, now) });
    drawables.sort((p, q2) => p.y - q2.y);
    for (const d of drawables) d.fn();
    drawBall(ctx, bm, sim.ball, true);
    // retículo sobre objetivo centrado
    if (top && topInside) {
      const sp = mMap(bm, top.x, top.y);
      const rr = 16 + Math.sin(now * 0.012) * 3;
      const col = q > 0.72 ? '#ffd166' : q > 0.4 ? '#3ddc97' : '#8fa6bd';
      ctx.strokeStyle = col; ctx.lineWidth = 2 + q * 2;
      ctx.strokeRect(sp.x - rr, sp.y - rr * 1.3, rr * 2, rr * 2.4);
      ctx.fillStyle = col; ctx.font = 'bold 11px "Roboto Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(top.label.toUpperCase(), sp.x, sp.y - rr * 1.3 - 5);
      // barra de encuadre
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bp.inner.x + 6, bp.inner.y + bp.inner.h - 16, 92, 10);
      ctx.fillStyle = col; ctx.fillRect(bp.inner.x + 8, bp.inner.y + bp.inner.h - 14, 88 * q, 6);
      // aviso TOMA
      if (replayReadyRef.current && slowMoCharges > 0 && !slowMoActive && Math.sin(now * 0.014) > -0.2) {
        ctx.fillStyle = '#ffd166'; ctx.font = 'bold 12px "Orbitron", sans-serif';
        ctx.fillText('¡TOMA!  [ESPACIO]', sp.x, sp.y + rr * 1.4 + 16);
      }
    }
    // borde del recorte real: lo que de verdad sale al aire
    const ca = mMap(bm, cam.x - FRAME_W / 2, cam.y - FRAME_H / 2);
    const cb = mMap(bm, cam.x + FRAME_W / 2, cam.y + FRAME_H / 2);
    ctx.strokeStyle = topInside ? 'rgba(61,220,151,0.9)' : 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 2; ctx.setLineDash([9, 6]);
    ctx.strokeRect(ca.x, ca.y, cb.x - ca.x, cb.y - ca.y);
    ctx.setLineDash([]);
    ctx.fillStyle = topInside ? 'rgba(61,220,151,0.9)' : 'rgba(255,209,102,0.9)';
    ctx.font = 'bold 9px "Roboto Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('SALIDA AL AIRE', ca.x + 3, Math.max(bp.inner.y + 2, ca.y - 12));

    // feed reciente
    if (recentCaptures.length) {
      ctx.font = 'bold 10px "Roboto Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      recentCaptures.slice(0, 3).forEach((c, i) => {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bp.inner.x + 6, bp.inner.y + 6 + i * 16, 96, 13);
        ctx.fillStyle = '#3ddc97'; ctx.fillText(`${c.type} +${c.points}`, bp.inner.x + 9, bp.inner.y + 8 + i * 16);
      });
    }
    // popups
    const alive: Popup[] = [];
    for (const pop of popupsRef.current) {
      const age = now - pop.born; if (age > pop.life) continue; alive.push(pop);
      const tt = age / pop.life;
      const sp = mMap(bm, pop.x, pop.y);
      const rise = tt * (pop.big ? 50 : 32);
      const alpha = tt < 0.15 ? tt / 0.15 : 1 - Math.max(0, (tt - 0.6) / 0.4);
      const sc = pop.big ? 1 + (1 - Math.min(1, tt * 5)) * 0.5 : 1;
      ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1); ctx.translate(sp.x, sp.y - 24 - rise); ctx.scale(sc, sc);
      ctx.font = `900 ${pop.big ? 18 : 13}px "Orbitron", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color; ctx.fillText(pop.text, 0, 0); ctx.restore();
    }
    popupsRef.current = alive;
    ctx.restore();

    // ── ABAJO: minimapa + joystick ──
    const mm = layout.minimap;
    drawPanelChrome(ctx, mm, 'MINIMAPA · JOYSTICK ARRIBA', '#ffd166');
    ctx.save();
    ctx.beginPath();
    ctx.rect(mm.inner.x, mm.inner.y, mm.inner.w, mm.inner.h);
    ctx.clip();
    const mmm = fitField(mm.inner);
    
    // Fondo del minimapa (césped + gradas)
    drawField(ctx, mmm, now);
    
    // Eventos con iconos claros
    for (const inc of incidentsRef.current) {
      const s = mMap(mmm, inc.x, inc.y);
      const pulse = 1 + Math.sin(now * 0.008 + inc.x * 0.1) * 0.2;
      
      // Halo
      ctx.fillStyle = inc.color + '40';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      
      // Icono
      ctx.fillStyle = inc.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    
    // Jugadores
    for (const pl of sim.players) {
      const s = mMap(mmm, pl.x, pl.y);
      ctx.fillStyle = teamColor(pl.team, pl.role === 'GK');
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Trayectoria del pase si va a un receptor
    if (sim.ball.targetOwnerId != null && sim.ball.ownerId == null) {
      const receiver = sim.players.find(p => p.id === sim.ball.targetOwnerId);
      if (receiver) {
        const ballP = mMap(mmm, sim.ball.x, sim.ball.y);
        const recvP = mMap(mmm, receiver.x, receiver.y);
        
        // Línea punteada
        ctx.strokeStyle = 'rgba(255,209,102,0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(ballP.x, ballP.y);
        ctx.lineTo(recvP.x, recvP.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Marcador en receptor
        ctx.fillStyle = 'rgba(255,209,102,0.5)';
        ctx.beginPath();
        ctx.arc(recvP.x, recvP.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Balón más grande y con flecha direccional
    const bs = mMap(mmm, sim.ball.x, sim.ball.y);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bs.x, bs.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    // Flecha direccional en el balón
    if (sim.ball.ownerId == null && (Math.abs(sim.ball.vx) > 5 || Math.abs(sim.ball.vy) > 5)) {
      const angle = Math.atan2(sim.ball.vy, sim.ball.vx);
      const arrowLen = 8;
      
      ctx.save();
      ctx.translate(bs.x, bs.y);
      ctx.rotate(angle);
      
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(arrowLen, 0);
      ctx.moveTo(arrowLen, 0);
      ctx.lineTo(arrowLen - 3, -2);
      ctx.moveTo(arrowLen, 0);
      ctx.lineTo(arrowLen - 3, 2);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Encuadre
    const ma = mMap(mmm, cam.x - FRAME_W / 2, cam.y - FRAME_H / 2);
    const mb = mMap(mmm, cam.x + FRAME_W / 2, cam.y + FRAME_H / 2);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(ma.x, ma.y, mb.x - ma.x, mb.y - ma.y);
    
    ctx.restore();
    
    // ── JOYSTICK VISUAL (siempre visible) ──
    {
      const joy = joystickRef.current;
      const held = minimapTouchRef.current.active;
      const mi = layout.minimap.inner;
      const cx = mi.x + mi.w / 2;
      const cy = mi.y + mi.h / 2;
      const radius = Math.min(mi.w, mi.h) * 0.35;
      const kx = held ? joy.x : cx;
      const ky = held ? joy.y : cy;

      // Base
      ctx.fillStyle = held ? 'rgba(4,10,18,0.72)' : 'rgba(4,10,18,0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = held ? 'rgba(255,209,102,0.85)' : 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cruceta guía
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.7, cy); ctx.lineTo(cx + radius * 0.7, cy);
      ctx.moveTo(cx, cy - radius * 0.7); ctx.lineTo(cx, cy + radius * 0.7);
      ctx.stroke();

      // Palanca
      ctx.strokeStyle = held ? 'rgba(255,209,102,0.6)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.fillStyle = held ? '#ffd166' : 'rgba(214,226,240,0.75)';
      ctx.beginPath();
      ctx.arc(kx, ky, radius * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#04070d';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = held ? '#ffd166' : 'rgba(147,163,184,0.9)';
      ctx.font = 'bold 8px "Roboto Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('JOYSTICK', cx, cy + radius + 9);
    }

    ctx.restore();

    // Rótulo enorme de GOL
    const banner = goalBannerRef.current;
    if (banner && now < banner.until) {
      const bh = 62;
      const by = bp.inner.y + bp.inner.h / 2 - bh / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(4,8,16,0.88)';
      ctx.fillRect(bp.inner.x, by, bp.inner.w, bh);
      ctx.fillStyle = Math.sin(now * 0.02) > 0 ? '#ffd166' : '#ff4d6d';
      ctx.fillRect(bp.inner.x, by, bp.inner.w, 4);
      ctx.fillRect(bp.inner.x, by + bh - 4, bp.inner.w, 4);
      ctx.font = `900 ${Math.min(40, bp.inner.w * 0.10)}px "Orbitron", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#04070d';
      const tx = bp.inner.x + bp.inner.w / 2;
      const ty = by + bh / 2;
      ctx.strokeText(banner.text, tx, ty);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(banner.text, tx, ty);
      ctx.restore();
    }

    // Aviso grande cuando hay algo urgente que grabar
    const urgent = targets.find(tg => tg.importance >= 2.2 && !tg.caught);
    if (urgent) {
      const insideU = inFrame(urgent, cam, 0);
      const pulse = 0.55 + Math.sin(now * 0.018) * 0.45;
      ctx.save();
      ctx.fillStyle = insideU ? `rgba(61,220,151,${0.18 + pulse * 0.12})` : `rgba(255,77,109,${0.22 + pulse * 0.2})`;
      ctx.fillRect(8, 48, W - 16, 28);
      ctx.fillStyle = insideU ? '#3ddc97' : '#ffd166';
      ctx.font = '900 15px "Orbitron", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const prefix = insideU ? 'GRABANDO' : '¡ENFOCA!';
      ctx.fillText(`${prefix}  ·  ${urgent.label.toUpperCase()}`, W / 2, 62);
      ctx.restore();
    }

    // overlays globales
    if (slowMoActive) { ctx.fillStyle = 'rgba(34,211,238,0.07)'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    if (now < flashRef.current.until) {
      const k = (flashRef.current.until - now) / 220;
      ctx.fillStyle = flashRef.current.color; ctx.globalAlpha = clamp(k * 0.32, 0, 0.32); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
  }, [getTargets, recentCaptures, shake, slowMoActive, slowMoCharges]);

  // ── Bucle principal ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(container.clientWidth * dpr);
      canvas.height = Math.floor(container.clientHeight * dpr);
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const rawDt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.06);
      lastFrameTimeRef.current = now;
      const dt = rawDt * (slowMoActive ? 0.38 : 1);
      const sim = matchRef.current;
      if (!sim) return;
      const level = LEVELS[currentLevel];
      const remaining = clamp(level.duration - (now - startTimeRef.current) / 1000, 0, level.duration);
      if (remaining <= 0) { finishGame(); return; }
      if (slowMoActive && now > slowMoEndRef.current) setSlowMoActive(false);
      if (now > nextChargeAtRef.current) { nextChargeAtRef.current = now + 11000; setSlowMoCharges(prev => (prev < 4 ? prev + 1 : prev)); }
      
      // Aplicar movimiento del joystick (respeta los límites de las gradas)
      if (joystickRef.current.active) {
        const cam = cameraRef.current;
        const speed = 58 * rawDt;
        const moved = clampCamera({
          x: cam.x + joystickRef.current.dx * speed,
          y: cam.y + joystickRef.current.dy * speed,
        });
        cam.x = moved.x;
        cam.y = moved.y;
      }
      
      moveCamera(rawDt);
      const tuning: MatchTuning = { pace: level.pace, incidentKinds: level.incidentKinds, incidentGap: level.incidentGap };
      const events = updateMatchSim(sim, incidentsRef.current, momentsRef.current, dt, now, tuning);
      for (const e of events) {
        if (e.type === 'goal') {
          setScoreLine(`${sim.homeGoals} - ${sim.awayGoals}`);
          setShake(1);
          window.setTimeout(() => setShake(0), 180);
          // Red que se ilumina + rótulo de GOL
          goalFlashRef.current = { until: now + 2600, side: e.team === 'home' ? 'right' : 'left' };
          goalBannerRef.current = { until: now + 2600, text: e.team === 'home' ? '¡GOL DEL ROJO!' : '¡GOL DEL AZUL!' };
          flashRef.current = { until: now + 260, color: '#ffd166' };
        }
      }
      processBroadcastScore(rawDt, now);
      renderFrame(ctx, container.clientWidth, container.clientHeight, now);
      if (now - lastTimeHudRef.current > 150) { setTimeRemaining(remaining); lastTimeHudRef.current = now; }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener('resize', resize); };
  }, [currentLevel, finishGame, moveCamera, phase, processBroadcastScore, renderFrame, slowMoActive]);

  // ── Teclado ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && (phase === 'gameover' || phase === 'paused')) { startGame(currentLevel); return; }
      if (phase !== 'playing') return;
      if (e.repeat && (e.code === 'Space' || e.code === 'Escape')) return;
      keysRef.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') { keysRef.current.delete('Space'); triggerReplay(); }
      if (e.code === 'Escape') { keysRef.current.delete('Escape'); togglePause(); }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [currentLevel, phase, startGame, togglePause, triggerReplay]);

  // ── Puntero: arrastrar encuadre o saltar por el mapa ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const container = containerRef.current;
    if (!container) return;
    const toLocal = (cx: number, cy: number) => { const b = container.getBoundingClientRect(); return { x: cx - b.left, y: cy - b.top }; };
    const regionAt = (lx: number, ly: number): 'minimap' | 'tactical' | null => {
      const L = layoutRef.current; if (!L) return null;
      const inR = (r: Panel) => lx >= r.inner.x && lx <= r.inner.x + r.inner.w && ly >= r.inner.y && ly <= r.inner.y + r.inner.h;
      if (inR(L.minimap)) return 'minimap';
      if (inR(L.tactical)) return 'tactical';
      return null;
    };
    const tacticalToWorld = (lx: number, ly: number) => {
      const L = layoutRef.current; if (!L) return null;
      const m = fitField(L.tactical.inner);
      return { x: (lx - m.ox) / m.ppuX, y: (ly - m.oy) / m.ppuY };
    };
    const minimapToJoystick = (lx: number, ly: number) => {
      const L = layoutRef.current; if (!L) return null;
      const mm = L.minimap.inner;
      const cx = mm.x + mm.w / 2;
      const cy = mm.y + mm.h / 2;
      const radius = Math.min(mm.w, mm.h) * 0.35;
      const dx = lx - cx;
      const dy = ly - cy;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, radius);
      const angle = Math.atan2(dy, dx);
      // Zona muerta para evitar deriva y respuesta normalizada 0..1
      const dead = radius * 0.16;
      const power = dist <= dead ? 0 : clamp((dist - dead) / (radius - dead), 0, 1);
      return {
        x: cx + Math.cos(angle) * clamped,
        y: cy + Math.sin(angle) * clamped,
        dx: dist > 0 ? (dx / dist) * power : 0,
        dy: dist > 0 ? (dy / dist) * power : 0,
        active: power > 0,
      };
    };
    const releaseJoystick = () => {
      minimapTouchRef.current.active = false;
      joystickRef.current = { x: 0, y: 0, dx: 0, dy: 0, active: false };
    };

    const onDown = (e: PointerEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.('button')) return;
      const p = toLocal(e.clientX, e.clientY);
      const mode = regionAt(p.x, p.y);
      if (!mode) return;

      // Cada dedo/ratón se registra por su propio id: no se pisan entre sí
      pointersRef.current.set(e.pointerId, mode);

      if (mode === 'tactical') {
        const w = tacticalToWorld(p.x, p.y);
        if (w) {
          const c = clampCamera({ x: w.x, y: w.y });
          followRef.current = { tx: c.x, ty: c.y, active: true };
        }
      } else {
        const joy = minimapToJoystick(p.x, p.y);
        if (joy) {
          joystickRef.current = joy;
          minimapTouchRef.current.active = true;
          // El joystick manda: cancela cualquier viaje automático pendiente
          followRef.current.active = false;
        }
      }

      try { container.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };

    const onMove = (e: PointerEvent) => {
      const mode = pointersRef.current.get(e.pointerId);
      if (!mode) return;
      const p = toLocal(e.clientX, e.clientY);

      if (mode === 'tactical') {
        const w = tacticalToWorld(p.x, p.y);
        if (w) {
          const c = clampCamera({ x: w.x, y: w.y });
          followRef.current = { tx: c.x, ty: c.y, active: true };
        }
      } else {
        const joy = minimapToJoystick(p.x, p.y);
        if (joy) {
          joystickRef.current = joy;
          minimapTouchRef.current.active = true;
          followRef.current.active = false;
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      const mode = pointersRef.current.get(e.pointerId);
      if (!mode) return;
      pointersRef.current.delete(e.pointerId);
      // Solo se suelta el joystick si ya no queda ningún dedo sobre él
      if (mode === 'minimap') {
        const stillHeld = Array.from(pointersRef.current.values()).includes('minimap');
        if (!stillHeld) releaseJoystick();
      }
      try { container.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };

    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', releaseJoystick);
    return () => {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', releaseJoystick);
      pointersRef.current.clear();
      releaseJoystick();
    };
  }, [phase]);

  return (
    <div className="app">
      <div ref={containerRef} className={`game-container ${shake ? 'shaking' : ''}`}>
        {phase === 'menu' && (
          <StartScreen highScores={highScores} unlockedLevel={unlockedLevel} onStart={startGame} onShowHowToPlay={() => setShowHowToPlay(true)} selfTest={selfTest} />
        )}
        {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
        {(phase === 'playing' || phase === 'paused') && (
          <>
            <canvas ref={canvasRef} className="game-canvas" />
            <GameHUD
              audience={audience} score={score} combo={combo} timeRemaining={timeRemaining}
              level={LEVELS[currentLevel]} slowMoCharges={slowMoCharges} onPause={togglePause} onSlowMo={triggerReplay}
              slowMoActive={slowMoActive} trackingFeedback={trackingFeedback} scoreLine={scoreLine}
              directorCue={directorCue} framing={framing} replayReady={replayReady}
            />
          </>
        )}
        {phase === 'paused' && <PauseModal onResume={() => setPhase('playing')} onRestart={() => startGame(currentLevel)} onQuit={() => setPhase('menu')} />}
        {phase === 'gameover' && (
          <GameOverScreen score={score} level={LEVELS[currentLevel]} highScores={highScores}
            isNewHighScore={highScores.length === 0 || score >= (highScores[0]?.score || 0)}
            cup={cupResult}
            onRestart={() => startGame(currentLevel)} onMenu={() => setPhase('menu')}
            onNextLevel={() => currentLevel < LEVELS.length - 1 && startGame(currentLevel + 1)}
            hasNextLevel={currentLevel < LEVELS.length - 1 && cupResult !== 'failed'} />
        )}
      </div>
    </div>
  );
}

export default App;

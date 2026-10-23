import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { StartScreen } from './components/StartScreen';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { GameOverScreen } from './components/GameOverScreen';
import { HowToPlay } from './components/HowToPlay';
import { CaptureLog, GameMode, GamePhase, HighScore, PlayerProfile, RunRewards, RunStats, UpgradeKey } from './types';
import { ALL_LEVELS, CUP_ROUND_RULES, CUP_ROUNDS, DIFFICULTY_PRESETS, LEVELS, MAX_COMBO, scoreMultiplierForMode } from './levels';
import { applyRunToProfile, loadProfile, purchaseUpgrade, UPGRADE_EFFECTS } from './progression';
import { hapticImpact, hapticSuccess, requestFullscreen, setHapticsEnabled } from './utils/mobile';
import { initialReplayCharges, offAirAudienceLoss, offAirCombo, offAirScoreLoss, resolveAudienceCollapse, trackingAudience, trackingCombo, trackingScore } from './utils/balance';
import { CameraState, FieldMap, TRACK, clampCamera, frameBounds, framingQuality, inFrame, fitField, fitWindow, mMap } from './utils/camera';
import { drawBall, drawIncidentBig, drawPlayerBig } from './utils/broadcastRenderer';
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
import { playCrowdBoo, playGameSound, setGameAudioEnabled, stopCrowdAudio, unlockGameAudio } from './utils/gameAudio';
import { createCrowdReaction, updateCrowdReaction } from './utils/crowd';
import { drawCrowdStrip, drawStadium } from './utils/stadiumRenderer';
import './App.css';

const STORAGE_KEY = 'camsoccer_highscores';
const UNLOCK_KEY = 'camsoccer_unlocked';
const readStorage = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };


const EMPTY_RUN_STATS: RunStats = { captures: 0, golden: 0, replays: 0, bestCombo: 1 };
const EMPTY_REWARDS: RunRewards = { xp: 0, credits: 0 };

interface Rect { x: number; y: number; w: number; h: number; }
interface Panel { x: number; y: number; w: number; h: number; inner: Rect; }
interface Layout { tactical: Panel; broadcast: Panel; minimap: Panel; }
type PointerMode = 'tactical' | 'minimap';

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



const needsCaptureLock = (target: InterestTarget) => target.kind !== 'ball' && target.kind !== 'pass';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
// Equipación: los PORTEROS visten distinto (amarillo local / verde visitante)
const teamColor = (t: 'home' | 'away', gk = false) =>
  gk ? (t === 'home' ? '#ffd93d' : '#2fd47a') : (t === 'home' ? '#e5484d' : '#2f6bed');
const teamTrim = (t: 'home' | 'away', gk = false) =>
  gk ? (t === 'home' ? '#6b4e00' : '#0b3d24') : (t === 'home' ? '#ffe3e3' : '#ffe08a');

function computeLayout(W: number, H: number): Layout {
  const titleH = 16;
  const gap = 6;
  const pad = 6;
  const panel = (x: number, y: number, w: number, h: number): Panel => ({
    x, y, w, h,
    inner: { x: x + pad, y: y + titleH, w: Math.max(10, w - pad * 2), h: Math.max(10, h - titleH - pad) },
  });

  // En un móvil apaisado la señal ocupa la izquierda y los controles la
  // derecha. Así el joystick nunca se reduce a una tira insignificante.
  if (W > 620 && H < 600) {
    const topPad = 88;
    const avail = Math.max(150, H - topPad - 7);
    const leftW = Math.floor(W * 0.56);
    const rightX = leftW + 4;
    const rightW = W - rightX - 7;
    const mapH = Math.round(avail * 0.61);
    return {
      broadcast: panel(7, topPad, leftW - 12, avail),
      tactical: panel(rightX, topPad, rightW, mapH),
      minimap: panel(rightX, topPad + mapH + gap, rightW, avail - mapH - gap),
    };
  }

  if (W > 1100) {
    // ARRIBA señal al aire · MEDIO mapa general · ABAJO control de precisión
    const topPad = 108;
    const botPad = 8;
    const avail = H - topPad - botPad;
    const zoomH = Math.round(avail * 0.44);
    const mapH = Math.round(avail * 0.39);
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
  const topPad = 108;
  const avail = H - topPad - 6;
  const zoomH = Math.round(avail * 0.40);
  const mapH = Math.round(avail * 0.38);
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
  const [soundEnabled, setSoundEnabled] = useState(() => readStorage('camsoccer_sound') !== 'off');
  const [hapticsEnabledState, setHapticsEnabledState] = useState(() => readStorage('camsoccer_haptics') !== 'off');
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [gameMode, setGameMode] = useState<GameMode>('career');
  const [cupRound, setCupRound] = useState(0);
  const [cupTotal, setCupTotal] = useState(0);
  const [cupChampion, setCupChampion] = useState(false);
  const [runStats, setRunStats] = useState<RunStats>(EMPTY_RUN_STATS);
  const [runRewards, setRunRewards] = useState<RunRewards>(EMPTY_REWARDS);
  const [newHighScore, setNewHighScore] = useState(false);
  const [zoom, setZoom] = useState(1);
  const maxSlowMoCharges = 3 + profile.upgrades.replay * UPGRADE_EFFECTS.replayCapacity;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  // Multi-touch real: mapa y joystick pueden usarse a la vez sin pisarse.
  // La señal superior es solo el monitor de programa: nunca recibe controles.
  const pointersRef = useRef<Map<number, PointerMode>>(new Map());
  const matchRef = useRef<MatchSim | null>(null);
  const momentsRef = useRef<EngineMoment[]>([]);
  const incidentsRef = useRef<EngineIncident[]>([]);
  const cameraRef = useRef<CameraState>({ x: 50, y: 50, zoom: 1 });
  const layoutRef = useRef<Layout | null>(null);
  const followRef = useRef<{ tx: number; ty: number; active: boolean }>({ tx: 50, ty: 50, active: false });
  const popupsRef = useRef<Popup[]>([]);
  const framingRef = useRef(0);
  const flashRef = useRef<{ until: number; color: string }>({ until: 0, color: '#fff' });
  const goalFlashRef = useRef<{ until: number; side: 'left' | 'right' } | null>(null);
  const goalBannerRef = useRef<{ until: number; text: string } | null>(null);
  const streakRef = useRef(0);
  const replayReadyRef = useRef(false);
  const captureLockRef = useRef<{ targetId: string | null; progress: number }>({ targetId: null, progress: 0 });
  const replayedTargetsRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const audienceRef = useRef(70);
  const crowdReactionRef = useRef(createCrowdReaction(70));
  const audienceRescuesRef = useRef(0);
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
  // Posición visual suavizada: el motor puede cambiar de pose, pero la pelota nunca salta en pantalla.
  const visualBallRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const visualBallTimeRef = useRef(0);
  const playerMotionRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());
  const visualPlayersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const minimapTouchRef = useRef<{ active: boolean }>({ active: false });
  const profileRef = useRef<PlayerProfile>(profile);
  const runStatsRef = useRef<RunStats>({ ...EMPTY_RUN_STATS });
  const highScoresRef = useRef<HighScore[]>([]);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    profileRef.current = profile;
    try { localStorage.setItem('camsoccer_profile_v1', JSON.stringify(profile)); } catch { /* Private mode can disable storage. */ }
  }, [profile]);

  useEffect(() => {
    setGameAudioEnabled(soundEnabled);
    try { localStorage.setItem('camsoccer_sound', soundEnabled ? 'on' : 'off'); } catch { /* noop */ }
  }, [soundEnabled]);

  useEffect(() => {
    if (phase !== 'playing') stopCrowdAudio();
    return () => stopCrowdAudio();
  }, [phase]);

  useEffect(() => {
    setHapticsEnabled(hapticsEnabledState);
    try { localStorage.setItem('camsoccer_haptics', hapticsEnabledState ? 'on' : 'off'); } catch { /* noop */ }
  }, [hapticsEnabledState]);

  useEffect(() => { highScoresRef.current = highScores; }, [highScores]);

  useEffect(() => {
    const id = window.setTimeout(() => { try { setSelfTest(runMatchSelfTest(120)); } catch { setSelfTest(null); } }, 500);
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

  const saveHighScore = useCallback((finalScore: number, levelName: string, mode: GameMode) => {
    const entry: HighScore = { score: finalScore, level: levelName, date: new Date().toLocaleDateString('es-ES'), mode };
    setHighScores(prev => {
      const next = [entry, ...prev].sort((a, b) => b.score - a.score).slice(0, 10);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Keep the in-memory record if storage is unavailable. */ }
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
    const level = ALL_LEVELS[currentLevel];
    const cup = finalScore >= level.cups.gold ? 'gold'
      : finalScore >= level.cups.silver ? 'silver'
      : finalScore >= level.cups.bronze ? 'bronze'
      : 'failed';
    const champion = gameMode === 'cup' && cupRound === CUP_ROUNDS.length - 1 && cup !== 'failed';
    const finalStats = { ...runStatsRef.current, bestCombo: Math.max(runStatsRef.current.bestCombo, comboRef.current) };
    const medalLevelId = gameMode === 'cup' ? `cup:${level.id}` : level.id;
    const result = applyRunToProfile(profileRef.current, medalLevelId, finalScore, cup, gameMode, finalStats, champion);
    profileRef.current = result.profile;
    setProfile(result.profile);
    setRunStats(finalStats);
    setRunRewards(result.rewards);
    setCupResult(cup);
    setCupChampion(champion);
    const recordScore = champion ? cupTotal + finalScore : finalScore;
    setNewHighScore(recordScore > 0 && recordScore > (highScoresRef.current[0]?.score ?? 0));
    if (recordScore > 0) saveHighScore(recordScore, champion ? 'Copa Broadcast' : level.name, gameMode);
    if (cup !== 'failed' && gameMode === 'career' && currentLevel < LEVELS.length - 1) {
      setUnlockedLevel(previous => {
        const next = Math.max(previous, currentLevel + 1);
        try { localStorage.setItem(UNLOCK_KEY, String(next)); } catch { /* noop */ }
        return next;
      });
    }
    if (cup !== 'failed') hapticSuccess(); else hapticImpact(true);
    setScore(finalScore);
    setPhase('gameover');
  }, [cupRound, cupTotal, currentLevel, gameMode, saveHighScore]);

  const startGame = useCallback((levelIndex: number, mode: GameMode = gameMode, tournamentRound = cupRound, tournamentTotal = cupTotal) => {
    stopCrowdAudio();
    void unlockGameAudio().then(() => playGameSound('start'));
    hapticImpact();
    const now = performance.now();
    const level = ALL_LEVELS[levelIndex];
    const difficulty = DIFFICULTY_PRESETS[level.difficulty];
    matchRef.current = createMatchSim(now);
    momentsRef.current = [];
    incidentsRef.current = [];
    cameraRef.current = { x: 50, y: 50, zoom: 1 };
    scoreRef.current = 0;
    audienceRef.current = difficulty.startAudience;
    crowdReactionRef.current = createCrowdReaction(difficulty.startAudience);
    audienceRescuesRef.current = mode === 'arcade' ? 0 : difficulty.rescues;
    comboRef.current = 1;
    runStatsRef.current = { ...EMPTY_RUN_STATS };
    endedRef.current = false;
    startTimeRef.current = now;
    lastFrameTimeRef.current = now;
    lastRenderRef.current = 0;
    lastHudUpdateRef.current = 0;
    lastTimeHudRef.current = 0;
    slowMoEndRef.current = 0;
    nextChargeAtRef.current = now + 11000;
    popupsRef.current = [];
    streakRef.current = 0;
    framingRef.current = 0;
    captureLockRef.current = { targetId: null, progress: 0 };
    visualBallRef.current = null;
    visualBallTimeRef.current = 0;
    playerMotionRef.current.clear();
    visualPlayersRef.current.clear();
    replayedTargetsRef.current = new Set();
    flashRef.current = { until: 0, color: '#fff' };
    goalFlashRef.current = null;
    goalBannerRef.current = null;
    followRef.current = { tx: 50, ty: 50, active: false };
    const replayLevel = profileRef.current.upgrades.replay;
    const replayCapacity = 3 + replayLevel * UPGRADE_EFFECTS.replayCapacity;
    setCurrentLevel(levelIndex);
    setGameMode(mode);
    setCupRound(mode === 'cup' ? tournamentRound : 0);
    setCupTotal(mode === 'cup' ? tournamentTotal : 0);
    setCupChampion(false);
    setNewHighScore(false);
    setRunRewards(EMPTY_REWARDS);
    setRunStats({ ...EMPTY_RUN_STATS });
    setZoom(1);
    setTimeRemaining(level.duration);
    setAudience(difficulty.startAudience);
    setScore(0);
    setCombo(1);
    setScoreLine('0 - 0');
    setDirectorCue('Sigue el balón');
    setRecentCaptures([]);
    setSlowMoCharges(Math.min(initialReplayCharges(mode), replayCapacity));
    setSlowMoActive(false);
    setCupResult('failed');
    setFraming(0);
    setReplayReady(false);
    setTrackingFeedback(null);
    setPhase('playing');
  }, [cupRound, cupTotal, gameMode]);

  const buyUpgrade = useCallback((key: UpgradeKey) => {
    const next = purchaseUpgrade(profileRef.current, key);
    if (next === profileRef.current) { hapticImpact(true); return; }
    profileRef.current = next;
    setProfile(next);
    hapticSuccess();
    playGameSound('capture');
  }, []);

  const changeZoom = useCallback((value: number) => {
    const next = clamp(Math.round(value * 100) / 100, 1, 2);
    if (next === cameraRef.current.zoom) return;
    cameraRef.current = clampCamera({ ...cameraRef.current, zoom: next });
    setZoom(next);
    hapticImpact();
  }, []);

  const toggleHaptics = useCallback(() => {
    const next = !hapticsEnabledState;
    setHapticsEnabledState(next);
    setHapticsEnabled(next);
    if (next) hapticSuccess();
  }, [hapticsEnabledState]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setGameAudioEnabled(next);
    if (next) void unlockGameAudio().then(() => playGameSound('capture'));
  }, [soundEnabled]);

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
        sim.forcedGoalAt += d; sim.goalPauseUntil += d;
        if (sim.ball.looseSince != null) sim.ball.looseSince += d;
      }
      momentsRef.current.forEach(m => { m.expiresAt += d; });
      incidentsRef.current.forEach(i => { i.expiresAt += d; i.bornAt += d; });
      popupsRef.current.forEach(popup => { popup.born += d; });
      playerMotionRef.current.forEach(motion => { motion.time += d; });
      if (visualBallTimeRef.current > 0) visualBallTimeRef.current += d;
      if (goalFlashRef.current) goalFlashRef.current.until += d;
      if (goalBannerRef.current) goalBannerRef.current.until += d;
      flashRef.current.until += d;
      startTimeRef.current += d;
      nextChargeAtRef.current += d;
      slowMoEndRef.current = performance.now() + slowMoRemainingRef.current;
      lastFrameTimeRef.current = performance.now();
      setPhase('playing');
    }
  }, [phase]);

  // Salir momentáneamente de la app nunca debe costar una partida en Android.
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden && phase === 'playing') togglePause(); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    window.addEventListener('pagehide', pauseWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.removeEventListener('pagehide', pauseWhenHidden);
    };
  }, [phase, togglePause]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (showHowToPlay) { setShowHowToPlay(false); return; }
      if (phase === 'playing' || phase === 'paused') { togglePause(); return; }
      if (phase === 'gameover') { setPhase('menu'); return; }
      void NativeApp.exitApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [phase, showHowToPlay, togglePause]);

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
    const level = ALL_LEVELS[currentLevel];
    const difficulty = DIFFICULTY_PRESETS[level.difficulty];

    const targets = getTargets(now);
    if (!targets.length) return;

    // La prioridad es una recomendación del director. El jugador puede ignorar
    // una oportunidad especial y mantener el balón en antena sin ser castigado.
    const priority = targets.find(target => target.kind === 'ball' || !target.caught) ?? targets[0];
    const cam = cameraRef.current;
    const target = targets.find(candidate => inFrame(candidate, cam, 1));
    const scoreMultiplier = scoreMultiplierForMode(gameMode, cupRound);
    let q = 0;
    replayReadyRef.current = false;

    if (target) {
      q = clamp(framingQuality(target, cam) + profileRef.current.upgrades.stabilizer * UPGRADE_EFFECTS.stabilizer, 0, 1);
      const golden = q > 0.72;
      const lockable = needsCaptureLock(target);
      const lock = captureLockRef.current;

      if (lockable) {
        if (lock.targetId !== target.id) {
          lock.targetId = target.id;
          lock.progress = target.caught ? 1 : 0;
        }
        if (target.caught) {
          lock.progress = 1;
        } else if (q > 0.28) {
          // Un plano centrado se consolida antes: tocar un icono ya no basta.
          lock.progress = clamp(lock.progress + dt * (0.55 + q * 1.5) * difficulty.capture * (1 + profileRef.current.upgrades.focus * UPGRADE_EFFECTS.focus), 0, 1);
        } else {
          lock.progress = Math.max(0, lock.progress - dt * 0.9);
        }
      } else {
        lock.targetId = target.id;
        lock.progress = 0;
      }

      scoreRef.current += trackingScore(dt, target.importance, comboRef.current, q, scoreMultiplier);
      audienceRef.current = clamp(audienceRef.current + trackingAudience(dt, target.importance, q, difficulty.recovery), 0, 100);
      comboRef.current = trackingCombo(dt, comboRef.current, target.importance, q, difficulty.combo);

      if (lockable && !target.caught && lock.progress >= 1) {
        const bonus = Math.round(target.importance * 150 * scoreMultiplier * (0.6 + q));
        scoreRef.current += bonus;
        runStatsRef.current.captures += 1;
        if (golden) runStatsRef.current.golden += 1;
        hapticImpact(target.importance > 3);
        audienceRef.current = clamp(audienceRef.current + target.importance * 4.5 * (0.5 + q), 0, 100);
        streakRef.current += 1;
        target.caught = true;
        pushCapture(target.kind, bonus);
        if (target.kind !== 'goal') playGameSound('capture');
        // Puntos debajo y rótulo arriba: no se tapan entre sí ni ocultan el evento.
        addPopup(target.x, target.y + 3, `+${bonus}`, golden ? '#ffd166' : '#3ddc97', target.importance > 2.6);
        addPopup(target.x, target.y - 4, golden ? '¡PLANO DE ORO!' : 'PLANO CAPTURADO', golden ? '#ffd166' : '#3ddc97', golden);
        if (streakRef.current > 0 && streakRef.current % 3 === 0) addPopup(target.x, target.y - 8, `RACHA ×${streakRef.current}`, '#22d3ee', true);
        if (target.importance > 3) {
          flashRef.current = { until: now + 160, color: target.color };
          setShake(1);
          window.setTimeout(() => setShake(0), 130);
        }
        momentsRef.current.forEach(moment => { if (moment.id === target.id) moment.caught = true; });
        incidentsRef.current.forEach(incident => { if (incident.id === target.id) incident.caught = true; });
      }

      replayReadyRef.current = Boolean(
        target.caught &&
        target.importance >= 1.8 &&
        q > 0.4 &&
        !replayedTargetsRef.current.has(target.id)
      );
      setTrackingFeedback(target.id === priority.id ? 'good' : null);
    } else {
      const lock = captureLockRef.current;
      lock.progress = Math.max(0, lock.progress - dt * 2.4);
      if (lock.progress === 0) lock.targetId = null;

      // Solo cae la audiencia cuando la señal no contiene ni balón ni evento.
      audienceRef.current = clamp(audienceRef.current - offAirAudienceLoss(dt, priority.importance, difficulty.drain), 0, 100);
      scoreRef.current = Math.max(0, scoreRef.current - offAirScoreLoss(dt, difficulty.drain));
      comboRef.current = offAirCombo(dt, comboRef.current);
      if (streakRef.current > 2) addPopup(cam.x, cam.y, 'RACHA PERDIDA', '#ff4d6d', false);
      streakRef.current = 0;
      setTrackingFeedback('bad');
    }

    runStatsRef.current.bestCombo = Math.max(runStatsRef.current.bestCombo, comboRef.current);
    framingRef.current = q;
    if (now - lastHudUpdateRef.current > 110) {
      setScore(Math.floor(scoreRef.current));
      setAudience(audienceRef.current);
      setCombo(comboRef.current);
      setDirectorCue(priority.kind !== 'ball' && priority.importance >= 1.8
        ? `OPORTUNIDAD · ${priority.label}`
        : priority.label);
      setFraming(q);
      setReplayReady(replayReadyRef.current);
      lastHudUpdateRef.current = now;
    }
    if (audienceRef.current <= 0) {
      const collapse = resolveAudienceCollapse(gameMode, scoreRef.current, audienceRescuesRef.current);
      if (collapse.kind === 'finish') {
        finishGame();
      } else {
        scoreRef.current = Math.max(0, scoreRef.current - collapse.scorePenalty);
        audienceRef.current = collapse.audience;
        audienceRescuesRef.current = collapse.rescues;
        comboRef.current = 1;
        streakRef.current = 0;
        const recoveredText = collapse.kind === 'arcade'
          ? collapse.scorePenalty > 0 ? `SEÑAL RECUPERADA · -${collapse.scorePenalty}` : 'SEÑAL RECUPERADA'
          : 'SEGUNDA OPORTUNIDAD';
        addPopup(cam.x, cam.y, recoveredText, collapse.kind === 'arcade' ? '#ff9f43' : '#3ddc97', true);
        hapticImpact(collapse.kind === 'arcade');
      }
    }
  }, [addPopup, cupRound, currentLevel, finishGame, gameMode, getTargets, pushCapture]);

  // ¡TOMA! corta a repetición: gran bonus si está bien encuadrado, castigo si cortas a destiempo
  const triggerReplay = useCallback(() => {
    if (slowMoCharges <= 0 || slowMoActive) return;
    const now = performance.now();
    setSlowMoCharges(prev => prev - 1);
    setSlowMoActive(true);
    slowMoEndRef.current = now + 2600;
    const cam = cameraRef.current;
    const scoreMultiplier = scoreMultiplierForMode(gameMode, cupRound);
    const target = getTargets(now).find(candidate => inFrame(candidate, cam, 1));
    const q = target ? clamp(framingQuality(target, cam) + profileRef.current.upgrades.stabilizer * UPGRADE_EFFECTS.stabilizer, 0, 1) : 0;
    const validReplay = Boolean(
      target?.caught &&
      target.importance >= 1.8 &&
      q > 0.4 &&
      !replayedTargetsRef.current.has(target.id)
    );

    if (target && validReplay) {
      const perfect = q > 0.75;
      const bonus = Math.round(target.importance * (perfect ? 420 : 240) * scoreMultiplier * (0.7 + q));
      replayedTargetsRef.current.add(target.id);
      replayReadyRef.current = false;
      setReplayReady(false);
      scoreRef.current += bonus;
      audienceRef.current = clamp(audienceRef.current + (perfect ? 12 : 7), 0, 100);
      comboRef.current = clamp(comboRef.current + (perfect ? 0.7 : 0.4), 1, MAX_COMBO);
      streakRef.current += 1;
      flashRef.current = { until: now + 220, color: perfect ? '#ffd166' : '#3ddc97' };
      addPopup(target.x, target.y - 6, perfect ? '¡TOMA PERFECTA!' : '¡BUENA TOMA!', perfect ? '#ffd166' : '#3ddc97', true);
      addPopup(target.x, target.y + 3, `+${bonus}`, perfect ? '#ffd166' : '#3ddc97', true);
      pushCapture(perfect ? 'TOMA PERFECTA' : 'REPETICIÓN', bonus);
      runStatsRef.current.replays += 1;
      runStatsRef.current.bestCombo = Math.max(runStatsRef.current.bestCombo, comboRef.current);
      hapticImpact(true);
      playGameSound('replay');
      setShake(1);
      window.setTimeout(() => setShake(0), 180);
    } else {
      audienceRef.current = clamp(audienceRef.current - 6, 0, 100);
      comboRef.current = 1;
      streakRef.current = 0;
      playGameSound('miss');
      addPopup(cam.x, cam.y, 'TOMA FALLIDA', '#ff4d6d', true);
    }
  }, [addPopup, cupRound, gameMode, getTargets, pushCapture, slowMoActive, slowMoCharges]);

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
    const speed = 62 * dt / cam.zoom;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) cam.y -= speed;
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) cam.y += speed;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) cam.x -= speed;
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) cam.x += speed;
    if (keyMove) follow.active = false;
    const c = clampCamera(cam);
    cam.x = c.x; cam.y = c.y;
  }, []);

  const levelStadium = () => ALL_LEVELS[currentLevel]?.stadium ?? { grass1: '#3a8a54', grass2: '#317c49', stands: '#1a2438', trim: '#3a5a7a' };

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
    const tl = mMap(m, 0, 0), br = mMap(m, 100, 100);
    const w = br.x - tl.x, h = br.y - tl.y;
    const ux = m.ppuX, uy = m.ppuY;
    const transform = ctx.getTransform();
    const viewW = ctx.canvas.width / (transform.a || 1);
    const viewH = ctx.canvas.height / (transform.d || 1);
    const visibleX0 = Math.max(0, (0 - m.ox) / ux);
    const visibleX1 = Math.min(100, (viewW - m.ox) / ux);
    const visibleY0 = Math.max(0, (0 - m.oy) / uy);
    const visibleY1 = Math.min(100, (viewH - m.oy) / uy);

    // ── Pista perimetral: tartán, carriles y bordes de seguridad ──
    const t0 = mMap(m, -TRACK - 8, -TRACK), t1 = mMap(m, 100 + TRACK + 8, 100 + TRACK);
    ctx.fillStyle = '#743c35';
    ctx.fillRect(t0.x, t0.y, t1.x - t0.x, t1.y - t0.y);
    const trackLight = ctx.createLinearGradient(t0.x, t0.y, t1.x, t1.y);
    trackLight.addColorStop(0, 'rgba(255,190,145,0.13)');
    trackLight.addColorStop(0.5, 'rgba(255,255,255,0)');
    trackLight.addColorStop(1, 'rgba(35,10,20,0.18)');
    ctx.fillStyle = trackLight;
    ctx.fillRect(t0.x, t0.y, t1.x - t0.x, t1.y - t0.y);

    ctx.lineWidth = Math.max(0.7, ux * 0.045);
    for (let i = 1; i < 5; i += 1) {
      const off = (TRACK / 5) * i;
      ctx.strokeStyle = i === 4 ? 'rgba(255,235,215,0.32)' : 'rgba(255,235,215,0.18)';
      const a = mMap(m, -TRACK - 8, -TRACK + off), b = mMap(m, 100 + TRACK + 8, -TRACK + off);
      const c = mMap(m, -TRACK - 8, 100 + TRACK - off), d = mMap(m, 100 + TRACK + 8, 100 + TRACK - off);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      const e = mMap(m, -TRACK + off, -TRACK), f = mMap(m, -TRACK + off, 100 + TRACK);
      const g = mMap(m, 100 + TRACK - off, -TRACK), j = mMap(m, 100 + TRACK - off, 100 + TRACK);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(j.x, j.y); ctx.stroke();
    }
    if (ux > 7) {
      ctx.font = `700 ${Math.max(7, Math.round(ux * 0.55))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let lane = 1; lane <= 4; lane += 1) {
        const top = mMap(m, 9, -TRACK + lane * 1.15);
        const bottom = mMap(m, 91, 100 + TRACK - lane * 1.15);
        ctx.fillStyle = 'rgba(255,235,215,0.42)';
        ctx.fillText(String(lane), top.x, top.y);
        ctx.fillText(String(lane), bottom.x, bottom.y);
      }
    }

    // Franja de césped de seguridad y sombra del césped sobre el tartán.
    const s0 = mMap(m, -2.5, -2.5), s1 = mMap(m, 102.5, 102.5);
    ctx.fillStyle = st.grass2;
    ctx.fillRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
    ctx.strokeStyle = 'rgba(0,0,0,0.24)';
    ctx.lineWidth = Math.max(2, ux * 0.28);
    ctx.strokeRect(tl.x, tl.y, w, h);

    // ── Césped: siega alterna, luz suave y desgaste en zonas de uso ──
    ctx.save();
    ctx.beginPath(); ctx.rect(tl.x, tl.y, w, h); ctx.clip();
    const stripes = 14;
    const stripe = w / stripes;
    const firstStripe = Math.max(0, Math.floor((visibleX0 / 100) * stripes) - 1);
    const lastStripe = Math.min(stripes, Math.ceil((visibleX1 / 100) * stripes) + 1);
    for (let i = firstStripe; i < lastStripe; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? st.grass1 : st.grass2;
      ctx.fillRect(tl.x + stripe * i, tl.y, stripe + 1, h);
    }
    const grassLight = ctx.createLinearGradient(tl.x, tl.y, br.x, br.y);
    grassLight.addColorStop(0, 'rgba(235,255,205,0.075)');
    grassLight.addColorStop(0.46, 'rgba(255,255,255,0)');
    grassLight.addColorStop(1, 'rgba(0,35,25,0.10)');
    ctx.fillStyle = grassLight;
    ctx.fillRect(tl.x, tl.y, w, h);

    // Zonas gastadas muy sutiles: áreas, punto de penalti y círculo central.
    ctx.fillStyle = 'rgba(202,183,116,0.065)';
    const worn = (wx: number, wy: number, rx: number, ry: number) => {
      const p = mMap(m, wx, wy);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * ux, ry * uy, 0, 0, Math.PI * 2); ctx.fill();
    };
    worn(3, 50, 4.5, 15); worn(97, 50, 4.5, 15);
    worn(11, 50, 2.4, 3); worn(89, 50, 2.4, 3); worn(50, 50, 3.4, 3.4);

    // Textura determinista, sólo en la parte visible. No parpadea entre frames.
    if (ux > 5 && visibleX1 > visibleX0 && visibleY1 > visibleY0) {
      const grid = 3.5;
      const startX = Math.max(0, Math.floor(visibleX0 / grid) * grid);
      const startY = Math.max(0, Math.floor(visibleY0 / grid) * grid);
      for (let wx = startX; wx < visibleX1 + grid; wx += grid) {
        for (let wy = startY; wy < visibleY1 + grid; wy += grid) {
          const ix = Math.round(wx / grid), iy = Math.round(wy / grid);
          const hash = ((ix * 73856093) ^ (iy * 19349663)) >>> 0;
          const p = mMap(m, wx + (hash % 100) / 145, wy + ((hash >>> 8) % 100) / 145);
          ctx.strokeStyle = hash % 3 === 0 ? 'rgba(225,255,205,0.15)' : 'rgba(0,45,25,0.13)';
          ctx.lineWidth = Math.max(0.55, ux * 0.025);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + uy * 0.10);
          ctx.lineTo(p.x + ((hash % 5) - 2) * ux * 0.018, p.y - uy * 0.10);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // ── Marcas reglamentarias completas ──
    const line = 'rgba(244,255,239,0.88)';
    ctx.strokeStyle = line;
    ctx.lineWidth = Math.max(1, ux * 0.105);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeRect(tl.x, tl.y, w, h);
    const mid = mMap(m, 50, 0), midB = mMap(m, 50, 100), center = mMap(m, 50, 50);
    ctx.beginPath(); ctx.moveTo(mid.x, mid.y); ctx.lineTo(midB.x, midB.y); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(center.x, center.y, 9.15 * ux, 9.15 * uy, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.arc(center.x, center.y, Math.max(1.3, uy * 0.24), 0, Math.PI * 2); ctx.fill();

    const fieldRect = (x1: number, y1: number, x2: number, y2: number) => {
      const a = mMap(m, x1, y1), b = mMap(m, x2, y2);
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    };
    fieldRect(0, 30, 16, 70); fieldRect(84, 30, 100, 70);
    fieldRect(0, 40, 6, 60); fieldRect(94, 40, 100, 60);

    const leftSpot = mMap(m, 11, 50), rightSpot = mMap(m, 89, 50);
    [leftSpot, rightSpot].forEach((p) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.1, uy * 0.20), 0, Math.PI * 2); ctx.fill();
    });
    // Semicírculos de penalti recortados para que sólo queden fuera del área.
    ctx.save();
    const leftClip = mMap(m, 16, 0);
    ctx.beginPath(); ctx.rect(leftClip.x, tl.y, br.x - leftClip.x, h); ctx.clip();
    ctx.beginPath(); ctx.ellipse(leftSpot.x, leftSpot.y, 9.15 * ux, 9.15 * uy, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save();
    const rightClip = mMap(m, 84, 0);
    ctx.beginPath(); ctx.rect(tl.x, tl.y, rightClip.x - tl.x, h); ctx.clip();
    ctx.beginPath(); ctx.ellipse(rightSpot.x, rightSpot.y, 9.15 * ux, 9.15 * uy, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // Arcos de esquina.
    const corner = (wx: number, wy: number, startAngle: number) => {
      const p = mMap(m, wx, wy);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 1.35 * ux, 1.35 * uy, 0, startAngle, startAngle + Math.PI / 2); ctx.stroke();
    };
    corner(0, 0, 0); corner(100, 0, Math.PI / 2); corner(100, 100, Math.PI); corner(0, 100, Math.PI * 1.5);

    // ── Porterías: volumen, malla densa y destello al marcar ──
    const flash = goalFlashRef.current;
    const drawGoal = (side: 'left' | 'right') => {
      const lineX = side === 'left' ? 0 : 100;
      const depth = side === 'left' ? -5 : 5;
      const front = mMap(m, lineX, 40);
      const back = mMap(m, lineX + depth, 60);
      const x0 = Math.min(front.x, back.x), x1 = Math.max(front.x, back.x);
      const y0 = front.y, y1 = back.y;
      const gw = x1 - x0, gh = y1 - y0;
      const lit = Boolean(flash && flash.side === side && now < flash.until);
      const pulse = lit ? 0.5 + Math.sin(now * 0.018) * 0.5 : 0;

      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x0 + ux * 0.25, y0 + uy * 0.35, gw, gh);
      const netShade = ctx.createLinearGradient(x0, y0, x1, y1);
      netShade.addColorStop(0, lit ? `rgba(255,209,102,${0.28 + pulse * 0.25})` : 'rgba(225,241,245,0.15)');
      netShade.addColorStop(1, lit ? 'rgba(255,244,195,0.30)' : 'rgba(155,190,200,0.07)');
      ctx.fillStyle = netShade;
      ctx.fillRect(x0, y0, gw, gh);

      ctx.strokeStyle = lit ? 'rgba(255,252,225,0.90)' : 'rgba(225,244,245,0.43)';
      ctx.lineWidth = Math.max(0.55, ux * 0.035);
      const columns = 5, rows = 10;
      for (let i = 0; i <= columns; i += 1) {
        const xx = x0 + (gw / columns) * i;
        ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y1); ctx.stroke();
      }
      for (let i = 0; i <= rows; i += 1) {
        const yy = y0 + (gh / rows) * i;
        const ripple = lit ? Math.sin(now * 0.022 + i * 0.7) * ux * 0.07 : 0;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy + ripple); ctx.stroke();
      }

      const pw = Math.max(2, ux * 0.30);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,0.30)';
      ctx.lineWidth = pw * 1.55;
      ctx.beginPath(); ctx.moveTo(front.x + pw * 0.4, y0 + pw * 0.5); ctx.lineTo(front.x + pw * 0.4, y1 + pw * 0.5); ctx.stroke();
      ctx.strokeStyle = lit ? '#fff1ad' : '#f7ffff';
      ctx.lineWidth = pw;
      ctx.beginPath(); ctx.moveTo(front.x, y0); ctx.lineTo(front.x, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(front.x, y0); ctx.lineTo(back.x, y0); ctx.moveTo(front.x, y1); ctx.lineTo(back.x, y1); ctx.stroke();
      const backX = side === 'left' ? x0 : x1;
      ctx.beginPath(); ctx.moveTo(backX, y0); ctx.lineTo(backX, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(0.7, pw * 0.22);
      ctx.beginPath(); ctx.moveTo(front.x - pw * 0.15, y0); ctx.lineTo(front.x - pw * 0.15, y1); ctx.stroke();
    };
    drawGoal('left'); drawGoal('right');

    // ── Banderines de esquina con tela ondeando ──
    const cornerFlag = (wx: number, wy: number, outX: number, outY: number, seed: number) => {
      const p = mMap(m, wx, wy);
      const pole = Math.max(5, ux * 0.95);
      const tipX = p.x + outX * pole * 0.55, tipY = p.y + outY * pole * 0.55 - pole * 0.45;
      ctx.strokeStyle = '#f4f5e9'; ctx.lineWidth = Math.max(1, ux * 0.07);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tipX, tipY); ctx.stroke();
      const wave = Math.sin(now * 0.005 + seed) * pole * 0.15;
      ctx.fillStyle = st.trim;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + pole * 0.68, tipY + wave);
      ctx.lineTo(tipX + pole * 0.12, tipY + pole * 0.42);
      ctx.closePath(); ctx.fill();
    };
    if (ux > 4) {
      cornerFlag(0, 0, -0.25, -1, 0); cornerFlag(100, 0, 0.25, -1, 1);
      cornerFlag(100, 100, 0.25, 1, 2); cornerFlag(0, 100, -0.25, 1, 3);
    }

    // ── Publicidad LED perimetral, sin robar protagonismo a la jugada ──
    const drawBoards = (wy: number, seed: number) => {
      if (ux < 4) return;
      const segments = 8;
      for (let i = 0; i < segments; i += 1) {
        const a = mMap(m, 2 + i * 12, wy), b = mMap(m, 2 + i * 12 + 11.4, wy + (wy < 50 ? -1.15 : 1.15));
        const top = Math.min(a.y, b.y), bh = Math.abs(b.y - a.y);
        const active = (Math.floor(now / 1800) + i + seed) % 4;
        const colors = [st.trim, '#52d9c0', '#ffd166', '#73a9ff'];
        ctx.fillStyle = 'rgba(6,15,23,0.94)';
        ctx.fillRect(a.x, top, b.x - a.x, bh);
        ctx.fillStyle = colors[active];
        ctx.globalAlpha = 0.68 + Math.sin(now * 0.003 + i) * 0.12;
        ctx.fillRect(a.x, wy < 50 ? top + bh - Math.max(1, uy * 0.10) : top, b.x - a.x, Math.max(1, uy * 0.10));
        if (ux > 8 && bh > 7) {
          ctx.fillStyle = colors[active];
          ctx.font = `800 ${Math.max(6, Math.round(bh * 0.42))}px "Barlow Condensed", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const labels = ['CAM SOCCER', 'COPA LIVE', 'SEÑAL 4K', 'ARCADE'];
          ctx.fillText(labels[active], (a.x + b.x) / 2, top + bh * 0.52, b.x - a.x - 4);
        }
        ctx.globalAlpha = 1;
      }
    };
    drawBoards(-1.15, 0); drawBoards(101.15, 2);

    // ── Banquillos acristalados con suplentes DELANTE ──
    const drawBench = (x1: number, x2: number, benchY: number, team: 'home' | 'away', facingUp: boolean) => {
      drawDugout(ctx, m, x1, x2, benchY, st.trim);
      const seats = 5;
      const rowY = facingUp ? benchY - 1.6 : benchY + 1.6;
      for (let s = 0; s < seats; s += 1) {
        const wx = x1 + ((x2 - x1) / seats) * (s + 0.5);
        drawSeated(ctx, m, wx, rowY, team, s === seats - 1, facingUp, now);
      }
    };
    drawBench(36, 50, -5.5, 'home', false);
    drawBench(50, 64, -5.5, 'home', false);
    drawBench(36, 50, 105.5, 'away', true);
    drawBench(50, 64, 105.5, 'away', true);
  };

  const drawPlayerTiny = (ctx: CanvasRenderingContext2D, m: FieldMap, p: { x: number; y: number; team: 'home' | 'away'; hasBall: boolean; role?: string; facingX?: number; facingY?: number }) => {
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


  const drawFoulBig = (ctx: CanvasRenderingContext2D, m: FieldMap, foul: { x: number; y: number; label: string }, now: number) => {
    const p = mMap(m, foul.x, foul.y);
    const u = m.ppuX;
    const pulse = Math.sin(now * 0.018);
    // Jugador caído: cuerpo horizontal, piernas dobladas y pequeño temblor.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 1.2, u * 2.4, u * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y + pulse * u * 0.08); ctx.rotate(-0.08 + pulse * 0.04);
    ctx.fillStyle = '#e5484d'; ctx.fillRect(-u * 1.5, -u * 0.35, u * 2.8, u * 0.9);
    ctx.fillStyle = '#2f6bed'; ctx.fillRect(u * 0.9, -u * 0.25, u * 1.2, u * 0.55);
    ctx.fillStyle = '#f0c199'; ctx.fillRect(-u * 2.2, -u * 0.55, u * 0.85, u * 0.85);
    ctx.fillStyle = '#23262e'; ctx.fillRect(-u * 0.4, u * 0.45, u * 0.55, u * 0.9); ctx.fillRect(u * 0.45, u * 0.45, u * 0.55, u * 0.8);
    ctx.restore();
    // Rival frenando y árbitro entrando a la jugada.
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1.5, u * 0.16);
    ctx.beginPath(); ctx.arc(p.x + u * 2.5, p.y - u * 1.2, u * 0.55 + pulse * u * 0.08, 0, Math.PI * 2); ctx.stroke();
    const refereeX = foul.x - 7 + Math.sin(now * 0.004) * 2;
    const refereeY = foul.y - 5 + Math.cos(now * 0.005) * 1.5;
    drawPlayerBig(ctx, m, { x: refereeX, y: refereeY, team: 'home', hasBall: false, moving: true, phase: now * 0.018, facingX: foul.x - refereeX, facingY: foul.y - refereeY, referee: true });
    const rp = mMap(m, refereeX, refereeY - 3.9);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(rp.x - u * 0.28, rp.y - u * 0.8, u * 0.56, u * 1.6);
    ctx.fillStyle = '#fff0b5'; ctx.font = 'bold 10px "Space Grotesk Variable", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(foul.label.toUpperCase(), p.x, p.y - u * 4.4);
  };


  const drawPanelChrome = (ctx: CanvasRenderingContext2D, p: Panel, title: string, accent: string, active = false) => {
    ctx.fillStyle = 'rgba(4,9,16,0.82)';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = active ? accent : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = active ? 2 : 1.5;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
    ctx.fillStyle = accent;
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(title, p.x + 8, p.y + 9);
  };

  const renderFrame = useCallback((ctx: CanvasRenderingContext2D, W: number, H: number, now: number) => {
    const sim = matchRef.current;
    if (!sim) return;

    // Seguimiento visual con límite de velocidad. Si una recepción o un saque
    // cambia la posición lógica, la pelota recorre el trayecto en vez de saltar.
    const actualBall = sim.ball;
    if (!visualBallRef.current) {
      visualBallRef.current = { x: actualBall.x, y: actualBall.y, vx: actualBall.vx, vy: actualBall.vy };
      visualBallTimeRef.current = now;
    } else {
      const visual = visualBallRef.current;
      const elapsed = Math.max(1, now - visualBallTimeRef.current) / 16.67;
      const blend = Math.min(1, 0.52 * elapsed);
      visual.x += (actualBall.x - visual.x) * blend;
      visual.y += (actualBall.y - visual.y) * blend;
      visual.vx = actualBall.vx; visual.vy = actualBall.vy;
      visualBallTimeRef.current = now;
    }
    const visualBall = visualBallRef.current;
    const layout = computeLayout(W, H);
    layoutRef.current = layout;
    const cam = cameraRef.current;
    const targets = getTargets(now);
    const priority = targets.find(target => target.kind === 'ball' || !target.caught) ?? targets[0];
    const onAir = targets.find(target => inFrame(target, cam, 1));
    const priorityInside = priority ? inFrame(priority, cam, 0) : false;
    const hasCoverage = Boolean(onAir);
    const frameColor = priorityInside ? '#ffd166' : hasCoverage ? '#3ddc97' : '#ff4d6d';
    const q = framingRef.current;
    const camFrame = frameBounds(cam);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070b13'; ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake) {
      // Sacudida continua y reproducible; evita el ruido visual de usar
      // coordenadas aleatorias distintas en cada frame.
      ctx.translate(Math.sin(now * 0.091) * 3 * shake, Math.cos(now * 0.073) * 3 * shake);
    }

    // ── MEDIO: mapa grande para verlo todo ──
    const t = layout.tactical;
    drawPanelChrome(ctx, t, 'MAPA DEL REALIZADOR · MUEVE EL RECUADRO DE CÁMARA', '#ff4058');
    ctx.save();
    ctx.beginPath(); ctx.rect(t.inner.x, t.inner.y, t.inner.w, t.inner.h); ctx.clip();
    const tm = fitField(t.inner);
    drawStadium(ctx, tm, now, levelStadium(), audienceRef.current, t.inner);
    drawField(ctx, tm, now);
    // ── EVENTOS: iconos grandes y pulsantes para que se vean claramente ──
    for (const inc of incidentsRef.current) {
      const ip = mMap(tm, inc.x, inc.y);
      const remaining = Math.max(0, (inc.expiresAt - now) / 1000);
      const urgent = remaining < 1.8 && !inc.caught;
      const pulse = inc.caught ? 1 : 1 + Math.sin(now * (urgent ? 0.018 : 0.008) + inc.x * 0.1) * (urgent ? 0.34 : 0.25);
      const icons: Record<EngineIncident['kind'], string> = {
        fight: '👊', streaker: '🏃', dog: '🐕', coach: '😤',
        mascot: '🦁', drone: 'D', sprinkler: 'H₂O', flare: '🔥',
      };
      ctx.save();
      ctx.globalAlpha = inc.caught ? 0.48 : clamp(remaining / 0.55, 0, 1);
      if (!inc.caught) {
        ctx.fillStyle = inc.color + (urgent ? '65' : '40');
        ctx.beginPath(); ctx.arc(ip.x, ip.y, 14 * pulse, 0, Math.PI * 2); ctx.fill();
      }
      if (urgent) {
        ctx.strokeStyle = inc.color; ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -now * 0.012;
        ctx.beginPath(); ctx.arc(ip.x, ip.y, 10.5 * pulse, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = inc.caught ? '#254b46' : inc.color;
      ctx.beginPath(); ctx.arc(ip.x, ip.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${inc.kind === 'sprinkler' ? 5 : 7}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[inc.kind], ip.x, ip.y + 0.5);
      if (inc.caught) {
        ctx.fillStyle = '#3ddc97'; ctx.beginPath(); ctx.arc(ip.x + 5.5, ip.y - 5.5, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#08251d'; ctx.font = 'bold 5px "IBM Plex Mono", monospace'; ctx.fillText('✓', ip.x + 5.5, ip.y - 5.2);
      }
      ctx.restore();
    }

    // ── JUGADORES ──
    for (const pl of sim.players) {
      drawPlayerTiny(ctx, tm, { ...pl, facingX: pl.targetX - pl.x, facingY: pl.targetY - pl.y });
    }

    // ── BALÓN: más grande, con flecha direccional y trayectoria visible ──
    drawBall(ctx, tm, visualBall, true);
    
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
        ctx.font = 'bold 8px "Space Grotesk Variable", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('RECEPTOR', recvP.x, recvP.y - 12);
      }
    }

    // ── RECUADRO DEL ENCUADRE ──
    const a = mMap(tm, camFrame.minX, camFrame.minY);
    const b = mMap(tm, camFrame.maxX, camFrame.maxY);
    ctx.fillStyle = priorityInside
      ? 'rgba(255,209,102,0.13)'
      : hasCoverage ? 'rgba(61,220,151,0.11)' : 'rgba(255,77,109,0.10)';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeStyle = frameColor;
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
      
      // El anillo marca una oportunidad sin resolverle al jugador el movimiento.
    }
    ctx.restore();

    // ── ARRIBA: monitor de programa, primer plano y animaciones completas ──
    const bp = layout.broadcast;
    drawPanelChrome(
      ctx,
      bp,
      slowMoActive ? '◀◀ REPETICIÓN · SEÑAL AL AIRE' : '● MONITOR DE PROGRAMA · LO QUE VE LA AUDIENCIA',
      slowMoActive ? '#ffd166' : frameColor,
      hasCoverage,
    );
    ctx.save();
    ctx.beginPath(); ctx.rect(bp.inner.x, bp.inner.y, bp.inner.w, bp.inner.h); ctx.clip();
    const bm = fitWindow(bp.inner, cam);
    drawStadium(ctx, bm, now, levelStadium(), audienceRef.current, bp.inner);
    drawField(ctx, bm, now);
    // Franjas de grada en las zonas letterbox del monitor. Comparten la
    // ocupación real: con audiencia cero sólo quedan los asientos vacíos.
    const bnd = frameBounds(cam);
    const stripAudience = audienceRef.current;
    if (bnd.minY > 2) {
      const gap = mMap(bm, 0, 0).y - bp.inner.y;
      if (gap > 4) drawCrowdStrip(ctx, bp.inner.x, bp.inner.y, bp.inner.w, Math.min(gap, 22), now, stripAudience, 101);
    }
    if (bnd.maxY < 98) {
      const bottomFieldY = mMap(bm, 0, 100).y;
      const gap = (bp.inner.y + bp.inner.h) - bottomFieldY;
      if (gap > 4) drawCrowdStrip(ctx, bp.inner.x, bp.inner.y + bp.inner.h - Math.min(gap, 22), bp.inner.w, Math.min(gap, 22), now, stripAudience, 131);
    }
    if (bnd.minX > 2) {
      const gapL = mMap(bm, 0, 0).x - bp.inner.x;
      if (gapL > 4) drawCrowdStrip(ctx, bp.inner.x, bp.inner.y, Math.min(gapL, 22), bp.inner.h, now, stripAudience, 151, true);
    }
    if (bnd.maxX < 98) {
      const rightFieldX = mMap(bm, 100, 0).x;
      const gapR = (bp.inner.x + bp.inner.w) - rightFieldX;
      if (gapR > 4) drawCrowdStrip(ctx, bp.inner.x + bp.inner.w - Math.min(gapR, 22), bp.inner.y, Math.min(gapR, 22), bp.inner.h, now, stripAudience, 171, true);
    }
    const drawables: Array<{ y: number; fn: () => void }> = [];
    for (const pl of sim.players) {
      const previous = playerMotionRef.current.get(pl.id);
      const elapsed = previous ? Math.max(16, now - previous.time) : 16;
      const actualSpeed = previous ? Math.hypot(pl.x - previous.x, pl.y - previous.y) * 1000 / elapsed : 0;
      playerMotionRef.current.set(pl.id, { x: pl.x, y: pl.y, time: now });
      // Render visual suavizado: si una reanudación recoloca al jugador, la
      // cámara muestra el desplazamiento en vez de un teletransporte.
      let visual = visualPlayersRef.current.get(pl.id);
      if (!visual) { visual = { x: pl.x, y: pl.y }; visualPlayersRef.current.set(pl.id, visual); }
      const visualBlend = Math.min(1, Math.max(0.18, elapsed / 120));
      visual.x += (pl.x - visual.x) * visualBlend;
      visual.y += (pl.y - visual.y) * visualBlend;
      // Usamos el desplazamiento real y no solo el objetivo: así la zancada
      // nunca se queda congelada mientras el jugador todavía está avanzando.
      const moving = actualSpeed > 0.18 || Math.hypot(pl.x - pl.targetX, pl.y - pl.targetY) > 0.08 || pl.hasBall;
      // Detección de festejo de gol por equipo
      const isCelebrate = sim.phase === 'goal';
      const celebrating = isCelebrate && pl.team !== sim.pendingKickoffTeam;
      const sad = isCelebrate && pl.team === sim.pendingKickoffTeam;
      const defendingTeam = sim.phase === 'shot' && sim.ball.shotBy
        ? (sim.ball.shotBy === 'home' ? 'away' : 'home')
        : null;
      const diving = pl.role === 'GK' && pl.team === defendingTeam && Math.abs(sim.ball.x - visual.x) < 30;
      const diveDirection = sim.ball.y >= visual.y ? 1 : -1;

      drawables.push({
        y: visual!.y,
        fn: () => drawPlayerBig(ctx, bm, {
          x: visual!.x, y: visual!.y, team: pl.team, number: pl.number,
          hasBall: pl.hasBall, moving: diving ? false : moving,
          phase: now * (moving ? 0.018 : 0.005) + pl.id * 0.73,
          role: pl.role, celebrating, sad, diving, diveDirection,
          facingX: diving ? sim.ball.x - visual!.x : pl.targetX - pl.x,
          facingY: diving ? sim.ball.y - visual!.y : pl.targetY - pl.y
        })
      });
    }
    for (const moment of momentsRef.current) {
      if (moment.kind === 'foul') drawables.push({ y: moment.y, fn: () => drawFoulBig(ctx, bm, moment, now) });
    }
    for (const inc of incidentsRef.current) drawables.push({ y: inc.y, fn: () => drawIncidentBig(ctx, bm, inc, now) });
    drawables.sort((p, q2) => p.y - q2.y);
    for (const d of drawables) d.fn();
    drawBall(ctx, bm, visualBall, true);
    // Retículo del contenido que está realmente en antena.
    if (onAir) {
      const sp = mMap(bm, onAir.x, onAir.y);
      const rr = 16 + Math.sin(now * 0.012) * 3;
      const col = q > 0.72 ? '#ffd166' : q > 0.4 ? '#3ddc97' : '#8fa6bd';
      ctx.strokeStyle = col; ctx.lineWidth = 2 + q * 2;
      ctx.strokeRect(sp.x - rr, sp.y - rr * 1.3, rr * 2, rr * 2.4);
      ctx.fillStyle = col; ctx.font = 'bold 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText(onAir.label.toUpperCase(), sp.x, sp.y - rr * 1.3 - 5);

      // Barra de calidad del encuadre.
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bp.inner.x + 6, bp.inner.y + bp.inner.h - 16, 92, 10);
      ctx.fillStyle = col; ctx.fillRect(bp.inner.x + 8, bp.inner.y + bp.inner.h - 14, 88 * q, 6);

      const lock = captureLockRef.current;
      const locking = needsCaptureLock(onAir) && !onAir.caught && lock.targetId === onAir.id;
      if (locking) {
        const radius = rr * 1.58;
        ctx.strokeStyle = 'rgba(0,0,0,0.62)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, radius, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
        ctx.strokeStyle = lock.progress > 0.72 ? '#ffd166' : '#22d3ee';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lock.progress);
        ctx.stroke();
        ctx.fillStyle = lock.progress > 0.72 ? '#ffd166' : '#22d3ee';
        ctx.font = 'bold 10px "Space Grotesk Variable", sans-serif';
        ctx.fillText(`MANTÉN EL PLANO ${Math.round(lock.progress * 100)}%`, sp.x, sp.y + rr * 1.4 + 16);
      } else if (replayReadyRef.current && slowMoCharges > 0 && !slowMoActive && Math.sin(now * 0.014) > -0.2) {
        ctx.fillStyle = '#ffd166'; ctx.font = 'bold 12px "Space Grotesk Variable", sans-serif';
        ctx.fillText('¡TOMA!  [ESPACIO]', sp.x, sp.y + rr * 1.4 + 16);
      }
    }
    // Borde del recorte real: es una referencia, no una zona de control.
    const ca = mMap(bm, camFrame.minX, camFrame.minY);
    const cb = mMap(bm, camFrame.maxX, camFrame.maxY);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 2; ctx.setLineDash([9, 6]);
    ctx.strokeRect(ca.x, ca.y, cb.x - ca.x, cb.y - ca.y);
    ctx.setLineDash([]);
    ctx.fillStyle = frameColor;
    ctx.font = 'bold 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('SALIDA AL AIRE', ca.x + 3, Math.max(bp.inner.y + 2, ca.y - 12));

    // feed reciente
    if (recentCaptures.length) {
      ctx.font = 'bold 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
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
      ctx.font = `900 ${pop.big ? 18 : 13}px "Space Grotesk Variable", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color; ctx.fillText(pop.text, 0, 0); ctx.restore();
    }
    popupsRef.current = alive;
    ctx.restore();

    // ── ABAJO: control de cámara sin duplicar el mapa táctico ──
    const mm = layout.minimap;
    drawPanelChrome(ctx, mm, 'CONTROL DE CÁMARA · ARRASTRA LA PALANCA', '#ffd166');
    ctx.save();
    ctx.beginPath();
    ctx.rect(mm.inner.x, mm.inner.y, mm.inner.w, mm.inner.h);
    ctx.clip();

    // Consola limpia: el mapa completo ya está en el panel central.
    ctx.fillStyle = '#210a12';
    ctx.fillRect(mm.inner.x, mm.inner.y, mm.inner.w, mm.inner.h);
    ctx.strokeStyle = 'rgba(255,209,102,0.12)';
    ctx.lineWidth = 1;
    for (let gx = mm.inner.x; gx < mm.inner.x + mm.inner.w; gx += 24) {
      ctx.beginPath(); ctx.moveTo(gx, mm.inner.y); ctx.lineTo(gx, mm.inner.y + mm.inner.h); ctx.stroke();
    }
    for (let gy = mm.inner.y; gy < mm.inner.y + mm.inner.h; gy += 24) {
      ctx.beginPath(); ctx.moveTo(mm.inner.x, gy); ctx.lineTo(mm.inner.x + mm.inner.w, gy); ctx.stroke();
    }

    if (mm.inner.w > 620) {
      ctx.fillStyle = 'rgba(147,163,184,0.78)';
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('PRECISIÓN', mm.inner.x + 18, mm.inner.y + mm.inner.h / 2 - 10);
      ctx.fillStyle = '#ffd166';
      ctx.fillText('WASD / FLECHAS', mm.inner.x + 18, mm.inner.y + mm.inner.h / 2 + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(147,163,184,0.78)';
      ctx.fillText('DECISIÓN RÁPIDA', mm.inner.x + mm.inner.w - 18, mm.inner.y + mm.inner.h / 2 - 10);
      ctx.fillStyle = '#ff7180';
      ctx.fillText('TOCA EL MAPA', mm.inner.x + mm.inner.w - 18, mm.inner.y + mm.inner.h / 2 + 8);
    }
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

      ctx.fillStyle = held ? 'rgba(4,10,18,0.92)' : 'rgba(4,10,18,0.72)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = held ? '#ffd166' : 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius * 0.7, cy); ctx.lineTo(cx + radius * 0.7, cy);
      ctx.moveTo(cx, cy - radius * 0.7); ctx.lineTo(cx, cy + radius * 0.7);
      ctx.stroke();

      ctx.strokeStyle = held ? 'rgba(255,209,102,0.65)' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.fillStyle = held ? '#ffd166' : '#9aa9bb';
      ctx.beginPath();
      ctx.arc(kx, ky, radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#04070d';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = held ? '#ffd166' : 'rgba(147,163,184,0.9)';
      ctx.font = 'bold 8px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(held ? 'MOVIENDO' : 'JOYSTICK', cx, cy + radius + 9);
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
      ctx.font = `900 ${Math.min(40, bp.inner.w * 0.10)}px "Space Grotesk Variable", sans-serif`;
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

    // Las oportunidades se anuncian en la mesa del realizador, nunca encima
    // de la señal superior que representa lo que recibe la audiencia.
    const urgent = targets.find(target => target.importance >= 2.2 && !target.caught);
    if (urgent) {
      const insideU = inFrame(urgent, cam, 0);
      const pulse = 0.55 + Math.sin(now * 0.018) * 0.45;
      ctx.save();
      const alertY = t.inner.y + 2;
      ctx.fillStyle = insideU
        ? `rgba(61,220,151,${0.18 + pulse * 0.12})`
        : `rgba(255,209,102,${0.15 + pulse * 0.12})`;
      ctx.fillRect(t.inner.x, alertY, t.inner.w, 26);
      ctx.fillStyle = insideU ? '#3ddc97' : '#ffd166';
      ctx.font = '900 13px "Space Grotesk Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const prefix = insideU ? 'MANTÉN EL PLANO' : 'OPORTUNIDAD';
      ctx.fillText(`${prefix}  ·  ${urgent.label.toUpperCase()}`, t.inner.x + t.inner.w / 2, alertY + 13);
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
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const lowMemory = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const renderInterval = coarsePointer || lowMemory ? 1000 / 40 : 0;
    const resize = () => {
      // DPR 2 en un móvil duplica el coste sin mejorar el pixel-art. Limitarlo
      // mantiene la imagen nítida y evita calentamiento en partidas largas.
      const dprCap = coarsePointer || lowMemory ? 1.5 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const nextWidth = Math.floor(container.clientWidth * dpr);
      const nextHeight = Math.floor(container.clientHeight * dpr);
      // Asignar width/height borra el canvas aunque el valor sea idéntico.
      // Los efectos se recrean al capturar eventos; no deben dejar un frame vacío.
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      canvas.style.width = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const rawDt = Math.min((now - lastFrameTimeRef.current) / 1000, 0.06);
      lastFrameTimeRef.current = now;
      const dt = rawDt * (slowMoActive ? 0.38 : 1);
      const sim = matchRef.current;
      if (!sim) return;
      const level = ALL_LEVELS[currentLevel];
      const remaining = clamp(level.duration - (now - startTimeRef.current) / 1000, 0, level.duration);
      if (remaining <= 0) { finishGame(); return; }
      if (slowMoActive && now > slowMoEndRef.current) setSlowMoActive(false);
      if (now > nextChargeAtRef.current) {
        nextChargeAtRef.current = now + 11000;
        const maxCharges = 3 + profileRef.current.upgrades.replay * UPGRADE_EFFECTS.replayCapacity;
        setSlowMoCharges(previous => (previous < maxCharges ? previous + 1 : previous));
      }
      
      // Aplicar movimiento del joystick (respeta los límites de las gradas)
      if (joystickRef.current.active) {
        const cam = cameraRef.current;
        const speed = 58 * rawDt / cam.zoom;
        const moved = clampCamera({
          x: cam.x + joystickRef.current.dx * speed,
          y: cam.y + joystickRef.current.dy * speed,
          zoom: cam.zoom,
        });
        cam.x = moved.x;
        cam.y = moved.y;
      }
      
      moveCamera(rawDt);
      const cupGap = gameMode === 'cup' ? (CUP_ROUND_RULES[cupRound]?.incidentGap ?? 1) : 1;
      const tuning: MatchTuning = { pace: level.pace, incidentKinds: level.incidentKinds, incidentGap: level.incidentGap * cupGap };
      const events = updateMatchSim(sim, incidentsRef.current, momentsRef.current, dt, now, tuning);
      for (const e of events) {
        if (e.type === 'goal') {
          hapticSuccess();
          playGameSound('goal');
          setScoreLine(`${sim.homeGoals} - ${sim.awayGoals}`);
          setShake(1);
          window.setTimeout(() => setShake(0), 180);
          // Red que se ilumina + rótulo de GOL
          goalFlashRef.current = { until: now + 2600, side: e.team === 'home' ? 'right' : 'left' };
          goalBannerRef.current = { until: now + 2600, text: e.team === 'home' ? '¡GOL DEL ROJO!' : '¡GOL DEL AZUL!' };
          flashRef.current = { until: now + 260, color: '#ffd166' };
        } else if (e.type === 'incident') {
          playGameSound('alert');
        }
      }
      processBroadcastScore(rawDt, now);
      if (!endedRef.current) {
        const booIntensity = updateCrowdReaction(crowdReactionRef.current, audienceRef.current, now);
        if (booIntensity > 0) playCrowdBoo(booIntensity);
      }
      if (!renderInterval || now - lastRenderRef.current >= renderInterval) {
        renderFrame(ctx, container.clientWidth, container.clientHeight, now);
        lastRenderRef.current = now;
      }
      if (now - lastTimeHudRef.current > 150) { setTimeRemaining(remaining); lastTimeHudRef.current = now; }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frameRef.current); resizeObserver.disconnect(); window.removeEventListener('resize', resize); };
  }, [currentLevel, finishGame, moveCamera, phase, processBroadcastScore, renderFrame, slowMoActive]);

  // ── Teclado ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && (phase === 'gameover' || phase === 'paused')) {
        if (gameMode === 'cup' && cupChampion) startGame(CUP_ROUNDS[0], 'cup', 0, 0);
        else startGame(currentLevel, gameMode, cupRound, cupTotal);
        return;
      }
      if (e.code === 'Escape' && phase === 'paused' && !e.repeat) { togglePause(); return; }
      if (phase !== 'playing') return;
      if (e.repeat && (e.code === 'Space' || e.code === 'Escape' || e.code === 'KeyQ' || e.code === 'KeyE')) return;
      keysRef.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
      if (e.code === 'Space') { keysRef.current.delete('Space'); triggerReplay(); }
      if (e.code === 'KeyQ') changeZoom(cameraRef.current.zoom - 0.25);
      if (e.code === 'KeyE') changeZoom(cameraRef.current.zoom + 0.25);
      if (e.code === 'Escape') { keysRef.current.delete('Escape'); togglePause(); }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [changeZoom, cupChampion, cupRound, cupTotal, currentLevel, gameMode, phase, startGame, togglePause, triggerReplay]);

  // ── Puntero: el mapa mueve el encuadre y el joystick lo afina ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const container = containerRef.current;
    if (!container) return;
    const toLocal = (cx: number, cy: number) => { const b = container.getBoundingClientRect(); return { x: cx - b.left, y: cy - b.top }; };
    const regionAt = (lx: number, ly: number): PointerMode | null => {
      const L = layoutRef.current; if (!L) return null;
      const inR = (r: Panel) => lx >= r.inner.x && lx <= r.inner.x + r.inner.w && ly >= r.inner.y && ly <= r.inner.y + r.inner.h;
      if (inR(L.tactical)) return 'tactical';
      if (inR(L.minimap)) return 'minimap';
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
          const c = clampCamera({ x: w.x, y: w.y, zoom: cameraRef.current.zoom });
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
          const c = clampCamera({ x: w.x, y: w.y, zoom: cameraRef.current.zoom });
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
          <StartScreen
            highScores={highScores} unlockedLevel={unlockedLevel} profile={profile}
            onStart={(levelIndex, mode) => startGame(levelIndex, mode, mode === 'cup' ? 0 : cupRound, mode === 'cup' ? 0 : cupTotal)}
            onShowHowToPlay={() => setShowHowToPlay(true)} onBuyUpgrade={buyUpgrade} selfTest={selfTest}
            soundEnabled={soundEnabled} hapticsEnabled={hapticsEnabledState}
            onToggleSound={toggleSound} onToggleHaptics={toggleHaptics} onFullscreen={() => void requestFullscreen()}
          />
        )}
        {showHowToPlay && <HowToPlay onClose={() => setShowHowToPlay(false)} />}
        {phase !== 'menu' && <canvas ref={canvasRef} className="game-canvas" />}
        {(phase === 'playing' || phase === 'paused') && (
          <GameHUD
            audience={audience} score={score} combo={combo} timeRemaining={timeRemaining}
            level={ALL_LEVELS[currentLevel]} slowMoCharges={slowMoCharges} maxSlowMoCharges={maxSlowMoCharges}
            onPause={togglePause} onSlowMo={triggerReplay}
            slowMoActive={slowMoActive} trackingFeedback={trackingFeedback} scoreLine={scoreLine}
            directorCue={directorCue} framing={framing} replayReady={replayReady}
            soundEnabled={soundEnabled} onToggleSound={toggleSound}
            zoom={zoom} onZoomChange={changeZoom} gameMode={gameMode}
            scoreMultiplier={scoreMultiplierForMode(gameMode, cupRound)}
          />
        )}
        {phase === 'paused' && <PauseModal onResume={togglePause} onRestart={() => startGame(currentLevel, gameMode, cupRound, cupTotal)} onQuit={() => setPhase('menu')} />}
        {phase === 'gameover' && (
          <GameOverScreen score={score} level={ALL_LEVELS[currentLevel]} highScores={highScores}
            isNewHighScore={newHighScore} cup={cupResult}
            stats={runStats} rewards={runRewards} gameMode={gameMode}
            cupRound={cupRound} cupTotal={cupTotal} cupChampion={cupChampion}
            onRestart={() => gameMode === 'cup' && cupChampion
              ? startGame(CUP_ROUNDS[0], 'cup', 0, 0)
              : startGame(currentLevel, gameMode, cupRound, cupTotal)} onMenu={() => setPhase('menu')}
            onNextLevel={() => {
              if (gameMode === 'cup' && cupRound < CUP_ROUNDS.length - 1) startGame(CUP_ROUNDS[cupRound + 1], 'cup', cupRound + 1, cupTotal + score);
              else if (gameMode === 'career' && currentLevel < LEVELS.length - 1) startGame(currentLevel + 1, 'career');
            }}
            hasNextLevel={cupResult !== 'failed' && ((gameMode === 'cup' && cupRound < CUP_ROUNDS.length - 1) || (gameMode === 'career' && currentLevel < LEVELS.length - 1))} />
        )}
      </div>
    </div>
  );
}

export default App;

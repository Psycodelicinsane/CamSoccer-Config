import { useEffect, useRef, useState } from 'react';
import { Camera, Crosshair, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import {
  CameraState,
  FieldMap,
  clampCamera,
  fitField,
  fitWindow,
  frameBounds,
  framingQuality,
  inFrame,
  mMap,
} from '../utils/camera';
import { drawBall, drawIncidentBig, drawPlayerBig } from '../utils/broadcastRenderer';
import { drawStadium } from '../utils/stadiumRenderer';
import {
  EngineIncident,
  EngineMoment,
  IncidentKind,
  MatchSim,
  createMatchSim,
  spawnIncident,
  updateMatchSim,
} from '../utils/matchEngine';

type PracticeTarget = 'ball' | 'keepers' | 'dog' | 'mascot' | 'drone' | 'coach';
type Rect = { x: number; y: number; w: number; h: number };

const TARGETS: Array<{ id: PracticeTarget; label: string; color: string }> = [
  { id: 'ball', label: 'Balón', color: '#f5f7fa' },
  { id: 'keepers', label: 'Porteros', color: '#ffd93d' },
  { id: 'dog', label: 'Perro', color: '#f4a261' },
  { id: 'mascot', label: 'Mascota', color: '#f6c453' },
  { id: 'drone', label: 'Dron', color: '#8be9fd' },
  { id: 'coach', label: 'Entrenador', color: '#c58cff' },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function makePracticeIncident(kind: IncidentKind, now: number): EngineIncident {
  const incident = spawnIncident(now, [kind]);
  incident.expiresAt = Number.POSITIVE_INFINITY;
  incident.vx = 0;
  incident.vy = 0;
  if (kind === 'dog') Object.assign(incident, { x: 56, y: 53, vx: 3.2, vy: 0.85 });
  if (kind === 'mascot') Object.assign(incident, { x: 40, y: 104, vx: 4.2, vy: 0 });
  if (kind === 'drone') Object.assign(incident, { x: 45, y: 47, vx: 2.1, vy: 0.65 });
  if (kind === 'coach') Object.assign(incident, { x: 50, y: -5.5, vx: 0, vy: 0 });
  return incident;
}

function drawWorldRect(ctx: CanvasRenderingContext2D, map: FieldMap, x0: number, y0: number, x1: number, y1: number, fill?: string, stroke?: string) {
  const a = mMap(map, x0, y0);
  const b = mMap(map, x1, y1);
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); }
}

function drawPracticePitch(ctx: CanvasRenderingContext2D, map: FieldMap, detailed: boolean, now: number, clipRect?: Rect) {
  drawWorldRect(ctx, map, -22, -20, 122, 120, '#172a32');
  // La práctica no castiga ni modifica la audiencia: siempre hay ambiente de estadio.
  drawStadium(ctx, map, now, { stands: '#1a2b38', trim: '#5aa9e7' }, 100, clipRect);
  drawWorldRect(ctx, map, -7, -7, 107, 107, '#75453d');
  drawWorldRect(ctx, map, 0, 0, 100, 100, '#2f874d');
  for (let x = 0; x < 100; x += 10) drawWorldRect(ctx, map, x, 0, x + 5, 100, x % 20 === 0 ? '#358f52' : '#2f874d');

  ctx.lineWidth = Math.max(0.8, map.ppuX * (detailed ? 0.085 : 0.16));
  ctx.strokeStyle = 'rgba(236,247,230,0.82)';
  drawWorldRect(ctx, map, 0, 0, 100, 100, undefined, 'rgba(236,247,230,0.82)');
  const midTop = mMap(map, 50, 0), midBottom = mMap(map, 50, 100);
  ctx.beginPath(); ctx.moveTo(midTop.x, midTop.y); ctx.lineTo(midBottom.x, midBottom.y); ctx.stroke();
  const center = mMap(map, 50, 50);
  ctx.beginPath(); ctx.ellipse(center.x, center.y, 9.15 * map.ppuX, 9.15 * map.ppuY, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#edf7ed'; ctx.beginPath(); ctx.arc(center.x, center.y, Math.max(1, map.ppuX * 0.22), 0, Math.PI * 2); ctx.fill();

  drawWorldRect(ctx, map, 0, 20, 16.5, 80, undefined, 'rgba(236,247,230,0.82)');
  drawWorldRect(ctx, map, 83.5, 20, 100, 80, undefined, 'rgba(236,247,230,0.82)');
  drawWorldRect(ctx, map, 0, 35, 5.5, 65, undefined, 'rgba(236,247,230,0.82)');
  drawWorldRect(ctx, map, 94.5, 35, 100, 65, undefined, 'rgba(236,247,230,0.82)');
  for (const x of [11, 89]) {
    const spot = mMap(map, x, 50);
    ctx.beginPath(); ctx.arc(spot.x, spot.y, Math.max(1, map.ppuX * 0.22), 0, Math.PI * 2); ctx.fill();
  }

  // Porterías y red: visibles al practicar con cualquiera de los dos porteros.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -3 : 100, x1 = side < 0 ? 0 : 103;
    drawWorldRect(ctx, map, x0, 41, x1, 59, 'rgba(215,235,240,0.07)', '#f2f6ef');
    if (detailed) {
      ctx.strokeStyle = 'rgba(220,235,240,0.38)';
      ctx.lineWidth = Math.max(0.6, map.ppuX * 0.035);
      for (let y = 44; y < 59; y += 3) {
        const a = mMap(map, x0, y), b = mMap(map, x1, y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  }
}

function targetPosition(
  kind: PracticeTarget,
  sim: MatchSim,
  incidents: EngineIncident[],
  keeperIndex: number,
): { x: number; y: number; label: string } {
  if (kind === 'ball') return { x: sim.ball.x, y: sim.ball.y, label: 'Balón' };
  if (kind === 'keepers') {
    const keeper = sim.players.filter(player => player.role === 'GK')[keeperIndex] ?? sim.players[0];
    return { x: keeper.x, y: keeper.y, label: keeper.team === 'home' ? 'Portero rojo' : 'Portero azul' };
  }
  const incident = incidents.find(item => item.kind === kind);
  if (incident) return { x: incident.x, y: incident.y, label: TARGETS.find(item => item.id === kind)?.label ?? kind };
  return { x: 50, y: 50, label: 'Centro' };
}

export function PracticePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<MatchSim | null>(null);
  const incidentsRef = useRef<EngineIncident[]>([]);
  const momentsRef = useRef<EngineMoment[]>([]);
  const automaticIncidentsRef = useRef<EngineIncident[]>([]);
  const cameraRef = useRef<CameraState>({ x: 50, y: 50, zoom: 1 });
  const nowRef = useRef(0);
  const targetRef = useRef<PracticeTarget>('ball');
  const keeperIndexRef = useRef(0);
  const followRef = useRef({ active: true, until: Number.POSITIVE_INFINITY });
  const keysRef = useRef(new Set<string>());
  const [zoom, setZoom] = useState(1);
  const [activeTarget, setActiveTarget] = useState<PracticeTarget>('ball');

  const changeZoom = (next: number) => {
    const value = clamp(Math.round(next * 4) / 4, 1, 2);
    cameraRef.current = clampCamera({ ...cameraRef.current, zoom: value });
    setZoom(value);
  };

  const focusTarget = (kind: PracticeTarget) => {
    if (kind === 'keepers' && targetRef.current === 'keepers') keeperIndexRef.current = 1 - keeperIndexRef.current;
    targetRef.current = kind;
    setActiveTarget(kind);
    followRef.current = { active: true, until: Number.POSITIVE_INFINITY };
  };

  const resetCamera = () => {
    keeperIndexRef.current = 0;
    changeZoom(1);
    focusTarget('ball');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sim = createMatchSim(0);
    sim.nextIncidentAt = Number.POSITIVE_INFINITY;
    sim.forcedGoalAt = Number.POSITIVE_INFINITY;
    sim.players.forEach(player => { player.speed *= 0.65; });
    simRef.current = sim;
    incidentsRef.current = (['dog', 'mascot', 'drone', 'coach'] as IncidentKind[]).map(kind => makePracticeIncident(kind, 0));
    momentsRef.current = [];
    automaticIncidentsRef.current = [];
    cameraRef.current = { x: 50, y: 50, zoom: 1 };
    followRef.current = { active: true, until: Number.POSITIVE_INFINITY };
    nowRef.current = 0;

    let width = 0, height = 0;
    let frame = 0, running = false, inView = true;
    let lastFrame = 0, lastRender = 0;
    let monitorMap: FieldMap | null = null;
    let tacticalMap: FieldMap | null = null;
    let monitorRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let tacticalRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const pointer = { id: -1, mode: 'none' as 'none' | 'monitor' | 'map', x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== nextWidth) canvas.width = nextWidth;
      if (canvas.height !== nextHeight) canvas.height = nextHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
    };

    const setMapCamera = (localX: number, localY: number) => {
      if (!tacticalMap) return;
      const next = clampCamera({
        x: (localX - tacticalMap.ox) / tacticalMap.ppuX,
        y: (localY - tacticalMap.oy) / tacticalMap.ppuY,
        zoom: cameraRef.current.zoom,
      });
      cameraRef.current = next;
      followRef.current.active = false;
    };

    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const inside = (point: { x: number; y: number }, rect: Rect) => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;

    const onPointerDown = (event: PointerEvent) => {
      const point = localPoint(event);
      pointer.id = event.pointerId;
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.mode = inside(point, tacticalRect) ? 'map' : inside(point, monitorRect) ? 'monitor' : 'none';
      if (pointer.mode === 'none') return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      followRef.current.active = false;
      if (pointer.mode === 'map') setMapCamera(point.x, point.y);
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointer.id || pointer.mode === 'none') return;
      const point = localPoint(event);
      if (pointer.mode === 'map') setMapCamera(point.x, point.y);
      if (pointer.mode === 'monitor' && monitorMap) {
        cameraRef.current = clampCamera({
          x: cameraRef.current.x - (point.x - pointer.x) / monitorMap.ppuX,
          y: cameraRef.current.y - (point.y - pointer.y) / monitorMap.ppuY,
          zoom: cameraRef.current.zoom,
        });
      }
      pointer.x = point.x;
      pointer.y = point.y;
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointer.id) return;
      pointer.id = -1;
      pointer.mode = 'none';
      try { canvas.releasePointerCapture(event.pointerId); } catch { /* El navegador ya liberó el puntero. */ }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
        keysRef.current.add(event.code);
        followRef.current.active = false;
        event.preventDefault();
      }
      if (!event.repeat && (event.code === 'KeyQ' || event.code === 'KeyE')) {
        changeZoom(cameraRef.current.zoom + (event.code === 'KeyE' ? 0.25 : -0.25));
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    const onBlur = () => { keysRef.current.clear(); pointer.mode = 'none'; };

    const updatePracticeIncident = (incident: EngineIncident, dt: number) => {
      incident.x += incident.vx * dt;
      incident.y += incident.vy * dt;
      if (incident.kind === 'dog' || incident.kind === 'drone') {
        const minX = incident.kind === 'dog' ? 7 : 12, maxX = incident.kind === 'dog' ? 93 : 88;
        const minY = incident.kind === 'dog' ? 14 : 18, maxY = incident.kind === 'dog' ? 86 : 82;
        if (incident.x < minX || incident.x > maxX) { incident.x = clamp(incident.x, minX, maxX); incident.vx *= -1; }
        if (incident.y < minY || incident.y > maxY) { incident.y = clamp(incident.y, minY, maxY); incident.vy *= -1; }
      }
      if (incident.kind === 'mascot' && (incident.x < 10 || incident.x > 90)) {
        incident.x = clamp(incident.x, 10, 90);
        incident.vx *= -1;
      }
    };

    const draw = (now: number) => {
      if (width < 10 || height < 10) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#081117'; ctx.fillRect(0, 0, width, height);
      const mapHeight = clamp(height * 0.35, 72, 96);
      monitorRect = { x: 0, y: 0, w: width, h: height - mapHeight - 5 };
      tacticalRect = { x: 5, y: height - mapHeight + 12, w: width - 10, h: mapHeight - 17 };
      monitorMap = fitWindow(monitorRect, cameraRef.current);
      tacticalMap = fitField(tacticalRect);

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, width, monitorRect.h); ctx.clip();
      drawPracticePitch(ctx, monitorMap, true, now, monitorRect);
      const drawables: Array<{ y: number; fn: () => void }> = [];
      const defendingTeam = sim.phase === 'shot' && sim.ball.shotBy ? (sim.ball.shotBy === 'home' ? 'away' : 'home') : null;
      for (const player of sim.players) {
        const moving = Math.hypot(player.x - player.targetX, player.y - player.targetY) > 0.08 || player.hasBall;
        const celebrating = sim.phase === 'goal' && player.team !== sim.pendingKickoffTeam;
        const sad = sim.phase === 'goal' && player.team === sim.pendingKickoffTeam;
        const diving = player.role === 'GK' && player.team === defendingTeam && Math.abs(sim.ball.x - player.x) < 30;
        drawables.push({ y: player.y, fn: () => drawPlayerBig(ctx, monitorMap!, {
          x: player.x, y: player.y, team: player.team, number: player.number,
          hasBall: player.hasBall, moving: diving ? false : moving,
          phase: now * (moving ? 0.018 : 0.005) + player.id * 0.73,
          role: player.role, celebrating, sad, diving,
          diveDirection: sim.ball.y >= player.y ? 1 : -1,
          facingX: diving ? sim.ball.x - player.x : player.targetX - player.x,
          facingY: diving ? sim.ball.y - player.y : player.targetY - player.y,
        }) });
      }
      for (const incident of incidentsRef.current) drawables.push({ y: incident.y, fn: () => drawIncidentBig(ctx, monitorMap!, incident, now) });
      drawables.sort((a, b) => a.y - b.y);
      drawables.forEach(drawable => drawable.fn());
      drawBall(ctx, monitorMap, sim.ball, true);

      const selected = targetPosition(targetRef.current, sim, incidentsRef.current, keeperIndexRef.current);
      const quality = framingQuality(selected, cameraRef.current);
      if (inFrame(selected, cameraRef.current, 0)) {
        const point = mMap(monitorMap, selected.x, selected.y);
        const size = 14 + Math.sin(now * 0.008) * 1.5;
        const color = quality > 0.72 ? '#ffd166' : quality > 0.4 ? '#3ddc97' : '#a9b9c4';
        ctx.strokeStyle = color; ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(point.x - size, point.y - size + 5); ctx.lineTo(point.x - size, point.y - size); ctx.lineTo(point.x - size + 5, point.y - size);
        ctx.moveTo(point.x + size - 5, point.y - size); ctx.lineTo(point.x + size, point.y - size); ctx.lineTo(point.x + size, point.y - size + 5);
        ctx.moveTo(point.x - size, point.y + size - 5); ctx.lineTo(point.x - size, point.y + size); ctx.lineTo(point.x - size + 5, point.y + size);
        ctx.moveTo(point.x + size - 5, point.y + size); ctx.lineTo(point.x + size, point.y + size); ctx.lineTo(point.x + size, point.y + size - 5); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(4,12,16,0.78)'; ctx.fillRect(8, monitorRect.h - 23, 132, 16);
      ctx.fillStyle = '#263a43'; ctx.fillRect(65, monitorRect.h - 16, 67, 4);
      ctx.fillStyle = quality > 0.72 ? '#ffd166' : '#b9ed73'; ctx.fillRect(65, monitorRect.h - 16, 67 * quality, 4);
      ctx.fillStyle = '#dbe7e3'; ctx.font = '700 8px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`ENCUADRE ${Math.round(quality * 100)}%`, 12, monitorRect.h - 15);
      ctx.restore();

      ctx.fillStyle = '#0a151c'; ctx.fillRect(0, monitorRect.h + 5, width, mapHeight - 5);
      ctx.fillStyle = '#8197a3'; ctx.font = '700 8px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('MAPA TÁCTICO · TOCA O ARRASTRA', 8, monitorRect.h + 13);
      drawPracticePitch(ctx, tacticalMap, false, now, tacticalRect);
      for (const player of sim.players) {
        const point = mMap(tacticalMap, player.x, player.y);
        ctx.fillStyle = player.role === 'GK' ? (player.team === 'home' ? '#ffd93d' : '#2fd47a') : player.team === 'home' ? '#e5484d' : '#2f6bed';
        ctx.beginPath(); ctx.arc(point.x, point.y, player.role === 'GK' ? 2.3 : 1.7, 0, Math.PI * 2); ctx.fill();
      }
      for (const incident of incidentsRef.current) {
        const point = mMap(tacticalMap, incident.x, incident.y);
        ctx.fillStyle = incident.color; ctx.beginPath(); ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      const ball = mMap(tacticalMap, sim.ball.x, sim.ball.y);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, ball.y, 2.3, 0, Math.PI * 2); ctx.fill();
      const bounds = frameBounds(cameraRef.current);
      const topLeft = mMap(tacticalMap, bounds.minX, bounds.minY), bottomRight = mMap(tacticalMap, bounds.maxX, bounds.maxY);
      ctx.fillStyle = 'rgba(245,207,104,0.08)'; ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.strokeStyle = '#f5cf68'; ctx.lineWidth = 1.4; ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.strokeStyle = '#334852'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    };

    const loop = (timestamp: number) => {
      if (!running) return;
      const dt = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 1 / 60;
      lastFrame = timestamp;
      nowRef.current += dt * 1000;
      const now = nowRef.current;
      updateMatchSim(sim, automaticIncidentsRef.current, momentsRef.current, dt, now, { pace: 0.55, incidentKinds: [], incidentGap: Number.POSITIVE_INFINITY });
      incidentsRef.current.forEach(incident => updatePracticeIncident(incident, dt));

      const keys = keysRef.current;
      const dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const dy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      if (dx || dy) {
        const speed = 62 * dt / cameraRef.current.zoom;
        cameraRef.current = clampCamera({ x: cameraRef.current.x + dx * speed, y: cameraRef.current.y + dy * speed, zoom: cameraRef.current.zoom });
      }
      if (followRef.current.active) {
        const selected = targetPosition(targetRef.current, sim, incidentsRef.current, keeperIndexRef.current);
        const blend = Math.min(1, dt * 12);
        const cam = cameraRef.current;
        cameraRef.current = clampCamera({ x: cam.x + (selected.x - cam.x) * blend, y: cam.y + (selected.y - cam.y) * blend, zoom: cam.zoom });
        if (now >= followRef.current.until) followRef.current.active = false;
      }
      if (!lastRender || timestamp - lastRender >= 1000 / 30) {
        draw(now);
        lastRender = timestamp;
      }
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      lastFrame = 0;
      frame = requestAnimationFrame(loop);
    };
    const stop = () => { running = false; cancelAnimationFrame(frame); lastFrame = 0; keysRef.current.clear(); };
    const onVisibility = () => { if (document.hidden) stop(); else start(); };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    const intersectionObserver = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true;
      if (inView) start(); else stop();
    }, { rootMargin: '100px' });
    intersectionObserver.observe(canvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <section className="practice-preview" aria-label="Práctica libre de cámara">
      <div className="practice-preview__bar">
        <span><Camera size={14} /> PRÁCTICA LIBRE</span>
        <span>CAM 01 <b>{zoom.toFixed(2).replace(/0$/, '')}×</b></span>
      </div>
      <canvas
        ref={canvasRef}
        className="practice-preview__canvas"
        tabIndex={0}
        aria-label="Campo interactivo de práctica. Arrastra el mapa o usa WASD y las flechas para mover la cámara; Q y E controlan el zoom."
        data-testid="practice-canvas"
      >Tu navegador necesita Canvas para mostrar la práctica.</canvas>
      <div className="practice-preview__controls">
        <div className="practice-preview__zoom" aria-label="Zoom de práctica">
          <button type="button" onClick={() => changeZoom(zoom - 0.25)} disabled={zoom <= 1} aria-label="Alejar cámara de práctica"><Minus size={14} /></button>
          <span>ZOOM</span>
          <button type="button" onClick={() => changeZoom(zoom + 0.25)} disabled={zoom >= 2} aria-label="Acercar cámara de práctica"><Plus size={14} /></button>
          <button type="button" className="practice-preview__reset" onClick={resetCamera} aria-label="Restablecer cámara de práctica"><RotateCcw size={14} /></button>
        </div>
        <div className="practice-preview__targets" aria-label="Centrar cámara en">
          {TARGETS.map(target => <button
            type="button"
            key={target.id}
            className={activeTarget === target.id ? 'is-active' : ''}
            aria-pressed={activeTarget === target.id}
            onClick={() => focusTarget(target.id)}
            title={target.id === 'keepers' ? 'Pulsa de nuevo para alternar entre los dos porteros' : `Centrar ${target.label.toLowerCase()}`}
          ><i style={{ background: target.color }} />{target.label}</button>)}
        </div>
      </div>
      <div className="practice-preview__footer">
        <span><Move size={12} /> ARRASTRA PARA ENCUADRAR</span>
        <span><Crosshair size={12} /> SIN RELOJ · SIN PUNTOS</span>
      </div>
    </section>
  );
}

import { Focus, Minus, Pause, Plus, Radio, RotateCcw, Volume2, VolumeX, Zap } from 'lucide-react';
import { GameMode, LevelConfig } from '../types';
import { LevelIcon } from './LevelIcon';

interface Props {
  audience: number;
  score: number;
  combo: number;
  timeRemaining: number;
  level: LevelConfig;
  slowMoCharges: number;
  maxSlowMoCharges: number;
  onPause: () => void;
  onSlowMo: () => void;
  slowMoActive: boolean;
  trackingFeedback: 'good' | 'bad' | null;
  scoreLine: string;
  directorCue: string;
  framing: number;
  replayReady: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  gameMode: GameMode;
  scoreMultiplier: number;
}

export function GameHUD({
  audience, score, combo, timeRemaining, level, slowMoCharges, maxSlowMoCharges,
  onPause, onSlowMo, slowMoActive, trackingFeedback, scoreLine, directorCue,
  framing, replayReady, soundEnabled, onToggleSound, zoom, onZoomChange, gameMode, scoreMultiplier,
}: Props) {
  const audienceColor = audience < 30 ? '#ff5d73' : audience < 55 ? '#ffd166' : '#7de2a4';
  const frameColor = framing > 0.72 ? '#ffd166' : framing > 0.4 ? '#7de2a4' : '#8fa6bd';
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = Math.floor(timeRemaining % 60);
  const low = timeRemaining < 20;
  const replayAvailable = replayReady && slowMoCharges > 0 && !slowMoActive;
  const multiplierLabel = scoreMultiplier.toFixed(2).replace('.', ',');
  const modeLabel = gameMode === 'arcade' ? `ARCADE ×${multiplierLabel}`
    : gameMode === 'cup' ? `COPA${scoreMultiplier > 1 ? ` ×${multiplierLabel}` : ''}`
    : 'CARRERA';

  return (
    <header className="hudstrip">
      {audience < 25 && <div className={`transmission-alert ${audience < 12 ? 'is-critical' : ''}`} role="status"><Zap size={15} />{audience < 12 ? 'SEÑAL CRÍTICA · ¡VUELVE AL BALÓN!' : 'LA AUDIENCIA ESTÁ BAJANDO'}</div>}
      <div className="hudstrip__primary">
        <div className="hud-live"><span className="live-badge"><i /> EN VIVO</span><span className="level-chip" style={{ '--chip': level.color } as React.CSSProperties}><LevelIcon levelId={level.id} size={16} /><b>{level.name}</b><small>{modeLabel}</small></span></div>
        <div className="scorebug" aria-label={`Marcador ${scoreLine}`}><span className="scorebug__team home">ROJ</span><strong>{scoreLine}</strong><span className="scorebug__team away">AZU</span><span className={`scorebug__clock ${low ? 'low' : ''}`}>{minutes}:{seconds.toString().padStart(2, '0')}</span></div>
        <div className="hud-score"><span>PUNTOS</span><b>{score.toLocaleString('es-ES')}</b>{combo > 1.15 && <em>×{combo.toFixed(1)}</em>}</div>
        <div className="hud-audience"><div><span>AUDIENCIA</span><b style={{ color: audienceColor }}>{Math.floor(audience)}%</b></div><div className="hud-meter"><i style={{ width: `${audience}%`, background: audienceColor }} /></div></div>
        <div className="hud-top-actions"><button className="hud-icon" onClick={onToggleSound} aria-label={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}>{soundEnabled ? <Volume2 /> : <VolumeX />}</button><button className="hud-icon" onClick={onPause} aria-label="Pausar partida"><Pause /></button></div>
      </div>

      <div className="hudstrip__secondary">
        <div className="hud-mobile-metrics">
          <div className="hud-mobile-score"><small>PUNTOS</small><b>{score.toLocaleString('es-ES')}</b>{combo > 1.15 && <em>COMBO ×{combo.toFixed(1)}</em>}</div>
          <div className="hud-mobile-audience"><div><small>AUD.</small><b style={{ color: audienceColor }}>{Math.floor(audience)}%</b></div><div className="hud-meter"><i style={{ width: `${audience}%`, background: audienceColor }} /></div></div>
        </div>
        <div className={`director-cue director-cue--${trackingFeedback ?? 'idle'}`}><Radio size={15} /><span>{directorCue}</span></div>
        <div className="framing-status"><Focus size={15} /><span>{framing > 0.72 ? 'PLANO DE ORO' : framing > 0.4 ? 'BUEN ENCUADRE' : 'BUSCA LA ACCIÓN'}</span><div className="hud-meter"><i style={{ width: `${framing * 100}%`, background: frameColor }} /></div></div>
        <div className="hud-controls">
          <div className="zoom-control" aria-label="Zoom de cámara"><button onClick={() => onZoomChange(zoom - 0.25)} disabled={zoom <= 1} aria-label="Alejar cámara"><Minus /></button><span>{zoom.toFixed(2).replace(/0$/, '')}×</span><button onClick={() => onZoomChange(zoom + 0.25)} disabled={zoom >= 2} aria-label="Acercar cámara"><Plus /></button></div>
          <button className={`replay-button ${replayAvailable ? 'is-ready' : ''} ${slowMoActive ? 'is-active' : ''}`} onClick={onSlowMo} disabled={slowMoCharges <= 0 || slowMoActive}><RotateCcw size={18} /><span>{slowMoActive ? 'REPETICIÓN' : '¡TOMA!'}<small>{replayAvailable ? '¡AHORA!' : 'ESPACIO'}</small></span><div className="replay-pips">{Array.from({ length: maxSlowMoCharges }, (_, index) => <i key={index} className={index < slowMoCharges ? 'is-on' : ''} />)}</div></button>
        </div>
      </div>
    </header>
  );
}

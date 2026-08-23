import { LevelConfig } from '../types';

interface Props {
  audience: number;
  score: number;
  combo: number;
  timeRemaining: number;
  level: LevelConfig;
  slowMoCharges: number;
  onPause: () => void;
  onSlowMo: () => void;
  slowMoActive: boolean;
  trackingFeedback: 'good' | 'bad' | null;
  scoreLine: string;
  directorCue: string;
  framing: number;
  replayReady: boolean;
}

export function GameHUD({
  audience, score, combo, timeRemaining, level, slowMoCharges, onPause, onSlowMo,
  slowMoActive, trackingFeedback, scoreLine, directorCue, framing, replayReady,
}: Props) {
  const aColor = audience < 30 ? '#ff4d6d' : audience < 55 ? '#ffd166' : '#3ddc97';
  const fColor = framing > 0.72 ? '#ffd166' : framing > 0.4 ? '#3ddc97' : '#8fa6bd';
  const m = Math.floor(timeRemaining / 60);
  const s = Math.floor(timeRemaining % 60);
  const low = timeRemaining < 20;

  return (
    <div className="hudstrip">
      <div className="hudstrip__group hudstrip__group--live">
        <span className="live-badge"><i />LIVE</span>
        <span className="level-chip" style={{ ['--chip' as string]: level.color }}>{level.icon} <b>{level.name}</b></span>
      </div>

      <div className="scorebug">
        <span className="scorebug__team home">ROJ</span>
        <span className="scorebug__goals">{scoreLine}</span>
        <span className="scorebug__team away">AZU</span>
        <span className={`scorebug__clock ${low ? 'low' : ''}`}>{m}:{s.toString().padStart(2, '0')}</span>
      </div>

      <div className="hudstrip__group hudstrip__group--stats">
        <div className="stat-mini">
          <span className="stat-mini__lbl">PUNTOS</span>
          <span className="stat-mini__val">{score.toLocaleString()}</span>
          {combo > 1.15 && <span className="stat-mini__combo">×{combo.toFixed(1)}</span>}
        </div>
        <div className="meter-mini">
          <span className="meter-mini__lbl" style={{ color: aColor }}>AUD {Math.floor(audience)}%</span>
          <span className="meter-mini__bar"><i style={{ width: `${audience}%`, background: aColor }} /></span>
        </div>
        <div className="meter-mini">
          <span className="meter-mini__lbl" style={{ color: fColor }}>{framing > 0.72 ? 'PLANO DE ORO' : 'ENCUADRE'}</span>
          <span className="meter-mini__bar"><i style={{ width: `${Math.round(framing * 100)}%`, background: fColor }} /></span>
        </div>
      </div>

      <div className={`cue-pill cue-pill--${trackingFeedback ?? 'idle'}`}>{directorCue}</div>

      <button
        className={`toma-btn ${(replayReady && slowMoCharges > 0 && !slowMoActive) ? 'ready' : ''} ${slowMoActive ? 'active' : ''}`}
        onClick={onSlowMo} disabled={slowMoCharges <= 0}
      >
        <span className="toma-btn__label">¡TOMA!</span>
        <span className="toma-btn__pips">{[0, 1, 2, 3].map(i => <i key={i} className={i < slowMoCharges ? 'on' : ''} />)}</span>
      </button>

      <button className="pause-btn" onClick={onPause} aria-label="Pausa">❚❚</button>
    </div>
  );
}

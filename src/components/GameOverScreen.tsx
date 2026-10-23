import { ArrowRight, Award, Coins, Crosshair, Focus, Home, Medal, Play, RotateCcw, Sparkles, Star, Trophy, Zap } from 'lucide-react';
import { CUP_ROUND_NAMES } from '../levels';
import { CupResult, GameMode, HighScore, LevelConfig, RunRewards, RunStats } from '../types';
import { MatchFixture } from '../teams';
import { Matchup } from './TeamKit';

interface Props {
  score: number;
  level: LevelConfig;
  fixture: MatchFixture;
  scoreLine: string;
  highScores: HighScore[];
  isNewHighScore: boolean;
  cup: CupResult;
  onRestart: () => void;
  onMenu: () => void;
  onNextLevel: () => void;
  hasNextLevel: boolean;
  stats: RunStats;
  rewards: RunRewards;
  gameMode: GameMode;
  cupRound: number;
  cupTotal: number;
  cupChampion: boolean;
}

const cupData = {
  gold: { title: 'Medalla de oro', className: 'gold', note: 'Una retransmisión de élite. La grada corea tu nombre.' },
  silver: { title: 'Medalla de plata', className: 'silver', note: 'Gran directo. Hay muy poco que mejorar.' },
  bronze: { title: 'Medalla de bronce', className: 'bronze', note: 'Objetivo cumplido. El siguiente estadio te espera.' },
  failed: { title: 'Emisión sin medalla', className: 'failed', note: 'Aún no llegas al bronce. Ajusta el encuadre y vuelve a intentarlo.' },
} as const;

export function GameOverScreen({
  score, level, fixture, scoreLine, highScores, isNewHighScore, cup, onRestart, onMenu,
  onNextLevel, hasNextLevel, stats, rewards, gameMode, cupRound, cupTotal, cupChampion,
}: Props) {
  const result = cupData[cup];
  const nextCupLabel = cupRound === 0 ? 'Jugar semifinal' : 'Jugar la final';

  return (
    <div className="gameover-overlay">
      <div className={`gameover-modal result--${result.className}`} role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-rays" aria-hidden="true" />
        <div className="result-header">
          <div className="result-medal">{cupChampion ? <Trophy /> : cup === 'failed' ? <Crosshair /> : <Medal />}<span /></div>
          <span className="section-kicker">{cupChampion ? 'TORNEO COMPLETADO' : gameMode === 'arcade' ? 'RESULTADO ARCADE' : 'FIN DE LA EMISIÓN'}</span>
          <h1 id="result-title">{cupChampion ? '¡Copa para ti!' : isNewHighScore && score > 0 ? '¡Nuevo récord!' : result.title}</h1>
          <p>{cupChampion ? 'Has superado las tres eliminatorias de la Copa Broadcast.' : result.note}</p>
          {isNewHighScore && score > 0 && !cupChampion && <span className="record-ribbon"><Sparkles size={14} /> MEJOR MARCA PERSONAL</span>}
        </div>

        {gameMode === 'cup' && <div className="result-cup-rounds">{CUP_ROUND_NAMES.map((name, index) => <div key={name} className={index < cupRound || cupChampion ? 'is-done' : index === cupRound ? 'is-current' : ''}><span>{index < cupRound || cupChampion ? '✓' : index + 1}</span><small>{name}</small></div>)}</div>}

        <Matchup fixture={fixture} scoreLine={scoreLine} compact />

        <div className="result-score"><span>PUNTUACIÓN{gameMode === 'cup' ? ' DE LA RONDA' : ' FINAL'}</span><b>{score.toLocaleString('es-ES')}</b><small>{level.name} · Objetivo bronce {level.cups.bronze.toLocaleString('es-ES')}</small>{gameMode === 'cup' && <em>Total del torneo: {(cupTotal + score).toLocaleString('es-ES')}</em>}</div>

        <div className="result-stats">
          <div><Crosshair size={17} /><b>{stats.captures}</b><span>Planos</span></div>
          <div><Focus size={17} /><b>{stats.golden}</b><span>De oro</span></div>
          <div><Zap size={17} /><b>×{stats.bestCombo.toFixed(1)}</b><span>Mejor combo</span></div>
          <div><RotateCcw size={17} /><b>{stats.replays}</b><span>Repes</span></div>
        </div>

        <div className="result-rewards"><span><Award size={17} /> Recompensas</span><b>+{rewards.xp} XP</b><b><Coins size={15} /> +{rewards.credits}</b></div>

        <div className="gameover-buttons">
          {hasNextLevel && <button className="primary-button primary-button--wide" onClick={onNextLevel}>{gameMode === 'cup' ? <Trophy size={18} /> : <Play size={18} fill="currentColor" />}{gameMode === 'cup' ? nextCupLabel : 'Siguiente estadio'}<ArrowRight size={18} /></button>}
          {cupChampion && <button className="primary-button primary-button--wide" onClick={onMenu}><Trophy size={18} /> Celebrar y volver al estudio</button>}
          <button className="secondary-button" onClick={onRestart}><RotateCcw size={17} /> {cupChampion ? 'Jugar otra copa' : gameMode === 'cup' ? 'Reintentar ronda' : 'Reintentar partido'}</button>
          {!cupChampion && <button className="text-button" onClick={onMenu}><Home size={16} /> Volver al estudio</button>}
        </div>

        {highScores.length > 0 && <div className="result-records"><span><Star size={14} /> MEJORES EMISIONES</span>{highScores.slice(0, 3).map((entry, index) => <div key={`${entry.date}-${index}`}><i>#{index + 1}</i><b>{entry.level}</b><strong>{entry.score.toLocaleString('es-ES')}</strong></div>)}</div>}
      </div>
    </div>
  );
}

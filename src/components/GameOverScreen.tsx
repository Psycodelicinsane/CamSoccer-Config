import { HighScore, LevelConfig } from '../types';

interface Props {
  score: number;
  level: LevelConfig;
  highScores: HighScore[];
  isNewHighScore: boolean;
  cup: 'gold' | 'silver' | 'bronze' | 'failed';
  onRestart: () => void;
  onMenu: () => void;
  onNextLevel: () => void;
  hasNextLevel: boolean;
}

export function GameOverScreen({
  score,
  level,
  highScores,
  isNewHighScore,
  cup,
  onRestart,
  onMenu,
  onNextLevel,
  hasNextLevel
}: Props) {
  const rank = highScores.findIndex(h => h.score === score) + 1;
  const cupData = {
    gold: { title: 'COPA ORO', icon: '🏆', cls: 'cup-gold', text: 'Retransmisión de élite. Pasas de fase con honores.' },
    silver: { title: 'COPA PLATA', icon: '🥈', cls: 'cup-silver', text: 'Buen directo. Pasas de fase.' },
    bronze: { title: 'COPA BRONCE', icon: '🥉', cls: 'cup-bronze', text: 'Suficiente para pasar, pero puedes mejorar.' },
    failed: { title: 'FALLIDO', icon: '❌', cls: 'cup-failed', text: 'La audiencia no compró la retransmisión. No pasas de fase.' },
  }[cup];

  return (
    <div className="gameover-overlay">
      <div className="gameover-modal">
        {isNewHighScore && score > 0 ? (
          <div className="new-record">
            <h1 className="new-record-title">¡NUEVO RÉCORD!</h1>
            <div className="confetti">🎊</div>
          </div>
        ) : (
          <>
            <h1 className="gameover-title">FIN DE TRANSMISIÓN</h1>
            <p className="gameover-subtitle">El partido ha terminado</p>
          </>
        )}

        <div className="final-stats">
          <div className={`stat-item cup-item ${cupData.cls}`}>
            <span className="stat-label">RESULTADO</span>
            <span className="stat-value big">{cupData.icon} {cupData.title}</span>
            <span className="stat-note">{cupData.text}</span>
          </div>

          <div className="stat-item highlight">
            <span className="stat-label">PUNTUACIÓN FINAL</span>
            <span className="stat-value big">{score.toLocaleString()}</span>
          </div>
          
          <div className="stat-item">
            <span className="stat-label">PARTIDO</span>
            <span className="stat-value">{level.icon} {level.name}</span>
            <span className="stat-note">
              Bronce {level.cups.bronze.toLocaleString()} · Plata {level.cups.silver.toLocaleString()} · Oro {level.cups.gold.toLocaleString()}
            </span>
          </div>

          {rank > 0 && rank <= 5 && (
            <div className="stat-item rank-item">
              <span className="stat-label">TU RANGO</span>
              <span className="stat-value rank-value">#{rank}</span>
            </div>
          )}
        </div>

        <div className="gameover-buttons">
          {hasNextLevel && (
            <button className="gameover-btn primary" onClick={onNextLevel}>
              ➡️ Siguiente Partido
            </button>
          )}
          <button className="gameover-btn secondary" onClick={onRestart}>
            🔄 Jugar de Nuevo
          </button>
          <button className="gameover-btn tertiary" onClick={onMenu}>
            🏠 Menú Principal
          </button>
        </div>

        {highScores.length > 0 && (
          <div className="top-scores">
            <h3>🏆 Mejores Puntuaciones</h3>
            {highScores.slice(0, 5).map((hs, i) => (
              <div 
                key={i} 
                className={`top-score-item ${hs.score === score ? 'current' : ''}`}
              >
                <span className="top-rank">#{i + 1}</span>
                <span className="top-score">{hs.score.toLocaleString()}</span>
                <span className="top-level">{hs.level}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

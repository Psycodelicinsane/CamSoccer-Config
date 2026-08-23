import { HighScore } from '../types';
import { LEVELS } from '../levels';
import { SelfTestResult } from '../utils/matchEngine';

interface Props {
  highScores: HighScore[];
  unlockedLevel: number;
  onStart: (level: number) => void;
  onShowHowToPlay: () => void;
  selfTest?: SelfTestResult | null;
}

export function StartScreen({ highScores, unlockedLevel, onStart, onShowHowToPlay, selfTest }: Props) {
  const best = highScores[0]?.score ?? 0;
  const next = Math.min(unlockedLevel, LEVELS.length - 1);

  return (
    <div className="menu">
      <div className="menu__crt" aria-hidden="true" />

      <div className="menu__inner">
        <header className="arcade-box">
          <p className="arcade-box__eyebrow">★ CONTROL DE REALIZACIÓN · CONSOLA 16-BIT ★</p>
          <h1 className="arcade-title">
            <span className="arcade-title__cam">CAM</span>
            <span className="arcade-title__soccer">SOCCER</span>
          </h1>
          <p className="arcade-box__tag">EL JUEGO DEL REALIZADOR DE TV</p>
          <p className="press-start">▶ ELIGE UN PARTIDO Y SALE AL AIRE ◀</p>
        </header>

        <div className="menu__stats">
          <div className="arcade-pill">
            <span>HI-SCORE</span>
            <b>{best.toLocaleString()}</b>
          </div>
          <div className="arcade-pill">
            <span>PISTAS</span>
            <b>{unlockedLevel + 1}/{LEVELS.length}</b>
          </div>
        </div>

        <section className="menu__levels">
          <h2 className="arcade-heading">— SELECCIONA TU PARTIDO —</h2>
          <div className="level-list">
            {LEVELS.map((level, index) => {
              const unlocked = index <= unlockedLevel;
              const recommended = unlocked && index === next;
              return (
                <button
                  key={level.name}
                  className={`level-card ${unlocked ? '' : 'is-locked'} ${recommended ? 'is-recommended' : ''}`}
                  style={{ ['--accent' as string]: level.color }}
                  onClick={() => unlocked && onStart(index)}
                  disabled={!unlocked}
                >
                  <span className="level-card__icon">{unlocked ? level.icon : '🔒'}</span>
                  <span className="level-card__body">
                    <span className="level-card__top">
                      <span className="level-card__name">{String(index + 1).padStart(2, '0')} · {level.name}</span>
                      {recommended && <span className="level-card__badge">▶</span>}
                    </span>
                    <span className="level-card__desc">
                      {unlocked ? level.tagline : 'Consigue 700 pts en el anterior'}
                    </span>
                  </span>
                  <span className="level-card__meta">
                    <span className="level-card__time">{level.duration} s</span>
                    <span className="level-card__time">BR {level.cups.bronze.toLocaleString()}</span>
                    <span className="level-card__dots">
                      {[0, 1, 2, 3, 4].map(d => (
                        <i key={d} className={d <= index ? 'is-on' : ''} />
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {highScores.length > 0 && (
          <section className="menu__records">
            <h2 className="arcade-heading">— TOP SCORES —</h2>
            <ol className="record-list">
              {highScores.slice(0, 3).map((hs, i) => (
                <li key={`${hs.score}-${i}`} className={`record record--${i + 1}`}>
                  <span className="record__pos">{i + 1}</span>
                  <span className="record__score">{hs.score.toLocaleString()}</span>
                  <span className="record__level">{hs.level}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="menu__footer">
          <button className="ghost-btn" onClick={onShowHowToPlay}>▶ MANUAL DEL REALIZADOR</button>
        </div>

        {selfTest && (
          <p className={`selftest ${selfTest.ok ? 'is-ok' : 'is-fail'}`}>
            {selfTest.ok ? '✓' : '✗'} MOTOR {selfTest.seconds}s · {selfTest.goals} GOLES · BLOQUEO MÁX{' '}
            {(selfTest.maxBallIdleMs / 1000).toFixed(1)}s
          </p>
        )}
        <p className="menu__copy">© 16-BIT BROADCAST STUDIO · SIN COIN-OP</p>
      </div>
    </div>
  );
}

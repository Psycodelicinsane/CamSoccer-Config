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
        <header className="title-hero">
          <div className="title-hero__topline"><span className="title-live-dot" /> ESTUDIO DEPORTIVO // CANAL 01 <b>EN DIRECTO</b></div>
          <div className="title-hero__brand">CONTROL DE REALIZACIÓN</div>
          <h1 className="title-hero__title"><span>CAM</span><strong>SOCCER</strong></h1>
          <div className="title-hero__rule"><i /><span>DIRECTOR DE FÚTBOL EN 16-BIT</span><i /></div>
          <p className="title-hero__pitch">TÚ ELIGES EL PLANO. LA AFICIÓN DECIDE SI SIGUE MIRANDO.</p>
          <div className="title-hero__keys"><span>MAPA</span><b>ENCUADRA</b><span>CAPTURA</span><b>REPITE</b></div>
          <p className="press-start">▶ ELIGE UN PARTIDO Y SALE AL AIRE ◀</p>
        </header>

        <section className="menu__stats title-stats" aria-label="Estadísticas">
          <div className="arcade-pill"><span>MEJOR MARCA</span><b>{best.toLocaleString('es-ES')}</b></div>
          <div className="arcade-pill"><span>PARTIDOS ABIERTOS</span><b>{unlockedLevel + 1} / {LEVELS.length}</b></div>
        </section>

        <section className="menu__levels title-section">
          <div className="title-section__heading"><span>01</span><h2>SELECCIONA EL PARTIDO</h2><span>LIVE</span></div>
          <div className="level-list">
            {LEVELS.map((level, index) => {
              const unlocked = index <= unlockedLevel;
              const recommended = unlocked && index === next;
              return (
                <button key={level.name} className={`level-card ${unlocked ? '' : 'is-locked'} ${recommended ? 'is-recommended' : ''}`} style={{ ['--accent' as string]: level.color }} onClick={() => unlocked && onStart(index)} disabled={!unlocked}>
                  <span className="level-card__icon">{unlocked ? level.icon : '🔒'}</span>
                  <span className="level-card__body">
                    <span className="level-card__top"><span className="level-card__name">{String(index + 1).padStart(2, '0')} · {level.name}</span>{recommended && <span className="level-card__badge">AL AIRE</span>}</span>
                    <span className="level-card__desc">{unlocked ? level.tagline : `Consigue ${LEVELS[index - 1].cups.bronze.toLocaleString('es-ES')} pts en el anterior`}</span>
                  </span>
                  <span className="level-card__meta"><span className="level-card__time">{level.duration} SEG</span><span className="level-card__time">BR {level.cups.bronze.toLocaleString('es-ES')}</span><span className="level-card__dots">{[0, 1, 2, 3, 4].map(d => <i key={d} className={d <= index ? 'is-on' : ''} />)}</span></span>
                </button>
              );
            })}
          </div>
        </section>

        {highScores.length > 0 && <section className="menu__records title-section"><div className="title-section__heading"><span>02</span><h2>ARCHIVO DE EMISIONES</h2><span>TOP 3</span></div><ol className="record-list">{highScores.slice(0, 3).map((hs, i) => <li key={`${hs.score}-${i}`} className={`record record--${i + 1}`}><span className="record__pos">0{i + 1}</span><span className="record__score">{hs.score.toLocaleString('es-ES')}</span><span className="record__level">{hs.level}</span></li>)}</ol></section>}

        <div className="menu__footer"><button className="ghost-btn" onClick={onShowHowToPlay}>▶ ABRIR MANUAL DEL REALIZADOR</button></div>
        {selfTest && !selfTest.ok && <p className="selftest is-fail">⚠ EL MOTOR DEL PARTIDO NECESITA REINICIARSE</p>}
        <p className="menu__copy">CAMSOCCER BROADCAST SYSTEM · 1986—2026</p>
      </div>
    </div>
  );
}

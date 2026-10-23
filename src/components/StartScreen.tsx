import { useMemo, useState } from 'react';
import {
  ArrowRight, Award, BookOpen, Camera, Check, ChevronRight, Clock3, Coins,
  Crosshair, Focus, Gamepad2, LockKeyhole, Maximize2, Medal, Play, Radio,
  RotateCcw, ShieldCheck, Sparkles, Star, Trophy, Vibrate, Video, Volume2,
  VolumeX, X, Zap,
} from 'lucide-react';
import { ARCADE_LEVELS, ARCADE_SCORE_MULTIPLIER, CUP_ROUND_RULES, CUP_ROUNDS, DIFFICULTY_PRESETS, LEVELS } from '../levels';
import { UPGRADES, directorRank, upgradeCost } from '../progression';
import { GameMode, HighScore, PlayerProfile, UpgradeKey } from '../types';
import { SelfTestResult } from '../utils/matchEngine';
import { LevelIcon } from './LevelIcon';
import { PracticePreview } from './PracticePreview';

interface Props {
  highScores: HighScore[];
  unlockedLevel: number;
  profile: PlayerProfile;
  onStart: (level: number, mode: GameMode) => void;
  onShowHowToPlay: () => void;
  onBuyUpgrade: (key: UpgradeKey) => void;
  selfTest?: SelfTestResult | null;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onFullscreen: () => void;
}

type Selection = { level: number; mode: GameMode } | null;

const modeLabels: Record<GameMode, string> = {
  career: 'Carrera', cup: 'Copa Broadcast', arcade: 'Arcade',
};

const medalLabel = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' } as const;
const multiplierLabel = (value: number) => `×${value.toFixed(2).replace('.', ',')}`;

export function StartScreen({
  highScores, unlockedLevel, profile, onStart, onShowHowToPlay, onBuyUpgrade,
  selfTest, soundEnabled, hapticsEnabled, onToggleSound, onToggleHaptics, onFullscreen,
}: Props) {
  const [mode, setMode] = useState<GameMode>(() => {
    const requested = new URLSearchParams(window.location.search).get('mode');
    return requested === 'arcade' || requested === 'cup' ? requested : 'career';
  });
  const [selected, setSelected] = useState<Selection>(null);
  const best = highScores[0]?.score ?? 0;
  const next = Math.min(unlockedLevel, LEVELS.length - 1);
  const rank = directorRank(profile.xp);
  const selectedLevel = selected ? [...LEVELS, ...ARCADE_LEVELS][selected.level] : null;
  const briefingRule = selected?.mode === 'arcade'
    ? 'Sin eliminación por audiencia: cada recuperación de señal resta hasta 250 puntos.'
    : selected?.mode === 'cup'
    ? 'Cada ronda de Copa empieza con 3 cargas de ¡TOMA! y conserva el total del torneo.'
    : selectedLevel?.difficulty === 1
    ? 'Empiezas con 85% de audiencia y una única segunda oportunidad.'
    : null;
  const medalsWon = useMemo(() => Object.keys(profile.medals).length, [profile.medals]);

  const openBriefing = (level: number, gameMode: GameMode) => setSelected({ level, mode: gameMode });

  return (
    <div className="menu">
      <div className="menu__ambient" aria-hidden="true" />
      <header className="menu-nav">
        <div className="brand-lockup">
          <span className="brand-lockup__mark"><Camera size={22} strokeWidth={2.4} /></span>
          <span><b>CAMSOCCER</b><small>BROADCAST CLUB</small></span>
        </div>
        <div className="menu-nav__actions">
          <div className="wallet" title="Monedas de producción"><Coins size={16} /><b>{profile.credits.toLocaleString('es-ES')}</b></div>
          <button className="icon-button" onClick={onToggleSound} aria-label={soundEnabled ? 'Silenciar' : 'Activar sonido'}>{soundEnabled ? <Volume2 /> : <VolumeX />}</button>
          <button className={`icon-button ${hapticsEnabled ? 'is-active' : ''}`} onClick={onToggleHaptics} aria-label="Vibración"><Vibrate /></button>
          <button className="icon-button fullscreen-button" onClick={onFullscreen} aria-label="Pantalla completa"><Maximize2 /></button>
        </div>
      </header>

      <main className="menu__inner">
        <section className="menu-hero">
          <div className="menu-hero__copy">
            <div className="eyebrow"><Radio size={14} /> EL FÚTBOL SE VE DISTINTO DESDE AQUÍ</div>
            <h1>Tú no juegas<br />el partido.<br /><em>Tú haces historia.</em></h1>
            <p>Persigue la jugada, domina el encuadre y convierte cada momento en un directo inolvidable.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => openBriefing(next, 'career')}><Play size={18} fill="currentColor" /> Continuar carrera <ArrowRight size={17} /></button>
              <button className="secondary-button" onClick={onShowHowToPlay}><BookOpen size={17} /> Cómo jugar</button>
            </div>
            <div className="director-progress">
              <div className="director-progress__rank"><span>DIRECTOR NIVEL {rank.level}</span><b>{Math.round(rank.progress * 100)}%</b></div>
              <div className="progress-track"><i style={{ width: `${rank.progress * 100}%` }} /></div>
              <small>{rank.current.toLocaleString('es-ES')} / {rank.needed.toLocaleString('es-ES')} XP para el siguiente nivel</small>
            </div>
          </div>
          <PracticePreview />
        </section>

        <section className="mode-deck">
          <div className="section-heading">
            <div><span className="section-kicker">CENTRO DE EMISIONES</span><h2>Elige tu próximo directo</h2></div>
            <span className="profile-chip"><Award size={15} /> {medalsWon} medallas</span>
          </div>
          <div className="mode-tabs" role="tablist" aria-label="Modos de juego">
            <button role="tab" aria-selected={mode === 'career'} className={mode === 'career' ? 'is-active' : ''} onClick={() => setMode('career')}><Video size={17} /><span>Carrera<small>5 estadios</small></span></button>
            <button role="tab" aria-selected={mode === 'cup'} className={mode === 'cup' ? 'is-active' : ''} onClick={() => setMode('cup')}><Trophy size={17} /><span>Copa<small>3 eliminatorias</small></span></button>
            <button role="tab" aria-selected={mode === 'arcade'} className={mode === 'arcade' ? 'is-active' : ''} onClick={() => setMode('arcade')}><Zap size={17} /><span>Arcade<small>Récords rápidos</small></span></button>
          </div>

          <div className="mode-content">
            {mode === 'career' && (
              <div className="level-list">
                {LEVELS.map((level, index) => {
                  const unlocked = index <= unlockedLevel;
                  const recommended = unlocked && index === next;
                  const medal = profile.medals[level.id];
                  return (
                    <button key={level.id} className={`level-card ${recommended ? 'is-recommended' : ''}`} style={{ '--accent': level.color } as React.CSSProperties} onClick={() => unlocked && openBriefing(index, 'career')} disabled={!unlocked}>
                      <span className="level-card__number">{unlocked ? String(index + 1).padStart(2, '0') : <LockKeyhole size={17} />}</span>
                      <span className="level-card__body"><span className="level-card__name">{level.name}{recommended && <i>SIGUIENTE</i>}</span><span className="level-card__desc">{unlocked ? `${DIFFICULTY_PRESETS[level.difficulty].label} · ${level.tagline}` : `Consigue bronce en ${LEVELS[index - 1].name}`}</span></span>
                      <span className="level-card__meta"><span><Clock3 size={12} /> {level.duration}s</span>{medal ? <b className={`medal medal--${medal}`}><Medal size={14} /> {medalLabel[medal]}</b> : <small>BR {level.cups.bronze.toLocaleString('es-ES')}</small>}</span>
                      <ChevronRight className="level-card__arrow" size={18} />
                    </button>
                  );
                })}
              </div>
            )}

            {mode === 'cup' && (
              <div className="cup-deck">
                <div className="cup-deck__trophy"><Trophy size={62} strokeWidth={1.3} /><span><Sparkles size={18} /></span></div>
                <span className="section-kicker">TORNEO DE TRES PARTIDOS</span>
                <h3>Copa Broadcast</h3>
                <p>Supera el bronce en cada eliminatoria. La dificultad y los puntos suben por ronda; si fallas, repites esa ronda.</p>
                <div className="cup-rounds">
                  {CUP_ROUNDS.map((levelIndex, index) => <div key={levelIndex} title={CUP_ROUND_RULES[index].label}><span>{index + 1}</span><b>{['Clasificatorio', 'Semifinal', 'Final'][index]}</b><small>{LEVELS[levelIndex].name}</small><small>{DIFFICULTY_PRESETS[LEVELS[levelIndex].difficulty].label} · {multiplierLabel(CUP_ROUND_RULES[index].score)}</small></div>)}
                </div>
                <div className="cup-prize"><Trophy size={18} /><span>Premio de campeón</span><b>+300 monedas · +250 XP</b></div>
                <button className="primary-button" onClick={() => openBriefing(CUP_ROUNDS[0], 'cup')}><Trophy size={18} /> Comenzar copa <ArrowRight size={17} /></button>
              </div>
            )}

            {mode === 'arcade' && (
              <div className="level-list">
                <div className="mode-notice"><Zap size={16} /><span>Puntuación <b>{multiplierLabel(ARCADE_SCORE_MULTIPLIER)}</b>. Si la audiencia llega a cero, pierdes hasta 250 puntos pero la partida continúa.</span></div>
                {ARCADE_LEVELS.map((level, index) => {
                  const required = [0, 1, 3][index];
                  const unlocked = unlockedLevel >= required;
                  const globalIndex = LEVELS.length + index;
                  const medal = profile.medals[level.id];
                  return (
                    <button key={level.id} className="level-card arcade-card" style={{ '--accent': level.color } as React.CSSProperties} onClick={() => unlocked && openBriefing(globalIndex, 'arcade')} disabled={!unlocked}>
                      <span className="level-card__number">{unlocked ? <LevelIcon levelId={level.id} size={20} /> : <LockKeyhole size={17} />}</span>
                      <span className="level-card__body"><span className="level-card__name">{level.name}</span><span className="level-card__desc">{unlocked ? `${DIFFICULTY_PRESETS[level.difficulty].label} · ${level.tagline}` : `Desbloquea el estadio ${required + 1} de la carrera`}</span></span>
                      <span className="level-card__meta"><span><Clock3 size={12} /> {level.duration}s</span>{medal ? <b className={`medal medal--${medal}`}><Medal size={14} /> {medalLabel[medal]}</b> : <small>RÉCORD LOCAL</small>}</span>
                      <ChevronRight className="level-card__arrow" size={18} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="studio-grid">
          <div className="upgrade-panel">
            <div className="section-heading section-heading--small"><div><span className="section-kicker">TU EQUIPO</span><h2>Mejoras de producción</h2></div><span className="wallet wallet--large"><Coins size={16} /> {profile.credits.toLocaleString('es-ES')}</span></div>
            <p className="panel-intro">Invierte lo ganado en cada directo. Son mejoras permanentes y moderadas: puedes conseguir medallas sin comprarlas.</p>
            <div className="upgrade-list">
              {UPGRADES.map((upgrade, index) => {
                const level = profile.upgrades[upgrade.key];
                const cost = upgradeCost(profile, upgrade.key);
                const Icon = [Crosshair, Focus, RotateCcw][index];
                return (
                  <div className="upgrade-row" key={upgrade.key}>
                    <span className="upgrade-row__icon"><Icon size={21} /></span>
                    <div className="upgrade-row__copy"><b>{upgrade.shortName}</b><small>{upgrade.description}</small><span className="upgrade-pips">{[0, 1, 2].map(i => <i key={i} className={i < level ? 'is-on' : ''} />)}</span></div>
                    <button onClick={() => onBuyUpgrade(upgrade.key)} disabled={cost == null || profile.credits < cost} aria-label={cost == null ? `${upgrade.shortName} al máximo` : `Mejorar ${upgrade.shortName} por ${cost} monedas`}>
                      {cost == null ? <><Check size={14} /> MÁX.</> : <><Coins size={13} /> {cost}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="records-panel">
            <div className="section-heading section-heading--small"><div><span className="section-kicker">TU ARCHIVO</span><h2>Mejores emisiones</h2></div><Star size={20} /></div>
            <div className="profile-stats"><div><b>{best.toLocaleString('es-ES')}</b><span>Mejor marca</span></div><div><b>{profile.captures.toLocaleString('es-ES')}</b><span>Planos</span></div><div><b>{profile.cupsWon}</b><span>Copas</span></div></div>
            {highScores.length ? <ol className="record-list">{highScores.slice(0, 4).map((hs, index) => <li key={`${hs.date}-${hs.score}-${index}`}><span className={`record-position record-position--${index + 1}`}>{index + 1}</span><div><b>{hs.level}</b><small>{hs.date}{hs.mode ? ` · ${modeLabels[hs.mode]}` : ''}</small></div><strong>{hs.score.toLocaleString('es-ES')}</strong></li>)}</ol> : <div className="empty-records"><Gamepad2 size={28} /><b>Tu primera gran emisión empieza aquí</b><span>Completa un partido para llenar el archivo.</span></div>}
          </div>
        </section>

        <footer className="menu-footer"><span><ShieldCheck size={14} /> Progreso guardado en este dispositivo</span><span>SIN ANUNCIOS · OFFLINE · ANDROID</span></footer>
        {selfTest && !selfTest.ok && <p className="selftest is-fail">El motor no superó la comprobación. Reinicia la aplicación.</p>}
      </main>

      {selected && selectedLevel && (
        <div className="briefing-overlay" onClick={() => setSelected(null)}>
          <div className="briefing-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="briefing-title">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
            <div className="briefing-modal__visual" style={{ '--accent': selectedLevel.color } as React.CSSProperties}><span><LevelIcon levelId={selectedLevel.id} size={25} /></span><div><small>{modeLabels[selected.mode]}</small><b>{selected.mode === 'cup' ? 'ELIMINATORIA 1 / 3' : selected.mode === 'arcade' ? 'PARTIDA DE PUNTUACIÓN' : `ESTADIO ${selected.level + 1} / ${LEVELS.length}`}</b></div></div>
            <span className="section-kicker">PRÓXIMA EMISIÓN</span>
            <h2 id="briefing-title">{selectedLevel.name}</h2>
            <p>{selectedLevel.tagline}</p>
            <div className="briefing-objective"><Crosshair size={23} /><div><b>Consigue la medalla de bronce</b><span>Mantén la audiencia y alcanza {selectedLevel.cups.bronze.toLocaleString('es-ES')} puntos antes del final.</span></div></div>
            {briefingRule && <div className="mode-notice"><ShieldCheck size={16} /><span>{briefingRule}</span></div>}
            <div className="briefing-medals"><div><Medal size={17} /><span>Bronce</span><b>{selectedLevel.cups.bronze.toLocaleString('es-ES')}</b></div><div><Medal size={17} /><span>Plata</span><b>{selectedLevel.cups.silver.toLocaleString('es-ES')}</b></div><div><Medal size={17} /><span>Oro</span><b>{selectedLevel.cups.gold.toLocaleString('es-ES')}</b></div></div>
            <div className="briefing-controls"><span><Gamepad2 size={15} /> Toca el mapa para mover la cámara</span><span><Focus size={15} /> Mantén el plano para capturarlo</span><span><RotateCcw size={15} /> Pulsa ¡TOMA! cuando se ilumine</span></div>
            <button className="primary-button primary-button--wide" onClick={() => { onStart(selected.level, selected.mode); setSelected(null); }}><Radio size={18} /> Salir al aire <ArrowRight size={18} /></button>
            <small className="briefing-duration"><Clock3 size={13} /> Dificultad: {DIFFICULTY_PRESETS[selectedLevel.difficulty].label} · Duración: {selectedLevel.duration}s · Pausa automática al cambiar de app</small>
          </div>
        </div>
      )}
    </div>
  );
}

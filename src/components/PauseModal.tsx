import { Home, Pause, Play, RotateCcw } from 'lucide-react';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseModal({ onResume, onRestart, onQuit }: Props) {
  return (
    <div className="pause-modal-overlay">
      <div className="pause-modal" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div className="pause-modal__icon"><Pause /></div>
        <span className="section-kicker">CONTROL DE EMISIÓN</span>
        <h2 id="pause-title">Señal en pausa</h2>
        <p>El reloj y el partido están detenidos. Tu audiencia te espera.</p>
        <div className="pause-buttons">
          <button className="primary-button primary-button--wide" onClick={onResume}><Play size={18} fill="currentColor" /> Volver al directo</button>
          <button className="secondary-button" onClick={onRestart}><RotateCcw size={17} /> Reiniciar partido</button>
          <button className="text-button" onClick={onQuit}><Home size={16} /> Abandonar y volver al estudio</button>
        </div>
        <small className="pause-shortcut">Pulsa ESC para continuar</small>
      </div>
    </div>
  );
}

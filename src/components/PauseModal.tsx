interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseModal({ onResume, onRestart, onQuit }: Props) {
  return (
    <div className="pause-modal-overlay">
      <div className="pause-modal">
        <div className="pause-icon">⏸️</div>
        <h2>PAUSA</h2>
        <p>¿Qué quieres hacer?</p>
        
        <div className="pause-buttons">
          <button className="pause-btn-primary" onClick={onResume}>
            ▶️ Reanudar
          </button>
          <button className="pause-btn-secondary" onClick={onRestart}>
            🔄 Reiniciar
          </button>
          <button className="pause-btn-tertiary" onClick={onQuit}>
            🏠 Menú
          </button>
        </div>
      </div>
    </div>
  );
}

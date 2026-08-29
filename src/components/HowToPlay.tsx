interface Props {
  onClose: () => void;
}

export function HowToPlay({ onClose }: Props) {
  return (
    <div className="howtoplay-overlay" onClick={onClose}>
      <div className="howtoplay-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <h2>Cómo se juega a CamSoccer</h2>
        
        <div className="instructions">
          <section className="instruction-section">
            <h3>🎯 Objetivo</h3>
            <p>
              Eres el <strong>realizador de televisión</strong> de un partido simulado en estilo SNES.
              Los jugadores son pequeños, se mueven con lógica de partido, pasan, roban y chutan.
              Tu trabajo es encuadrar lo que saldría por televisión.
            </p>
          </section>

          <section className="instruction-section">
            <h3>📺 Qué Debes Enfocar</h3>
            <ul className="event-list">
              <li>
                <span className="event-icon">⚽</span>
                <span><strong>Balón y poseedor</strong> - La base de la retransmisión</span>
              </li>
              <li>
                <span className="event-icon">🎯</span>
                <span><strong>Pases y disparos</strong> - Sube audiencia rápido</span>
              </li>
              <li>
                <span className="event-icon">🥅</span>
                <span><strong>¡¡GOL!!</strong> - ¡Máxima prioridad!</span>
              </li>
              <li>
                <span className="event-icon">😤</span>
                <span><strong>Entrenadores</strong> - Reacciones fuera de la jugada</span>
              </li>
              <li className="rare">
                <span className="event-icon">🏃</span>
                <span><strong>¡INTRUSO!</strong> - ¡Aparece brevemente! (Raro)</span>
              </li>
              <li className="rare">
                <span className="event-icon">🐕</span>
                <span><strong>¡Perro!</strong> - ¡Captúralo rápido! (Raro)</span>
              </li>
              <li className="rare">
                <span className="event-icon">👊</span>
                <span><strong>¡Pelea!</strong> - Drama total (Raro)</span>
              </li>
            </ul>
          </section>

          <section className="instruction-section">
            <h3>🎥 Tres zonas de trabajo</h3>
            <ul className="event-list">
              <li><span className="event-icon">📺</span><span><strong>ARRIBA · SEÑAL</strong>: es lo que está grabando tu cámara y lo que ve la audiencia. Aquí disfrutas las animaciones de cerca; no se controla</span></li>
              <li><span className="event-icon">🗺️</span><span><strong>MEDIO · MAPA</strong>: toca o arrastra sobre el campo para mover el recuadro de cámara</span></li>
              <li><span className="event-icon">🕹️</span><span><strong>ABAJO · PRECISIÓN</strong>: usa la palanca para centrar y seguir la acción sin saltos</span></li>
            </ul>
          </section>

          <section className="instruction-section">
            <h3>🎮 Controles</h3>
            <div className="controls-grid">
              <div className="control-item">
                <span className="key">WASD</span>
                <span>Mover encuadre</span>
              </div>
              <div className="control-item">
                <span className="key">Flechas</span>
                <span>Mover encuadre</span>
              </div>
              <div className="control-item">
                <span className="key">ESPACIO</span>
                <span>¡TOMA! repetición</span>
              </div>
              <div className="control-item">
                <span className="key">ESC</span>
                <span>Pausar</span>
              </div>
            </div>
            <p className="touch-hint">
              <strong>📱 Táctil:</strong> Toca o arrastra el mapa · usa la palanca inferior para afinar
            </p>
          </section>

          <section className="instruction-section">
            <h3>⭐ ¡TOMA! — tu jugada maestra</h3>
            <p>
              Mantén un momento interesante <strong>bien centrado</strong> hasta completar el círculo de captura.
              Cuando se ilumine <strong>¡TOMA!</strong>, pulsa <span className="key">ESPACIO</span> para cortar a
              repetición y llevarte un <strong>bonus enorme</strong>. Cada jugada admite una sola repetición:
              si cortas antes de consolidar el plano, pierdes la carga y audiencia.
            </p>
          </section>

          <section className="instruction-section">
            <h3>🎯 Encuadre</h3>
            <p>
              No basta con que la acción esté en el recuadro: cuanto más <strong>centrada</strong> esté, más puntúas.
              Si la clavas en el centro consigues un <strong>PLANO DE ORO</strong> y el retículo se vuelve dorado.
            </p>
          </section>

          <section className="instruction-section">
            <h3>🥅 Disparos y goles = lo más rentable</h3>
            <p>
              Los jugadores atacan por las <strong>bandas</strong> y hacen <strong>centros al área</strong>. Cada partido
              tiene muchos <strong>tiros a puerta</strong>: si los grabas bien dan muchísimos puntos, y un{' '}
              <strong>GOL</strong> es imprescindible. ¡No te los pierdas o la audiencia se va!
            </p>
          </section>

          <section className="instruction-section">
            <h3>💡 Consejos</h3>
            <ul className="tips-list">
              <li>• Hay <strong>gradas en los 4 lados</strong>: puedes girar la cámara al norte, sur, este u oeste para grabar al público</li>
              <li>• El <strong>mapa</strong> es un teletransporte: toca para saltar a cualquier zona al instante</li>
              <li>• Si aparece una <strong>flecha de color</strong> sobre el campo, ¡ve hacia ella!</li>
              <li>• Un <strong>círculo que se cierra</strong> avisa de que algo va a pasar ahí: llega antes</li>
              <li>• Seguir el <strong>balón</strong> mantiene segura la retransmisión y la audiencia</li>
              <li>• Perros, peleas y banquillos son <strong>oportunidades de bonus</strong>: decide si compensa abandonar la jugada</li>
              <li>• Encadena capturas para subir la <strong>racha</strong> y el multiplicador</li>
            </ul>
          </section>
        </div>

        <button className="got-it-btn" onClick={onClose}>
          ¡Entendido! 📺
        </button>
      </div>
    </div>
  );
}

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
              <li><span className="event-icon">📺</span><span><strong>ARRIBA · ZOOM</strong>: el plano cercano que sale al aire. Aquí ves caras, el balón y las gradas</span></li>
              <li><span className="event-icon">🗺️</span><span><strong>MEDIO · MAPA</strong>: toca cualquier zona y la cámara viaja allí al instante</span></li>
              <li><span className="event-icon">🕹️</span><span><strong>ABAJO · JOYSTICK</strong>: arrastra para mover la cámara con precisión (funciona a la vez que el mapa)</span></li>
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
              <strong>📱 Táctil:</strong> Arrastra sobre el campo para mover el encuadre · toca el mapa para saltar
            </p>
          </section>

          <section className="instruction-section">
            <h3>⭐ ¡TOMA! — tu jugada maestra</h3>
            <p>
              Cuando tengas un buen momento <strong>bien centrado</strong>, pulsa <span className="key">ESPACIO</span>{' '}
              (o el botón <strong>¡TOMA!</strong>) para cortar a repetición a cámara lenta y llevarte un{' '}
              <strong>bonus enorme</strong>. Si cortas sin nada bueno en pantalla, pierdes la carga y audiencia.
              Las cargas se recargan solas.
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
              <li>• Encadena capturas para subir la <strong>racha</strong> y el multiplicador</li>
              <li>• No grabar lo importante <strong>penaliza fuerte</strong>: pierdes audiencia y puntos</li>
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

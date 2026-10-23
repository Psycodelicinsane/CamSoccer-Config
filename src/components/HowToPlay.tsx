import { Camera, Check, Crosshair, Focus, Gamepad2, Minus, MousePointer2, Plus, RotateCcw, Trophy, X, Zap } from 'lucide-react';

interface Props { onClose: () => void; }

export function HowToPlay({ onClose }: Props) {
  return (
    <div className="howtoplay-overlay" onClick={onClose}>
      <div className="howtoplay-modal" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="how-title">
        <button className="modal-close" onClick={onClose} aria-label="Cerrar manual"><X /></button>
        <span className="section-kicker">MANUAL DEL REALIZADOR</span>
        <h2 id="how-title">Tres gestos. Un gran directo.</h2>
        <p className="how-intro">No controlas a los futbolistas: controlas lo que ven millones de personas. Practica primero con la cámara interactiva de la portada —sin reloj ni puntuación— y luego sigue la acción sin dejar caer la audiencia. Si pierdes la señal, la grada se vacía y el público abuchea; vuelve al balón para recuperarla.</p>
        <div className="how-steps">
          <section><span className="how-step__number">01</span><div className="how-step__icon"><MousePointer2 /></div><div><h3>Busca la historia</h3><p>Toca o arrastra en el <b>mapa central</b> para desplazar el recuadro. El monitor superior muestra exactamente lo que sale al aire.</p></div></section>
          <section><span className="how-step__number">02</span><div className="how-step__icon"><Focus /></div><div><h3>Mantén el plano</h3><p>Centra el balón o un incidente. El círculo se llena al enfocar; al completarse sumas puntos y audiencia. En el centro conseguirás un <b>Plano de oro</b> y tu combo podrá llegar hasta ×4.</p></div></section>
          <section><span className="how-step__number">03</span><div className="how-step__icon"><RotateCcw /></div><div><h3>Corta a repetición</h3><p>Cuando <b>¡TOMA!</b> se ilumine, actívalo para una gran bonificación. Hacerlo antes de tiempo gasta una carga y rompe tu combo. Empiezas con 2 cargas (3 en Copa) y se regeneran.</p></div></section>
        </div>
        <div className="how-priority"><Zap size={18} /><div><b>Prioriza lo que no se repite</b><span>Goles, drones, mascotas, aspersores, bengalas e intrusos dan muchos más puntos. El balón es tu zona segura para recuperar audiencia.</span></div></div>
        <div className="how-controls">
          <h3><Gamepad2 size={17} /> Controles</h3>
          <div><span><b>WASD / Flechas</b>Mover cámara</span><span><b>Q / E</b>Alejar / acercar</span><span><b>Espacio</b>¡TOMA!</span><span><b>Esc</b>Pausa</span></div>
          <p><Camera size={15} /> En Android usa el mapa, el joystick inferior y los botones <Minus size={13} /> <Plus size={13} /> para el zoom. Puedes usar dos dedos en zonas distintas.</p>
        </div>
        <div className="how-modes"><div><Trophy size={18} /><span><b>Carrera y Copa</b>Consigue bronce para avanzar por cinco dificultades. El primer estadio tiene una segunda oportunidad; la Copa encadena tres rondas.</span></div><div><Crosshair size={18} /><span><b>Arcade</b>Partidas rápidas y puntuación ×1,15. Si la audiencia llega a cero pierdes puntos, pero el reto continúa.</span></div></div>
        <button className="primary-button primary-button--wide" onClick={onClose}><Check size={18} /> Entendido, al estudio</button>
      </div>
    </div>
  );
}

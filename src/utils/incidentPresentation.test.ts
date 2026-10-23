import { describe, expect, it } from 'vitest';
import { DOG_MAX_TILT, DOG_RENDER_SCALE, dogOrientation } from './incidentPresentation';

describe('orientación del perro', () => {
  it('usa espejo al cambiar de lado y nunca pone la cabeza boca abajo', () => {
    for (const [vx, vy] of [[8, 0], [-8, 0], [4, 8], [-4, 8], [4, -8], [-4, -8], [0, 10], [0, -10]]) {
      const pose = dogOrientation(vx, vy);
      expect(Math.abs(pose.rotation)).toBeLessThanOrEqual(DOG_MAX_TILT);
      // El vector vertical local siempre apunta hacia arriba en pantalla.
      expect(-Math.cos(pose.rotation)).toBeLessThan(0);
      if (vx !== 0) expect(pose.direction).toBe(Math.sign(vx));
    }
  });

  it('mantiene la cabeza señalando el lado y la vertical del desplazamiento', () => {
    for (const [vx, vy] of [[8, 3], [-8, 3], [8, -3], [-8, -3]]) {
      const { direction, rotation } = dogOrientation(vx, vy);
      const forwardX = Math.cos(rotation) * direction;
      const forwardY = Math.sin(rotation) * direction;
      expect(Math.sign(forwardX)).toBe(Math.sign(vx));
      expect(Math.sign(forwardY)).toBe(Math.sign(vy));
    }
  });

  it('reduce el tamaño de render sin cambiar la posición lógica del incidente', () => {
    expect(DOG_RENDER_SCALE).toBeGreaterThan(0.6);
    expect(DOG_RENDER_SCALE).toBeLessThan(0.8);
  });
});

import { describe, expect, it } from 'vitest';
import { STAND_MAX, STAND_MIN, clampCamera, fitField, fitWindow, frameBounds, framingQuality, mMap } from './camera';

describe('cámara compartida entre partida y práctica', () => {
  it('mantiene el encuadre máximo en el centro y reduce el área al acercar', () => {
    const camera = { x: 50, y: 50, zoom: 1 };
    const wide = frameBounds(camera);
    const close = frameBounds({ ...camera, zoom: 2 });
    expect(framingQuality({ x: 50, y: 50 }, camera)).toBe(1);
    expect(framingQuality({ x: 80, y: 80 }, camera)).toBe(0);
    expect(close.maxX - close.minX).toBeCloseTo((wide.maxX - wide.minX) / 2);
    expect(close.maxY - close.minY).toBeCloseTo((wide.maxY - wide.minY) / 2);
  });

  it('respeta los límites del estadio en todos los niveles de zoom', () => {
    [1, 1.5, 2].forEach(zoom => {
      const camera = clampCamera({ x: -999, y: 999, zoom });
      const bounds = frameBounds(camera);
      expect(bounds.minX).toBeGreaterThanOrEqual(STAND_MIN);
      expect(bounds.maxY).toBeLessThanOrEqual(STAND_MAX);
      expect(camera.zoom).toBe(zoom);
    });
  });

  it('proyecta el centro de la cámara al centro del monitor', () => {
    const inner = { x: 20, y: 10, w: 600, h: 300 };
    const camera = { x: 40, y: 55, zoom: 1.25 };
    const map = fitWindow(inner, camera);
    const center = mMap(map, camera.x, camera.y);
    expect(center.x).toBeCloseTo(inner.x + inner.w / 2);
    expect(center.y).toBeCloseTo(inner.y + inner.h / 2);
    expect(map.ppuX).toBeCloseTo(map.ppuY);
  });

  it('usa una proyección finita y centrada para el mapa táctico', () => {
    const inner = { x: 5, y: 5, w: 320, h: 160 };
    const map = fitField(inner);
    const center = mMap(map, 50, 50);
    expect(Number.isFinite(map.ppuX)).toBe(true);
    expect(Number.isFinite(map.ppuY)).toBe(true);
    expect(center.x).toBeGreaterThan(inner.x);
    expect(center.x).toBeLessThan(inner.x + inner.w);
    expect(center.y).toBeGreaterThan(inner.y);
    expect(center.y).toBeLessThan(inner.y + inner.h);
  });
});

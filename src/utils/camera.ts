export interface CameraState { x: number; y: number; zoom: number; }
export interface CameraRect { x: number; y: number; w: number; h: number; }
export interface FieldMap { ppuX: number; ppuY: number; ox: number; oy: number; }

export const FRAME_W = 19;
export const FRAME_H = 10.8;
export const TRACK = 7;
export const STAND_MIN = -20;
export const STAND_MAX = 120;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const frameSize = (camera: CameraState) => ({ w: FRAME_W / camera.zoom, h: FRAME_H / camera.zoom });

export const clampCamera = (camera: CameraState): CameraState => {
  const { w, h } = frameSize(camera);
  return {
    x: clamp(camera.x, STAND_MIN + w / 2, STAND_MAX - w / 2),
    y: clamp(camera.y, STAND_MIN + h / 2, STAND_MAX - h / 2),
    zoom: camera.zoom,
  };
};

export const frameBounds = (camera: CameraState) => {
  const { w, h } = frameSize(camera);
  return {
    minX: camera.x - w / 2, maxX: camera.x + w / 2,
    minY: camera.y - h / 2, maxY: camera.y + h / 2,
  };
};

export const inFrame = (target: { x: number; y: number }, camera: CameraState, pad = 0) => {
  const bounds = frameBounds(camera);
  return target.x >= bounds.minX + pad && target.x <= bounds.maxX - pad && target.y >= bounds.minY + pad && target.y <= bounds.maxY - pad;
};

export const framingQuality = (target: { x: number; y: number }, camera: CameraState) => {
  const { w, h } = frameSize(camera);
  const dx = (target.x - camera.x) / (w / 2);
  const dy = (target.y - camera.y) / (h / 2);
  return clamp(1 - Math.hypot(dx, dy) / 0.9, 0, 1);
};

export function fitWindow(inner: CameraRect, camera: CameraState): FieldMap {
  const { w, h } = frameSize(camera);
  const ppu = Math.min(inner.w / w, inner.h / h);
  const uW = ppu * w;
  const uH = ppu * h;
  const bx = inner.x + (inner.w - uW) / 2;
  const by = inner.y + (inner.h - uH) / 2;
  return {
    ppuX: ppu,
    ppuY: ppu,
    ox: bx - (camera.x - w / 2) * ppu,
    oy: by - (camera.y - h / 2) * ppu,
  };
}

export const mMap = (map: FieldMap, worldX: number, worldY: number) => ({
  x: map.ox + worldX * map.ppuX,
  y: map.oy + worldY * map.ppuY,
});

const FIELD_RATIO = 1.56;
const MAP_MIN_X = -22;
const MAP_MAX_X = 122;
const MAP_MIN_Y = -20;
const MAP_MAX_Y = 120;
const MAP_SPAN_X = MAP_MAX_X - MAP_MIN_X;
const MAP_SPAN_Y = MAP_MAX_Y - MAP_MIN_Y;

export function fitField(inner: CameraRect): FieldMap {
  let ppuY = inner.h / MAP_SPAN_Y;
  let ppuX = ppuY * FIELD_RATIO;
  if (ppuX * MAP_SPAN_X > inner.w) {
    ppuX = inner.w / MAP_SPAN_X;
    ppuY = ppuX / FIELD_RATIO;
  }
  const uW = ppuX * MAP_SPAN_X;
  const uH = ppuY * MAP_SPAN_Y;
  const cx = inner.x + (inner.w - uW) / 2;
  const cy = inner.y + (inner.h - uH) / 2;
  return {
    ppuX,
    ppuY,
    ox: cx - MAP_MIN_X * ppuX,
    oy: cy - MAP_MIN_Y * ppuY,
  };
}

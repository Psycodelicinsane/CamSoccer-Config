export const DOG_RENDER_SCALE = 0.72;
export const DOG_MAX_TILT = 0.48;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Orienta un animal de perfil sin rotarlo boca abajo. Al ir a la izquierda se
 * refleja horizontalmente y sólo se inclina lo suficiente para seguir su ruta.
 */
export function dogOrientation(vx = 0, vy = 0) {
  const direction = vx < 0 ? -1 : 1;
  const routeTilt = clamp(Math.atan2(vy, Math.abs(vx)), -DOG_MAX_TILT, DOG_MAX_TILT);
  return { direction, rotation: direction * routeTilt };
}

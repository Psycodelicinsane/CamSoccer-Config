import { CameraRect, FieldMap, STAND_MAX, STAND_MIN, TRACK, mMap } from './camera';
import { crowdOccupancy, spectatorPresent } from './crowd';

export interface StadiumColors {
  stands: string;
  trim: string;
}

const SHIRTS = ['#e7c85a', '#d75a5a', '#5aa9e7', '#3ddc97', '#c9d3da', '#ff9f43', '#9c6ade'];
const SKINS = ['#f0c199', '#d99b72', '#a96946', '#70432f'];
const HAIRS = ['#3a2416', '#20202a', '#5a3d1a', '#8a8f98'];

function drawSeat(ctx: CanvasRenderingContext2D, x: number, y: number, unit: number, index: number, simplified = false) {
  const color = index % 5 === 0 ? '#51333d' : index % 3 === 0 ? '#2e4556' : '#263747';
  if (simplified) {
    ctx.fillStyle = color;
    ctx.fillRect(x - unit * 0.44, y - unit * 0.18, unit * 0.88, unit * 0.55);
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath(); ctx.ellipse(x, y + unit * 0.62, unit * 0.52, unit * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x - unit * 0.47, y - unit * 0.23, unit * 0.94, unit * 0.66, unit * 0.12); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(x - unit * 0.38, y - unit * 0.16, unit * 0.76, Math.max(0.55, unit * 0.07));
}

function drawSpectator(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  unit: number,
  index: number,
  now: number,
  audience: number,
  simplified = false,
) {
  const shirt = SHIRTS[Math.abs(index) % SHIRTS.length];
  const skin = SKINS[Math.abs(index * 3) % SKINS.length];
  const hair = HAIRS[Math.abs(index * 7) % HAIRS.length];
  const wave = Math.sin(now * 0.0035 + x * 0.045 + index * 0.17);
  const cheering = audience >= 55 && wave > 0.35;
  const booing = audience < 40 && index % 3 !== 0;
  const agitation = booing ? Math.sin(now * 0.011 + index) * unit * 0.10 : 0;
  const lift = cheering ? Math.abs(Math.sin(now * 0.010 + index)) * unit * (simplified ? 0.20 : 0.35) : booing ? Math.abs(Math.sin(now * 0.007 + index)) * unit * 0.18 : 0;
  const y = baseY - lift;

  if (simplified) {
    // En el mapa táctico estas formas ocupan pocos píxeles. Conservamos color,
    // cabeza y estado de ánimo sin pagar por detalles que no pueden apreciarse.
    ctx.fillStyle = shirt;
    ctx.fillRect(x - unit * 0.39, y - unit * 0.36, unit * 0.78, unit * 0.69);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x, y - unit * 0.62, unit * 0.27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair;
    ctx.fillRect(x - unit * 0.25, y - unit * 0.86, unit * 0.50, unit * 0.16);
    if (cheering || booing) {
      ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(0.7, unit * 0.16); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - unit * 0.30, y - unit * 0.24); ctx.lineTo(x - unit * 0.58, y - unit * 0.84);
      ctx.moveTo(x + unit * 0.30, y - unit * 0.24); ctx.lineTo(x + unit * 0.58, y - unit * 0.84); ctx.stroke();
    }
    return;
  }

  // Piernas y zapatos, sentados o incorporándose con la ola.
  ctx.strokeStyle = '#182231'; ctx.lineWidth = Math.max(0.8, unit * 0.22); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - unit * 0.18, y + unit * 0.23); ctx.lineTo(x - unit * 0.22, y + unit * (cheering ? 0.76 : 0.61));
  ctx.moveTo(x + unit * 0.18, y + unit * 0.23); ctx.lineTo(x + unit * 0.22, y + unit * (cheering ? 0.76 : 0.61)); ctx.stroke();

  // Torso con hombros redondeados y sombreado lateral.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.roundRect(x - unit * 0.43, y - unit * 0.40, unit * 0.86, unit * 0.76, unit * 0.18); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.beginPath(); ctx.roundRect(x + unit * 0.19, y - unit * 0.35, unit * 0.22, unit * 0.64, unit * 0.08); ctx.fill();

  const arm = (ax: number, ay: number, bx: number, by: number, color: string, width = 0.18) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.75, unit * width); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  if (cheering) {
    arm(x - unit * 0.34, y - unit * 0.25, x - unit * 0.66, y - unit * 1.06, shirt, 0.22);
    arm(x + unit * 0.34, y - unit * 0.25, x + unit * 0.66, y - unit * 1.06, shirt, 0.22);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(x - unit * 0.66, y - unit * 1.08, unit * 0.12, 0, Math.PI * 2); ctx.arc(x + unit * 0.66, y - unit * 1.08, unit * 0.12, 0, Math.PI * 2); ctx.fill();
  } else if (booing) {
    // Brazos abiertos y puños agitados: la silueta del abucheo se lee incluso sin sonido.
    arm(x - unit * 0.34, y - unit * 0.23, x - unit * (0.76 + agitation / unit), y - unit * 0.68, shirt, 0.22);
    arm(x + unit * 0.34, y - unit * 0.23, x + unit * (0.76 - agitation / unit), y - unit * 0.68, shirt, 0.22);
    arm(x - unit * (0.76 + agitation / unit), y - unit * 0.68, x - unit * (0.82 + agitation / unit), y - unit * 0.93, skin, 0.15);
    arm(x + unit * (0.76 - agitation / unit), y - unit * 0.68, x + unit * (0.82 - agitation / unit), y - unit * 0.93, skin, 0.15);
  } else {
    arm(x - unit * 0.35, y - unit * 0.22, x - unit * 0.46, y + unit * 0.23, shirt, 0.20);
    arm(x + unit * 0.35, y - unit * 0.22, x + unit * 0.46, y + unit * 0.23, shirt, 0.20);
  }

  // Cabeza, pelo y expresión; el público deja de ser una cuadrícula de píxeles.
  const headY = y - unit * 0.68;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, headY, unit * 0.30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x, headY - unit * 0.03, unit * 0.31, Math.PI, Math.PI * 2); ctx.fill();
  if (unit > 4.2) {
    ctx.fillStyle = '#20232a';
    ctx.beginPath(); ctx.arc(x - unit * 0.10, headY, Math.max(0.55, unit * 0.035), 0, Math.PI * 2); ctx.arc(x + unit * 0.10, headY, Math.max(0.55, unit * 0.035), 0, Math.PI * 2); ctx.fill();
    if (booing) {
      ctx.fillStyle = '#672d35'; ctx.beginPath(); ctx.ellipse(x, headY + unit * 0.15, unit * 0.10, unit * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (index % 11 === 0 && unit > 3 && audience > 35) {
    const sway = Math.sin(now * 0.008 + index) * unit * 0.28;
    ctx.strokeStyle = SHIRTS[Math.abs(index + 3) % SHIRTS.length]; ctx.lineWidth = Math.max(1, unit * 0.16);
    ctx.beginPath(); ctx.moveTo(x - unit * 0.55, y - unit * 1.12); ctx.quadraticCurveTo(x + sway, y - unit * 1.30, x + unit * 0.62, y - unit * 1.10); ctx.stroke();
  }
}

export function drawCrowdStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  audience: number,
  seed = 0,
  vertical = false,
) {
  if (w < 2 || h < 2) return;
  ctx.fillStyle = '#141d2b'; ctx.fillRect(x, y, w, h);
  const length = vertical ? h : w;
  const cell = 5;
  const count = Math.floor(length / cell);
  for (let col = 0; col < count; col += 1) {
    const px = vertical ? x + w * 0.52 : x + col * cell + cell * 0.5;
    const py = vertical ? y + col * cell + cell * 0.68 : y + h * 0.72;
    const index = seed + col * 71;
    ctx.fillStyle = col % 3 === 0 ? '#334457' : '#293a4b';
    ctx.fillRect(px - 1.8, py - 1.2, 3.6, 2.6);
    if (!spectatorPresent(seed, 0, col, audience)) continue;
    const bob = audience < 35 ? Math.sin(now * 0.009 + col) * 0.45 : Math.sin(now * 0.006 + col * 0.7) > 0.55 ? -1 : 0;
    ctx.fillStyle = SHIRTS[Math.abs(index) % SHIRTS.length];
    ctx.beginPath(); ctx.roundRect(px - 1.8, py - 3.6 + bob, 3.6, 3.2, 0.8); ctx.fill();
    ctx.fillStyle = SKINS[Math.abs(index * 3) % SKINS.length];
    ctx.beginPath(); ctx.arc(px, py - 4.4 + bob, 1.35, 0, Math.PI * 2); ctx.fill();
    if (audience < 35 && col % 2 === 0) {
      ctx.strokeStyle = SKINS[Math.abs(index * 3) % SKINS.length]; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(px - 1.4, py - 3 + bob); ctx.lineTo(px - 2.6, py - 5.7 + bob); ctx.moveTo(px + 1.4, py - 3 + bob); ctx.lineTo(px + 2.6, py - 5.7 + bob); ctx.stroke();
    }
  }
}

export function drawStadium(
  ctx: CanvasRenderingContext2D,
  map: FieldMap,
  now: number,
  stadium: StadiumColors,
  audience = 100,
  clipRect?: CameraRect,
) {
  const fillCrowd = (rx: number, ry: number, rw: number, rh: number, seed: number) => {
    if (rw < 2 || rh < 2) return;
    const transform = ctx.getTransform();
    const viewW = ctx.canvas.width / (transform.a || 1);
    const viewH = ctx.canvas.height / (transform.d || 1);
    const clipX0 = clipRect?.x ?? 0, clipY0 = clipRect?.y ?? 0;
    const clipX1 = clipRect ? clipRect.x + clipRect.w : viewW;
    const clipY1 = clipRect ? clipRect.y + clipRect.h : viewH;
    const visibleX0 = Math.max(clipX0, rx), visibleY0 = Math.max(clipY0, ry);
    const visibleX1 = Math.min(viewW, clipX1, rx + rw), visibleY1 = Math.min(viewH, clipY1, ry + rh);
    if (visibleX1 - visibleX0 < 2 || visibleY1 - visibleY0 < 2) return;

    ctx.fillStyle = stadium.stands; ctx.fillRect(visibleX0, visibleY0, visibleX1 - visibleX0, visibleY1 - visibleY0);
    const unit = Math.max(2.2, map.ppuY * 1.15);
    const simplified = map.ppuY < 3.2;
    const stepX = unit * 1.80;
    const stepY = unit * (simplified ? 2.35 : 2.25);
    // Las filas se dimensionan por el espacio completo del espectador, no sólo
    // por su asiento: brazos y cabezas nunca terminan bajo la pista o la grada
    // contigua. Las bandas estrechas simplemente muestran menos localidades.
    const horizontalMargin = simplified ? 0.85 : 1.10;
    const firstRowOffset = simplified ? 1.35 : 1.65;
    const bottomSpace = 0.85;
    const availableRows = rh - unit * (firstRowOffset + bottomSpace);
    const cols = Math.max(0, Math.floor((rw - unit * horizontalMargin * 2) / stepX) + 1);
    const rows = availableRows < 0 ? 0 : Math.max(1, Math.round(availableRows / stepY) + 1);
    // Reparte el sobrante entre filas en lugar de dejar todo el hueco al final.
    // Así una franja estrecha de grada todavía puede contener gente completa.
    const rowSpacing = rows > 1 ? availableRows / (rows - 1) : stepY;
    ctx.save();
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.055)';
    const firstStep = Math.max(1, Math.floor((visibleY0 - ry) / rowSpacing));
    const lastStep = Math.min(rows, Math.ceil((visibleY1 - ry) / rowSpacing));
    for (let row = firstStep; row <= lastStep; row += 1) {
      const sy = ry + row * rowSpacing;
      ctx.fillRect(visibleX0, sy, visibleX1 - visibleX0, Math.max(0.6, unit * 0.08));
    }

    // Se calcula la rejilla completa y sólo se recorre su porción visible. Los
    // índices no dependen del recorte: cada persona conserva siempre su asiento.
    const rowStart = Math.max(0, Math.floor((visibleY0 - ry) / rowSpacing) - 1);
    const rowEnd = Math.min(rows, Math.ceil((visibleY1 - ry) / rowSpacing) + 1);
    const colStart = Math.max(0, Math.floor((visibleX0 - rx) / stepX) - 1);
    const colEnd = Math.min(cols, Math.ceil((visibleX1 - rx) / stepX) + 1);
    for (let row = rowStart; row < rowEnd; row += 1) {
      for (let col = colStart; col < colEnd; col += 1) {
        const index = seed + row * 131 + col * 71;
        const px = rx + unit * horizontalMargin + col * stepX + (row % 2) * unit * 0.30;
        const py = ry + unit * firstRowOffset + row * rowSpacing;
        if (px - unit * horizontalMargin < rx || px + unit * horizontalMargin > rx + rw) continue;
        if (py - unit * firstRowOffset < ry - 0.5 || py + unit * bottomSpace > ry + rh + 0.5) continue;
        // No dibujar medias personas en los bordes del monitor. Los asientos sí
        // pueden continuar fuera de plano, pero cada aficionado visible cabe entero.
        if (px - unit * horizontalMargin < visibleX0 - 0.5 || px + unit * horizontalMargin > visibleX1 + 0.5) continue;
        if (py - unit * firstRowOffset < visibleY0 - 0.5 || py + unit * bottomSpace > visibleY1 + 0.5) continue;
        drawSeat(ctx, px, py, unit, index, simplified);
        if (spectatorPresent(seed, row, col, audience)) drawSpectator(ctx, px, py, unit, index, now, audience, simplified);
      }
    }
    ctx.restore();
  };

  const band = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
    const a = mMap(map, x0, y0), b = mMap(map, x1, y1);
    fillCrowd(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y), seed);
  };
  band(STAND_MIN, STAND_MIN, STAND_MAX, -TRACK, 7);
  band(STAND_MIN, 100 + TRACK, STAND_MAX, STAND_MAX, 23);
  band(STAND_MIN, -TRACK, -TRACK, 100 + TRACK, 41);
  band(100 + TRACK, -TRACK, STAND_MAX, 100 + TRACK, 59);

  const isVisible = (x: number, y: number, w: number, h: number) => {
    const transform = ctx.getTransform();
    const viewW = ctx.canvas.width / (transform.a || 1);
    const viewH = ctx.canvas.height / (transform.d || 1);
    const x0 = clipRect?.x ?? 0, y0 = clipRect?.y ?? 0;
    const x1 = clipRect ? clipRect.x + clipRect.w : viewW;
    const y1 = clipRect ? clipRect.y + clipRect.h : viewH;
    return x + w >= x0 && y + h >= y0 && x <= x1 && y <= y1;
  };
  const supporterBanner = (wx: number, wy: number, ww: number, label: string, color: string) => {
    const a = mMap(map, wx, wy), b = mMap(map, wx + ww, wy + 2.1);
    if (!isVisible(a.x, a.y, b.x - a.x, b.y - a.y)) return;
    ctx.fillStyle = 'rgba(5,13,22,0.92)'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.fillStyle = color; ctx.fillRect(a.x, a.y, b.x - a.x, Math.max(1, map.ppuY * 0.18));
    ctx.fillRect(a.x, b.y - Math.max(1, map.ppuY * 0.12), b.x - a.x, Math.max(1, map.ppuY * 0.12));
    if (b.y - a.y > 9 && b.x - a.x > 45) {
      ctx.fillStyle = '#f4f4df';
      ctx.font = `800 ${Math.max(7, Math.round((b.y - a.y) * 0.43))}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, (a.x + b.x) / 2, (a.y + b.y) / 2, b.x - a.x - 8);
    }
  };
  supporterBanner(12, -11.2, 22, 'LA GRADA', stadium.trim);
  supporterBanner(39, -11.2, 22, 'CAM SOCCER', '#e7c85a');
  supporterBanner(66, -11.2, 22, 'EN DIRECTO', '#5aa9e7');
  supporterBanner(19, 109.1, 27, 'NUNCA PARAMOS', '#d75a5a');
  supporterBanner(54, 109.1, 27, 'COPA BROADCAST', stadium.trim);

  if (crowdOccupancy(audience) <= 0.08) return;
  const stadiumFlag = (wx: number, wy: number, color: string, seed: number) => {
    const point = mMap(map, wx, wy);
    const pole = Math.max(4, map.ppuY * 2.4), fw = Math.max(3, map.ppuX * 1.55);
    if (!isVisible(point.x - fw, point.y - pole, fw * 2.5, pole * 1.4)) return;
    ctx.strokeStyle = 'rgba(235,240,235,0.75)'; ctx.lineWidth = Math.max(0.7, map.ppuX * 0.055);
    ctx.beginPath(); ctx.moveTo(point.x, point.y); ctx.lineTo(point.x, point.y - pole); ctx.stroke();
    const wave = Math.sin(now * 0.0045 + seed * 1.7) * fw * 0.18;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(point.x, point.y - pole);
    ctx.quadraticCurveTo(point.x + fw * 0.55, point.y - pole + wave, point.x + fw, point.y - pole + pole * 0.18);
    ctx.lineTo(point.x + fw * 0.82, point.y - pole + pole * 0.48);
    ctx.quadraticCurveTo(point.x + fw * 0.42, point.y - pole + pole * 0.30 - wave, point.x, point.y - pole + pole * 0.35);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.fillRect(point.x + fw * 0.18, point.y - pole + pole * 0.08, Math.max(1, fw * 0.12), pole * 0.26);
  };
  [10, 34, 66, 90].forEach((wx, index) => {
    stadiumFlag(wx, -10.8, index % 2 ? stadium.trim : '#e7c85a', index);
    stadiumFlag(wx, 111.2, index % 2 ? '#5aa9e7' : '#d75a5a', index + 4);
  });
}

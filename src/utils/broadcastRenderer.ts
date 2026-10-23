import { EngineIncident } from './matchEngine';
import { FieldMap, mMap } from './camera';
import { DOG_RENDER_SCALE, dogOrientation } from './incidentPresentation';
import { DEFAULT_FIXTURE, MatchFixture, TeamIdentity, readableTextColor } from '../teams';

export interface BroadcastPlayer {
  x: number;
  y: number;
  team: 'home' | 'away';
  identity?: TeamIdentity;
  number?: number;
  hasBall: boolean;
  moving: boolean;
  phase: number;
  role?: string;
  celebrating?: boolean;
  sad?: boolean;
  facingX?: number;
  facingY?: number;
  diving?: boolean;
  diveDirection?: number;
  referee?: boolean;
  intruder?: boolean;
  staff?: 'security' | 'coach';
  protesting?: boolean;
  fighting?: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const drawPlayerBig = (ctx: CanvasRenderingContext2D, m: FieldMap, p: BroadcastPlayer) => {
  const sp = mMap(m, p.x, p.y);
  const gk = p.role === 'GK';
  const u = m.ppuX;
  if (u <= 0) return;
  const H = u * 3.55, w = H * 0.43;
  const transform = ctx.getTransform();
  const viewW = ctx.canvas.width / (transform.a || 1);
  const viewH = ctx.canvas.height / (transform.d || 1);
  if (sp.x < -H * 1.8 || sp.x > viewW + H * 1.8 || sp.y < -H * 1.8 || sp.y > viewH + H * 1.8) return;

  const rawFx = p.facingX ?? 0;
  const rawFy = p.facingY ?? -1;
  const directionLength = Math.hypot(rawFx, rawFy) || 1;
  const facingX = rawFx / directionLength;
  const facingY = rawFy / directionLength;
  const diving = Boolean(gk && p.diving);
  const diveDirection = p.diveDirection === 0 ? 1 : (p.diveDirection ?? 1);
  const number = p.number ?? (p.team === 'home' ? 7 : 9);
  const skins = ['#f0c199', '#d99b72', '#b97953', '#855239', '#5d3929'];
  const skin = skins[(number + (p.team === 'away' ? 2 : 0)) % skins.length];
  const hairs = ['#2b1b14', '#161a22', '#54351f', '#34251d', '#151313'];
  const hair = p.staff === 'coach' ? '#d0d7de' : hairs[(number * 3 + (p.team === 'away' ? 1 : 0)) % hairs.length];
  const identity = p.identity ?? DEFAULT_FIXTURE[p.team];
  const uniform = gk ? identity.goalkeeperKit : identity.kit;
  const kit = p.intruder ? skin : p.staff === 'security' ? '#ff6b00' : p.staff === 'coach' ? '#1c2838' : p.referee ? '#171d25' : uniform.primary;
  const trim = p.intruder ? '#efd0b5' : p.staff === 'security' ? '#ffd166' : p.staff === 'coach' ? '#f5f5f0' : p.referee ? '#f5cf68' : uniform.secondary;
  const shorts = p.intruder ? skin : p.staff ? '#111722' : p.referee ? '#10141b' : uniform.shorts;
  const socks = p.intruder ? skin : p.staff || p.referee ? '#171d25' : uniform.socks;
  const gloves = gk ? uniform.secondary : '#f4f7f2';
  const kitPattern = !p.intruder && !p.staff && !p.referee && !gk ? uniform.pattern : 'solid';

  const segment = (ax: number, ay: number, bx: number, by: number, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  const joint = (x: number, y: number, radius: number, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, radius), 0, Math.PI * 2); ctx.fill();
  };

  // La sombra permanece en el césped incluso durante saltos y estiradas.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sp.x + u * 0.12, sp.y + u * 0.16, w * (diving ? 1.15 : 0.68), H * (diving ? 0.075 : 0.065), 0, 0, Math.PI * 2);
  ctx.fill();

  // Polvo procedural: tres partículas cíclicas, sin aleatoriedad por frame.
  if (p.moving && !diving && u > 4) {
    for (let i = 0; i < 3; i += 1) {
      const life = ((p.phase * 0.075 + i / 3) % 1 + 1) % 1;
      const dx = -facingX * life * u * 0.85 + (i - 1) * u * 0.12;
      const dy = -facingY * life * u * 0.25 - life * u * 0.18;
      ctx.fillStyle = `rgba(225,235,205,${(1 - life) * 0.22})`;
      ctx.beginPath(); ctx.arc(sp.x + dx, sp.y + dy, u * (0.10 + life * 0.17), 0, Math.PI * 2); ctx.fill();
    }
  }

  const celebrationJump = p.celebrating ? Math.abs(Math.sin(p.phase * 0.65)) * H * 0.15 : 0;
  const runBob = p.moving && !p.celebrating && !diving ? Math.abs(Math.sin(p.phase * 2)) * H * 0.018 : 0;
  const jump = celebrationJump + runBob;
  const stride = p.moving && !diving && !p.celebrating && !p.sad ? Math.sin(p.phase) : 0;

  ctx.save();
  ctx.translate(sp.x, sp.y - jump);
  ctx.rotate(diving ? diveDirection * 1.02 : facingX * 0.035 + (p.moving ? Math.sin(p.phase * 2) * 0.009 : 0));

  // Piernas articuladas: cadera → rodilla → tobillo, con el brazo opuesto.
  for (const side of [-1, 1]) {
    const legSwing = diving ? -diveDirection * 0.18 : side * stride;
    const hipX = side * w * 0.19, hipY = -H * 0.39;
    const lift = diving ? H * 0.025 : Math.max(0, side * stride) * H * 0.055;
    const footX = side * w * 0.23 + legSwing * w * 0.43;
    const footY = -lift;
    const kneeX = (hipX + footX) * 0.52 + legSwing * w * 0.08;
    const kneeY = -H * 0.205 - Math.abs(legSwing) * H * 0.018;
    const shortEndX = hipX + (kneeX - hipX) * 0.55;
    const shortEndY = hipY + (kneeY - hipY) * 0.55;
    segment(hipX, hipY, shortEndX, shortEndY, w * 0.29, shorts);
    segment(shortEndX, shortEndY, kneeX, kneeY, w * 0.20, skin);
    segment(kneeX, kneeY, footX, footY - H * 0.035, w * 0.20, socks);
    // Costura de la media y bota orientada hacia la carrera.
    segment(kneeX, kneeY + H * 0.018, footX, footY - H * 0.035, Math.max(0.7, w * 0.035), 'rgba(255,255,255,0.32)');
    segment(footX - facingX * w * 0.05, footY - H * 0.018, footX + facingX * w * 0.18, footY, w * 0.18, '#151a20');
  }

  // Pantalón con cintura y dos perneras, en lugar de un único rectángulo.
  ctx.fillStyle = shorts;
  ctx.beginPath();
  ctx.moveTo(-w * 0.38, -H * 0.46); ctx.lineTo(w * 0.38, -H * 0.46);
  ctx.lineTo(w * 0.34, -H * 0.34); ctx.lineTo(w * 0.05, -H * 0.34);
  ctx.lineTo(0, -H * 0.39); ctx.lineTo(-w * 0.05, -H * 0.34);
  ctx.lineTo(-w * 0.34, -H * 0.34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(-w * 0.34, -H * 0.455, w * 0.68, Math.max(1, H * 0.018));

  // Torso anatómico: hombros anchos, cintura más estrecha y paneles laterales.
  const shirtTop = -H * 0.755, shirtBottom = -H * 0.435;
  const traceShirt = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 0.49, shirtTop + H * 0.045);
    ctx.quadraticCurveTo(-w * 0.35, shirtTop - H * 0.012, -w * 0.20, shirtTop);
    ctx.lineTo(w * 0.20, shirtTop);
    ctx.quadraticCurveTo(w * 0.35, shirtTop - H * 0.012, w * 0.49, shirtTop + H * 0.045);
    ctx.lineTo(w * 0.34, shirtBottom); ctx.lineTo(-w * 0.34, shirtBottom);
    ctx.closePath();
  };
  ctx.fillStyle = kit;
  traceShirt();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.24)'; ctx.lineWidth = Math.max(0.8, w * 0.035); ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.moveTo(-w * 0.49, shirtTop + H * 0.05); ctx.lineTo(-w * 0.34, shirtTop + H * 0.07);
  ctx.lineTo(-w * 0.25, shirtBottom); ctx.lineTo(-w * 0.34, shirtBottom); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.49, shirtTop + H * 0.05); ctx.lineTo(w * 0.34, shirtTop + H * 0.07);
  ctx.lineTo(w * 0.25, shirtBottom); ctx.lineTo(w * 0.34, shirtBottom); ctx.closePath(); ctx.fill();

  if (!p.intruder) {
    ctx.fillStyle = trim;
    if (p.staff === 'security') {
      ctx.fillRect(-w * 0.40, shirtTop + H * 0.09, w * 0.80, H * 0.035);
      ctx.fillRect(-w * 0.36, shirtTop + H * 0.22, w * 0.72, H * 0.035);
    } else if (p.staff === 'coach') {
      ctx.fillRect(-w * 0.12, shirtTop + H * 0.02, w * 0.24, H * 0.25);
      ctx.fillStyle = '#e5484d';
      ctx.beginPath(); ctx.moveTo(-w * 0.045, shirtTop + H * 0.06); ctx.lineTo(w * 0.045, shirtTop + H * 0.06);
      ctx.lineTo(w * 0.025, shirtTop + H * 0.25); ctx.lineTo(0, shirtTop + H * 0.28); ctx.lineTo(-w * 0.025, shirtTop + H * 0.25); ctx.closePath(); ctx.fill();
    } else if (!p.referee) {
      // Cada club tiene un patrón real, recortado a la silueta de la camiseta.
      ctx.save();
      traceShirt();
      ctx.clip();
      ctx.fillStyle = trim;
      if (kitPattern === 'stripes') {
        for (const offset of [-0.27, 0, 0.27]) ctx.fillRect(w * offset - w * 0.06, shirtTop, w * 0.12, shirtBottom - shirtTop);
      } else if (kitPattern === 'hoops') {
        for (const offset of [0.08, 0.17, 0.26]) ctx.fillRect(-w * 0.5, shirtTop + H * offset, w, H * 0.035);
      } else if (kitPattern === 'sash') {
        ctx.beginPath();
        ctx.moveTo(-w * 0.44, shirtTop + H * 0.03); ctx.lineTo(-w * 0.20, shirtTop);
        ctx.lineTo(w * 0.42, shirtBottom - H * 0.04); ctx.lineTo(w * 0.20, shirtBottom);
        ctx.closePath(); ctx.fill();
      } else if (kitPattern === 'halves') {
        ctx.fillRect(0, shirtTop, w * 0.50, shirtBottom - shirtTop);
      } else if (kitPattern === 'band') {
        ctx.fillRect(-w * 0.50, shirtTop + H * 0.105, w, H * 0.065);
      }
      ctx.restore();
    }
    ctx.strokeStyle = trim; ctx.lineWidth = Math.max(1, w * 0.055);
    ctx.beginPath(); ctx.moveTo(-w * 0.16, shirtTop + H * 0.005); ctx.lineTo(0, shirtTop + H * 0.065); ctx.lineTo(w * 0.16, shirtTop + H * 0.005); ctx.stroke();
  }

  if (p.number && !p.intruder && H > 30) {
    ctx.font = `800 ${Math.round(H * 0.145)}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const numberInk = p.staff || p.referee ? trim : uniform.number;
    ctx.strokeStyle = readableTextColor(numberInk) === '#f7fbff' ? 'rgba(247,251,255,0.72)' : 'rgba(0,0,0,0.48)';
    ctx.lineWidth = Math.max(1.5, H * 0.018);
    ctx.strokeText(String(p.number), 0, shirtTop + H * 0.205);
    ctx.fillStyle = numberInk;
    ctx.fillText(String(p.number), 0, shirtTop + H * 0.205);
  }

  // Brazos con hombro, codo y muñeca. Celebración, tristeza y estirada
  // tienen siluetas claramente distintas incluso en un plano general.
  for (const side of [-1, 1]) {
    const shoulderX = side * w * 0.43, shoulderY = shirtTop + H * 0.065;
    let elbowX: number, elbowY: number, handX: number, handY: number;
    if (p.protesting) {
      const wave = Math.sin(p.phase * 1.7 + side) * H * 0.035;
      elbowX = side * w * 0.65; elbowY = -H * (side > 0 ? 0.82 : 0.55) + wave;
      handX = side * w * 0.78; handY = -H * (side > 0 ? 1.03 : 0.45) + wave;
    } else if (p.fighting) {
      const punch = (Math.sin(p.phase * 2.1 + side * Math.PI) + 1) * 0.5;
      const forward = facingX >= 0 ? 1 : -1;
      elbowX = forward * w * (0.45 + punch * 0.15); elbowY = -H * (0.62 + side * 0.045);
      handX = forward * w * (0.72 + punch * 0.34); handY = -H * (0.64 + side * 0.055);
    } else if (p.celebrating) {
      const wave = Math.sin(p.phase * 0.9 + side) * H * 0.025;
      elbowX = side * w * 0.68; elbowY = -H * 0.86 + wave;
      handX = side * w * 0.58; handY = -H * 1.04 + wave;
    } else if (diving) {
      elbowX = diveDirection * w * 0.58; elbowY = -H * (0.72 + side * 0.045);
      handX = diveDirection * w * 1.04; handY = -H * (0.78 + side * 0.055);
    } else if (p.sad) {
      elbowX = side * w * 0.48; elbowY = -H * 0.48;
      handX = side * w * 0.34; handY = -H * 0.32;
    } else {
      const armSwing = -side * stride;
      elbowX = side * w * 0.53 + armSwing * w * 0.13;
      elbowY = -H * 0.56 + Math.abs(stride) * H * 0.012;
      handX = side * w * 0.40 + armSwing * w * 0.34;
      handY = -H * 0.40 - Math.abs(armSwing) * H * 0.035;
    }
    segment(shoulderX, shoulderY, elbowX, elbowY, w * 0.22, kit);
    segment(elbowX, elbowY, handX, handY, w * 0.155, skin);
    if (gk) {
      joint(handX, handY, w * 0.145, gloves);
      ctx.strokeStyle = '#f4f7f2'; ctx.lineWidth = Math.max(0.7, w * 0.035);
      ctx.beginPath(); ctx.arc(handX, handY, w * 0.145, 0, Math.PI * 2); ctx.stroke();
    } else {
      joint(handX, handY, w * 0.105, skin);
    }
  }

  // Cuello y cabeza con tonos de piel, peinados y mirada hacia la jugada.
  segment(0, shirtTop + H * 0.035, 0, shirtTop - H * 0.055, w * 0.22, skin);
  const headR = H * 0.145;
  const headCY = -H * 0.895 + (p.sad ? H * 0.035 : 0);
  joint(-headR * 0.93, headCY + headR * 0.05, headR * 0.22, skin);
  joint(headR * 0.93, headCY + headR * 0.05, headR * 0.22, skin);
  joint(0, headCY, headR, skin);
  // Sombra facial suave bajo la mandíbula.
  ctx.fillStyle = 'rgba(80,38,25,0.12)';
  ctx.beginPath(); ctx.arc(0, headCY + headR * 0.20, headR * 0.87, 0.12 * Math.PI, 0.88 * Math.PI); ctx.fill();

  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(0, headCY, headR * 1.01, Math.PI, Math.PI * 2); ctx.fill();
  const hairStyle = number % 4;
  if (hairStyle === 1) {
    ctx.fillRect(-headR * 0.95, headCY - headR * 0.18, headR * 0.25, headR * 0.65);
  } else if (hairStyle === 2) {
    ctx.beginPath(); ctx.moveTo(-headR * 0.25, headCY - headR * 0.90);
    ctx.lineTo(0, headCY - headR * 1.35); ctx.lineTo(headR * 0.28, headCY - headR * 0.90); ctx.closePath(); ctx.fill();
  } else if (hairStyle === 3 && !p.intruder) {
    ctx.fillStyle = trim; ctx.fillRect(-headR * 0.92, headCY - headR * 0.42, headR * 1.84, Math.max(1, headR * 0.18));
  }

  if (headR > 3.2) {
    const lookX = facingX * headR * 0.18, lookY = facingY * headR * 0.09;
    const eyeY = headCY - headR * 0.02 + lookY;
    ctx.fillStyle = '#182029';
    joint(-headR * 0.36 + lookX, eyeY, Math.max(0.75, headR * 0.085), '#182029');
    joint(headR * 0.36 + lookX, eyeY, Math.max(0.75, headR * 0.085), '#182029');
    // Nariz y cejas aportan dirección sin convertir la cara en un emoticono.
    segment(lookX * 1.4, headCY + headR * 0.08, lookX * 1.8, headCY + headR * 0.28, Math.max(0.65, headR * 0.055), 'rgba(95,48,35,0.55)');
    ctx.strokeStyle = hair; ctx.lineWidth = Math.max(0.7, headR * 0.07);
    ctx.beginPath();
    ctx.moveTo(-headR * 0.55 + lookX, eyeY - headR * (p.sad ? 0.05 : 0.20));
    ctx.lineTo(-headR * 0.18 + lookX, eyeY - headR * (p.sad ? 0.18 : 0.22));
    ctx.moveTo(headR * 0.18 + lookX, eyeY - headR * (p.sad ? 0.18 : 0.22));
    ctx.lineTo(headR * 0.55 + lookX, eyeY - headR * (p.sad ? 0.05 : 0.20)); ctx.stroke();
    if (p.protesting || p.fighting) {
      ctx.fillStyle = '#762d32';
      ctx.beginPath(); ctx.ellipse(lookX, headCY + headR * 0.48, headR * 0.22, headR * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(90,40,35,0.75)'; ctx.lineWidth = Math.max(0.7, headR * 0.06);
      ctx.beginPath();
      if (p.sad) ctx.arc(lookX, headCY + headR * 0.66, headR * 0.25, Math.PI * 1.15, Math.PI * 1.85);
      else ctx.arc(lookX, headCY + headR * 0.39, headR * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  // Lágrima y gota de esfuerza siguen ciclos continuos y predecibles.
  if (p.sad && headR > 3) {
    const tear = (Math.sin(p.phase * 0.7) + 1) * 0.5;
    ctx.fillStyle = `rgba(103,210,255,${0.35 + tear * 0.55})`;
    ctx.beginPath(); ctx.ellipse(headR * 0.48, headCY + headR * (0.25 + tear * 0.65), headR * 0.09, headR * 0.17, 0, 0, Math.PI * 2); ctx.fill();
  } else if (p.moving && !p.celebrating && Math.sin(p.phase) > 0.7 && u > 5) {
    ctx.strokeStyle = 'rgba(170,230,255,0.72)'; ctx.lineWidth = Math.max(1, u * 0.055);
    ctx.beginPath(); ctx.moveTo(headR * 1.15, headCY - headR * 0.2); ctx.lineTo(headR * 1.45, headCY - headR * 0.55); ctx.stroke();
  }

  ctx.restore();

  // Cuatro esquinas de seguimiento: identifican al poseedor sin tapar el modelo.
  if (p.hasBall) {
    const left = sp.x - w * 0.83, right = sp.x + w * 0.83;
    const top = sp.y - H * 1.12 - jump, bottom = sp.y + H * 0.07;
    const len = Math.max(3, w * 0.22);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1.3, u * 0.085); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left, top + len); ctx.lineTo(left, top); ctx.lineTo(left + len, top);
    ctx.moveTo(right - len, top); ctx.lineTo(right, top); ctx.lineTo(right, top + len);
    ctx.moveTo(left, bottom - len); ctx.lineTo(left, bottom); ctx.lineTo(left + len, bottom);
    ctx.moveTo(right - len, bottom); ctx.lineTo(right, bottom); ctx.lineTo(right, bottom - len); ctx.stroke();
  }

  if (p.celebrating && u > 4) {
    const sparkle = (x: number, y: number, size: number, alpha: number) => {
      ctx.fillStyle = `rgba(255,209,102,${alpha})`;
      ctx.beginPath(); ctx.moveTo(x, y - size); ctx.lineTo(x + size * 0.25, y - size * 0.25);
      ctx.lineTo(x + size, y); ctx.lineTo(x + size * 0.25, y + size * 0.25);
      ctx.lineTo(x, y + size); ctx.lineTo(x - size * 0.25, y + size * 0.25);
      ctx.lineTo(x - size, y); ctx.lineTo(x - size * 0.25, y - size * 0.25); ctx.closePath(); ctx.fill();
    };
    const twinkle = 0.55 + Math.sin(p.phase * 1.2) * 0.35;
    sparkle(sp.x - w * 0.85, sp.y - H * 1.12 - jump, u * 0.22, twinkle);
    sparkle(sp.x + w * 0.90, sp.y - H * 0.92 - jump, u * 0.16, 1 - twinkle * 0.45);
  }
};

export const drawBall = (ctx: CanvasRenderingContext2D, m: FieldMap, ball: { x: number; y: number; vx?: number; vy?: number }, bold = false) => {
  const p = mMap(m, ball.x, ball.y);
  const r = Math.max(bold ? 4 : 2.4, m.ppuX * (bold ? 0.85 : 0.6));
  const speed = Math.hypot(ball.vx ?? 0, ball.vy ?? 0);
  const angle = Math.atan2(ball.vy ?? 0, ball.vx ?? 0);
  // Marca de posición visible incluso quieta (anillo pulsante en el mapa grande)
  if (bold) {
    const pulse = 1.2 + Math.sin(performance.now() * 0.006) * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.32 + Math.sin(performance.now() * 0.01) * 0.18})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Estela cometaria: deja la estela DETRÁS, no flecha al frente
  if (speed > 3) {
    const segs = bold ? 8 : 6;
    const spacing = Math.min(bold ? 16 : 8, speed * m.ppuX * 0.02 + 3);
    const shot = speed > 22;
    for (let i = segs; i >= 1; i -= 1) {
      const t = i / segs;
      ctx.fillStyle = shot ? `rgba(255,209,102,${(1 - t) * 0.6 + 0.12})` : `rgba(255,255,255,${(1 - t) * 0.55 + 0.1})`;
      ctx.beginPath();
      ctx.arc(p.x - Math.cos(angle) * spacing * i, p.y - Math.sin(angle) * spacing * i, Math.max(1, r * (1 - t * 0.7)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.75, r * 1.05, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  // Pelota de fútbol: base blanca + sombreado
  ctx.save();
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#f5f7fa';
  ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  ctx.fillStyle = 'rgba(88,104,128,0.35)';
  ctx.fillRect(p.x - r, p.y + r * 0.35, r * 2, r * 0.75);
  // Pentágonos negros
  const pent = (cx: number, cy: number, pr: number, rot: number) => {
    ctx.fillStyle = '#161a22';
    ctx.beginPath();
    for (let k = 0; k < 5; k += 1) {
      const a = rot + (k * Math.PI * 2) / 5;
      const px = cx + Math.cos(a) * pr;
      const py = cy + Math.sin(a) * pr;
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  };
  if (r > 4) {
    // El dibujo gira con la distancia recorrida, no con un temporizador:
    // así el balón rueda y permanece quieto cuando no tiene velocidad.
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate((ball.x + ball.y) * 0.32); ctx.translate(-p.x, -p.y);
    pent(p.x, p.y, r * 0.42, -Math.PI / 2);
    for (let k = 0; k < 5; k += 1) {
      const a = -Math.PI / 2 + Math.PI * 0.4 + (k * Math.PI * 2) / 5;
      pent(p.x + Math.cos(a) * r * 0.85, p.y + Math.sin(a) * r * 0.85, r * 0.32, a);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = '#161a22';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  // Brillo
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(p.x - r * 0.38, p.y - r * 0.42, r * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(10,14,20,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
};

export const drawIncidentBig = (ctx: CanvasRenderingContext2D, m: FieldMap, inc: EngineIncident, now: number, fixture: MatchFixture = DEFAULT_FIXTURE) => {
  const p = mMap(m, inc.x, inc.y);
  const u = m.ppuX;
  if (u <= 0) return;
  // Los incidentes tienen efectos amplios, pero no necesitan dibujarse cuando
  // todo su volumen está fuera del monitor. Ahorra especialmente en móvil.
  const transform = ctx.getTransform();
  const viewW = ctx.canvas.width / (transform.a || 1);
  const viewH = ctx.canvas.height / (transform.d || 1);
  const margin = Math.max(36, u * 8);
  if (p.x < -margin || p.x > viewW + margin || p.y < -margin || p.y > viewH + margin) return;
  const age = Math.max(0, (now - inc.bornAt) / 1000);
  const remaining = Math.max(0, (inc.expiresAt - now) / 1000);
  const enterLinear = clamp(age / 0.38, 0, 1);
  const enter = 1 - Math.pow(1 - enterLinear, 3);
  const scale = 0.72 + enter * 0.28 + Math.sin(enterLinear * Math.PI) * 0.06;
  ctx.save();
  ctx.globalAlpha = clamp(remaining / 0.6, 0, 1);
  ctx.translate(p.x, p.y); ctx.scale(scale, scale); ctx.translate(-p.x, -p.y);
  try {

  if (inc.kind === 'dog') {
    // Perro de cuatro patas con formas orgánicas, articulaciones y pelaje.
    // La dirección sale de su velocidad real, también en la práctica.
    const pose = dogOrientation(inc.vx ?? 0, inc.vy ?? 0);
    const stride = now * 0.022;
    const gait = Math.sin(stride);
    const bounce = Math.abs(Math.sin(stride)) * u * 0.10;
    const fur = inc.color;
    const furDark = '#a96438';
    const furLight = '#ffd0a3';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 1.12, u * 1.90, u * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y - bounce);
    ctx.rotate(pose.rotation);
    ctx.scale(pose.direction * DOG_RENDER_SCALE, DOG_RENDER_SCALE);

    // Pequeñas líneas de carrera detrás del animal.
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = Math.max(0.8, u * 0.10); ctx.lineCap = 'round';
    for (let k = 1; k <= 2; k += 1) {
      ctx.beginPath(); ctx.moveTo(-u * (2.8 + k * 0.55), -u * (0.30 + k * 0.34)); ctx.lineTo(-u * (3.45 + k * 0.55), -u * (0.30 + k * 0.34)); ctx.stroke();
    }

    // Cola curva con movimiento independiente del galope.
    const wag = Math.sin(now * 0.014) * u * 0.52;
    ctx.strokeStyle = furDark; ctx.lineWidth = Math.max(2, u * 0.48); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-u * 1.85, -u * 0.72); ctx.quadraticCurveTo(-u * 2.85, -u * 1.12 + wag, -u * 3.18, -u * 1.82 + wag); ctx.stroke();
    ctx.strokeStyle = fur; ctx.lineWidth = Math.max(1.2, u * 0.31);
    ctx.beginPath(); ctx.moveTo(-u * 1.85, -u * 0.75); ctx.quadraticCurveTo(-u * 2.82, -u * 1.12 + wag, -u * 3.12, -u * 1.76 + wag); ctx.stroke();

    const leg = (anchorX: number, phase: number, far: boolean) => {
      const swing = Math.sin(stride + phase) * u * 0.62;
      const lift = Math.max(0, Math.cos(stride + phase)) * u * 0.20;
      const hipY = -u * 0.12;
      const kneeX = anchorX + swing * 0.42;
      const kneeY = u * 0.60 - lift * 0.35;
      const pawX = anchorX + swing;
      const pawY = u * 1.35 - lift;
      const color = far ? '#9a5c36' : '#bb7542';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(70,38,25,0.30)'; ctx.lineWidth = Math.max(1.5, u * 0.40);
      ctx.beginPath(); ctx.moveTo(anchorX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(pawX, pawY); ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, u * 0.28);
      ctx.beginPath(); ctx.moveTo(anchorX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(pawX, pawY); ctx.stroke();
      ctx.fillStyle = far ? '#805037' : furLight;
      ctx.beginPath(); ctx.ellipse(pawX + u * 0.12, pawY, u * 0.30, u * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    };
    // Patas lejanas primero para dar volumen al cuerpo.
    leg(-u * 1.25, Math.PI, true);
    leg(u * 0.95, 0, true);

    const coat = ctx.createLinearGradient(0, -u * 1.55, 0, u * 0.40);
    coat.addColorStop(0, '#ffc080'); coat.addColorStop(0.42, fur); coat.addColorStop(1, '#cf8148');
    ctx.fillStyle = coat;
    ctx.beginPath(); ctx.ellipse(-u * 0.20, -u * 0.63, u * 2.12, u * 0.91, -0.03, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = furLight;
    ctx.beginPath(); ctx.ellipse(u * 0.20, -u * 0.20, u * 1.40, u * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    // Mancha de pelaje y hombro más oscuro.
    ctx.fillStyle = 'rgba(142,78,42,0.55)';
    ctx.beginPath(); ctx.ellipse(-u * 0.90, -u * 0.92, u * 0.76, u * 0.40, -0.20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d98b4d';
    ctx.beginPath(); ctx.ellipse(u * 1.18, -u * 0.67, u * 0.76, u * 0.82, -0.18, 0, Math.PI * 2); ctx.fill();

    // Patas cercanas, alternadas con las lejanas.
    leg(-u * 0.88, 0, false);
    leg(u * 1.28, Math.PI, false);

    // Cuello, collar y chapa.
    ctx.strokeStyle = '#d9e6ef'; ctx.lineWidth = Math.max(1.2, u * 0.20);
    ctx.beginPath(); ctx.moveTo(u * 1.26, -u * 1.25); ctx.lineTo(u * 1.48, -u * 0.28); ctx.stroke();
    ctx.strokeStyle = '#e5484d'; ctx.lineWidth = Math.max(1, u * 0.14);
    ctx.beginPath(); ctx.moveTo(u * 1.30, -u * 1.20); ctx.lineTo(u * 1.50, -u * 0.32); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(u * 1.50, -u * 0.20, Math.max(1.2, u * 0.16), 0, Math.PI * 2); ctx.fill();

    // Cabeza, hocico y orejas flexibles con rebotar del galope.
    const earBounce = gait * u * 0.15;
    ctx.fillStyle = furDark;
    ctx.beginPath(); ctx.ellipse(u * 1.46, -u * 1.63 + earBounce, u * 0.42, u * 0.74, -0.40, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(u * 2.15, -u * 1.78 - earBounce, u * 0.38, u * 0.68, 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = fur;
    ctx.beginPath(); ctx.ellipse(u * 1.98, -u * 1.28, u * 0.91, u * 0.84, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = furLight;
    ctx.beginPath(); ctx.ellipse(u * 2.74, -u * 0.96, u * 0.83, u * 0.47, 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202128';
    ctx.beginPath(); ctx.ellipse(u * 3.36, -u * 1.05, u * 0.25, u * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(u * 3.30, -u * 1.12, Math.max(0.6, u * 0.055), 0, Math.PI * 2); ctx.fill();
    // Ojo con brillo y ceja expresiva.
    ctx.fillStyle = '#202128'; ctx.beginPath(); ctx.arc(u * 2.25, -u * 1.43, Math.max(1, u * 0.13), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(u * 2.29, -u * 1.48, Math.max(0.5, u * 0.045), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = furDark; ctx.lineWidth = Math.max(0.7, u * 0.07);
    ctx.beginPath(); ctx.moveTo(u * 2.02, -u * 1.68); ctx.lineTo(u * 2.38, -u * 1.61); ctx.stroke();
    // Lengua y jadeo.
    if (Math.sin(now * 0.010) > -0.25) {
      ctx.fillStyle = '#ef7d8d';
      ctx.beginPath(); ctx.ellipse(u * 2.92, -u * 0.52, u * 0.22, u * 0.35, 0.20, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#b84f67'; ctx.lineWidth = Math.max(0.5, u * 0.04);
      ctx.beginPath(); ctx.moveTo(u * 2.93, -u * 0.43); ctx.lineTo(u * 2.96, -u * 0.27); ctx.stroke();
    }
    ctx.restore();

    if (u > 3.5 && Math.sin(now * 0.009) > 0.2) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
      ctx.font = 'bold 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const barkX = p.x + pose.direction * u * 1.4;
      const barkY = p.y - u * 3.25;
      ctx.fillRect(barkX - u * 3.25, barkY, u * 6.5, 13); ctx.strokeRect(barkX - u * 3.25, barkY, u * 6.5, 13);
      ctx.fillStyle = '#111'; ctx.fillText('¡GUAU!', barkX, barkY + 1);
    }
    return;
  }

  if (inc.kind === 'fight') {
    const sh = Math.sin(now * 0.05) * u * 0.4;
    // Nube de polvo de pelea cómica
    ctx.fillStyle = 'rgba(240,240,240,0.65)';
    ctx.beginPath(); ctx.arc(p.x + sh, p.y, u * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Jugadores peleando dentro
    drawPlayerBig(ctx, m, { x: inc.x - 1.4, y: inc.y + 1.6, team: 'home', identity: fixture.home, hasBall: false, moving: true, phase: now * 0.018, facingX: 1, facingY: 0, fighting: true });
    drawPlayerBig(ctx, m, { x: inc.x + 1.4, y: inc.y + 1.6, team: 'away', identity: fixture.away, hasBall: false, moving: true, phase: now * 0.018 + 2, facingX: -1, facingY: 0, fighting: true });

    // Puños y estrellas saltando
    ctx.fillStyle = '#fff23c';
    for (let i = 0; i < 5; i++) {
      const a = now * 0.02 + (i * Math.PI * 2) / 5;
      ctx.fillRect(p.x + Math.cos(a) * u * 2.5 - 1, p.y - u * 0.5 + Math.sin(a) * u * 1.8 - 1, u * 0.8, u * 0.8);
    }

    // Bocadillo de bronca
    if (u > 3) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      const bx = p.x;
      const by = p.y - u * 4.2;
      ctx.fillRect(bx - u * 4, by - 7, u * 8, 14);
      ctx.strokeRect(bx - u * 4, by - 7, u * 8, 14);
      ctx.fillStyle = '#ff3366';
      ctx.font = 'bold 10px "Space Grotesk Variable", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('¡PELEA!', bx, by + 1);
    }
    return;
  }

  if (inc.kind === 'streaker') {
    const phase = now * 0.018;
    drawPlayerBig(ctx, m, {
      x: inc.x, y: inc.y, team: 'home', hasBall: false, moving: true, phase,
      facingX: inc.vx ?? 0, facingY: inc.vy ?? 1, intruder: true,
    });
    // Censura alineada con el pantalón del modelo, no con una coordenada
    // independiente que podía quedar desplazada durante la zancada.
    const H = u * 3.55;
    const footY = p.y - Math.abs(Math.sin(phase * 2)) * H * 0.018;
    ctx.fillStyle = '#11141a';
    ctx.fillRect(p.x - u * 0.82, footY - H * 0.42, u * 1.64, H * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(p.x - u * 0.82, footY - H * 0.42, u * 1.64, Math.max(1, H * 0.018));

    // Guardias detrás según el vector real de carrera, también en vertical.
    const velocity = Math.hypot(inc.vx ?? 0, inc.vy ?? 0) || 1;
    const dirX = (inc.vx ?? 0) / velocity, dirY = (inc.vy ?? 0) / velocity;
    const guardX = inc.x - dirX * 3.4;
    const guardY = inc.y - dirY * 3.4 + Math.sin(now * 0.009) * 0.35;
    drawPlayerBig(ctx, m, {
      x: guardX, y: guardY, team: 'away', hasBall: false, moving: true,
      phase: phase + 2.4, facingX: dirX, facingY: dirY, staff: 'security',
    });
    if (Math.sin(now * 0.008) > 0.25 && u > 4) {
      const guard = mMap(m, guardX, guardY);
      const bx = guard.x - dirX * u * 2.4, by = guard.y - u * 4.5;
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx - u * 2.1, by - 7, u * 4.2, 14, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#11141a'; ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('¡ALTO!', bx, by + 1);
    }
    return;
  }

  if (inc.kind === 'mascot') {
    const H = u * 3.55, w = H * 0.48;
    const phase = now * 0.012;
    const bounce = Math.abs(Math.sin(phase * 1.4)) * u * 0.28;
    const direction = (inc.vx ?? 1) >= 0 ? 1 : -1;
    const limb = (ax: number, ay: number, bx: number, by: number, width: number, color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    };
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 0.2, w * 0.72, H * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y - bounce); ctx.scale(direction, 1);
    // Cola con movimiento péndulo.
    ctx.strokeStyle = '#b9712f'; ctx.lineWidth = w * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w * 0.32, -H * 0.43);
    ctx.quadraticCurveTo(-w * (0.95 + Math.sin(phase) * 0.12), -H * 0.45, -w * 0.85, -H * (0.72 + Math.sin(phase) * 0.08)); ctx.stroke();
    ctx.fillStyle = '#6f4326'; ctx.beginPath(); ctx.arc(-w * 0.85, -H * (0.72 + Math.sin(phase) * 0.08), w * 0.15, 0, Math.PI * 2); ctx.fill();
    // Zapatones y piernas alternas.
    const step = Math.sin(phase * 2) * w * 0.24;
    limb(-w * 0.18, -H * 0.35, -w * 0.25 + step, -H * 0.06, w * 0.22, '#f6c453');
    limb(w * 0.18, -H * 0.35, w * 0.25 - step, -H * 0.06, w * 0.22, '#f6c453');
    ctx.fillStyle = '#25324a';
    ctx.beginPath(); ctx.ellipse(-w * 0.22 + step, -H * 0.035, w * 0.30, H * 0.065, -0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w * 0.22 - step, -H * 0.035, w * 0.30, H * 0.065, 0.08, 0, Math.PI * 2); ctx.fill();
    // Cuerpo de felpa y barriga.
    ctx.fillStyle = inc.color; ctx.beginPath(); ctx.ellipse(0, -H * 0.46, w * 0.52, H * 0.25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe0a3'; ctx.beginPath(); ctx.ellipse(w * 0.06, -H * 0.43, w * 0.29, H * 0.17, 0, 0, Math.PI * 2); ctx.fill();
    // Brazos de baile con codos, opuestos al paso.
    const arm = Math.sin(phase * 1.8) * w * 0.16;
    limb(-w * 0.42, -H * 0.60, -w * 0.72, -H * 0.76 + arm, w * 0.20, inc.color);
    limb(-w * 0.72, -H * 0.76 + arm, -w * 0.60, -H * 0.98 + arm, w * 0.17, inc.color);
    limb(w * 0.42, -H * 0.60, w * 0.72, -H * 0.76 - arm, w * 0.20, inc.color);
    limb(w * 0.72, -H * 0.76 - arm, w * 0.60, -H * 0.98 - arm, w * 0.17, inc.color);
    // Melena, orejas y cabeza expresiva.
    const headY = -H * 0.87, headR = H * 0.21;
    ctx.fillStyle = '#9a5a2d'; ctx.beginPath(); ctx.arc(0, headY, headR * 1.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = inc.color;
    ctx.beginPath(); ctx.arc(-headR * 0.70, headY - headR * 0.72, headR * 0.37, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.70, headY - headR * 0.72, headR * 0.37, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, headY, headR * 0.88, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe0a3'; ctx.beginPath(); ctx.ellipse(headR * 0.15, headY + headR * 0.26, headR * 0.60, headR * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b2430';
    ctx.beginPath(); ctx.arc(-headR * 0.30, headY - headR * 0.16, Math.max(1, headR * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.30, headY - headR * 0.16, Math.max(1, headR * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headR * 0.18, headY + headR * 0.12, headR * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6f4326'; ctx.lineWidth = Math.max(1, headR * 0.06);
    ctx.beginPath(); ctx.arc(headR * 0.15, headY + headR * 0.28, headR * 0.30, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    ctx.restore();
    return;
  }

  if (inc.kind === 'drone') {
    const bob = Math.sin(now * 0.006 + age) * u * 0.20;
    const bodyY = p.y - u * 1.8 + bob;
    // Sombra y cono de cámara sobre el césped.
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 0.35, u * 1.65, u * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(139,233,253,0.065)';
    ctx.beginPath(); ctx.moveTo(p.x - u * 0.35, bodyY + u * 0.4); ctx.lineTo(p.x + u * 0.35, bodyY + u * 0.4);
    ctx.lineTo(p.x + u * 2.2, p.y + u * 0.3); ctx.lineTo(p.x - u * 2.2, p.y + u * 0.3); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(p.x, bodyY); ctx.rotate(Math.sin(now * 0.003) * 0.045);
    // Cuatro brazos y rotores con giro real.
    for (let i = 0; i < 4; i += 1) {
      const sx = i % 2 === 0 ? -1 : 1, sy = i < 2 ? -1 : 1;
      const rx = sx * u * 1.55, ry = sy * u * 0.72;
      ctx.strokeStyle = '#607487'; ctx.lineWidth = Math.max(1.5, u * 0.16);
      ctx.beginPath(); ctx.moveTo(sx * u * 0.48, sy * u * 0.22); ctx.lineTo(rx, ry); ctx.stroke();
      ctx.strokeStyle = 'rgba(205,235,245,0.38)'; ctx.lineWidth = Math.max(1, u * 0.07);
      ctx.beginPath(); ctx.ellipse(rx, ry, u * 0.85, u * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
      const rotor = now * 0.055 + i * Math.PI * 0.5;
      ctx.strokeStyle = 'rgba(225,245,250,0.78)'; ctx.lineWidth = Math.max(1, u * 0.09);
      ctx.beginPath(); ctx.moveTo(rx - Math.cos(rotor) * u * 0.78, ry - Math.sin(rotor) * u * 0.25);
      ctx.lineTo(rx + Math.cos(rotor) * u * 0.78, ry + Math.sin(rotor) * u * 0.25); ctx.stroke();
      ctx.fillStyle = '#202b38'; ctx.beginPath(); ctx.arc(rx, ry, u * 0.15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#263646'; ctx.strokeStyle = inc.color; ctx.lineWidth = Math.max(1, u * 0.08);
    ctx.beginPath(); ctx.roundRect(-u * 0.92, -u * 0.52, u * 1.84, u * 1.04, u * 0.25); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3e566b'; ctx.fillRect(-u * 0.52, -u * 0.38, u * 1.04, u * 0.24);
    // Gimbal, lente y piloto de grabación.
    ctx.fillStyle = '#111923'; ctx.beginPath(); ctx.arc(0, u * 0.55, u * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#48bde0'; ctx.beginPath(); ctx.arc(0, u * 0.55, u * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9f7ff'; ctx.beginPath(); ctx.arc(-u * 0.07, u * 0.47, u * 0.07, 0, Math.PI * 2); ctx.fill();
    if (Math.sin(now * 0.012) > -0.15) {
      ctx.fillStyle = '#ff4058'; ctx.beginPath(); ctx.arc(u * 0.62, -u * 0.24, Math.max(1.3, u * 0.11), 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#3ddc97'; ctx.beginPath(); ctx.arc(-u * 0.62, -u * 0.24, Math.max(1, u * 0.09), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }

  if (inc.kind === 'sprinkler') {
    const pressure = clamp(age / 0.75, 0, 1) * clamp(remaining / 0.8, 0, 1);
    // Charcos que crecen bajo los tres chorros.
    for (let jet = 0; jet < 3; jet += 1) {
      const angle = now * 0.0028 + jet * Math.PI * 2 / 3;
      const reach = u * 4.8 * pressure;
      const ex = p.x + Math.cos(angle) * reach, ey = p.y + Math.sin(angle) * reach;
      ctx.fillStyle = 'rgba(102,217,255,0.12)';
      ctx.beginPath(); ctx.ellipse(ex, ey, u * (0.7 + pressure * 0.6), u * 0.35, angle, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(175,238,255,0.60)'; ctx.lineWidth = Math.max(1, u * 0.10); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y - u * 0.25);
      ctx.quadraticCurveTo(p.x + Math.cos(angle) * reach * 0.52, p.y + Math.sin(angle) * reach * 0.52 - u * 2.1 * pressure, ex, ey); ctx.stroke();
      // Gotas escalonadas por la parábola, sin partículas aleatorias.
      for (let drop = 0; drop < 7; drop += 1) {
        const t = ((drop / 7 + age * 0.85) % 1 + 1) % 1;
        const distance = reach * t;
        const dx = p.x + Math.cos(angle) * distance;
        const dy = p.y + Math.sin(angle) * distance - Math.sin(t * Math.PI) * u * 2.1 * pressure;
        ctx.fillStyle = `rgba(195,244,255,${0.35 + (1 - t) * 0.55})`;
        ctx.beginPath(); ctx.ellipse(dx, dy, Math.max(1, u * 0.09), Math.max(1.2, u * 0.16), angle, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Cabezal metálico giratorio.
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + u * 0.22, u * 0.55, u * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#607d8b'; ctx.fillRect(p.x - u * 0.30, p.y - u * 0.48, u * 0.60, u * 0.65);
    ctx.fillStyle = '#d7edf2'; ctx.beginPath(); ctx.ellipse(p.x, p.y - u * 0.48, u * 0.42, u * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263b46'; ctx.beginPath(); ctx.arc(p.x, p.y - u * 0.50, u * 0.13, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (inc.kind === 'flare') {
    const flicker = 0.88 + Math.sin(now * 0.027) * 0.12;
    // Luz de la bengala sobre la grada.
    for (let ring = 3; ring >= 1; ring -= 1) {
      ctx.fillStyle = `rgba(255,91,45,${0.025 + (4 - ring) * 0.025})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, u * ring * 1.45 * flicker, 0, Math.PI * 2); ctx.fill();
    }
    // Humo por ciclos continuos: se expande y pierde opacidad al subir.
    for (let i = 0; i < 8; i += 1) {
      const life = ((age * 0.20 + i / 8) % 1 + 1) % 1;
      const sx = p.x + Math.sin(i * 2.7 + age * 0.8) * u * life * 1.25;
      const sy = p.y - u * 0.8 - life * u * 5.6;
      ctx.fillStyle = `rgba(188,174,181,${(1 - life) * 0.24})`;
      ctx.beginPath(); ctx.arc(sx, sy, u * (0.25 + life * 0.72), 0, Math.PI * 2); ctx.fill();
    }
    // Espectador sujetando la bengala.
    ctx.strokeStyle = '#202536'; ctx.lineWidth = Math.max(2, u * 0.32); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x - u * 0.8, p.y + u * 1.8); ctx.lineTo(p.x - u * 0.5, p.y + u * 0.3); ctx.lineTo(p.x, p.y - u * 0.2); ctx.stroke();
    ctx.fillStyle = '#202536'; ctx.fillRect(p.x - u * 1.15, p.y + u * 1.2, u * 1.25, u * 1.6);
    ctx.fillStyle = '#b97953'; ctx.beginPath(); ctx.arc(p.x - u * 0.55, p.y + u * 0.85, u * 0.42, 0, Math.PI * 2); ctx.fill();
    // Mango, llama exterior e interior.
    ctx.strokeStyle = '#e7e0d2'; ctx.lineWidth = Math.max(1.5, u * 0.15);
    ctx.beginPath(); ctx.moveTo(p.x, p.y + u * 0.3); ctx.lineTo(p.x, p.y - u * 0.5); ctx.stroke();
    ctx.fillStyle = '#ff5a2f';
    ctx.beginPath(); ctx.moveTo(p.x, p.y - u * 0.35);
    ctx.bezierCurveTo(p.x - u * 0.85, p.y - u * 1.1, p.x + u * 0.25, p.y - u * (2.0 * flicker), p.x + u * 0.12, p.y - u * 2.25);
    ctx.bezierCurveTo(p.x + u * 0.85, p.y - u * 1.35, p.x + u * 0.55, p.y - u * 0.65, p.x, p.y - u * 0.35); ctx.fill();
    ctx.fillStyle = '#ffe66d'; ctx.beginPath(); ctx.ellipse(p.x + u * 0.05, p.y - u * 0.85, u * 0.24, u * 0.60 * flicker, 0.1, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i += 1) {
      const life = ((age * 1.25 + i / 6) % 1 + 1) % 1;
      const angle = i * 2.4 + age;
      ctx.fillStyle = `rgba(255,222,102,${1 - life})`;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(angle) * life * u * 1.8, p.y - u * 0.8 - life * u * 2.4, Math.max(0.8, u * 0.07), 0, Math.PI * 2); ctx.fill();
    }
    return;
  }

  // Entrenador con modelo propio: abrigo, pantalón de vestir, carpeta de
  // táctica, pelo gris y gestos de protesta articulados.
  const H = u * 3.78, w = H * 0.45;
  const phase = now * 0.011;
  const bob = Math.abs(Math.sin(phase * 0.7)) * u * 0.055;
  const gesture = (Math.sin(phase * 1.4) + 1) * 0.035;
  const facing = (inc.vx ?? 0) === 0 ? 0 : Math.sign(inc.vx ?? 0);
  const skin = '#d99b72';
  const angrySkin = '#f2645a';
  const coat = '#1b2b40';
  const coatLight = '#2d465f';
  const trousers = '#141c28';
  const limb = (ax: number, ay: number, bx: number, by: number, width: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, width); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(p.x + u * 0.10, p.y + u * 0.14, w * 0.78, H * 0.065, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y - bob);
  ctx.rotate(facing * 0.025 + Math.sin(phase * 0.5) * 0.008);

  // Piernas de vestir con un pequeño paso de impaciencia.
  const step = Math.sin(phase * 0.75) * w * 0.12;
  for (const side of [-1, 1]) {
    const hipX = side * w * 0.19;
    const footX = side * w * 0.23 + side * step;
    limb(hipX, -H * 0.36, hipX + side * step * 0.30, -H * 0.17, w * 0.30, trousers);
    limb(hipX + side * step * 0.30, -H * 0.17, footX, -H * 0.045, w * 0.25, trousers);
    ctx.fillStyle = '#0b1119';
    ctx.beginPath(); ctx.ellipse(footX + w * 0.07, -H * 0.025, w * 0.25, H * 0.040, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(footX - w * 0.10, -H * 0.048, w * 0.23, Math.max(0.7, H * 0.009));
  }

  // Abrigo largo con hombros, solapas y bajos separados.
  const shoulderY = -H * 0.755, coatBottom = -H * 0.27;
  const coatGradient = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
  coatGradient.addColorStop(0, '#142235'); coatGradient.addColorStop(0.55, coat); coatGradient.addColorStop(1, coatLight);
  ctx.fillStyle = coatGradient;
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, shoulderY + H * 0.06);
  ctx.quadraticCurveTo(-w * 0.32, shoulderY - H * 0.01, -w * 0.18, shoulderY);
  ctx.lineTo(w * 0.18, shoulderY);
  ctx.quadraticCurveTo(w * 0.32, shoulderY - H * 0.01, w * 0.48, shoulderY + H * 0.06);
  ctx.lineTo(w * 0.42, coatBottom); ctx.lineTo(w * 0.06, coatBottom - H * 0.015);
  ctx.lineTo(0, coatBottom + H * 0.035); ctx.lineTo(-w * 0.06, coatBottom - H * 0.015);
  ctx.lineTo(-w * 0.42, coatBottom); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(4,10,18,0.55)'; ctx.lineWidth = Math.max(0.8, w * 0.035); ctx.stroke();
  // Camisa, corbata y solapas cruzadas.
  ctx.fillStyle = '#edf1ee';
  ctx.beginPath(); ctx.moveTo(-w * 0.16, shoulderY + H * 0.01); ctx.lineTo(w * 0.16, shoulderY + H * 0.01);
  ctx.lineTo(w * 0.10, -H * 0.53); ctx.lineTo(0, -H * 0.48); ctx.lineTo(-w * 0.10, -H * 0.53); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9c27b0';
  ctx.beginPath(); ctx.moveTo(-w * 0.045, -H * 0.69); ctx.lineTo(w * 0.045, -H * 0.69); ctx.lineTo(w * 0.035, -H * 0.50);
  ctx.lineTo(0, -H * 0.46); ctx.lineTo(-w * 0.035, -H * 0.50); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#58718a'; ctx.lineWidth = Math.max(0.8, w * 0.05);
  ctx.beginPath(); ctx.moveTo(-w * 0.19, shoulderY); ctx.lineTo(-w * 0.03, -H * 0.53); ctx.lineTo(-w * 0.20, -H * 0.57);
  ctx.moveTo(w * 0.19, shoulderY); ctx.lineTo(w * 0.03, -H * 0.53); ctx.lineTo(w * 0.20, -H * 0.57); ctx.stroke();
  ctx.fillStyle = '#a8b6c3';
  for (let button = 0; button < 3; button += 1) {
    ctx.beginPath(); ctx.arc(w * 0.09, -H * (0.48 - button * 0.065), Math.max(0.65, w * 0.025), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#0d1724'; ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.beginPath(); ctx.moveTo(-w * 0.37, -H * 0.39); ctx.lineTo(w * 0.37, -H * 0.39); ctx.stroke();

  // Brazo de la carpeta, quieto, y brazo de protesta con índice extendido.
  limb(-w * 0.41, -H * 0.69, -w * 0.62, -H * 0.53, w * 0.24, coat);
  limb(-w * 0.62, -H * 0.53, -w * 0.66, -H * 0.39, w * 0.20, coatLight);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-w * 0.66, -H * 0.38, w * 0.105, 0, Math.PI * 2); ctx.fill();
  const rightElbowY = -H * (0.82 + gesture);
  const rightHandY = -H * (1.00 + gesture);
  limb(w * 0.41, -H * 0.69, w * 0.67, rightElbowY, w * 0.24, coatLight);
  limb(w * 0.67, rightElbowY, w * 0.84, rightHandY, w * 0.19, coat);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(w * 0.84, rightHandY, w * 0.11, 0, Math.PI * 2); ctx.fill();
  limb(w * 0.86, rightHandY - H * 0.01, w * 0.91, rightHandY - H * 0.115, w * 0.065, skin);
  // Reloj en la muñeca que sujeta la carpeta.
  ctx.strokeStyle = '#c8d2da'; ctx.lineWidth = Math.max(0.7, w * 0.055);
  ctx.beginPath(); ctx.arc(-w * 0.66, -H * 0.405, w * 0.11, 0, Math.PI * 2); ctx.stroke();

  // Carpeta táctica con campo y flechas, sostenida delante del abrigo.
  ctx.save(); ctx.translate(-w * 0.71, -H * 0.43); ctx.rotate(-0.13);
  ctx.fillStyle = '#d7c49a'; ctx.fillRect(-w * 0.34, -H * 0.14, w * 0.68, H * 0.30);
  ctx.fillStyle = '#2f7c56'; ctx.fillRect(-w * 0.30, -H * 0.12, w * 0.60, H * 0.25);
  ctx.strokeStyle = 'rgba(240,250,235,0.85)'; ctx.lineWidth = Math.max(0.55, w * 0.018);
  ctx.strokeRect(-w * 0.26, -H * 0.095, w * 0.52, H * 0.19);
  ctx.beginPath(); ctx.moveTo(0, -H * 0.095); ctx.lineTo(0, H * 0.095); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, w * 0.09, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(0.7, w * 0.025);
  ctx.beginPath(); ctx.moveTo(-w * 0.18, H * 0.045); ctx.quadraticCurveTo(0, -H * 0.07, w * 0.17, -H * 0.025); ctx.stroke();
  ctx.fillStyle = '#303b47'; ctx.fillRect(-w * 0.10, -H * 0.155, w * 0.20, H * 0.035);
  ctx.restore();

  // Cuello y cabeza expresiva con pelo gris, cejas y barba corta.
  limb(0, shoulderY + H * 0.02, 0, -H * 0.82, w * 0.23, angrySkin);
  const headR = H * 0.135, headCY = -H * 0.91;
  ctx.fillStyle = angrySkin;
  ctx.beginPath(); ctx.arc(-headR * 0.95, headCY + headR * 0.06, headR * 0.22, 0, Math.PI * 2); ctx.arc(headR * 0.95, headCY + headR * 0.06, headR * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, headCY, headR * 0.92, headR * 1.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c3cbd3';
  ctx.beginPath(); ctx.arc(0, headCY - headR * 0.06, headR * 0.96, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillRect(-headR * 0.93, headCY - headR * 0.23, headR * 0.20, headR * 0.58);
  ctx.fillRect(headR * 0.73, headCY - headR * 0.23, headR * 0.20, headR * 0.58);
  // Entradas y peinado hacia atrás.
  ctx.fillStyle = '#e0e5e8';
  ctx.beginPath(); ctx.moveTo(-headR * 0.65, headCY - headR * 0.78); ctx.quadraticCurveTo(0, headCY - headR * 1.30, headR * 0.70, headCY - headR * 0.72);
  ctx.lineTo(headR * 0.45, headCY - headR * 0.93); ctx.quadraticCurveTo(0, headCY - headR * 1.08, -headR * 0.65, headCY - headR * 0.78); ctx.fill();
  if (headR > 3) {
    const eyeY = headCY - headR * 0.05;
    ctx.fillStyle = '#182029';
    ctx.beginPath(); ctx.arc(-headR * 0.34, eyeY, Math.max(0.7, headR * 0.065), 0, Math.PI * 2); ctx.arc(headR * 0.34, eyeY, Math.max(0.7, headR * 0.065), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6f7780'; ctx.lineWidth = Math.max(0.7, headR * 0.075); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-headR * 0.60, eyeY - headR * 0.27); ctx.lineTo(-headR * 0.15, eyeY - headR * 0.14);
    ctx.moveTo(headR * 0.15, eyeY - headR * 0.14); ctx.lineTo(headR * 0.60, eyeY - headR * 0.27); ctx.stroke();
    // Nariz, arrugas y barba de dos días.
    limb(0, headCY + headR * 0.02, headR * 0.08, headCY + headR * 0.30, Math.max(0.6, headR * 0.05), '#a96f54');
    ctx.strokeStyle = 'rgba(112,73,58,0.48)'; ctx.lineWidth = Math.max(0.5, headR * 0.035);
    ctx.beginPath(); ctx.moveTo(-headR * 0.48, headCY - headR * 0.48); ctx.lineTo(headR * 0.48, headCY - headR * 0.48); ctx.stroke();
    ctx.fillStyle = 'rgba(70,76,82,0.30)';
    ctx.beginPath(); ctx.ellipse(0, headCY + headR * 0.62, headR * 0.58, headR * 0.27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#762d32';
    ctx.beginPath(); ctx.ellipse(0, headCY + headR * 0.50, headR * 0.27, headR * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1e6dc'; ctx.fillRect(-headR * 0.18, headCY + headR * 0.36, headR * 0.36, Math.max(0.7, headR * 0.07));
  }
  ctx.restore();
  const headY = p.y - H * 0.91 - bob;
  // Vapor y marca de furia dibujados con líneas, sin depender de emojis.
  for (const side of [-1, 1]) {
    const rise = ((age * 0.9 + (side + 1) * 0.2) % 1 + 1) % 1;
    ctx.fillStyle = `rgba(235,240,245,${(1 - rise) * 0.55})`;
    ctx.beginPath(); ctx.arc(p.x + side * u * (0.85 + rise * 0.25), headY - rise * u * 1.2, u * (0.12 + rise * 0.17), 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#ff4058'; ctx.lineWidth = Math.max(1.2, u * 0.09); ctx.lineCap = 'round';
  for (let i = 0; i < 4; i += 1) {
    const a = -Math.PI * 0.85 + i * Math.PI * 0.23;
    ctx.beginPath(); ctx.moveTo(p.x + u * 1.25 + Math.cos(a) * u * 0.22, headY - u * 0.65 + Math.sin(a) * u * 0.22);
    ctx.lineTo(p.x + u * 1.25 + Math.cos(a) * u * 0.48, headY - u * 0.65 + Math.sin(a) * u * 0.48); ctx.stroke();
  }
  if (u > 3.5) {
    const phrases = ['¡ÁRBITRO!', '¡ES MANO!', '¡FALTA CLARA!', '#@$%!!'];
    const phrase = phrases[Math.floor(age * 0.8) % phrases.length];
    const by = headY - u * 1.25;
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    const width = Math.max(u * 4.8, ctx.measureText(phrase).width + 14);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#11141a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(p.x - width / 2, by - 7, width, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#11141a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(phrase, p.x, by + 1);
  }
  } finally {
    ctx.restore();
  }
};

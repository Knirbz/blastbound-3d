import * as THREE from 'three';
import type { BlastKind } from './logic';

// Original flame artwork, drawn once and reused as a texture. Keeping the shape
// separate from the particles makes the blast readable at phone size.
const colors: Record<BlastKind, { outline: string; edge: string; middle: string; hot: string }> = {
  normal: { outline: '#a72c27', edge: '#f45a26', middle: '#ffad37', hot: '#fff3ae' },
  powered: { outline: '#116caa', edge: '#1baad4', middle: '#64e3ee', hot: '#e1ffff' },
  chain: { outline: '#6334ab', edge: '#ad62eb', middle: '#e3a3fa', hot: '#fff0ff' },
};

export function makeBlastFlame(kind: BlastKind, variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const c = colors[kind];
  const lean = (variant - 1) * 13;

  const glow = ctx.createRadialGradient(128, 163, 13, 128, 163, 116);
  glow.addColorStop(0, `${c.middle}99`);
  glow.addColorStop(0.58, `${c.edge}55`);
  glow.addColorStop(1, `${c.edge}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(128, 163, 121, 88, 0, 0, Math.PI * 2);
  ctx.fill();

  // Broad base and uneven high tips form a single silhouette across the tile.
  ctx.beginPath();
  ctx.moveTo(20, 220);
  ctx.bezierCurveTo(4, 178, 33, 150, 48, 161);
  ctx.bezierCurveTo(37, 127, 70 + lean, 111, 75, 133);
  ctx.bezierCurveTo(70, 84, 94 + lean, 68, 96, 91);
  ctx.bezierCurveTo(99, 67, 119 + lean, 35, 121, 19);
  ctx.bezierCurveTo(143, 56, 130, 93, 143, 104);
  ctx.bezierCurveTo(151, 76, 176 - lean, 67, 176, 55);
  ctx.bezierCurveTo(184, 85, 177, 119, 187, 132);
  ctx.bezierCurveTo(208, 108, 223, 131, 216, 166);
  ctx.bezierCurveTo(238, 157, 250, 192, 233, 222);
  ctx.quadraticCurveTo(204, 244, 127, 240);
  ctx.quadraticCurveTo(48, 244, 20, 220);
  ctx.closePath();
  const body = ctx.createLinearGradient(0, 228, 0, 55);
  body.addColorStop(0, c.edge);
  body.addColorStop(0.43, c.middle);
  body.addColorStop(0.8, c.edge);
  body.addColorStop(1, c.middle);
  ctx.fillStyle = body;
  ctx.strokeStyle = c.outline;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();

  // A second, smaller flame remains bright when the outer edge overlaps blocks.
  ctx.beginPath();
  ctx.moveTo(62, 224);
  ctx.bezierCurveTo(52, 184, 75, 160, 86, 178);
  ctx.bezierCurveTo(82, 141, 104, 122, 106, 112);
  ctx.bezierCurveTo(121, 134, 116, 151, 123, 157);
  ctx.bezierCurveTo(135, 119, 148, 108, 150, 94);
  ctx.bezierCurveTo(164, 132, 151, 154, 168, 175);
  ctx.bezierCurveTo(186, 159, 202, 193, 190, 224);
  ctx.quadraticCurveTo(126, 237, 62, 224);
  ctx.closePath();
  const core = ctx.createLinearGradient(0, 225, 0, 105);
  core.addColorStop(0, c.hot);
  core.addColorStop(0.62, c.hot);
  core.addColorStop(1, c.middle);
  ctx.fillStyle = core;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

export function makeBlastCore(kind: BlastKind): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const c = colors[kind];
  const glow = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  glow.addColorStop(0, `${c.hot}dd`);
  glow.addColorStop(0.45, `${c.middle}99`);
  glow.addColorStop(1, `${c.edge}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 256, 256);

  const drawBurst = (outer: number, inner: number, fill: string, points: number, offset = 0) => {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI / points) + offset;
      const radius = i % 2 ? inner : outer * (0.87 + 0.13 * Math.sin(i * 4.7));
      const x = 128 + Math.cos(angle) * radius;
      const y = 128 + Math.sin(angle) * radius;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.fillStyle = fill;
    ctx.fill();
  };
  drawBurst(111, 73, c.outline, 10, -0.2);
  drawBurst(104, 69, c.edge, 10, -0.2);
  drawBurst(78, 54, c.middle, 9, 0.11);
  drawBurst(53, 37, c.hot, 9, 0.11);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

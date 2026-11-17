// The minimap: a square panel at the bottom-right with the avenue grid,
// the player's arrow, gold mission marker and flashing police blips.

import { G } from './state.js';
import { getMarker } from './missions.js';
import { roundRect } from './vehicles.js';

const SIZE = 176;
const PAD = 14;

export function drawMinimap(ctx, t) {
  const { w, h } = G.view;
  const x0 = w - SIZE - PAD, y0 = h - SIZE - PAD;
  const s = SIZE / G.city.size;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 20, 28, 0.78)';
  roundRect(ctx, x0 - 4, y0 - 4, SIZE + 8, SIZE + 8, 10);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x0, y0, SIZE, SIZE, 7);
  ctx.clip();
  ctx.fillStyle = '#233140';
  ctx.fillRect(x0, y0, SIZE, SIZE);
  // Avenues.
  ctx.strokeStyle = '#8fa3b5';
  ctx.lineWidth = Math.max(2, G.city.roadHalf * 2 * s);
  for (const c of G.city.roads) {
    ctx.beginPath(); ctx.moveTo(x0 + c * s, y0); ctx.lineTo(x0 + c * s, y0 + SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + c * s); ctx.lineTo(x0 + SIZE, y0 + c * s); ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * s, y0 + y * s, r, 0, Math.PI * 2); ctx.fill();
  };
  // Police blips flash blue/red.
  const phase = Math.floor(t * 4) % 2;
  for (const cop of G.cops) if (!cop.wrecked) dot(cop.x, cop.y, 3.2, phase ? '#4cc9f0' : '#ff5a5a');
  // Mission marker.
  const marker = getMarker();
  if (marker) {
    dot(marker.x, marker.y, 4.6 + Math.sin(t * 5) * 1.1, '#ffd23f');
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x0 + marker.x * s, y0 + marker.y * s, 7.5, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const p = G.player;
  ctx.translate(x0 + p.x * s, y0 + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#14213d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.6); ctx.lineTo(-2.4, 0); ctx.lineTo(-5, 4.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // North label.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x0 + SIZE - 10, y0 + 12);
}

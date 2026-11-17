// Lightweight particle system: one pooled array, additive little rects and
// circles with gravity/drag per particle. Sparks, smoke, muzzle flashes,
// impact puffs and mission-complete confetti all go through spawn().

import { G } from './state.js';

export function spawn(x, y, opts) {
  if (G.parts.length > 420) return;
  G.parts.push({
    x, y,
    vx: opts.vx ?? 0, vy: opts.vy ?? 0,
    life: 0, maxLife: opts.life ?? 0.5,
    size: opts.size ?? 3,
    color: opts.color ?? '#ffd23f',
    grav: opts.grav ?? 0,
    drag: opts.drag ?? 0,
    shrink: opts.shrink ?? true,
    circle: opts.circle ?? true,
  });
}

export function burst(x, y, count, color, speed = 160, life = 0.45, size = 3) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    spawn(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: life * (0.5 + Math.random()), size, drag: 4 });
  }
}

export const sparks = (x, y, n = 8) => burst(x, y, n, '#ffcf5c', 240, 0.35, 2.5);
export const smoke = (x, y, n = 1) => {
  for (let i = 0; i < n; i++) {
    spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, {
      vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 18,
      color: 'rgba(60,60,66,0.55)', life: 1.1 + Math.random() * 0.6, size: 7 + Math.random() * 6, shrink: false,
    });
  }
};
export const muzzle = (x, y, angle) => {
  spawn(x, y, { vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60, color: '#ffe66d', life: 0.07, size: 6, circle: false });
  burst(x, y, 2, '#ffb703', 90, 0.15, 2);
};
export const hitPuff = (x, y) => burst(x, y, 5, '#e63946', 110, 0.4, 3);
export const confetti = (x, y) => {
  for (const color of ['#ffd23f', '#3ddc84', '#4cc9f0', '#f72585']) burst(x, y, 7, color, 200, 0.8, 3);
};

export function updateParticles(dt) {
  const list = G.parts;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.maxLife) { list.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function drawParticles(ctx) {
  for (const p of G.parts) {
    const k = 1 - p.life / p.maxLife;
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.fillStyle = p.color;
    const s = p.shrink ? p.size * k + 0.6 : p.size;
    if (p.circle) { ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

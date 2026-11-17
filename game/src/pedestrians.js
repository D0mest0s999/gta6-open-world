// Pedestrians stroll the sidewalk ring of their city block, flee from
// gunfire and crashes, and — if a car hits one — go down and bring the
// police down on whoever was driving.

import { G, commitCrime } from './state.js';
import { collideBuildings } from './city.js';
import { hitPuff } from './particles.js';
import { sfx } from './audio.js';

const SHIRTS = ['#ff8fa3', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f78c6b', '#c8b6ff', '#ffffff', '#073b4c'];

export function spawnPeds(rng, count) {
  const blocks = G.city.blocks;
  for (let i = 0; i < count; i++) {
    const b = blocks[rng.int(0, blocks.length - 1)];
    const side = rng.int(0, 3);
    const t = rng.range(0, 1);
    const x = side === 0 ? b.x0 + 8 + t * (b.x1 - b.x0 - 16) : side === 1 ? b.x0 + 8 + t * (b.x1 - b.x0 - 16) : side === 2 ? b.x0 + 8 : b.x1 - 8;
    const y = side === 0 ? b.y0 + 8 : side === 1 ? b.y1 - 8 : b.y0 + 8 + t * (b.y1 - b.y0 - 16);
    G.peds.push({
      x, y, block: b, side, t, dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(34, 58), shirt: rng.pick(SHIRTS), skin: rng.pick(['#f1c27d', '#e0ac69', '#8d5524', '#ffdbac']),
      hp: 30, state: 'walk', fleeAt: 0, downAt: 0, phase: rng.range(0, 6),
    });
  }
}

// Advance a ped along its block ring; returns the new position.
function ringPoint(p) {
  const b = p.block, inset = 8;
  const w = (b.x1 - b.x0) - inset * 2, h = (b.y1 - b.y0) - inset * 2;
  const per = 2 * (w + h);
  let d = ((p.t * per) % per + per) % per;
  if (d < w) return { x: b.x0 + inset + d, y: b.y0 + inset };
  d -= w;
  if (d < h) return { x: b.x1 - inset, y: b.y0 + inset + d };
  d -= h;
  if (d < w) return { x: b.x1 - inset - d, y: b.y1 - inset };
  d -= w;
  return { x: b.x0 + inset, y: b.y1 - inset - d };
}

export function damagePed(p, amount, byPlayer) {
  if (p.state === 'down') return;
  p.hp -= amount;
  hitPuff(p.x, p.y);
  if (p.hp <= 0) {
    p.state = 'down';
    p.downAt = G.t;
    if (byPlayer) { commitCrime(1); sfx.hit(); }
  } else {
    p.state = 'flee';
    p.fleeAt = G.t + 4;
    if (byPlayer) commitCrime(0.4);
  }
}

export function updatePeds(dt) {
  const per = (b) => 2 * ((b.x1 - b.x0 - 16) + (b.y1 - b.y0 - 16));
  for (const p of G.peds) {
    if (p.state === 'down') continue;
    if (p.state === 'flee') {
      if (G.t > p.fleeAt) { p.state = 'walk'; continue; }
      const threat = G.player;
      const a = Math.atan2(p.y - threat.y, p.x - threat.x);
      p.x += Math.cos(a) * 120 * dt;
      p.y += Math.sin(a) * 120 * dt;
      collideBuildings(G.city, p, 8);
      continue;
    }
    p.t += (p.dir * p.speed * dt) / per(p.block);
    const pt = ringPoint(p);
    p.x = pt.x; p.y = pt.y;
  }
  // Cars versus pedestrians: a fast car that reaches a ped knocks it down.
  const testCar = (car, isPlayers) => {
    if (Math.abs(car.speed) < 55 || car.wrecked) return;
    for (const p of G.peds) {
      if (p.state === 'down') continue;
      if (Math.hypot(p.x - car.x, p.y - car.y) < 24) {
        damagePed(p, 999, isPlayers);
        if (isPlayers) G.shake = Math.max(G.shake, 4);
      }
    }
  };
  for (const car of G.cars) testCar(car, car === G.player.car);
  for (const car of G.cops) testCar(car, false);
  // Clear the long-downed so fresh peds can be topped up by main.
  for (let i = G.peds.length - 1; i >= 0; i--) {
    if (G.peds[i].state === 'down' && G.t - G.peds[i].downAt > 25) G.peds.splice(i, 1);
  }
}

export function drawPed(ctx, p, t) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(40,30,15,0.25)';
  ctx.beginPath(); ctx.ellipse(1.5, 3, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  if (p.state === 'down') {
    ctx.rotate(1.2);
    ctx.fillStyle = p.shirt;
    ctx.fillRect(-8, -3, 16, 6);
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(-10, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(t * 9 + p.phase) * 1.3;
  ctx.fillStyle = '#2f3542';
  ctx.fillRect(-4.5, -1 + Math.abs(bob) * 0.4, 3.4, 7);
  ctx.fillRect(1.2, -1 - Math.abs(bob) * 0.4, 3.4, 7);
  ctx.fillStyle = p.shirt;
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(0, -1.5 + bob * 0.3, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

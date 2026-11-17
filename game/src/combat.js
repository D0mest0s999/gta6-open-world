// Bullets and gunfire. The player shoots toward the mouse while on foot;
// police shoot back at three stars and up. Bullets are stopped by
// buildings and damage cars, pedestrians and the player.

import { G, commitCrime } from './state.js';
import { pointInBuilding } from './city.js';
import { damageCar } from './vehicles.js';
import { damagePed } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { muzzle, sparks } from './particles.js';
import { mouse } from './input.js';
import { sfx } from './audio.js';

export function fireBullet(x, y, angle, from) {
  G.bullets.push({
    x, y,
    vx: Math.cos(angle) * 780, vy: Math.sin(angle) * 780,
    life: 0.55, from,
  });
}

export function updateCombat(dt, mouseWorld) {
  const p = G.player;
  // Player gunfire.
  if (!p.car && mouse.down && p.shootCd <= 0 && G.mode === 'playing') {
    p.shootCd = 0.145;
    const gx = p.x + Math.cos(p.aim) * 20, gy = p.y + Math.sin(p.aim) * 20;
    fireBullet(gx, gy, p.aim + (Math.random() - 0.5) * 0.03, 'player');
    muzzle(gx, gy, p.aim);
    sfx.shot();
    commitCrime(0.22);
    // Nearby pedestrians panic.
    for (const ped of G.peds) {
      if (ped.state === 'walk' && Math.hypot(ped.x - p.x, ped.y - p.y) < 190) { ped.state = 'flee'; ped.fleeAt = G.t + 3; }
    }
  }
  // Move and resolve bullets.
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(G.city, b.x, b.y)) { sparks(b.x, b.y, 2); dead = true; }
    if (!dead && b.from === 'player') {
      for (const car of [...G.cars, ...G.cops]) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 23) {
          damageCar(car, 9, b.x, b.y);
          if (car.kind === 'police') commitCrime(0.3);
          sfx.hit();
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.state !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
            damagePed(ped, 20, true);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'police' && !p.car && Math.hypot(p.x - b.x, p.y - b.y) < 11) {
      hurtPlayer(7);
      dead = true;
    }
    if (!dead && b.from === 'police' && p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 23) {
      damageCar(p.car, 5, b.x, b.y);
      dead = true;
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function drawBullets(ctx) {
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const b of G.bullets) {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
  }
  ctx.stroke();
}

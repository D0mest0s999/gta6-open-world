// The Neon Harbor PD: wanted-level decay, cruiser spawns scaled to the
// star count, steering chases that ram the player's car, and officers who
// stop and shoot on foot at three stars or more.

import { G } from './state.js';
import { clamp, angleDelta } from './random.js';
import { lineBlocked } from './city.js';
import { makeCar, moveFreeCar } from './vehicles.js';
import { fireBullet } from './combat.js';
import { sfx } from './audio.js';

let spawnCd = 0;

export function wantedStars() {
  return G.wanted <= 0 ? 0 : Math.ceil(G.wanted);
}

function desiredCops() {
  if (G.wanted <= 0) return 0;
  return Math.min(1 + Math.ceil(G.wanted), 6);
}

function spawnCop(rng) {
  const p = G.player;
  const roads = G.city.roads;
  for (let tries = 0; tries < 8; tries++) {
    const vertical = rng.chance(0.5);
    const road = roads[rng.int(0, roads.length - 1)];
    const along = clamp((vertical ? p.y : p.x) + rng.range(-780, 780), 80, G.city.size - 80);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    if (Math.hypot(x - p.x, y - p.y) < 560) continue;
    const cop = makeCar(x, y, 0, '#f2f2f2', 'police');
    cop.top = 448;
    cop.mode = 'chase';
    cop.shootCd = rng.range(0.4, 1.2);
    cop.deadAt = 0;
    G.cops.push(cop);
    return;
  }
}

export function updatePolice(dt, rng) {
  const p = G.player;
  // Who can see the player right now?
  let anySeen = false;
  for (const cop of G.cops) {
    if (cop.wrecked) continue;
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    if (d < 540 && !lineBlocked(G.city, cop.x, cop.y, p.x, p.y)) { anySeen = true; break; }
  }
  if (anySeen) G.lastSeenAt = G.t;
  // Wanted decays once the heat is off and nobody is watching.
  if (G.wanted > 0 && G.t - G.lastCrimeAt > 5 && G.t - G.lastSeenAt > 3.5) {
    G.wanted = Math.max(0, G.wanted - dt * 0.085);
  }

  spawnCd -= dt;
  const want = desiredCops();
  const active = G.cops.filter((c) => !c.wrecked).length;
  if (active < want && spawnCd <= 0) { spawnCop(rng); spawnCd = 1.4; }

  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    if (cop.wrecked) {
      if (!cop.deadAt) cop.deadAt = G.t;
      if (G.t - cop.deadAt > 25) G.cops.splice(i, 1);
      continue;
    }
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (G.wanted <= 0) cop.mode = 'leave';
    if (cop.mode === 'leave') {
      const away = Math.atan2(cop.y - p.y, cop.x - p.x);
      steer(cop, away, cop.top * 0.7, dt);
      moveFreeCar(cop, dt);
      if (dist > 880) G.cops.splice(i, 1);
      continue;
    }
    // Chase: aim a little ahead of the player's motion.
    const lead = p.car ? 0.35 : 0.1;
    const tx = p.x + Math.cos(p.angle) * (p.car ? p.car.speed : 0) * lead;
    const ty = p.y + Math.sin(p.angle) * (p.car ? p.car.speed : 0) * lead;
    const shootingStandoff = !p.car && wantedStars() >= 3 && dist < 210;
    if (shootingStandoff) {
      cop.speed = Math.max(0, cop.speed - 500 * dt);
      cop.angle += clamp(angleDelta(cop.angle, Math.atan2(dy, dx)), -2.4 * dt, 2.4 * dt);
      cop.shootCd -= dt;
      if (cop.shootCd <= 0 && dist > 60 && !lineBlocked(G.city, cop.x, cop.y, p.x, p.y)) {
        cop.shootCd = 0.85 + rng() * 0.5;
        fireBullet(cop.x + Math.cos(cop.angle) * 26, cop.y + Math.sin(cop.angle) * 26,
          Math.atan2(dy, dx) + (rng() - 0.5) * 0.11, 'police');
        sfx.shot();
      }
    } else {
      const targetSpeed = dist < 52 ? 130 : cop.top;
      steer(cop, Math.atan2(ty - cop.y, tx - cop.x), targetSpeed, dt);
    }
    moveFreeCar(cop, dt);
  }
}

function steer(cop, desiredAngle, targetSpeed, dt) {
  cop.angle += clamp(angleDelta(cop.angle, desiredAngle), -2.7 * dt, 2.7 * dt);
  const accel = targetSpeed > cop.speed ? 250 : 420;
  cop.speed += clamp(targetSpeed - cop.speed, -accel * dt, accel * dt);
}

// Distance to the closest active cruiser, for the siren volume.
export function nearestCopDist() {
  let best = Infinity;
  for (const cop of G.cops) {
    if (cop.wrecked) continue;
    best = Math.min(best, Math.hypot(G.player.x - cop.x, G.player.y - cop.y));
  }
  return best;
}

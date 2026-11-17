// The player: on foot with WASD + mouse aim, sprint on Shift, and E to
// climb into (steal) or out of a parked car. While driving, the player
// object rides on the car's position and vehicles.js does the physics.

import { G, commitCrime } from './state.js';
import { clamp } from './random.js';
import { collideBuildings } from './city.js';
import { isDown, wasPressed } from './input.js';
import { drivePlayerCar } from './vehicles.js';
import { sfx } from './audio.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, aim: 0, hp: 100, maxHp: 100,
    car: null, lastHurtAt: -99, shootCd: 0, radius: 10,
  };
}

export function hurtPlayer(amount) {
  const p = G.player;
  if (G.mode !== 'playing' || p.hp <= 0) return;
  p.hp -= amount;
  p.lastHurtAt = G.t;
  G.shake = Math.min(8, G.shake + 2.5);
  sfx.hurt();
}

function nearestStealableCar() {
  let best = null, bd = 58 * 58;
  for (const car of G.cars) {
    if (car.kind !== 'parked' || car.wrecked) continue;
    const d = (car.x - G.player.x) ** 2 + (car.y - G.player.y) ** 2;
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updatePlayer(dt, mouseWorld) {
  const p = G.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  // Slow health regen up to half after a quiet spell.
  if (p.hp > 0 && p.hp < 50 && G.t - p.lastHurtAt > 6) p.hp = Math.min(50, p.hp + 5 * dt);

  if (p.car) {
    drivePlayerCar(p.car, dt);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    if (p.car.wrecked) {
      // Thrown clear of the wreck.
      p.car = null;
      p.x += 30; p.y += 10;
      hurtPlayer(12);
      return;
    }
    if (wasPressed('KeyE')) {
      const car = p.car;
      p.car = null;
      car.speed = 0;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      collideBuildings(G.city, p, p.radius);
      sfx.click();
    }
    return;
  }

  // On foot.
  let mx = (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0);
  let my = (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0);
  const sprint = isDown('ShiftLeft') || isDown('ShiftRight');
  const speed = sprint ? 268 : 172;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.angle = Math.atan2(my, mx);
    collideBuildings(G.city, p, p.radius);
  }
  p.aim = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);

  if (wasPressed('KeyE')) {
    const car = nearestStealableCar();
    if (car) {
      p.car = car;
      p.x = car.x; p.y = car.y;
      commitCrime(1); // grand theft auto: the wanted system notices
      sfx.steal();
    }
  }
}

export function drawPlayer(ctx, t) {
  const p = G.player;
  if (p.car) {
    // A bobbing marker so the player can spot their own car in traffic.
    ctx.fillStyle = '#ffd23f';
    const bob = Math.sin(t * 5) * 3;
    ctx.beginPath();
    ctx.moveTo(p.car.x, p.car.y - 34 + bob);
    ctx.lineTo(p.car.x - 7, p.car.y - 45 + bob);
    ctx.lineTo(p.car.x + 7, p.car.y - 45 + bob);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(40,30,15,0.3)';
  ctx.beginPath(); ctx.ellipse(1.5, 3.5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Legs
  ctx.fillStyle = '#26324a';
  ctx.fillRect(-5, 0, 4, 8);
  ctx.fillRect(1.5, 0, 4, 8);
  // Torso: sunset-orange jacket, unmistakably the protagonist.
  ctx.fillStyle = '#ff7b00';
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-8, -2.4, 16, 4.8);
  // Head
  ctx.fillStyle = '#8d5524';
  ctx.beginPath(); ctx.arc(0, -1, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14213d';
  ctx.beginPath(); ctx.arc(0, -2.4, 4.6, Math.PI, Math.PI * 2); ctx.fill();
  // Gun arm toward the aim.
  ctx.rotate(p.aim);
  ctx.fillStyle = '#22252b';
  ctx.fillRect(6, -1.6, 13, 3.2);
  ctx.fillStyle = '#454a51';
  ctx.fillRect(15, -1.1, 6, 2.2);
  ctx.restore();
}

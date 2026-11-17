// Cars: traffic that follows the avenue lanes and stops for the car ahead,
// parked cars waiting to be stolen, and the free-steering physics used by
// the player's car and the police. A car is a plain object; kind is
// 'traffic', 'parked' or 'police'.

import { G, commitCrime } from './state.js';
import { clamp } from './random.js';
import { collideBuildings } from './city.js';
import { isDown } from './input.js';
import { sparks, smoke } from './particles.js';
import { sfx } from './audio.js';

export const CAR_COLORS = ['#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261', '#9b5de5', '#00bbf9', '#f15bb5', '#8ac926', '#e0e1dd', '#3a506b', '#bc6c25'];
const LANE = 24;

let nextId = 1;
export function makeCar(x, y, angle, color, kind) {
  return {
    id: nextId++, x, y, angle, speed: 0, color, kind,
    hp: 100, wrecked: false, top: 400, cruise: 170,
    axis: 'y', dir: 1, roadI: 0, nextCross: 0, smokeAt: 0,
  };
}

// Lane offset from the road centre for a direction of travel (right-hand).
function laneOff(axis, dir) {
  return axis === 'y' ? (dir > 0 ? -LANE : LANE) : (dir > 0 ? LANE : -LANE);
}
function travelAngle(axis, dir) {
  return axis === 'y' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
}

function placeOnRoad(car, rng, nearX, nearY) {
  const roads = G.city.roads;
  car.axis = rng.chance(0.5) ? 'x' : 'y';
  car.dir = rng.chance(0.5) ? 1 : -1;
  car.roadI = rng.int(0, roads.length - 1);
  let along = rng.range(60, G.city.size - 60);
  if (nearX !== undefined) {
    // Respawn in the player's neighbourhood so the streets stay alive.
    const base = car.axis === 'y' ? nearY : nearX;
    along = base + rng.range(-950, 950);
    if (along < 60 || along > G.city.size - 60) along = rng.range(60, G.city.size - 60);
    car.roadI = nearestRoadIndex(car.axis === 'y' ? nearX : nearY);
  }
  const perp = roads[car.roadI] + laneOff(car.axis, car.dir);
  if (car.axis === 'y') { car.x = perp; car.y = along; } else { car.x = along; car.y = perp; }
  car.angle = travelAngle(car.axis, car.dir);
  car.cruise = rng.range(140, 215);
  car.speed = car.cruise;
  setNextCross(car);
}

function nearestRoadIndex(coord) {
  let best = 0, bd = Infinity;
  G.city.roads.forEach((c, i) => { const d = Math.abs(c - coord); if (d < bd) { bd = d; best = i; } });
  return best;
}

function setNextCross(car) {
  const pos = car.axis === 'y' ? car.y : car.x;
  let best = car.dir > 0 ? Infinity : -Infinity;
  for (const c of G.city.roads) {
    if (car.dir > 0 ? (c > pos + 4 && c < best) : (c < pos - 4 && c > best)) best = c;
  }
  car.nextCross = best;
}

export function spawnTraffic(rng, count) {
  for (let i = 0; i < count; i++) {
    const car = makeCar(0, 0, 0, rng.pick(CAR_COLORS), 'traffic');
    placeOnRoad(car, rng);
    G.cars.push(car);
  }
}

export function spawnParked(rng) {
  const roads = G.city.roads;
  for (const c of roads) {
    for (let d = 200; d < G.city.size - 120; d += rng.range(150, 260)) {
      if (rng.chance(0.35)) continue;
      const vertical = rng.chance(0.5);
      const side = rng.chance(0.5) ? -1 : 1;
      const off = side * (G.city.roadHalf - 19);
      const x = vertical ? c + off : d;
      const y = vertical ? d : c + off;
      const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const car = makeCar(x, y, angle, rng.pick(CAR_COLORS), 'parked');
      car.top = rng.range(360, 470);
      G.cars.push(car);
    }
  }
}

export function spawnParkedAt(x, y, angle, color) {
  const car = makeCar(x, y, angle, color, 'parked');
  car.top = 470;
  G.cars.push(car);
  return car;
}

// The nearest other vehicle directly ahead of a lane-following car.
function carAhead(car) {
  const dx = Math.cos(car.angle), dy = Math.sin(car.angle);
  let best = null, bestDist = 86;
  const test = (o) => {
    if (o === car || o.wrecked) return;
    const rx = o.x - car.x, ry = o.y - car.y;
    const fwd = rx * dx + ry * dy;
    const lat = Math.abs(rx * -dy + ry * dx);
    if (fwd > 6 && fwd < bestDist && lat < 30) { bestDist = fwd; best = o; }
  };
  for (const o of G.cars) test(o);
  for (const o of G.cops) test(o);
  return best;
}

function updateTrafficCar(car, dt, rng) {
  if (car.wrecked) { car.speed = 0; return; }
  let desired = car.cruise;
  const ahead = carAhead(car);
  if (ahead) desired = Math.min(desired, ahead.speed ?? 0);
  // A pedestrian in the lane or the player on foot: traffic brakes.
  const px = car.x + Math.cos(car.angle) * 44, py = car.y + Math.sin(car.angle) * 44;
  if (!G.player.car && Math.hypot(G.player.x - px, G.player.y - py) < 30) desired = 0;
  for (const p of G.peds) {
    if (p.state !== 'down' && Math.hypot(p.x - px, p.y - py) < 26) { desired = 0; break; }
  }
  car.speed += clamp(desired - car.speed, -340 * dt, 130 * dt);
  const move = car.speed * dt;
  if (car.axis === 'y') car.y += car.dir * move; else car.x += car.dir * move;
  // Intersection: maybe turn onto the crossing avenue.
  const pos = car.axis === 'y' ? car.y : car.x;
  if ((car.dir > 0 && pos >= car.nextCross) || (car.dir < 0 && pos <= car.nextCross)) {
    const crossI = G.city.roads.indexOf(car.nextCross);
    if (crossI >= 0 && rng.chance(0.32)) {
      const oldRoad = G.city.roads[car.roadI];
      car.axis = car.axis === 'y' ? 'x' : 'y';
      car.roadI = crossI;
      car.dir = rng.chance(0.5) ? 1 : -1;
      const perp = G.city.roads[car.roadI] + laneOff(car.axis, car.dir);
      if (car.axis === 'x') { car.x = oldRoad; car.y = perp; } else { car.x = perp; car.y = oldRoad; }
      car.angle = travelAngle(car.axis, car.dir);
    }
    setNextCross(car);
  }
  // Keep traffic circulating near the player.
  const offWorld = car.x < -60 || car.y < -60 || car.x > G.city.size + 60 || car.y > G.city.size + 60;
  if (offWorld || Math.hypot(car.x - G.player.x, car.y - G.player.y) > 1500) placeOnRoad(car, rng, G.player.x, G.player.y);
}

export function updateTraffic(dt, rng) {
  for (const car of G.cars) if (car.kind === 'traffic') updateTrafficCar(car, dt, rng);
}

// Free-steering movement shared by the player's car and police cars.
// Returns the impact speed when a building stops the car.
export function moveFreeCar(car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const pos = { x: nx, y: ny };
  const hit = collideBuildings(G.city, pos, 19);
  let impact = 0;
  if (hit) {
    impact = Math.abs(car.speed);
    if (impact > 130) {
      damageCar(car, (impact - 130) / 9, pos.x, pos.y);
      sfx.crash(Math.min(1, impact / 420));
      G.shake = Math.min(9, impact / 55);
    }
    car.speed = -car.speed * 0.28;
  }
  car.x = pos.x;
  car.y = pos.y;
  return impact;
}

export function damageCar(car, amount, x = car.x, y = car.y) {
  if (car.wrecked) return;
  car.hp -= amount;
  sparks(x, y, 6);
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    smoke(x, y, 10);
  }
}

// The player's driving: throttle, brake/reverse, speed-sensitive steering.
export function drivePlayerCar(car, dt) {
  if (car.wrecked) { car.speed = 0; return; }
  const fwd = isDown('KeyW') || isDown('ArrowUp');
  const back = isDown('KeyS') || isDown('ArrowDown');
  const left = isDown('KeyA') || isDown('ArrowLeft');
  const right = isDown('KeyD') || isDown('ArrowRight');
  if (fwd) car.speed += 300 * dt;
  else if (back) car.speed += (car.speed > 12 ? -430 : -170) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 55 * dt);
  car.speed *= Math.max(0, 1 - 0.35 * dt);
  car.speed = clamp(car.speed, -150, car.top);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  if (steer && Math.abs(car.speed) > 4) {
    const grip = clamp(Math.abs(car.speed) / 150, 0.25, 1.25);
    car.angle += steer * grip * 1.75 * dt * Math.sign(car.speed);
  }
  moveFreeCar(car, dt);
}

// Circle-vs-circle resolution between every pair of nearby cars.
export function resolveCarOverlaps() {
  const all = [...G.cars, ...G.cops];
  if (G.player.car) all.push(G.player.car);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 42 * 42 || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (42 - d) / 2;
      const ux = dx / d, uy = dy / d;
      const rel = Math.abs(a.speed - b.speed);
      if (a.kind !== 'parked' || a === G.player.car) { a.x -= ux * push; a.y -= uy * push; }
      if (b.kind !== 'parked' || b === G.player.car) { b.x += ux * push; b.y += uy * push; }
      if (rel > 120) {
        damageCar(a, rel / 16, a.x, a.y);
        damageCar(b, rel / 16, b.x, b.y);
        sfx.crash(Math.min(1, rel / 380));
        if ((a.kind === 'police' || b.kind === 'police') && (a === G.player.car || b === G.player.car)) commitCrime(0.6);
      }
      if (a === G.player.car || b === G.player.car) { const o = a === G.player.car ? b : a; if (o.kind === 'traffic') o.speed = Math.min(o.speed, 40); }
    }
  }
}

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(40,30,15,0.30)';
  ctx.beginPath(); ctx.ellipse(4, 6, 27, 15, car.angle, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  // Wheels
  ctx.fillStyle = '#15161a';
  for (const [wx, wy] of [[-15, -12], [15, -12], [-15, 12], [15, 12]]) ctx.fillRect(wx - 5, wy - 3, 10, 6);
  // Body
  ctx.fillStyle = car.wrecked ? '#3a3a3e' : car.color;
  roundRect(ctx, -24, -12, 48, 24, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, -24, -12, 48, 8, 7);
  ctx.fill();
  // Cabin and glass
  ctx.fillStyle = car.wrecked ? '#22242a' : '#1d2733';
  roundRect(ctx, -9, -9.5, 17, 19, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,245,0.8)';
  ctx.fillRect(6, -8.5, 3.5, 17);
  ctx.fillRect(-11.5, -8.5, 3, 17);
  // Headlights
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(22.5, -9, 2.6, 5);
  ctx.fillRect(22.5, 4, 2.6, 5);
  ctx.fillStyle = '#ff5a5a';
  ctx.fillRect(-25, -9, 2.4, 5);
  ctx.fillRect(-25, 4, 2.4, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    roundRect(ctx, -24, -12, 48, 24, 7); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -12, 13, 24);
    ctx.fillStyle = '#1d2733';
    roundRect(ctx, -9, -9.5, 17, 19, 4); ctx.fill();
    const phase = Math.floor(t * 5) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#ffd0cc';
    ctx.fillRect(-4, -7, 8, 6);
    ctx.fillStyle = phase ? '#99c2ff' : '#2f7bff';
    ctx.fillRect(-4, 1, 8, 6);
  }
  if (car.hp < 55 && !car.wrecked) {
    ctx.fillStyle = 'rgba(30,30,30,0.35)';
    ctx.beginPath(); ctx.arc(14, 0, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (car.wrecked && Math.random() < 0.25) smoke(car.x, car.y, 1);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

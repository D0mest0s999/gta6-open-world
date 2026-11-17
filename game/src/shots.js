// Screenshot staging: ?shot=<name>&seed=<n> builds a deterministic scene
// for the maker's screenshots. Each scene poses the player, traffic and
// police, then main.js runs fixed steps and renders one settled frame.

import { G } from './state.js';
import { makeCar, spawnParkedAt } from './vehicles.js';
import { initMissions } from './missions.js';
import { muzzle, sparks, smoke } from './particles.js';

function nextCrossAhead(axis, dir, pos) {
  let best = dir > 0 ? Infinity : -Infinity;
  for (const c of G.city.roads) {
    if (dir > 0 ? (c > pos + 4 && c < best) : (c < pos - 4 && c > best)) best = c;
  }
  return best;
}

// Teleport the i-th traffic car onto a lane near a point, facing its way.
function poseTraffic(i, axis, roadI, along, dir) {
  const traffic = G.cars.filter((c) => c.kind === 'traffic');
  const car = traffic[i % traffic.length];
  if (!car) return null;
  const roads = G.city.roads;
  const lane = axis === 'y' ? (dir > 0 ? -24 : 24) : (dir > 0 ? 24 : -24);
  car.axis = axis;
  car.dir = dir;
  car.roadI = roadI;
  if (axis === 'y') { car.x = roads[roadI] + lane; car.y = along; }
  else { car.x = along; car.y = roads[roadI] + lane; }
  car.angle = axis === 'y' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  car.speed = car.cruise;
  car.nextCross = nextCrossAhead(axis, dir, axis === 'y' ? car.y : car.x);
  return car;
}

function poseCop(x, y, angle) {
  const cop = makeCar(x, y, angle, '#f2f2f2', 'police');
  cop.top = 448;
  cop.mode = 'chase';
  cop.shootCd = 1;
  cop.deadAt = 0;
  G.cops.push(cop);
  return cop;
}

export function stageShot(name) {
  const R = G.city.roads;
  const p = G.player;
  if (name === 'cover') {
    initMissions(0);
    // On the avenue just south of the downtown crossing: always visible.
    p.x = R[2] - 40; p.y = R[2] + 128;
    p.aim = -0.9;
    poseTraffic(0, 'y', 2, R[2] - 210, 1);
    poseTraffic(1, 'y', 2, R[2] + 300, -1);
    poseTraffic(2, 'x', 2, R[2] - 330, 1);
    poseTraffic(3, 'x', 1, R[2] + 130, -1);
  } else if (name === 'drive') {
    initMissions(0);
    const car = spawnParkedAt(R[2] - 260, R[3] + 24, 0, '#e63946');
    p.car = car;
    p.x = car.x; p.y = car.y;
    car.speed = 235;
    poseTraffic(0, 'x', 3, R[2] + 60, 1);
    poseTraffic(1, 'x', 3, R[2] + 430, 1);
    poseTraffic(2, 'x', 3, R[2] - 560, -1);
    poseTraffic(3, 'y', 3, R[3] - 240, 1);
  } else if (name === 'chase') {
    initMissions(2); // getaway objective on the HUD, three stars
    const car = spawnParkedAt(R[3] - 120, R[2] + 24, 0, '#457b9d');
    p.car = car;
    p.x = car.x; p.y = car.y;
    car.speed = 330;
    poseCop(car.x - 170, car.y - 6, 0.12);
    poseCop(car.x - 330, car.y + 52, -0.1);
    poseCop(car.x - 90, car.y - 120, 0.5);
    poseTraffic(0, 'x', 2, R[3] + 420, 1);
    poseTraffic(1, 'y', 4, R[2] - 260, 1);
  } else if (name === 'combat') {
    initMissions(1);
    // A shootout in the middle of the crossing: road under everyone's feet.
    p.x = R[1]; p.y = R[2] + 24;
    p.aim = 0.15;
    G.wanted = 2;
    G.lastCrimeAt = 0;
    const victim = spawnParkedAt(p.x + 150, p.y + 10, 0.2, '#2a9d8f');
    victim.hp = 26;
    poseCop(p.x - 210, p.y - 54, 0.6);
    poseTraffic(0, 'y', 1, R[1] - 260, 1);
  }
  G.cam.x = p.x;
  G.cam.y = p.y;
}

// Effects added after the settle steps so they are alive in the frame;
// also restores the staged aim, which live mouse input overwrote.
export function stageFinalFx(name) {
  const p = G.player;
  if (name === 'cover') p.aim = -0.9;
  if (name === 'combat') p.aim = 0.15;
  if (name === 'combat') {
    const gx = p.x + Math.cos(p.aim) * 22, gy = p.y + Math.sin(p.aim) * 22;
    muzzle(gx, gy, p.aim);
    sparks(p.x + 150, p.y + 10, 10);
    smoke(p.x + 150, p.y + 4, 2);
    G.bullets.push({ x: gx + 30, y: gy + 11, vx: Math.cos(p.aim) * 780, vy: Math.sin(p.aim) * 780, life: 0.5, from: 'player' });
  }
  if (name === 'chase') {
    sparks(p.x - 60, p.y + 16, 6);
  }
}

// SUNFALL: Neon Harbor — boot, the frame loop, camera, screens and the
// wiring between every system. Update order per frame: player, traffic,
// police, pedestrians, combat, particles, missions; then the world is
// drawn ground-up and the HUD and minimap go on top.

import { G } from './state.js';
import { makeRng, clamp, lerp } from './random.js';
import { initInput, mouse, wasPressed, endFrame } from './input.js';
import { buildCity, drawGround, drawProps, drawBuildings } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic, resolveCarOverlaps, drawCar } from './vehicles.js';
import { spawnPeds, updatePeds, drawPed } from './pedestrians.js';
import { makePlayer, updatePlayer, drawPlayer } from './player.js';
import { updatePolice, nearestCopDist } from './police.js';
import { updateCombat, drawBullets } from './combat.js';
import { updateParticles, drawParticles } from './particles.js';
import { initMissions, updateMissions, drawMarker } from './missions.js';
import { drawHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { initAudio, sfx, setEngine, setSiren } from './audio.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { stageShot, stageFinalFx } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number.parseInt(params.get('seed') || '1', 10) || 1;
window.__shotReady = false;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
G.canvas = canvas;
G.ctx = ctx;
G.shot = shotName;

function resize() {
  canvas.width = Math.min(innerWidth, 1600);
  canvas.height = Math.min(innerHeight, 1000);
  G.view.w = canvas.width;
  G.view.h = canvas.height;
}
addEventListener('resize', resize);
resize();

const el = (id) => document.getElementById(id);
const screens = { title: el('title-screen'), pause: el('pause-screen'), over: el('over-screen') };

function showScreen(name) {
  for (const [key, node] of Object.entries(screens)) node.classList.toggle('hidden', key !== name);
}

function buildWorld(seed, missionIndex, cash) {
  G.rng = makeRng(seed);
  G.seed = seed;
  G.city = buildCity(G.rng);
  G.cars = [];
  G.cops = [];
  G.peds = [];
  G.bullets = [];
  G.parts = [];
  G.wanted = 0;
  G.lastCrimeAt = -99;
  G.lastSeenAt = -99;
  G.cash = cash;
  G.t = 0;
  spawnParked(G.rng);
  spawnTraffic(G.rng, 16);
  spawnPeds(G.rng, 26);
  const R = G.city.roads;
  G.player = makePlayer(R[2] + 84, R[2] + 108);
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
  initMissions(missionIndex);
}

function startRun(missionIndex, cash) {
  buildWorld((Date.now() % 90000) + 17, missionIndex, cash);
  G.mode = 'playing';
  showScreen(null);
  sfx.click();
}

function gameOver() {
  G.mode = 'over';
  setEngine(false);
  setSiren(0);
  const story = G.msn.index >= 3 ? 'Story complete — free roaming' : `Reached mission ${G.msn.index + 1} of 3`;
  el('over-stats').textContent =
    `Cash earned this run: $${G.earned.toLocaleString()} • Banked: $${G.cash.toLocaleString()} • ${story}`;
  showScreen('over');
}

// --- One simulation step -------------------------------------------------
function step(dt) {
  G.t += dt;
  const mouseWorld = {
    x: G.cam.x + (mouse.x - G.view.w / 2),
    y: G.cam.y + (mouse.y - G.view.h / 2),
  };
  updatePlayer(dt, mouseWorld);
  updateTraffic(dt, G.rng);
  updatePolice(dt, G.rng);
  updatePeds(dt);
  updateCombat(dt, mouseWorld);
  updateParticles(dt);
  updateMissions(dt);
  resolveCarOverlaps();
  if (G.peds.length < 18) spawnPeds(G.rng, 2);
  if (G.player.hp <= 0 && G.mode === 'playing') gameOver();
}

// --- Rendering ------------------------------------------------------------
function render() {
  const { w, h } = G.view;
  const shakeX = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shakeY = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const vx = G.cam.x - w / 2, vy = G.cam.y - h / 2;
  ctx.fillStyle = '#0e2a3a';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-vx + shakeX, -vy + shakeY);
  drawGround(ctx, G.city, vx, vy, w, h);
  drawProps(ctx, G.city, vx, vy, w, h);
  drawMarker(ctx, G.t);
  for (const car of G.cars) drawCar(ctx, car, G.t);
  for (const cop of G.cops) drawCar(ctx, cop, G.t);
  for (const ped of G.peds) drawPed(ctx, ped, G.t);
  drawPlayer(ctx, G.t);
  drawBullets(ctx);
  drawParticles(ctx);
  drawBuildings(ctx, G.city, vx, vy, w, h);
  ctx.restore();
  if (G.mode !== 'title') {
    drawHud(ctx);
    drawMinimap(ctx, G.t);
  }
}

function updateCamera(dt) {
  const p = G.player;
  let tx = p.x, ty = p.y;
  if (p.car) { tx += Math.cos(p.car.angle) * p.car.speed * 0.22; ty += Math.sin(p.car.angle) * p.car.speed * 0.22; }
  const k = G.mode === 'title' ? 0.8 : 5.2;
  G.cam.x = lerp(G.cam.x, tx, Math.min(1, k * dt));
  G.cam.y = lerp(G.cam.y, ty, Math.min(1, k * dt));
  const hw = G.view.w / 2, hh = G.view.h / 2;
  G.cam.x = G.city.size <= G.view.w ? G.city.size / 2 : clamp(G.cam.x, hw - 140, G.city.size - hw + 140);
  G.cam.y = G.city.size <= G.view.h ? G.city.size / 2 : clamp(G.cam.y, hh - 140, G.city.size - hh + 140);
  G.shake = Math.max(0, G.shake - dt * 26);
}

// --- Boot -----------------------------------------------------------------
initInput(canvas, initAudio);
buildWorld(7, 0, 0);

const save = loadSave();
if (save) {
  el('btn-continue').classList.remove('hidden');
  el('continue-note').textContent = `Saved run: $${save.cash.toLocaleString()} banked, mission ${Math.min(save.missionIndex + 1, 3)} of 3`;
}
el('btn-new').addEventListener('click', () => { clearSave(); storeSave(0, 0); G.earned = 0; startRun(0, 0); });
el('btn-continue').addEventListener('click', () => { const s = loadSave(); if (s) { G.earned = 0; startRun(s.missionIndex, s.cash); } });
el('btn-resume').addEventListener('click', () => { G.mode = 'playing'; showScreen(null); sfx.click(); });
el('btn-restart').addEventListener('click', () => { G.earned = 0; startRun(G.msn.index, G.cash); });
el('btn-again').addEventListener('click', () => { startRun(G.msn.index, G.cash); });

if (shotName) {
  // Screenshot mode: pose the scene, settle it with fixed steps, freeze.
  showScreen(null);
  G.mode = 'playing';
  buildWorld(shotSeed * 1000 + 41, 0, 250);
  stageShot(shotName);
  const steps = { cover: 36, drive: 26, chase: 34, combat: 30 }[shotName] ?? 30;
  for (let i = 0; i < steps; i++) step(1 / 30);
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
  updateCamera(10);
  stageFinalFx(shotName);
  render();
  window.__shotReady = true;
  const freeze = () => { render(); requestAnimationFrame(freeze); };
  requestAnimationFrame(freeze);
} else {
  showScreen('title');
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    if (G.mode === 'playing') {
      step(dt);
      if (wasPressed('KeyP') || wasPressed('Escape')) { G.mode = 'paused'; showScreen('pause'); }
    } else if (G.mode === 'paused') {
      if (wasPressed('KeyP') || wasPressed('Escape')) { G.mode = 'playing'; showScreen(null); }
    } else if (G.mode === 'title') {
      // The city lives behind the title: traffic rolls, peds stroll.
      G.t += dt;
      updateTraffic(dt, G.rng);
      updatePeds(dt);
      updateParticles(dt);
      const cx = 1700 + Math.cos(G.t * 0.05) * 330;
      const cy = 1700 + Math.sin(G.t * 0.037) * 330;
      G.cam.x = lerp(G.cam.x, cx, dt * 0.7);
      G.cam.y = lerp(G.cam.y, cy, dt * 0.7);
    }
    if (G.mode === 'playing') {
      updateCamera(dt);
      const p = G.player;
      setEngine(!!p.car, Math.abs(p.car ? p.car.speed : 0) / 430);
      const nd = nearestCopDist();
      setSiren(G.wanted > 0 && nd < 640 ? clamp(1 - nd / 640, 0.08, 1) : 0);
    }
    render();
    endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

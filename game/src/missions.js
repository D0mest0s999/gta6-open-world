// The story of SUNFALL: Neon Harbor in three missions, then repeatable
// delivery jobs forever. A tiny state machine: index + step, a marker in
// the world, objective text for the HUD, cash on completion, progress
// saved through save.js.

import { G, showBanner, commitCrime } from './state.js';
import { spawnParkedAt } from './vehicles.js';
import { storeSave } from './save.js';
import { confetti } from './particles.js';
import { sfx } from './audio.js';

const STORY = [
  { title: 'Mission 1 — Harbor Wheels', pay: 600 },
  { title: 'Mission 2 — The Package', pay: 1000 },
  { title: 'Mission 3 — Sunfall Getaway', pay: 1800 },
];

export function initMissions(index) {
  G.msn = { index, step: 0, targetCar: null, target: null, timer: 0, jobPay: 0 };
  if (index === 0) {
    // The gold coupe waits on the east kerb of the 3rd avenue.
    G.msn.targetCar = spawnParkedAt(G.city.roads[2] + 56, 1010, Math.PI / 2, '#ffd23f');
    G.msn.target = { x: G.msn.targetCar.x, y: G.msn.targetCar.y };
    showBanner('Harbor Wheels', 'Steal the gold coupe marked on your map', 4.5);
  } else if (index === 1) {
    G.msn.target = { x: G.city.roads[1] - 92, y: G.city.roads[3] };
    showBanner('The Package', 'Pick up the package on the west sidewalk', 4.5);
  } else if (index === 2) {
    G.msn.target = { x: G.city.roads[0], y: G.city.roads[5] };
    G.wanted = Math.max(G.wanted, 3);
    commitCrime(0);
    showBanner('Sunfall Getaway', 'Lose yourself at the getaway point, far south-west', 4.5);
  } else {
    setupJob();
  }
}

function setupJob() {
  const rng = G.rng;
  const roads = G.city.roads;
  const roadside = () => {
    const vertical = rng.chance(0.5);
    const c = roads[rng.int(0, roads.length - 1)];
    const along = rng.range(200, G.city.size - 200);
    const side = rng.chance(0.5) ? -92 : 92;
    return vertical ? { x: c + side, y: along } : { x: along, y: c + side };
  };
  G.msn.step = 0;
  G.msn.target = roadside();
  G.msn.jobTo = roadside();
  const d = Math.hypot(G.msn.jobTo.x - G.msn.target.x, G.msn.jobTo.y - G.msn.target.y);
  G.msn.jobPay = Math.round(140 + d * 0.14);
}

function payOut(amount, bannerTitle) {
  G.cash += amount;
  G.earned += amount;
  showBanner(bannerTitle, `+$${amount.toLocaleString()} — nice work`, 3.6);
  confetti(G.player.x, G.player.y);
  sfx.jingle();
  storeSave(G.cash, G.msn.index);
}

function completeStoryMission() {
  const def = STORY[G.msn.index];
  payOut(def.pay, `${def.title} — COMPLETE`);
  G.msn.index += 1;
  G.msn.step = 0;
  G.msn.targetCar = null;
  storeSave(G.cash, G.msn.index);
  // Set up the next chapter straight away (its banner follows this one).
  const next = G.msn.index;
  if (next === 1) {
    G.msn.target = { x: G.city.roads[1] - 92, y: G.city.roads[3] };
    setTimeoutBanner('The Package', 'Pick up the package on the west sidewalk');
  } else if (next === 2) {
    G.msn.target = { x: G.city.roads[0], y: G.city.roads[5] };
    G.wanted = Math.max(G.wanted, 3);
    commitCrime(0);
    setTimeoutBanner('Sunfall Getaway', 'Reach the getaway point, far south-west');
  } else {
    setupJob();
    setTimeoutBanner('Free Roam', 'Delivery jobs are on your map — earn your fortune');
  }
}

let queuedBanner = null;
function setTimeoutBanner(title, sub) { queuedBanner = { title, sub, at: G.t + 3.8 }; }

export function updateMissions(dt) {
  const m = G.msn;
  if (!m) return;
  if (queuedBanner && G.t >= queuedBanner.at) {
    showBanner(queuedBanner.title, queuedBanner.sub, 4);
    queuedBanner = null;
  }
  const p = G.player;
  const reach = (t, r) => Math.hypot(p.x - t.x, p.y - t.y) < r;

  if (m.index === 0) {
    if (m.step === 0) {
      m.target = { x: m.targetCar.x, y: m.targetCar.y };
      if (p.car === m.targetCar) {
        m.step = 1;
        m.target = { x: G.city.roads[4], y: G.city.roads[4] };
        showBanner('Wheels acquired', 'Deliver the coupe to the glowing drop-off, south-east', 3.6);
        sfx.pickup();
      }
    } else if (reach(m.target, 74) && p.car === m.targetCar) {
      completeStoryMission();
    }
  } else if (m.index === 1) {
    if (m.step === 0) {
      if (reach(m.target, 46)) {
        m.step = 1;
        m.timer = 150;
        m.target = { x: G.city.roads[5] - 92, y: G.city.roads[1] };
        G.wanted = Math.max(G.wanted, 2);
        commitCrime(0);
        showBanner('Package in hand', 'The harbor patrol is alerted — deliver it, fast!', 3.6);
        sfx.pickup();
      }
    } else {
      m.timer -= dt;
      if (m.timer <= 0) {
        m.step = 0;
        m.target = { x: G.city.roads[1] - 92, y: G.city.roads[3] };
        showBanner('Too slow', 'The buyer walked. Pick the package up again', 3.4);
        sfx.fail();
      } else if (reach(m.target, 60)) {
        completeStoryMission();
      }
    }
  } else if (m.index === 2) {
    if (reach(m.target, 78)) completeStoryMission();
  } else {
    // Repeatable delivery jobs.
    if (m.step === 0 && reach(m.target, 48)) {
      m.step = 1;
      m.target = m.jobTo;
      showBanner('Package collected', `Deliver it for $${m.jobPay.toLocaleString()}`, 2.6);
      sfx.pickup();
    } else if (m.step === 1 && reach(m.target, 62)) {
      payOut(m.jobPay, 'Delivery complete');
      setupJob();
    }
  }
}

export function getMarker() {
  const m = G.msn;
  if (!m || !m.target) return null;
  return m.target;
}

export function getObjective() {
  const m = G.msn;
  if (!m) return { title: '', text: '' };
  const p = G.player;
  const dist = m.target ? Math.round(Math.hypot(p.x - m.target.x, p.y - m.target.y) / 10) : 0;
  const d = `${dist} m`;
  if (m.index === 0) {
    return m.step === 0
      ? { title: STORY[0].title, text: `Steal the gold coupe — ${d}` }
      : { title: STORY[0].title, text: `Deliver the coupe to the drop-off — ${d}` };
  }
  if (m.index === 1) {
    return m.step === 0
      ? { title: STORY[1].title, text: `Pick up the package — ${d}` }
      : { title: STORY[1].title, text: `Deliver the package — ${d} — ${Math.max(0, Math.ceil(m.timer))}s left` };
  }
  if (m.index === 2) return { title: STORY[2].title, text: `Reach the getaway point — ${d}` };
  return m.step === 0
    ? { title: 'Side job — Delivery', text: `Collect the package — ${d}` }
    : { title: 'Side job — Delivery', text: `Deliver for $${m.jobPay.toLocaleString()} — ${d}` };
}

// The golden beacon drawn in the world at the current target.
export function drawMarker(ctx, t) {
  const target = getMarker();
  if (!target) return;
  const pulse = 1 + Math.sin(t * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 210, 63, 0.45)';
  ctx.beginPath(); ctx.arc(target.x, target.y, 44 * pulse, 0, Math.PI * 2); ctx.stroke();
  const grad = ctx.createLinearGradient(0, target.y - 190, 0, target.y);
  grad.addColorStop(0, 'rgba(255, 210, 63, 0)');
  grad.addColorStop(1, 'rgba(255, 210, 63, 0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(target.x - 13, target.y - 190, 26, 190);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('▼', target.x, target.y - 196 + Math.sin(t * 4) * 5);
  ctx.restore();
}

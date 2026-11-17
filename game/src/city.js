// Neon Harbor: a sun-soaked grid city. Six avenues each way make 25 city
// blocks; every block holds pastel buildings with collision, the strips
// along the world edge are parkland with palms. Roads, sidewalks, props
// and buildings are generated once from the seeded RNG.

import { clamp } from './random.js';

export const WORLD = 3400;
export const ROADS = [250, 830, 1410, 1990, 2570, 3150]; // centerlines, both axes
export const ROAD_HALF = 75;

const ROOF_COLORS = ['#f4e3c1', '#eec39f', '#e39a7b', '#cf7a63', '#9fc6c0', '#7fb3b0', '#f2efdf', '#d9a05b', '#b7d3e8', '#e8b4b8', '#a8c686', '#f0c987'];
const WALL_SHADE = 'rgba(90, 55, 30, 0.35)';

export function buildCity(rng) {
  const buildings = [];
  const blocks = [];
  // Block interiors sit between neighbouring roads, inside the sidewalks.
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = ROADS[i] + ROAD_HALF + 20, x1 = ROADS[i + 1] - ROAD_HALF - 20;
      const y0 = ROADS[j] + ROAD_HALF + 20, y1 = ROADS[j + 1] - ROAD_HALF - 20;
      blocks.push({ x0, y0, x1, y1 });
      const pattern = rng.int(0, 2);
      const addBuilding = (bx, by, bw, bh) => {
        const roofBoxes = [];
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
          roofBoxes.push({ dx: rng.range(6, Math.max(7, bw - 30)), dy: rng.range(6, Math.max(7, bh - 24)), w: rng.range(12, 26), h: rng.range(9, 18) });
        }
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          height: rng.range(24, 95),
          color: rng.pick(ROOF_COLORS),
          roofBoxes,
        });
      };
      if (pattern === 0) {
        addBuilding(x0 + 14, y0 + 14, (x1 - x0) - 28, (y1 - y0) - 28); // one tower
      } else if (pattern === 1) {
        const mid = (x0 + x1) / 2;
        addBuilding(x0 + 12, y0 + 12, mid - x0 - 24, (y1 - y0) - 24);
        addBuilding(mid + 12, y0 + 12, x1 - mid - 24, (y1 - y0) - 24);
      } else {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        addBuilding(x0 + 10, y0 + 10, mx - x0 - 20, my - y0 - 20);
        addBuilding(mx + 10, y0 + 10, x1 - mx - 20, my - y0 - 20);
        addBuilding(x0 + 10, my + 10, mx - x0 - 20, y1 - my - 20);
        addBuilding(mx + 10, my + 10, x1 - mx - 20, y1 - my - 20);
      }
    }
  }
  // Props: palms on the park strips and lamps along the avenues.
  const props = [];
  for (let i = 0; i < 130; i++) {
    const edge = rng.int(0, 3);
    const along = rng.range(40, WORLD - 40);
    const off = rng.range(24, 130);
    const p = edge === 0 ? { x: along, y: off } : edge === 1 ? { x: along, y: WORLD - off }
      : edge === 2 ? { x: off, y: along } : { x: WORLD - off, y: along };
    props.push({ kind: 'palm', x: p.x, y: p.y, lean: rng.range(-0.2, 0.2), s: rng.range(0.8, 1.3) });
  }
  for (const c of ROADS) {
    for (let d = 130; d < WORLD; d += 290) {
      props.push({ kind: 'lamp', x: c - ROAD_HALF - 12, y: d });
      props.push({ kind: 'palm', x: c + ROAD_HALF + 13, y: d + 140, lean: rng.range(-0.2, 0.2), s: rng.range(0.85, 1.2) });
    }
  }
  return { size: WORLD, roads: ROADS, roadHalf: ROAD_HALF, buildings, blocks, props };
}

export function isOnRoad(city, x, y) {
  for (const c of city.roads) if (Math.abs(x - c) <= city.roadHalf || Math.abs(y - c) <= city.roadHalf) return true;
  return false;
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function collideBuildings(city, pos, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(pos.x, b.x, b.x + b.w);
    const ny = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - nx, dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.y = ny + (dy / d) * r;
    } else {
      // Centre inside the footprint: leave by the nearest face.
      const left = pos.x - b.x, right = b.x + b.w - pos.x, top = pos.y - b.y, bot = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) pos.x = b.x - r; else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r; else pos.y = b.y + b.h + r;
    }
  }
  pos.x = clamp(pos.x, r, city.size - r);
  pos.y = clamp(pos.y, r, city.size - r);
  return hit;
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

// Rough line of sight: sample the segment, blocked by any building.
export function lineBlocked(city, x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(d / 26));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(city, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
  }
  return false;
}

export function drawGround(ctx, city, vx, vy, vw, vh) {
  // Base: dry sun-baked ground, parkland strips at the edges.
  ctx.fillStyle = '#c9b489';
  ctx.fillRect(vx, vy, vw, vh);
  ctx.fillStyle = '#86b364';
  ctx.fillRect(vx, vy, Math.max(0, Math.min(vx + vw, 165) - vx), vh);
  ctx.fillRect(Math.max(vx, city.size - 165), vy, Math.max(0, vx + vw - (city.size - 165)), vh);
  ctx.fillRect(vx, vy, vw, Math.max(0, Math.min(vy + vh, 165) - vy));
  ctx.fillRect(vx, Math.max(vy, city.size - 165), vw, Math.max(0, vy + vh - (city.size - 165)));
  // Block pavement.
  ctx.fillStyle = '#cfc8b8';
  for (const b of city.blocks) {
    if (b.x1 < vx - 30 || b.x0 > vx + vw + 30 || b.y1 < vy - 30 || b.y0 > vy + vh + 30) continue;
    ctx.fillRect(b.x0 - 20, b.y0 - 20, (b.x1 - b.x0) + 40, (b.y1 - b.y0) + 40);
  }
  // Sidewalk bands then asphalt.
  for (const pass of [0, 1]) {
    ctx.fillStyle = pass === 0 ? '#ddd6c6' : '#454a51';
    const half = pass === 0 ? city.roadHalf + 14 : city.roadHalf;
    for (const c of city.roads) {
      if (c + half > vx && c - half < vx + vw) ctx.fillRect(c - half, vy, half * 2, vh);
      if (c + half > vy && c - half < vy + vh) ctx.fillRect(vx, c - half, vw, half * 2);
    }
  }
  // Centre dashes, skipped inside intersections.
  ctx.fillStyle = '#e8cf6a';
  for (const c of city.roads) {
    for (let d = 16; d < city.size; d += 56) {
      const nearCross = city.roads.some((o) => Math.abs(d + 14 - o) < city.roadHalf + 26);
      if (!nearCross) {
        if (c > vx - 4 && c < vx + vw + 4 && d > vy - 30 && d < vy + vh) ctx.fillRect(c - 2, d, 4, 28);
        if (c > vy - 4 && c < vy + vh + 4 && d > vx - 30 && d < vx + vw) ctx.fillRect(d, c - 2, 28, 4);
      }
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,235,0.75)';
  for (const cx of city.roads) for (const cy of city.roads) {
    if (cx + 100 < vx || cx - 100 > vx + vw || cy + 100 < vy || cy - 100 > vy + vh) continue;
    for (let s = -60; s <= 60; s += 24) {
      ctx.fillRect(cx + s - 7, cy - city.roadHalf - 12, 14, 9);
      ctx.fillRect(cx + s - 7, cy + city.roadHalf + 3, 14, 9);
      ctx.fillRect(cx - city.roadHalf - 12, cy + s - 7, 9, 14);
      ctx.fillRect(cx + city.roadHalf + 3, cy + s - 7, 9, 14);
    }
  }
}

export function drawProps(ctx, city, vx, vy, vw, vh) {
  for (const p of city.props) {
    if (p.x < vx - 40 || p.x > vx + vw + 40 || p.y < vy - 40 || p.y > vy + vh + 40) continue;
    if (p.kind === 'lamp') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a6068';
      ctx.fillRect(p.x - 1.5, p.y - 10, 3, 12);
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath(); ctx.arc(p.x, p.y - 11, 3.4, 0, Math.PI * 2); ctx.fill();
    } else {
      const s = p.s;
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(p.x + 6 * s, p.y + 5 * s, 13 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8a6b46';
      ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + 6 * s);
      ctx.quadraticCurveTo(p.x + p.lean * 20, p.y - 4 * s, p.x + p.lean * 30, p.y - 10 * s);
      ctx.stroke();
      ctx.strokeStyle = '#3f9e4d';
      ctx.lineWidth = 2.4 * s;
      const tx = p.x + p.lean * 30, ty = p.y - 10 * s;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + Math.cos(a) * 9 * s, ty + Math.sin(a) * 7 * s - 3, tx + Math.cos(a) * 15 * s, ty + Math.sin(a) * 11 * s + 3);
        ctx.stroke();
      }
    }
  }
}

// Buildings go last in the world pass: their long sun shadows and pastel
// roofs sell the height, and cars slip "behind" towers at block edges.
export function drawBuildings(ctx, city, vx, vy, vw, vh) {
  for (const b of city.buildings) {
    if (b.x + b.w < vx - 120 || b.x > vx + vw + 40 || b.y + b.h < vy - 120 || b.y > vy + vh + 40) continue;
    const sh = b.height * 0.45;
    ctx.fillStyle = 'rgba(70, 45, 20, 0.28)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    ctx.fillStyle = WALL_SHADE;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x, b.y, b.w, 4);
    ctx.fillStyle = 'rgba(105, 90, 70, 0.5)';
    for (const r of b.roofBoxes) ctx.fillRect(b.x + r.dx, b.y + r.dy, r.w, r.h);
    ctx.fillStyle = 'rgba(70, 130, 160, 0.55)';
    if (b.w > 90 && b.h > 90) ctx.fillRect(b.x + b.w - 34, b.y + 10, 24, 16); // rooftop pool on big towers
  }
}

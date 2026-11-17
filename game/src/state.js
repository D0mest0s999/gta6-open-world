// The one shared game state object. Every module imports G and reads or
// writes its slice; main.js owns the loop that steps the slices in order.

export const G = {
  mode: 'title', // 'title' | 'playing' | 'paused' | 'over'
  t: 0, // seconds since the run started (pauses with the game)
  seed: 1,
  rng: null,
  shot: null, // screenshot staging name when loaded with ?shot=
  canvas: null,
  ctx: null,
  view: { w: 1280, h: 800 },
  cam: { x: 0, y: 0 },
  shake: 0,

  city: null, // filled by city.js: roads, buildings, blocks, props
  player: null, // filled by player.js
  cars: [], // traffic and parked cars (vehicles.js)
  cops: [], // police cars (police.js)
  peds: [], // pedestrians (pedestrians.js)
  bullets: [], // combat.js
  parts: [], // particles.js

  wanted: 0, // 0..5 stars, fractional while it decays
  lastCrimeAt: -99,
  lastSeenAt: -99, // last time a cop had the player in sight
  cash: 0,
  earned: 0, // lifetime cash this run, shown on the game-over screen
  banner: { title: '', sub: '', until: 0 },
  overStats: null,
};

export function showBanner(title, sub = '', seconds = 3.2) {
  G.banner = { title, sub, until: G.t + seconds };
}

// Register a crime: raises the wanted level (fractions allowed, the HUD
// shows whole stars rounded up) and restarts the heat clock that the
// decay in police.js watches.
export function commitCrime(stars) {
  G.wanted = Math.min(5, G.wanted + stars);
  G.lastCrimeAt = G.t;
}

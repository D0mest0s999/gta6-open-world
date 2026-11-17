# SUNFALL: Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/D0mest0s999/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/D0mest0s999/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down 2D open-world crime game for the browser, built for the
make.fun **gta6-01 "Make GTA 6"** bounty. Vanilla JavaScript and canvas —
no libraries, no build step, no network requests. Every asset is a file
under `game/` or drawn and synthesized at runtime.

## Play it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

Open the page, click **New Game**, and take the harbor.

You are a small-time wheelman in Neon Harbor, a sun-soaked grid city of
pastel towers, palms and six avenues each way. A contact has work for
you: steal a gold coupe, run a package under the patrol's nose, then
vanish at the getaway point while the whole harbor PD gives chase.
Finish the story and the city stays yours — delivery jobs pay forever.

## What's in the world

- **A living city** — 25 blocks of pastel buildings with collision and
  long sun shadows, sidewalks, crosswalks, palms and lamps, generated
  from a seed so it is the same city every visit.
- **On foot** — WASD/arrows, Shift to sprint, mouse aim, click to shoot.
- **Cars** — lane-following traffic that brakes for the car ahead,
  parked cars on every kerb. Press **E** next to one to steal it
  (theft raises your wanted level), **E** again to get out. Driving has
  acceleration, braking/reverse, speed-sensitive steering, and building
  crashes that bend the car.
- **Pedestrians** — they stroll the block sidewalks, flee gunfire, and
  a hit-and-run brings serious heat.
- **Wanted system** — 0–5 stars on the HUD. Theft, gunfire, hit-and-run
  and ramming a cruiser all add heat; break line of sight and stay
  clean and it decays. Police cruisers spawn with your stars, chase,
  ram, and at three stars their officers stop and shoot.
- **Missions** — a three-mission story chain with on-screen objectives,
  world beacons and a minimap marker, then repeatable delivery jobs.
- **HUD & minimap** — health (and car condition), cash, wanted stars,
  objective text with distance, speedometer, and a live minimap with
  police blips and the mission marker.
- **Screens & saving** — title screen with story and controls, pause
  (P/Esc), game-over screen with your run's stats, and progress
  (cash + story position) saved to `localStorage` with a Continue
  option.
- **Sound** — all WebAudio synthesis: engine hum, sirens that swell as
  cruisers close in, gunshots, crashes, pickups and mission jingles.
- **Effects** — sparks, smoke, muzzle flashes, confetti payouts, screen
  shake and a hurt flash.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse + click | Aim / shoot (on foot) |
| E | Steal car / get out |
| Shift | Sprint |
| P or Esc | Pause |

## Layout

- `game/index.html` — page, menu screens, canvas
- `game/style.css` — menu chrome and sunset styling
- `game/src/` — one module per job: `city` (map + collision),
  `vehicles` (traffic + driving), `pedestrians`, `police` (wanted +
  chases), `player`, `combat`, `missions`, `hud`, `minimap`, `audio`,
  `particles`, `input`, `save`, `random` (seeded RNG), `state`,
  `shots` (screenshot staging), `main` (boot + loop)
- `main.ts` — the hand-in program: copies `game/` and `screenshots/`
  to the output folder and writes `dossier.json` with the vendored
  `vendor/makefun-game.ts`
- `screenshots/` — four real renders of the game, staged with
  `?shot=<name>&seed=<n>` URLs (see `shots.json`)

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=3eb465ac&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

# SENJA — Sunset Archipelago Pilot

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/NgademinSikil/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/NgademinSikil/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A 3D flight game for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

Fly a small prop plane between the volcanic islands of the Senja archipelago as the
sun goes down. Three kinds of sorties: deliver cargo between island airstrips, race
the floating rings against the clock, and rescue a stranded pilot from Pulau Api.
Fuel drains with throttle and only comes back on a runway; hard landings damage the
plane; a gear-up landing is a bad day.

## Play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```
npx serve game
```

- **W/S** or **↑/↓** — pitch · **A/D** or **←/→** — bank & turn
- **Shift** — more throttle · **Ctrl** — less throttle · **G** — landing gear
- **C** — chase / cockpit camera · **Mouse drag** — look around
- **M** — sound on/off · **P** — pause · **Enter** — fly · **R** — fly again after a crash

Everything is original and offline: three.js is vendored under `game/vendor/`,
all sounds are synthesised with WebAudio, and the game makes no network requests.

## Layout

- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — page, import map, HUD
- `game/src/main.js` — game loop, cameras, shot poses
- `game/src/world.js` — archipelago, islands, airstrips, rings, clouds, sunset sky
- `game/src/aircraft.js` — the prop plane, built from three.js primitives
- `game/src/physics.js` — arcade flight model (throttle, banked turns, stall, fuel, damage)
- `game/src/missions.js` — cargo, ring race, rescue
- `game/src/hud.js` — instruments (altitude, speed, heading, fuel, throttle, damage)
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — procedural engine hum, wind, cues
- `game/src/rng.js` — seeded random so the world is identical every load

Screenshots in `screenshots/` are real renders of the running game
(`?shot=chase|cockpit|landing|rings` stages each pose).

Built for [make.fun](https://make.fun/r/ds1567x3) — play it, judge it, build your own.

# SKYLINE HARBOR — Golden-Hour Courier Run

[![Make the best flight game](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/spy26/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/spy26/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A single-player 3D flight game in the browser. Fly a small propeller courier over a
golden-hour harbor city — downtown towers, piers and boats, a suspension bridge,
beaches and green hills — threading glowing rings in sequence, then bring her home
for a landing bonus on the runway before the three minutes run out.

## Play

Open `game/index.html` in desktop Chrome (serve `game/` from any static server, or
just open the file). No network, no downloads: Three.js is vendored under
`game/vendor/`, all textures and sounds are generated in code.

| Key | Action |
| --- | --- |
| ↑ / ↓ or W / S | Pitch |
| ← / → or A / D | Roll — a banked turn steers the plane |
| Q / E | Rudder yaw |
| Shift / Ctrl | Throttle up / down |
| Space | Boost (drinks fuel) |
| Mouse | Fine aim (click to lock the pointer) |
| C | Cockpit / chase view |
| P · R · M · H | Pause · Restart · Sound · Help |

## The run

- **Rings:** 8 glowing gates in a fixed course around the city, harbor and bridge.
  Each pays 100 points, +10 seconds and +6 fuel. Finish the course for +50 and the
  gates reset.
- **Fuel:** drains with throttle and boost. Empty tank means gliding — rings top it up.
- **Stall:** below 50 knots the nose drops and the controls go soft. Add throttle.
- **Landing:** touch down on the runway, slow and lined up, to bank a landing bonus
  plus a time bonus. Hit terrain, a building or the bay and the run ends.
- **Best score** is saved in `localStorage`.

Screenshots are staged with `?shot=1..4` (title, city chase, cockpit ring, harbor
bridge) so every shot is reproducible from a URL alone.

## Files

- `game/index.html` — page shell, HUD and overlays
- `game/src/config.js` — tuning, course and terrain math
- `game/src/world.js` — the harbor city: terrain, water, buildings, runway, bridge
- `game/src/plane.js` — the courier mesh and the flight model
- `game/src/input.js` — keyboard and mouse
- `game/src/hud.js` — instruments, minimap and screens
- `game/src/audio.js` — synthesized engine, wind and chimes (WebAudio, no files)
- `game/src/shots.js` — staged screenshot scenes
- `game/src/main.js` — game loop, states, scoring and camera
- `main.ts` — hands the entry in: copies `game/` and `screenshots/`, writes `dossier.json`

Original work, MIT licensed.

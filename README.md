# Glowmaze

A neon arcade maze-chase game that runs on the classic arcade rules: tile movement,
corner-cutting, scatter/chase timers, four enemy personalities, fright mode,
house release counters, bonus items and per-level speed tables.

The characters, maze, art and sounds are all original to this project.

## Look

- Black arcade screen with thin neon-pink walls: one line around every wall, a double line on the outer frame, rounded corners.
- Chunky score bar at the top: blinking 1UP, HIGH SCORE, level.
- Pixel-art characters (14 × 14): VOLT, a yellow robot with a visor and a grille that opens as it eats; VIPER (spiky orb), LURK (diamond), FLUX (hexagon) and DRIFT (triangle), each with two animation frames plus frightened and flashing versions.
- Pixel-art bonus items: chip, gem, bolt, gear, battery, planet, crown, star.

## Run it

```bash
npm install
npm run dev            # local dev server
npm test               # 42 tests (Vitest)
npm run build          # type-check + production build in dist/
npm run build:single   # everything in one file: dist-single/glowmaze.html
```

Controls: arrow keys or WASD (swipe on phones), Enter/Space or tap to start, P to pause, M for sound.

## Project layout

```
src/game/        Game rules. Plain TypeScript, no drawing, 60 updates per second.
  constants.ts   Board size, directions, start positions, scatter corners
  maze.ts        The 28×31 board (text grid you can edit)
  levels.ts      Per-level speeds, fright time, mode timers, bonus items
  player.ts      Player movement with early turns and corner-cutting
  enemy.ts       Enemy states: house → leaving → active → eyes → entering
  targeting.ts   Each enemy's target tile and the junction choice rule
  modes.ts       Scatter/chase clock
  house.ts       When enemies leave the house
  game.ts        State machine, scoring, collisions, lives, levels
src/render/      Canvas 2D drawing: wall outlines (pre-rendered once per size), pixel-art sprites
src/audio/       Web Audio synth: every sound is generated, no audio files
src/input.ts     Keyboard + swipe
src/storage.ts   High score in localStorage
tests/           Maze checks, AI rules, scoring, lives, levels, long random play, sprite grids
```

## The rules, and where they live

| Rule | Value | File |
| --- | --- | --- |
| Board | 28×31 tiles, 8 px each, 240 pellets + 4 power pellets, house in the centre, T-shaped walls | `maze.ts` |
| Update rate | Fixed 60 per second, one-pixel steps | `main.ts`, `player.ts`, `enemy.ts` |
| Turning | Queued turn taken as soon as the next tile is open; player slides diagonally through corners, enemies turn only at tile centers | `player.ts` |
| Tunnel | One tunnel through the middle row wraps around; enemies slow to 40–50% inside | `maze.ts`, `game.ts` |
| Collision | Same tile, checked after the player moves and again after enemies move | `game.ts` |
| Pellets | 10 points, player pauses 1 frame; power pellet 50 points, 3 frames | `game.ts` |
| Enemy chain | 200, 400, 800, 1600 within one power-up | `game.ts` |
| Bonus item | After 70 and 170 pellets, lasts 9–10 s, 100 → 5000 points by level | `levels.ts`, `game.ts` |
| Lives | 3, plus one extra at 10,000 points | `game.ts` |
| Scatter/chase | Level 1: 7, 20, 7, 20, 5, 20, 5 s, then chase forever. Every switch reverses enemies | `levels.ts`, `modes.ts` |
| Junction choice | Exit closest to the target in a straight line, never reverse, ties up > left > down > right | `targeting.ts` |
| VIPER | Targets the player's tile | `targeting.ts` |
| LURK | 4 tiles ahead of the player (with the arcade's facing-up quirk) | `targeting.ts` |
| FLUX | Doubles the line from VIPER to 2 tiles ahead of the player | `targeting.ts` |
| DRIFT | Chases when more than 8 tiles away, otherwise heads to its corner | `targeting.ts` |
| Fright | 6 s on level 1, shorter later, none from level 19; random turns; flashes before ending; pauses the mode clock | `levels.ts`, `game.ts` |
| Eaten enemy | Eyes race back to the house, revive, come back out | `enemy.ts` |
| House | Per-enemy pellet counters (level 1: 0 / 30 / 60), shared 7 / 17 / 32 counter after a lost life, 4 s idle timer (3 s from level 5) | `house.ts` |
| Speed-up | VIPER speeds up at 20 then 10 pellets left on level 1 (more on later levels) | `levels.ts`, `game.ts` |

To turn off the facing-up targeting quirk, set `ARCADE_UP_QUIRK = false` in `src/game/targeting.ts`.

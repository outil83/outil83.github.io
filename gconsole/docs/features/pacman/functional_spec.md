# Functional Specification — GConsole Pacman

## Overview
An open-arena, non-standard Pacman game playable directly in the browser. There are no walls; the playing field is an open canvas. Pacman navigates by touch or click; ghosts autonomously chase pacman. Eating an egg temporarily weakens all ghosts, allowing pacman to eat them. The game is endless with a score that can rise or fall. Difficulty scales by level (1–3 ghosts). The game integrates with GConsole's profile and leaderboard systems.

---

## User Stories

| # | Story |
|---|-------|
| US-01 | As a player, I want the game to start when I press Enter or tap Start, so I can begin playing. |
| US-02 | As a player, I want to navigate pacman by clicking/tapping a point on the canvas, so it moves there automatically. |
| US-03 | As a player, I want to see a path trace on the canvas showing where pacman is heading. |
| US-04 | As a player, I want ghosts to chase me autonomously, so the game is challenging. |
| US-05 | As a player, I want pacman to eat the egg and weaken all ghosts temporarily, so I can counter-attack. |
| US-06 | As a player, I want to eat a weakened ghost and gain +1 point. |
| US-07 | As a player, I want to see a −1 score penalty when a ghost eats pacman (pacman is respawned). |
| US-08 | As a player, I want to pause and resume the game at any time via Esc / Enter or on-screen buttons. |
| US-09 | As a player, I want the number of ghosts to increase with level (1→2→3), so the game gets harder. |
| US-10 | As a player, I want the game to continue forever with no win condition. |
| US-11 | As a player, I want my score saved and associated with my active GConsole profile. |
| US-12 | As a player, I want a HUD showing current score, level, and pause/resume controls. |

---

## Acceptance Criteria

- [ ] AC-01: Canvas is displayed without walls; pacman, ghosts and egg are spawned at random positions with a minimum separation distance of 20% of the shorter canvas dimension.
- [ ] AC-02: Clicking/tapping the canvas sets a navigation target; pacman moves toward it at constant speed; a dashed path trace is rendered from pacman's position to the target.
- [ ] AC-03: Each active ghost independently pursues pacman using direct-chase movement.
- [ ] AC-04: When pacman overlaps an egg sprite, all ghosts enter "weak" state for 5 seconds (visual change); a new egg spawns after 3 seconds at a random position.
- [ ] AC-05: While a ghost is weak, pacman overlapping it adds +1 to score and respawns that ghost at a random position after a 2-second delay.
- [ ] AC-06: When an active ghost overlaps pacman, score decreases by 1; pacman respawns at a random position; path trace is cleared.
- [ ] AC-07: Esc key or Pause button pauses all movement and timers; Enter key or Resume button unpauses.
- [ ] AC-08: Level 1 starts with 1 ghost; advancing to level 2 adds a second ghost; level 3 adds a third. Level advance trigger is at score milestones: ≥3 for level 2, ≥6 for level 3.
- [ ] AC-09: HUD shows: score (integer, can be negative), level (1–3), Pause button, Start/Resume button.
- [ ] AC-10: Score is saved via `StorageManager.saveScore('pacman', playerId, score, 'level-N')` on game over (i.e., when the player navigates away or explicitly quits).
- [ ] AC-11: Game runs at a stable 60 FPS on mid-range mobile hardware.
- [ ] AC-12: Game is fully playable on mobile (touch) and desktop (mouse + keyboard).
- [ ] AC-13: All four responsive breakpoints display the canvas scaled to fit the viewport.

---

## Out of Scope

- Traditional Pacman maze, pellets, or lives system.
- Multiplayer.
- Sound effects (can be added later).
- Ghost AI beyond direct-chase (pathfinding algorithms, flocking, etc.).
- Power-up items other than the egg.
- Explicit "level complete" screens or win states.

---

## Dependencies

| Module | Usage |
|---|---|
| `StorageManager` | Read active profile, save scores, log audit events |
| `InputManager` | `SELECT` (start/resume), `BACK`/`PAUSE` (pause), click/touch target |
| `AdManager` | Ad slot below canvas |
| `ProfileManager` | Read active player name for display |

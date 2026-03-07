# High-Level Design — GConsole Pacman

## Architecture Overview

The Pacman game is a self-contained module in `games/pacman/`. It follows the standard GConsole game module pattern: a single HTML shell, one ES6 module entry point (`game.js`), and scoped CSS. The game renders on an HTML5 `<canvas>` element using a `requestAnimationFrame` game loop. All input (keyboard, touch, mouse) is normalised through `InputManager`; all persistence flows through `StorageManager`.

The game is structured as a pure **state machine** managed by an object literal (`PacmanGame`). No external libraries are used.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│  games/pacman/index.html                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  .hud  [Score | Level | Start btn | Pause btn] │  │
│  ├───────────────────────────────────────────────┤  │
│  │  <canvas id="pacman-canvas">                  │  │
│  ├───────────────────────────────────────────────┤  │
│  │  .ad-slot (managed by AdManager)              │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  game.js                                            │
│  ┌──────────────┐   ┌──────────────┐               │
│  │  PacmanGame  │──▶│  GameLoop    │ rAF 60fps      │
│  │  (state mgr) │   │  update()    │               │
│  │              │   │  render()    │               │
│  └──────┬───────┘   └──────────────┘               │
│         │                                           │
│  ┌──────▼───────┐   ┌──────────────┐               │
│  │  EntityMgr   │   │  InputMgr    │◀── keyboard   │
│  │  pacman      │   │  (core)      │◀── touch      │
│  │  ghosts[]    │   └──────────────┘◀── mouse      │
│  │  egg         │                                   │
│  └──────────────┘   ┌──────────────┐               │
│                     │ StorageMgr   │◀── save score │
│                     │  (core)      │               │
│                     └──────────────┘               │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow (Primary: Player taps canvas, pacman moves, eats egg)

1. Player taps canvas → `pointerdown` event captured on canvas.
2. Canvas coordinates translated to game coordinates → stored as `PacmanGame.target`.
3. Path trace line rendered from pacman to target on each render frame.
4. `update()` each frame moves pacman toward `target` by `PACMAN_SPEED` units.
5. Collision check: pacman vs egg → `onEggEaten()` triggered.
6. All ghosts set `weak = true`, `weakTimer = 5000ms`.
7. `scheduleEggRespawn()` fires after 3000ms → new egg at random position.
8. Ghost `update()` checks `weak` flag; if true, ghost moves slower and cannot eat pacman.
9. If pacman overlaps weak ghost → `onGhostEaten(ghost)` → score +1, ghost scheduled for respawn.

---

## Module Responsibilities

| Module / File | Responsibility |
|---|---|
| `games/pacman/index.html` | Shell: canvas, HUD HTML, script/style links |
| `games/pacman/game.js` | Single entry point; exports `PacmanGame`; runs `init()` on load |
| `games/pacman/style.css` | Layout, HUD, pause overlay, responsive canvas sizing |
| `js/core/InputManager.js` | `SELECT` → start/resume; `BACK`/`PAUSE` → pause |
| `js/core/StorageManager.js` | Save score on session end; log audit events |
| `js/core/AdManager.js` | Inject ad placeholder below canvas |

---

## State Management

| localStorage Key (gconsole_) | Type | Writer | Reader |
|---|---|---|---|
| `activeProfile` | `string` | ProfileManager | PacmanGame.init |
| `scores` | `Array<ScoreEntry>` | StorageManager.saveScore | Leaderboard (portal) |
| `audit` | `Array<AuditEntry>` | StorageManager.logAudit | Portal audit view |

No game-specific keys are needed beyond the standard GConsole schema.

---

## Input Handling

| Intent | Trigger | Game Action |
|---|---|---|
| `SELECT` | Enter key | Start or Resume game |
| `BACK` | Esc key | Pause game |
| `PAUSE` | Gamepad pause | Pause game |
| Canvas `pointerdown` | Touch / click | Set navigation target |

Note: Canvas navigation uses a raw `pointerdown` listener on the canvas element (not an InputManager intent) because it requires canvas-local coordinates.

---

## Responsive Strategy

The canvas is sized in CSS to be square and fill available width up to a max-width at each breakpoint. A `resize` event listener recalculates `canvas.width`/`canvas.height` and updates the `SCALE` factor used to convert pointer events to game coordinates. Game logic always operates in a 600×600 logical coordinate space.

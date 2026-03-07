# Low-Level Design — GConsole Pacman

## File Structure

| File | Status | Purpose |
|---|---|---|
| `games/pacman/index.html` | New | Game shell: canvas, HUD, script/style links |
| `games/pacman/game.js` | New | All game logic; exported `PacmanGame` object |
| `games/pacman/style.css` | New | Layout, HUD, overlay, responsive canvas |
| `js/app.js` | Modified | Add pacman entry to `GAMES` array |

---

## JavaScript — Function Signatures

### `game.js` — `PacmanGame` object

```js
const PacmanGame = {
  // --- State ---
  /** @type {'idle'|'playing'|'paused'} */ state,
  /** @type {number} */ score,
  /** @type {number} */ level,          // 1, 2, or 3
  /** @type {string|null} */ playerId,
  /** @type {{x:number,y:number}|null} */ target,  // navigation target in game coords
  /** @type {number} */ lastTimestamp,
  /** @type {number|null} */ animFrameId,

  // --- Entities ---
  /** @type {{x:number,y:number,angle:number,mouthOpen:boolean}} */ pacman,
  /** @type {Array<Ghost>} */ ghosts,
  /** @type {{x:number,y:number,alive:boolean}} */ egg,

  // --- Canvas ---
  /** @type {HTMLCanvasElement} */ canvas,
  /** @type {CanvasRenderingContext2D} */ ctx,
  /** @type {number} */ scale,          // canvas.width / GAME_SIZE

  /**
   * Initialise game: read profile, bind DOM/input, start loop in idle state.
   * @returns {void}
   */
  init(),

  /**
   * Spawn all entities at random positions with minimum separation.
   * @param {number} level
   * @returns {void}
   */
  spawnEntities(level),

  /**
   * Generate a random position in game coords ensuring minDist from existing positions.
   * @param {Array<{x:number,y:number}>} occupied
   * @param {number} minDist
   * @returns {{x:number,y:number}}
   */
  randomPos(occupied, minDist),

  /**
   * Main rAF callback: computes delta, calls update then render.
   * @param {number} timestamp
   * @returns {void}
   */
  loop(timestamp),

  /**
   * Advance game state by delta milliseconds.
   * @param {number} delta  Milliseconds since last frame (capped at 50ms)
   * @returns {void}
   */
  update(delta),

  /**
   * Draw the current frame onto the canvas.
   * @returns {void}
   */
  render(),

  /**
   * Move pacman toward target, update mouth animation.
   * @param {number} delta
   * @returns {void}
   */
  movePacman(delta),

  /**
   * Move a single ghost: direct-chase when active, slower random drift when weak.
   * @param {Ghost} ghost
   * @param {number} delta
   * @returns {void}
   */
  moveGhost(ghost, delta),

  /**
   * Check and handle all collisions for the current frame.
   * @returns {void}
   */
  checkCollisions(),

  /**
   * Called when pacman overlaps the egg.
   * @returns {void}
   */
  onEggEaten(),

  /**
   * Called when pacman overlaps a weak ghost.
   * @param {Ghost} ghost
   * @returns {void}
   */
  onGhostEaten(ghost),

  /**
   * Called when an active ghost overlaps pacman.
   * @returns {void}
   */
  onPacmanEaten(),

  /**
   * Add delta to score, update HUD, check level-up threshold.
   * @param {number} delta  +1 or −1
   * @returns {void}
   */
  addScore(delta),

  /**
   * Advance to the next level (max 3): add a ghost, re-spawn entities.
   * @returns {void}
   */
  advanceLevel(),

  /**
   * Show a floating score text (+1 / −1) at a canvas position.
   * @param {number} x  Game x coordinate
   * @param {number} y  Game y coordinate
   * @param {string} text  E.g. "+1" or "−1"
   * @param {string} color CSS colour string
   * @returns {void}
   */
  spawnFloatingText(x, y, text, color),

  /**
   * Transition to 'playing' state; spawn entities if first start.
   * @returns {void}
   */
  startGame(),

  /**
   * Transition to 'paused' state; stop rAF loop.
   * @returns {void}
   */
  pauseGame(),

  /**
   * Transition back to 'playing' state; restart rAF loop.
   * @returns {void}
   */
  resumeGame(),

  /**
   * Save session score to StorageManager and log audit event.
   * @returns {void}
   */
  saveSession(),

  /**
   * Recalculate canvas size and scale factor on resize.
   * @returns {void}
   */
  handleResize(),

  /**
   * Translate a PointerEvent's client coords to game coords using current scale.
   * @param {PointerEvent} e
   * @returns {{x:number,y:number}}
   */
  pointerToGame(e),

  /**
   * Update the DOM HUD elements (score, level text).
   * @returns {void}
   */
  updateHUD(),
};
```

### Ghost shape

```js
/**
 * @typedef {Object} Ghost
 * @property {number} x          Game x coordinate
 * @property {number} y          Game y coordinate
 * @property {string} color      CSS colour for normal state
 * @property {boolean} active    True if chasing; false if eaten/respawning
 * @property {boolean} weak      True during egg-power window
 * @property {number} weakTimer  Remaining weak milliseconds
 * @property {boolean} respawning True while off-screen waiting to respawn
 */
```

### FloatingText shape

```js
/**
 * @typedef {Object} FloatingText
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {string} color
 * @property {number} life  Remaining lifetime in ms (starts at 800)
 */
```

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `GAME_SIZE` | `600` | Logical game width & height in units |
| `PACMAN_RADIUS` | `14` | Pacman circle radius in game units |
| `GHOST_RADIUS` | `14` | Ghost collision radius |
| `EGG_RADIUS` | `10` | Egg collision radius |
| `PACMAN_SPEED` | `120` | Units per second |
| `GHOST_SPEED_NORMAL` | `80` | Units per second |
| `GHOST_SPEED_WEAK` | `40` | Units per second when weak |
| `WEAK_DURATION` | `5000` | Milliseconds ghost stays weak |
| `EGG_RESPAWN_DELAY` | `3000` | Milliseconds before new egg appears |
| `GHOST_RESPAWN_DELAY` | `2000` | Milliseconds before eaten ghost returns |
| `MIN_SPAWN_DIST` | `120` | Minimum distance between entities on spawn |
| `LEVEL_THRESHOLDS` | `[3, 6]` | Score values at which level increases |

---

## CSS — Class Inventory

| Class | Element | Intent |
|---|---|---|
| `.pacman-page` | `<body>` | Root layout: flex column, full viewport height, dark bg |
| `.pacman-header` | `<header>` | Portal back-link bar |
| `.pacman-hud` | `<div>` | Horizontal bar above canvas: score, level, buttons |
| `.pacman-hud__score` | `<span>` | Score display; `aria-live="polite"` |
| `.pacman-hud__level` | `<span>` | Level display |
| `.pacman-hud__btn` | `<button>` | Shared HUD button style; min 48×48px |
| `.pacman-hud__btn--start` | `<button>` | Start / Resume button |
| `.pacman-hud__btn--pause` | `<button>` | Pause button |
| `.pacman-canvas-wrap` | `<div>` | Square wrapper; responsive max-width |
| `#pacman-canvas` | `<canvas>` | Game canvas; width/height set by JS |
| `.pacman-overlay` | `<div>` | Pause/start overlay; absolute over canvas |
| `.pacman-overlay--hidden` | modifier | `display:none` |
| `.pacman-overlay__title` | `<p>` | "PAUSED" heading |
| `.pacman-overlay__btn` | `<button>` | Resume / Start button inside overlay |
| `.ad-slot` | `<div>` | AdManager-managed placeholder |

---

## HTML — DOM Structure

```
<body.pacman-page>
  <header.pacman-header>
    <a href="../../index.html">← GConsole</a>
  </header>

  <div.pacman-hud>
    <span>Score: <span.pacman-hud__score aria-live="polite">0</span></span>
    <span>Level: <span.pacman-hud__level>1</span></span>
    <button.pacman-hud__btn.pacman-hud__btn--start aria-label="Start game">▶ Start</button>
    <button.pacman-hud__btn.pacman-hud__btn--pause aria-label="Pause game">⏸</button>
  </div>

  <div.pacman-canvas-wrap>
    <canvas#pacman-canvas></canvas>
    <div.pacman-overlay>
      <p.pacman-overlay__title>PAUSED</p>
      <button.pacman-overlay__btn aria-label="Resume game">▶ Resume</button>
    </div>
  </div>

  <div.ad-slot></div>

  <script type="module" src="./game.js"></script>
```

---

## Integration Points

### `js/app.js` — GAMES array entry
```js
{
  id: 'pacman',
  title: 'Pacman Arena',
  description: 'Open-arena chase game. Eat eggs to weaken ghosts. Avoid being eaten.',
  thumbnail: 'assets/pacman-thumb.svg',
  path: 'games/pacman/index.html',
}
```

### `StorageManager`
- `StorageManager.get('activeProfile')` → playerId on init.
- `StorageManager.saveScore('pacman', playerId, score, 'level-' + level)` → on `visibilitychange` or explicit quit.
- `StorageManager.logAudit(playerId, 'pacman_start', { level })` → on game start.
- `StorageManager.logAudit(playerId, 'pacman_score', { score, level })` → on score save.

### `InputManager`
```js
InputManager.init(document.body);
InputManager.on(INTENTS.SELECT, () => { /* start or resume */ });
InputManager.on(INTENTS.BACK,   () => { /* pause */ });
InputManager.on(INTENTS.PAUSE,  () => { /* pause */ });
```

### `AdManager`
```js
AdManager.inject(); // scans for .ad-slot divs and fills them
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| No active profile | `playerId` defaults to `'guest'`; game still plays; score saved under `'guest'` |
| Canvas not supported | `<noscript>` message shown; handled by browser |
| Resize to zero width | Guard: `if (canvas.width < 10) return;` in render |
| `delta` spike (tab hidden) | `delta` capped at 50ms per frame to prevent entity teleportation |
| Score goes negative | Allowed; HUD renders negative number normally |

---

## Performance Considerations

- Single `<canvas>` with full redraw each frame (no layered canvases needed at this complexity).
- Entities drawn with simple canvas primitives (arcs, rects, bezier for ghost skirt) — no image assets needed for entities.
- `requestAnimationFrame` loop stopped when paused or tab hidden (`visibilitychange`).
- Floating text objects stored in a small array; pruned each frame when `life ≤ 0`.
- No offscreen canvas needed; entity count is max 3 ghosts + 1 pacman + 1 egg.

/**
 * game.js — GConsole Pacman Arena
 * Open-arena, endless chase game.
 * Uses InputManager for keyboard/gamepad intents and
 * StorageManager for score persistence.
 */

import StorageManager from '../../js/core/StorageManager.js';
import InputManager, { INTENTS } from '../../js/core/InputManager.js';
import AdManager from '../../js/core/AdManager.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const GAME_SIZE          = 600;    // Logical coordinate space (square)
const PACMAN_RADIUS      = 14;
const GHOST_RADIUS       = 14;
const EGG_RADIUS         = 10;
const PACMAN_SPEED       = 130;                // units/sec
const GHOST_SPEED_NORMAL = PACMAN_SPEED;       // same speed as pacman
const GHOST_SPEED_WEAK   = PACMAN_SPEED * 0.8; // 80% of pacman speed when weak
const WEAK_DURATION      = 6000;   // ms (5000 × 1.2)
const EGG_RESPAWN_DELAY  = 3000;   // ms
const GHOST_RESPAWN_DELAY= 2000;   // ms
const MIN_SPAWN_DIST     = 130;    // min px separation on spawn
const FLOAT_LIFE         = 850;    // ms floating text lives
const GHOST_DIR_INTERVAL = 480;    // ms between ghost direction recalculations
const BOB_SPEED          = 0.004;  // bob animation speed (rad/ms)
const GHOST_COLORS       = ['#e94560', '#a855f7', '#22d3ee'];
const DELTA_CAP          = 50;     // ms — prevents teleport on tab-switch

// Cardinal direction descriptors
const DIRS = {
  RIGHT: { x:  1, y:  0, angle: 0 },
  LEFT:  { x: -1, y:  0, angle: Math.PI },
  DOWN:  { x:  0, y:  1, angle: Math.PI / 2 },
  UP:    { x:  0, y: -1, angle: -Math.PI / 2 },
};
const DIR_LIST = [DIRS.RIGHT, DIRS.LEFT, DIRS.DOWN, DIRS.UP];

// ─── PacmanGame ───────────────────────────────────────────────────────────────

const PacmanGame = {

  // ── State ──────────────────────────────────────────────
  /** @type {'idle'|'playing'|'paused'} */ state: 'idle',
  /** @type {number} */ score: 0,
  /** @type {number} */ level: 1,
  /** @type {string} */ playerId: 'guest',
  /** @type {{x:number,y:number,angle:number}|null} */ _pendingDir: null,
  /** @type {Array<{dirX:number,dirY:number,angle:number,remaining:number}>} */ _path: [],
  /** @type {Object|null} */ _targetGhost: null,
  /** @type {number} */ lastTimestamp: 0,
  /** @type {number|null} */ animFrameId: null,

  // ── Entities ───────────────────────────────────────────
  pacman: { x: 300, y: 300, dirX: 0, dirY: 0, angle: 0, mouthOpen: true, mouthAnim: 0, respawnFlash: 0, bobPhase: 0 },
  /** @type {Array<Object>} */ ghosts: [],
  egg: { x: 100, y: 100, alive: true, fadeIn: 0 },

  // ── Floating Texts ─────────────────────────────────────
  /** @type {Array<Object>} */ floats: [],

  // ── Canvas / DOM ───────────────────────────────────────
  /** @type {HTMLCanvasElement} */ canvas: null,
  /** @type {CanvasRenderingContext2D} */ ctx: null,
  /** @type {number} */ scale: 1,

  // ─── Init ──────────────────────────────────────────────────────────────────

  /**
   * Bootstrap the game: bind DOM references, input, resize, and render first frame.
   * @returns {void}
   */
  init() {
    this.canvas = document.getElementById('pacman-canvas');
    this.ctx    = this.canvas.getContext('2d');

    this.playerId = StorageManager.get('activeProfile') || 'guest';

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Canvas pointer navigation
    this.canvas.addEventListener('pointerdown', (e) => this._onCanvasPointer(e));

    // InputManager intents
    InputManager.init(document.body);
    InputManager.on(INTENTS.SELECT, () => this._onSelect());
    InputManager.on(INTENTS.BACK,   () => this._onBack());
    InputManager.on(INTENTS.PAUSE,  () => this._onBack());
    InputManager.on(INTENTS.RIGHT,  () => this._setDirectionIntent(DIRS.RIGHT));
    InputManager.on(INTENTS.LEFT,   () => this._setDirectionIntent(DIRS.LEFT));
    InputManager.on(INTENTS.DOWN,   () => this._setDirectionIntent(DIRS.DOWN));
    InputManager.on(INTENTS.UP,     () => this._setDirectionIntent(DIRS.UP));

    // HUD buttons
    document.getElementById('btn-start').addEventListener('click', () => this._onSelect());
    document.getElementById('btn-pause').addEventListener('click', () => this._onBack());

    // Level select buttons
    document.querySelectorAll('.pacman-overlay__btn--level').forEach((btn) => {
      btn.addEventListener('click', () => this.startGame(parseInt(btn.dataset.level, 10)));
    });

    // Resume button
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());

    // Save on page leave
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveSession();
    });

    // AdManager
    const adSlot = document.querySelector('.ad-slot');
    AdManager.init({ bannerContainer: adSlot, sidebarContainer: null });

    // Initial draw
    this.spawnEntities(1);
    this.render();
    this._showLevelSelect();
  },

  // ─── Spawn / Reset ─────────────────────────────────────────────────────────

  /**
   * Spawn pacman, ghosts (count = level), and egg at random positions.
   * Ensures MIN_SPAWN_DIST separation between all entities.
   * @param {number} level
   * @returns {void}
   */
  spawnEntities(level) {
    const occupied = [];

    // Pacman
    const pp = this.randomPos(occupied, 0);
    occupied.push(pp);
    Object.assign(this.pacman, {
      x: pp.x, y: pp.y,
      dirX: 0, dirY: 0,
      angle: 0,
      mouthOpen: true,
      mouthAnim: 0,
      respawnFlash: 0,
      bobPhase: 0,
    });

    // Ghosts
    this.ghosts = [];
    for (let i = 0; i < level; i++) {
      const gp      = this.randomPos(occupied, MIN_SPAWN_DIST);
      occupied.push(gp);
      const initDir = DIR_LIST[Math.floor(Math.random() * 4)];
      this.ghosts.push({
        x: gp.x,
        y: gp.y,
        color: GHOST_COLORS[i],
        active: true,
        weak: false,
        weakTimer: 0,
        respawning: false,
        dirX: initDir.x,
        dirY: initDir.y,
        angle: initDir.angle,
        _dirTimer: 0,
        _bobPhase: Math.random() * Math.PI * 2,
        _waveOffset: 0,
      });
    }

    // Egg
    const ep = this.randomPos(occupied, MIN_SPAWN_DIST);
    this.egg.x      = ep.x;
    this.egg.y      = ep.y;
    this.egg.alive  = true;
    this.egg.fadeIn = 0;

    this._pendingDir  = null;
    this._path        = [];
    this._targetGhost = null;
    this.floats       = [];
  },

  /**
   * Return a random game-coordinate position with at least minDist from
   * all positions in the occupied array.
   * @param {Array<{x:number,y:number}>} occupied
   * @param {number} minDist
   * @returns {{x:number,y:number}}
   */
  randomPos(occupied, minDist) {
    const margin = 40;
    let attempts = 0;
    while (attempts < 200) {
      const x = margin + Math.random() * (GAME_SIZE - margin * 2);
      const y = margin + Math.random() * (GAME_SIZE - margin * 2);
      const ok = occupied.every(({ x: ox, y: oy }) => {
        const d = Math.hypot(x - ox, y - oy);
        return d >= minDist;
      });
      if (ok) return { x, y };
      attempts++;
    }
    // Fallback: ignore constraint
    return {
      x: margin + Math.random() * (GAME_SIZE - margin * 2),
      y: margin + Math.random() * (GAME_SIZE - margin * 2),
    };
  },

  // ─── Game State Machine ─────────────────────────────────────────────────────

  /**
   * Select/Enter pressed: resume when paused, else show level-select.
   * @returns {void}
   */
  _onSelect() {
    if (this.state === 'paused') this.resumeGame();
    else                         this._showLevelSelect();
  },

  /**
   * Apply arrow-key / gamepad direction intent to pacman immediately.
   * @param {{x:number,y:number,angle:number}} dir
   * @returns {void}
   */
  _setDirectionIntent(dir) {
    if (this.state !== 'playing') return;
    this.pacman.dirX  = dir.x;
    this.pacman.dirY  = dir.y;
    this.pacman.angle = dir.angle;
  },

  /**
   * Pause if playing; ignore otherwise.
   * @returns {void}
   */
  _onBack() {
    if (this.state === 'playing') this.pauseGame();
  },

  /**
   * Start a new game at the selected level.
   * @param {number} level  1 | 2 | 3
   * @returns {void}
   */
  startGame(level) {
    this.score = 0;
    this.level = level;
    this.spawnEntities(level);
    StorageManager.logAudit(this.playerId, 'pacman_start', { level });
    this.updateHUD();

    this.state = 'playing';
    this._hideOverlay();
    this._setButtonState('playing');
    this.lastTimestamp = performance.now();
    this.animFrameId   = requestAnimationFrame((ts) => this.loop(ts));
  },

  /**
   * Pause: stop animation loop, show resume overlay.
   * @returns {void}
   */
  pauseGame() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.state = 'paused';
    this._showResumeOverlay();
    this._setButtonState('paused');
  },

  /**
   * Resume: hide overlay, restart loop.
   * @returns {void}
   */
  resumeGame() {
    this.state         = 'playing';
    this.lastTimestamp = performance.now();
    this._hideOverlay();
    this._setButtonState('playing');
    this.animFrameId   = requestAnimationFrame((ts) => this.loop(ts));
  },

  // ─── Main Loop ─────────────────────────────────────────────────────────────

  /**
   * requestAnimationFrame callback.
   * @param {number} timestamp  DOMHighResTimeStamp
   * @returns {void}
   */
  loop(timestamp) {
    const raw   = timestamp - this.lastTimestamp;
    const delta = Math.min(raw, DELTA_CAP);
    this.lastTimestamp = timestamp;

    this.update(delta);
    this.render();

    if (this.state === 'playing') {
      this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  /**
   * Advance all game entities by delta ms.
   * @param {number} delta  ms since last frame (capped)
   * @returns {void}
   */
  update(delta) {
    // If chasing a ghost, recompute path to its current position every frame
    if (this._targetGhost) {
      if (!this._targetGhost.active || this._targetGhost.respawning) {
        this._targetGhost = null;
        this._path        = [];
      } else {
        this._path = this._computePath(
          this.pacman.x, this.pacman.y,
          this._targetGhost.x, this._targetGhost.y
        );
      }
    }

    this.movePacman(delta);
    this.ghosts.forEach((g) => this.moveGhost(g, delta));
    this.checkCollisions();

    // Tick weak timers + ghost animations
    this.ghosts.forEach((g) => {
      if (g.weak && g.active) {
        g.weakTimer -= delta;
        if (g.weakTimer <= 0) { g.weak = false; g.weakTimer = 0; }
      }
      g._bobPhase   = (g._bobPhase   + BOB_SPEED * delta) % (Math.PI * 2);
      g._waveOffset = (g._waveOffset + 0.003  * delta) % (Math.PI * 2);
    });

    // Tick pacman flash + bob
    if (this.pacman.respawnFlash > 0) this.pacman.respawnFlash -= delta;
    this.pacman.bobPhase = (this.pacman.bobPhase + BOB_SPEED * 1.8 * delta) % (Math.PI * 2);

    // Tick floating texts
    this.floats = this.floats.filter((f) => {
      f.life -= delta;
      f.y    -= delta * 0.04;
      return f.life > 0;
    });
  },

  /**
   * Move pacman. Follows computed path segments if present, otherwise continues
   * in the current direction. Walls wrap around (toroidal arena).
   * @param {number} delta
   * @returns {void}
   */
  movePacman(delta) {
    const { pacman } = this;

    // Keyboard/gamepad intent: apply immediately, cancel any active path
    if (this._pendingDir) {
      pacman.dirX       = this._pendingDir.x;
      pacman.dirY       = this._pendingDir.y;
      pacman.angle      = this._pendingDir.angle;
      this._pendingDir  = null;
      this._path        = [];
      this._targetGhost = null;
    }

    // Follow next path segment if one exists
    if (this._path.length > 0) {
      const seg = this._path[0];
      pacman.dirX  = seg.dirX;
      pacman.dirY  = seg.dirY;
      pacman.angle = seg.angle;
      const speed = PACMAN_SPEED * (delta / 1000);
      const step  = Math.min(speed, seg.remaining);
      pacman.x      += seg.dirX * step;
      pacman.y      += seg.dirY * step;
      seg.remaining -= step;
      if (seg.remaining <= 0.5) this._path.shift();
    } else if (pacman.dirX || pacman.dirY) {
      // Free movement in current direction
      const speed = PACMAN_SPEED * (delta / 1000);
      pacman.x += pacman.dirX * speed;
      pacman.y += pacman.dirY * speed;
    }

    // Wrap-around walls (toroidal)
    if (pacman.x < 0)         pacman.x += GAME_SIZE;
    if (pacman.x > GAME_SIZE) pacman.x -= GAME_SIZE;
    if (pacman.y < 0)         pacman.y += GAME_SIZE;
    if (pacman.y > GAME_SIZE) pacman.y -= GAME_SIZE;

    // Mouth chop animation while moving
    if (pacman.dirX || pacman.dirY) {
      pacman.mouthAnim = (pacman.mouthAnim + delta * 0.012) % (Math.PI * 2);
      pacman.mouthOpen = Math.sin(pacman.mouthAnim) > 0;
    }
  },

  /**
   * Move a ghost in cardinal directions using toroidal (wrap-around) arena.
   * Active ghosts chase pacman; weak ghosts flee — using shortest toroidal distance.
   * @param {Object} ghost
   * @param {number} delta
   * @returns {void}
   */
  moveGhost(ghost, delta) {
    if (!ghost.active || ghost.respawning) return;

    const speed = (ghost.weak ? GHOST_SPEED_WEAK : GHOST_SPEED_NORMAL) * (delta / 1000);

    ghost._dirTimer -= delta;
    if (ghost._dirTimer <= 0) {
      ghost._dirTimer = GHOST_DIR_INTERVAL + Math.random() * 200;
      // Toroidal shortest delta to pacman
      const dx = _toroidalDelta(this.pacman.x, ghost.x, GAME_SIZE);
      const dy = _toroidalDelta(this.pacman.y, ghost.y, GAME_SIZE);
      let d;
      if (ghost.weak) {
        // Flee: dominant axis, move AWAY
        if (Math.abs(dx) >= Math.abs(dy)) { d = dx > 0 ? DIRS.LEFT  : DIRS.RIGHT; }
        else                              { d = dy > 0 ? DIRS.UP    : DIRS.DOWN;  }
      } else {
        // Chase: dominant axis, move TOWARD
        if (Math.abs(dx) >= Math.abs(dy)) { d = dx > 0 ? DIRS.RIGHT : DIRS.LEFT; }
        else                              { d = dy > 0 ? DIRS.DOWN  : DIRS.UP;   }
      }
      ghost.dirX  = d.x;
      ghost.dirY  = d.y;
      ghost.angle = d.angle;
    }

    ghost.x += ghost.dirX * speed;
    ghost.y += ghost.dirY * speed;

    // Wrap-around walls (toroidal)
    if (ghost.x < 0)         ghost.x += GAME_SIZE;
    if (ghost.x > GAME_SIZE) ghost.x -= GAME_SIZE;
    if (ghost.y < 0)         ghost.y += GAME_SIZE;
    if (ghost.y > GAME_SIZE) ghost.y -= GAME_SIZE;
  },

  /**
   * Compute the shortest toroidal path from (fromX,fromY) to (toX,toY).
   * Returns up to two cardinal-direction segments: horizontal first, then vertical.
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   * @returns {Array<{dirX:number,dirY:number,angle:number,remaining:number}>}
   */
  _computePath(fromX, fromY, toX, toY) {
    const dx = _toroidalDelta(toX, fromX, GAME_SIZE);
    const dy = _toroidalDelta(toY, fromY, GAME_SIZE);
    const segs = [];
    if (Math.abs(dx) > 2) {
      const d = dx > 0 ? DIRS.RIGHT : DIRS.LEFT;
      segs.push({ dirX: d.x, dirY: d.y, angle: d.angle, remaining: Math.abs(dx) });
    }
    if (Math.abs(dy) > 2) {
      const d = dy > 0 ? DIRS.DOWN : DIRS.UP;
      segs.push({ dirX: d.x, dirY: d.y, angle: d.angle, remaining: Math.abs(dy) });
    }
    return segs;
  },

  // ─── Collision Detection ───────────────────────────────────────────────────

  /**
   * Check pacman ↔ egg and pacman ↔ ghosts collisions.
   * @returns {void}
   */
  checkCollisions() {
    // Pacman vs Egg
    if (this.egg.alive) {
      const d = Math.hypot(this.pacman.x - this.egg.x, this.pacman.y - this.egg.y);
      if (d < PACMAN_RADIUS + EGG_RADIUS) {
        this.onEggEaten();
      }
    }

    // Pacman vs Ghosts
    for (const ghost of this.ghosts) {
      if (!ghost.active || ghost.respawning) continue;
      const d = Math.hypot(this.pacman.x - ghost.x, this.pacman.y - ghost.y);
      if (d < PACMAN_RADIUS + GHOST_RADIUS) {
        if (ghost.weak) {
          this.onGhostEaten(ghost);
        } else {
          this.onPacmanEaten();
          break; // only one death per frame
        }
      }
    }
  },

  // ─── Events ────────────────────────────────────────────────────────────────

  /**
   * Pacman ate the egg: weaken all ghosts, schedule egg respawn.
   * @returns {void}
   */
  onEggEaten() {
    this.egg.alive = false;

    // Weaken all active, non-respawning ghosts
    this.ghosts.forEach((g) => {
      if (g.active && !g.respawning) {
        g.weak        = true;
        g.weakTimer   = WEAK_DURATION;
        g._dirTimer   = 0; // force direction re-pick next frame
      }
    });

    // Schedule egg respawn
    setTimeout(() => {
      const occupied = [
        { x: this.pacman.x, y: this.pacman.y },
        ...this.ghosts.map((g) => ({ x: g.x, y: g.y })),
      ];
      const ep     = this.randomPos(occupied, MIN_SPAWN_DIST);
      this.egg.x   = ep.x;
      this.egg.y   = ep.y;
      this.egg.alive  = true;
      this.egg.fadeIn = 400; // ms fade-in
    }, EGG_RESPAWN_DELAY);
  },

  /**
   * Pacman ate a weak ghost: +1 score, schedule ghost respawn.
   * @param {Object} ghost
   * @returns {void}
   */
  onGhostEaten(ghost) {
    ghost.active     = false;
    ghost.weak       = false;
    ghost.respawning = true;

    this.spawnFloatingText(ghost.x, ghost.y - 10, '+1', '#2ecc71');
    this.addScore(1);

    setTimeout(() => {
      const occupied = [
        { x: this.pacman.x, y: this.pacman.y },
        ...this.ghosts.filter((g) => g !== ghost).map((g) => ({ x: g.x, y: g.y })),
      ];
      const gp         = this.randomPos(occupied, MIN_SPAWN_DIST);
      const initDir    = DIR_LIST[Math.floor(Math.random() * 4)];
      ghost.x          = gp.x;
      ghost.y          = gp.y;
      ghost.dirX       = initDir.x;
      ghost.dirY       = initDir.y;
      ghost.angle     = initDir.angle;
      ghost._dirTimer = 0;
      ghost.active    = true;
      ghost.respawning = false;
      ghost.weak       = false;
    }, GHOST_RESPAWN_DELAY);
  },

  /**
   * A ghost ate pacman: −1 score, respawn pacman at random position.
   * @returns {void}
   */
  onPacmanEaten() {
    this.spawnFloatingText(this.pacman.x, this.pacman.y - 10, '−1', '#e94560');
    this.addScore(-1);

    // Stop pacman movement and clear nav state
    this.pacman.dirX  = 0;
    this.pacman.dirY  = 0;
    this._pendingDir  = null;
    this._path        = [];
    this._targetGhost = null;

    // Respawn pacman at safe position
    const occupied = this.ghosts.map((g) => ({ x: g.x, y: g.y }));
    const pp = this.randomPos(occupied, MIN_SPAWN_DIST);
    this.pacman.x            = pp.x;
    this.pacman.y            = pp.y;
    this.pacman.respawnFlash = 600;
  },

  // ─── Score & Level ─────────────────────────────────────────────────────────

  /**
   * Add delta to score and update HUD. No automatic level progression.
   * @param {number} delta  +1 or −1
   * @returns {void}
   */
  addScore(delta) {
    this.score += delta;
    this.updateHUD();
  },

  // ─── Floating Texts ────────────────────────────────────────────────────────

  /**
   * Push a floating text entry to be rendered for FLOAT_LIFE ms.
   * @param {number} x
   * @param {number} y
   * @param {string} text
   * @param {string} color
   * @returns {void}
   */
  spawnFloatingText(x, y, text, color) {
    this.floats.push({ x, y, text, color, life: FLOAT_LIFE });
  },

  // ─── Render ────────────────────────────────────────────────────────────────

  /**
   * Clear and redraw the full canvas each frame.
   * @returns {void}
   */
  render() {
    const { ctx, canvas } = this;
    if (!canvas || canvas.width < 10) return;

    const s = this.scale;

    // Background
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena border glow
    ctx.save();
    ctx.strokeStyle = 'rgba(245,197,24,0.15)';
    ctx.lineWidth   = 3 * s;
    ctx.strokeRect(4 * s, 4 * s, (GAME_SIZE - 8) * s, (GAME_SIZE - 8) * s);
    ctx.restore();

    // Direction trace
    this._renderDirectionTrace(s);

    // Egg
    if (this.egg.alive) this._renderEgg(s);

    // Ghosts
    this.ghosts.forEach((g) => this._renderGhost(g, s));

    // Pacman
    this._renderPacman(s);

    // Floating texts
    this.floats.forEach((f) => this._renderFloat(f, s));
  },

  /**
   * Draw the navigation path trace. Multi-segment for tap/ghost paths;
   * simple directional arrow for keyboard/gamepad movement.
   * Lines split at toroidal wrap boundaries via _drawWrappedLine.
   * @param {number} s
   * @returns {void}
   */
  _renderDirectionTrace(s) {
    const { pacman, ctx } = this;
    const hasPath = this._path.length > 0;
    const hasDir  = pacman.dirX !== 0 || pacman.dirY !== 0;
    if (!hasPath && !hasDir) return;

    ctx.save();
    if (hasPath) {
      let cx = pacman.x;
      let cy = pacman.y;
      for (let i = 0; i < this._path.length; i++) {
        const seg  = this._path[i];
        const ex   = cx + seg.dirX * seg.remaining;
        const ey   = cy + seg.dirY * seg.remaining;
        const fade = Math.max(0.08, 0.5 - i * 0.15);
        ctx.setLineDash([7 * s, 5 * s]);
        ctx.lineDashOffset = -(Date.now() / 38 + i * 28) % (12 * s);
        ctx.strokeStyle    = this._targetGhost
          ? `rgba(232,50,96,${fade})`
          : `rgba(245,197,24,${fade})`;
        ctx.lineWidth = 2 * s;
        this._drawWrappedLine(cx, cy, ex, ey, s);
        cx = ((ex % GAME_SIZE) + GAME_SIZE) % GAME_SIZE;
        cy = ((ey % GAME_SIZE) + GAME_SIZE) % GAME_SIZE;
      }
      ctx.setLineDash([]);
      ctx.fillStyle = this._targetGhost ? 'rgba(232,50,96,0.7)' : 'rgba(245,197,24,0.65)';
      ctx.beginPath();
      ctx.arc(cx * s, cy * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.setLineDash([7 * s, 5 * s]);
      ctx.lineDashOffset = -(Date.now() / 38) % (12 * s);
      ctx.strokeStyle    = 'rgba(245,197,24,0.38)';
      ctx.lineWidth      = 2 * s;
      const tx = pacman.x + pacman.dirX * GAME_SIZE * 0.45;
      const ty = pacman.y + pacman.dirY * GAME_SIZE * 0.45;
      this._drawWrappedLine(pacman.x, pacman.y, tx, ty, s);
      ctx.setLineDash([]);
    }
    ctx.restore();
  },

  /**
   * Draw a line from (x1,y1) to (x2,y2) splitting correctly at wrap-around
   * boundaries. Recursively handles multiple crossings.
   * Caller must set ctx stroke properties before calling.
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @param {number} s  canvas scale
   * @returns {void}
   */
  _drawWrappedLine(x1, y1, x2, y2, s) {
    const { ctx } = this;
    const GS = GAME_SIZE;
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Find the earliest boundary crossing along the segment
    let tMin = 1.0001;
    let wrap  = null;
    if (dx > 0 && x2 > GS) { const t = (GS - x1) / dx; if (t < tMin) { tMin = t; wrap = 'r'; } }
    if (dx < 0 && x2 < 0)  { const t = (0  - x1) / dx; if (t < tMin) { tMin = t; wrap = 'l'; } }
    if (dy > 0 && y2 > GS) { const t = (GS - y1) / dy; if (t < tMin) { tMin = t; wrap = 'b'; } }
    if (dy < 0 && y2 < 0)  { const t = (0  - y1) / dy; if (t < tMin) { tMin = t; wrap = 't'; } }

    if (!wrap) {
      ctx.beginPath();
      ctx.moveTo(x1 * s, y1 * s);
      ctx.lineTo(x2 * s, y2 * s);
      ctx.stroke();
      return;
    }

    // Draw up to the boundary, then continue from the opposite side
    const bx = x1 + dx * tMin;
    const by = y1 + dy * tMin;
    ctx.beginPath();
    ctx.moveTo(x1 * s, y1 * s);
    ctx.lineTo(bx * s, by * s);
    ctx.stroke();

    let nx = bx, ny = by;
    if (wrap === 'r') nx -= GS;
    if (wrap === 'l') nx += GS;
    if (wrap === 'b') ny -= GS;
    if (wrap === 't') ny += GS;

    const rem = 1 - tMin;
    this._drawWrappedLine(nx, ny, nx + dx * rem, ny + dy * rem, s);
  },

  /**
   * Draw pacman with gradient, mouth-chop animation, eye, and perpendicular body-bob.
   * @param {number} s
   * @returns {void}
   */
  _renderPacman(s) {
    const { ctx, pacman } = this;

    // Bob perpendicular to movement direction
    const moving = pacman.dirX !== 0 || pacman.dirY !== 0;
    const bobAmt = moving ? Math.sin(pacman.bobPhase) * 2.5 : 0;
    const bobX   = pacman.dirY !== 0 ? bobAmt : 0;
    const bobY   = pacman.dirX !== 0 ? bobAmt : 0;

    const px = (pacman.x + bobX) * s;
    const py = (pacman.y + bobY) * s;
    const r  = PACMAN_RADIUS * s;

    const flash      = pacman.respawnFlash > 0 && Math.floor(pacman.respawnFlash / 80) % 2 === 0;
    const mouthAngle = pacman.mouthOpen ? 0.28 : 0.04;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(px + 2 * s, py + r * 0.6, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.08, px, py, r);
    grad.addColorStop(0, flash ? '#ffffff' : '#ffe566');
    grad.addColorStop(1, flash ? '#cccccc' : '#c49000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, pacman.angle + mouthAngle, pacman.angle + Math.PI * 2 - mouthAngle);
    ctx.closePath();
    ctx.fill();

    // Eye
    const eyeAngle = pacman.angle - Math.PI / 4;
    const ex = px + Math.cos(eyeAngle) * r * 0.52;
    const ey = py + Math.sin(eyeAngle) * r * 0.52;
    ctx.fillStyle = '#0f0f1a';
    ctx.beginPath();
    ctx.arc(ex, ey, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /**
   * Draw a ghost with bobbing body, animated wavy skirt, and direction-tracking pupils.
   * @param {Object} ghost
   * @param {number} s
   * @returns {void}
   */
  _renderGhost(ghost, s) {
    if (!ghost.active) return;

    const { ctx }  = this;
    const bobY = Math.sin(ghost._bobPhase) * 3;
    const gx   = ghost.x * s;
    const gy   = (ghost.y + bobY) * s;
    const r    = GHOST_RADIUS * s;

    let alpha = 1;
    if (ghost.weak && ghost.weakTimer < 1500) {
      alpha = Math.floor(ghost.weakTimer / 150) % 2 === 0 ? 0.35 : 1;
    }

    ctx.save();
    ctx.globalAlpha = ghost.respawning ? 0 : alpha;

    const color = ghost.weak ? '#5a6fa0' : ghost.color;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(gx + 2 * s, gy + r * 0.85, r * 0.6, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body gradient
    const grad = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.3, r * 0.05, gx, gy, r * 1.3);
    grad.addColorStop(0, ghost.weak ? '#8fa8d0' : _lighten(ghost.color, 40));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;

    // Dome
    ctx.beginPath();
    ctx.arc(gx, gy - r * 0.05, r, Math.PI, 0, false);

    // Animated wavy skirt
    const yBottom  = gy + r * 0.88;
    const waveCount = 3;
    ctx.lineTo(gx + r, yBottom);
    for (let i = waveCount; i >= 0; i--) {
      const wx = gx - r + (r * 2 / waveCount) * i;
      const wy = yBottom + Math.sin(ghost._waveOffset + i * 1.3) * r * 0.28;
      ctx.lineTo(wx, wy);
    }
    ctx.lineTo(gx - r, yBottom);
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (!ghost.weak) {
      const eyeOffX = r * 0.30;
      const eyeOffY = -r * 0.2;
      const eyeR    = r * 0.22;
      const pupilR  = eyeR * 0.55;
      const px      = ghost.dirX * eyeR * 0.25;
      const py      = ghost.dirY * eyeR * 0.25;

      [-1, 1].forEach((side) => {
        const ex = gx + side * eyeOffX;
        const ey = gy + eyeOffY;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR, eyeR * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a4ab0';
        ctx.beginPath();
        ctx.arc(ex + px, ey + py, pupilR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + px - pupilR * 0.3, ey + py - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      // X eyes
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth   = 1.8 * s;
      ctx.lineCap     = 'round';
      [-1, 1].forEach((side) => {
        const ex = gx + side * r * 0.3;
        const ey = gy - r * 0.15;
        const d  = r * 0.18;
        ctx.beginPath();
        ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d);
        ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d);
        ctx.stroke();
      });
    }

    ctx.restore();
  },

  /**
   * Draw the egg.
   * @param {number} s
   * @returns {void}
   */
  _renderEgg(s) {
    const { ctx, egg } = this;
    const ex = egg.x * s;
    const ey = egg.y * s;
    const rx = EGG_RADIUS * s;
    const ry = EGG_RADIUS * 1.35 * s;

    let alpha = 1;
    if (egg.fadeIn > 0) {
      alpha = 1 - egg.fadeIn / 400;
      egg.fadeIn = Math.max(0, egg.fadeIn - 16);
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Egg body
    ctx.fillStyle = '#f0e8d0';
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Speckles
    ctx.fillStyle = 'rgba(120,80,40,0.3)';
    const speckles = [[0.2, -0.3], [-0.35, 0.1], [0.1, 0.4], [-0.1, -0.5]];
    speckles.forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(ex + ox * rx, ey + oy * ry, rx * 0.18, 0, Math.PI * 2);
      ctx.fill();
    });

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.ellipse(ex - rx * 0.25, ey - ry * 0.3, rx * 0.25, ry * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Draw a floating score text.
   * @param {Object} f  FloatingText
   * @param {number} s
   * @returns {void}
   */
  _renderFloat(f, s) {
    const { ctx } = this;
    const progress = f.life / FLOAT_LIFE;
    ctx.save();
    ctx.globalAlpha = Math.min(progress * 2, 1);
    ctx.fillStyle   = f.color;
    ctx.font        = `bold ${Math.round(18 * s)}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x * s, f.y * s);
    ctx.restore();
  },

  // ─── Canvas Resize ─────────────────────────────────────────────────────────

  /**
   * Recalculate canvas pixel size and scale factor.
   * @returns {void}
   */
  handleResize() {
    const wrap = document.querySelector('.pacman-canvas-wrap');
    if (!wrap) return;
    const size         = Math.floor(wrap.getBoundingClientRect().width);
    this.canvas.width  = size;
    this.canvas.height = size;
    this.scale         = size / GAME_SIZE;
    if (this.state !== 'playing') this.render();
  },

  /**
   * Translate a pointer event's client coords to game-space coords.
   * @param {PointerEvent} e
   * @returns {{x:number,y:number}}
   */
  pointerToGame(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / this.scale,
      y: (e.clientY - rect.top)  / this.scale,
    };
  },

  /**
   * Handle pointer tap on canvas.
   * Tapping near a ghost locks pacman onto it (path recomputed each frame in update).
   * Tapping elsewhere computes the shortest toroidal path to that point.
   * @param {PointerEvent} e
   * @returns {void}
   */
  _onCanvasPointer(e) {
    if (this.state !== 'playing') return;
    e.preventDefault();
    const pt = this.pointerToGame(e);

    // Detect tap on/near a ghost
    const hitGhost = this.ghosts.find(
      (g) => g.active && !g.respawning &&
             Math.hypot(pt.x - g.x, pt.y - g.y) < GHOST_RADIUS * 2.5
    );

    if (hitGhost) {
      this._targetGhost = hitGhost;  // update() keeps recomputing path
    } else {
      this._targetGhost = null;
    }

    const tx = hitGhost ? hitGhost.x : pt.x;
    const ty = hitGhost ? hitGhost.y : pt.y;
    this._path = this._computePath(this.pacman.x, this.pacman.y, tx, ty);
  },

  // ─── HUD & Overlay ─────────────────────────────────────────────────────────

  /**
   * Sync score and level DOM elements.
   * @returns {void}
   */
  updateHUD() {
    const scoreEl = document.getElementById('score-display');
    const levelEl = document.getElementById('level-display');
    if (scoreEl) scoreEl.textContent = this.score;
    if (levelEl) levelEl.textContent = this.level;
  },

  /**
   * Update button enabled/disabled/label state.
   * @param {'idle'|'playing'|'paused'} state
   * @returns {void}
   */
  _setButtonState(state) {
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    if (state === 'playing') {
      btnStart.textContent = '▶ Playing';
      btnStart.disabled    = true;
      btnPause.disabled    = false;
    } else if (state === 'paused') {
      btnStart.textContent = '▶ Resume';
      btnStart.disabled    = false;
      btnPause.disabled    = true;
    } else {
      btnStart.textContent = '▶ Start';
      btnStart.disabled    = false;
      btnPause.disabled    = true;
    }
  },

  /**
   * Show level-select overlay (called before game starts).
   * @returns {void}
   */
  _showLevelSelect() {
    const overlay = document.getElementById('pacman-overlay');
    overlay.classList.remove('pacman-overlay--hidden');
    document.getElementById('overlay-title').textContent    = 'Select Level';
    document.getElementById('overlay-subtitle').textContent = 'How many ghosts can you handle?';
    document.getElementById('overlay-levels').classList.remove('pacman-overlay--hidden');
    document.getElementById('overlay-resume').classList.add('pacman-overlay--hidden');
    overlay.querySelector('.pacman-overlay__btn--level')?.focus();
  },

  /**
   * Show the paused / resume overlay.
   * @returns {void}
   */
  _showResumeOverlay() {
    const overlay = document.getElementById('pacman-overlay');
    overlay.classList.remove('pacman-overlay--hidden');
    document.getElementById('overlay-title').textContent    = 'PAUSED';
    document.getElementById('overlay-subtitle').textContent = 'Press Enter or tap Resume to continue';
    document.getElementById('overlay-levels').classList.add('pacman-overlay--hidden');
    document.getElementById('overlay-resume').classList.remove('pacman-overlay--hidden');
    document.getElementById('btn-resume').focus();
  },

  /**
   * Hide the overlay.
   * @returns {void}
   */
  _hideOverlay() {
    document.getElementById('pacman-overlay').classList.add('pacman-overlay--hidden');
  },

  // ─── Persistence ───────────────────────────────────────────────────────────

  /**
   * Save the current session score to StorageManager.
   * @returns {void}
   */
  saveSession() {
    if (this.state === 'idle') return;
    StorageManager.saveScore('pacman', this.playerId, this.score, `level-${this.level}`);
    StorageManager.logAudit(this.playerId, 'pacman_score', { score: this.score, level: this.level });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Shortest signed delta from `from` to `to` on a toroidal axis of given `size`.
 * Result is in the range (-size/2, size/2].
 * @param {number} to
 * @param {number} from
 * @param {number} size
 * @returns {number}
 */
function _toroidalDelta(to, from, size) {
  let d = to - from;
  if (d >  size / 2) d -= size;
  if (d < -size / 2) d += size;
  return d;
}

/**
 * Lighten a CSS hex colour string by `amount` (0–255).
 * @param {string} hex   e.g. '#e94560'
 * @param {number} amount
 * @returns {string}
 */
function _lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => PacmanGame.init());

export default PacmanGame;

/**
 * InputManager — Unified input bus
 * Normalizes Touch, Mouse, Keyboard, and Gamepad events
 * into standardized application intents.
 *
 * Intents: UP, DOWN, LEFT, RIGHT, SELECT, BACK, PAUSE
 */

const INTENTS = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  SELECT: 'SELECT',
  BACK: 'BACK',
  PAUSE: 'PAUSE',
};

// Keyboard mapping
const KEY_MAP = {
  ArrowUp: INTENTS.UP,
  ArrowDown: INTENTS.DOWN,
  ArrowLeft: INTENTS.LEFT,
  ArrowRight: INTENTS.RIGHT,
  w: INTENTS.UP,
  W: INTENTS.UP,
  s: INTENTS.DOWN,
  S: INTENTS.DOWN,
  a: INTENTS.LEFT,
  A: INTENTS.LEFT,
  d: INTENTS.RIGHT,
  D: INTENTS.RIGHT,
  Enter: INTENTS.SELECT,
  ' ': INTENTS.SELECT,
  Escape: INTENTS.BACK,
  Backspace: INTENTS.BACK,
  p: INTENTS.PAUSE,
  P: INTENTS.PAUSE,
};

// Gamepad button mapping (Standard Gamepad Layout)
const GAMEPAD_MAP = {
  12: INTENTS.UP,     // D-pad up
  13: INTENTS.DOWN,   // D-pad down
  14: INTENTS.LEFT,   // D-pad left
  15: INTENTS.RIGHT,  // D-pad right
  0: INTENTS.SELECT,  // A / Cross
  1: INTENTS.BACK,    // B / Circle
  9: INTENTS.PAUSE,   // Start
};

const InputManager = {
  _listeners: {},
  _gamepadPollId: null,
  _gamepadPrevState: {},
  _touchStartPos: null,

  /** Minimum swipe distance in pixels */
  SWIPE_THRESHOLD: 50,

  /**
   * Initialize all input listeners.
   * @param {HTMLElement} [target=document] — Element to bind events to
   */
  init(target = document) {
    this._target = target;

    // Keyboard
    document.addEventListener('keydown', this._onKeyDown.bind(this));

    // Touch
    target.addEventListener('touchstart', this._onTouchStart.bind(this), {
      passive: true,
    });
    target.addEventListener('touchend', this._onTouchEnd.bind(this), {
      passive: true,
    });

    // Gamepad
    window.addEventListener(
      'gamepadconnected',
      this._onGamepadConnected.bind(this)
    );
    window.addEventListener(
      'gamepaddisconnected',
      this._onGamepadDisconnected.bind(this)
    );

    console.log('[InputManager] Initialized');
  },

  /**
   * Register a callback for an intent.
   * @param {string} intent — One of INTENTS values
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  on(intent, callback) {
    if (!this._listeners[intent]) {
      this._listeners[intent] = [];
    }
    this._listeners[intent].push(callback);

    return () => {
      this._listeners[intent] = this._listeners[intent].filter(
        (cb) => cb !== callback
      );
    };
  },

  /**
   * Emit an intent to all registered listeners.
   * @param {string} intent
   * @param {object} [data={}]
   */
  emit(intent, data = {}) {
    const cbs = this._listeners[intent];
    if (cbs) {
      cbs.forEach((cb) => {
        try {
          cb({ intent, ...data });
        } catch (e) {
          console.error(`[InputManager] Listener error for "${intent}":`, e);
        }
      });
    }
  },

  /**
   * Remove all listeners and stop polling.
   */
  destroy() {
    this._listeners = {};
    if (this._gamepadPollId) {
      cancelAnimationFrame(this._gamepadPollId);
      this._gamepadPollId = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);
    console.log('[InputManager] Destroyed');
  },

  // --- Internal handlers ---

  _onKeyDown(e) {
    // Never intercept keys while focus is inside an editable field
    const tag = e.target?.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      e.target?.isContentEditable
    ) return;

    const intent = KEY_MAP[e.key];
    if (intent) {
      e.preventDefault();
      this.emit(intent, { source: 'keyboard', key: e.key });
    }
  },

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  },

  _onTouchEnd(e) {
    if (!this._touchStartPos) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStartPos.x;
    const dy = touch.clientY - this._touchStartPos.y;
    const elapsed = Date.now() - this._touchStartPos.time;
    this._touchStartPos = null;

    // If short tap (< 300ms and small movement), treat as SELECT
    if (
      elapsed < 300 &&
      Math.abs(dx) < 20 &&
      Math.abs(dy) < 20
    ) {
      // SELECT is handled by click events on interactive elements
      return;
    }

    // Swipe detection
    if (
      Math.abs(dx) < this.SWIPE_THRESHOLD &&
      Math.abs(dy) < this.SWIPE_THRESHOLD
    ) {
      return;
    }

    let intent;
    if (Math.abs(dx) > Math.abs(dy)) {
      intent = dx > 0 ? INTENTS.RIGHT : INTENTS.LEFT;
    } else {
      intent = dy > 0 ? INTENTS.DOWN : INTENTS.UP;
    }

    this.emit(intent, { source: 'touch' });
  },

  _onGamepadConnected(e) {
    console.log(`[InputManager] Gamepad connected: ${e.gamepad.id}`);
    if (!this._gamepadPollId) {
      this._pollGamepad();
    }
  },

  _onGamepadDisconnected(e) {
    console.log(`[InputManager] Gamepad disconnected: ${e.gamepad.id}`);
    const gamepads = navigator.getGamepads();
    const anyConnected = Array.from(gamepads).some((gp) => gp !== null);
    if (!anyConnected && this._gamepadPollId) {
      cancelAnimationFrame(this._gamepadPollId);
      this._gamepadPollId = null;
    }
  },

  _pollGamepad() {
    const gamepads = navigator.getGamepads();

    for (const gp of gamepads) {
      if (!gp) continue;

      const prevButtons = this._gamepadPrevState[gp.index] || {};

      for (const [btnIdx, intent] of Object.entries(GAMEPAD_MAP)) {
        const btn = gp.buttons[btnIdx];
        if (btn && btn.pressed && !prevButtons[btnIdx]) {
          this.emit(intent, { source: 'gamepad', gamepadIndex: gp.index });
        }
      }

      // Analog stick directional intents (left stick)
      const axes = gp.axes;
      if (axes.length >= 2) {
        const DEAD_ZONE = 0.5;
        const prevAxes = this._gamepadPrevState[gp.index + '_axes'] || [0, 0];

        if (axes[0] < -DEAD_ZONE && prevAxes[0] >= -DEAD_ZONE)
          this.emit(INTENTS.LEFT, { source: 'gamepad' });
        if (axes[0] > DEAD_ZONE && prevAxes[0] <= DEAD_ZONE)
          this.emit(INTENTS.RIGHT, { source: 'gamepad' });
        if (axes[1] < -DEAD_ZONE && prevAxes[1] >= -DEAD_ZONE)
          this.emit(INTENTS.UP, { source: 'gamepad' });
        if (axes[1] > DEAD_ZONE && prevAxes[1] <= DEAD_ZONE)
          this.emit(INTENTS.DOWN, { source: 'gamepad' });

        this._gamepadPrevState[gp.index + '_axes'] = [axes[0], axes[1]];
      }

      // Save button state
      const btnState = {};
      for (const btnIdx of Object.keys(GAMEPAD_MAP)) {
        const btn = gp.buttons[btnIdx];
        btnState[btnIdx] = btn ? btn.pressed : false;
      }
      this._gamepadPrevState[gp.index] = btnState;
    }

    this._gamepadPollId = requestAnimationFrame(this._pollGamepad.bind(this));
  },
};

// Export intents for consumers
export { INTENTS };
export default InputManager;

/**
 * StorageManager — Robust wrapper for localStorage
 * Handles JSON serialization/deserialization with error handling.
 */

const STORAGE_PREFIX = 'gconsole_';

const StorageManager = {
  /**
   * Get a value from localStorage by key.
   * @param {string} key — Storage key (without prefix)
   * @param {*} defaultValue — Fallback if key not found or parse fails
   * @returns {*} Parsed value or defaultValue
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[StorageManager] Failed to read key "${key}":`, e);
      return defaultValue;
    }
  },

  /**
   * Set a value in localStorage.
   * @param {string} key — Storage key (without prefix)
   * @param {*} value — Value to serialize and store
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[StorageManager] Failed to write key "${key}":`, e);
      if (e.name === 'QuotaExceededError') {
        StorageManager._onQuotaExceeded(key);
      }
      return false;
    }
  },

  /**
   * Remove a key from localStorage.
   * @param {string} key — Storage key (without prefix)
   */
  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.warn(`[StorageManager] Failed to remove key "${key}":`, e);
    }
  },

  /**
   * Check if a key exists in localStorage.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return localStorage.getItem(STORAGE_PREFIX + key) !== null;
  },

  /**
   * Get all gconsole keys.
   * @returns {string[]}
   */
  keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        result.push(k.slice(STORAGE_PREFIX.length));
      }
    }
    return result;
  },

  /**
   * Clear all gconsole data from localStorage.
   */
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },

  // --- Score helpers ---

  /**
   * Save a game score.
   * @param {string} gameId
   * @param {string} playerId
   * @param {number} score
   * @param {string} difficulty
   * @returns {boolean} True if this is a new personal best
   */
  saveScore(gameId, playerId, score, difficulty = 'normal') {
    const scores = StorageManager.get('scores', []);
    const entry = {
      playerId,
      gameId,
      difficulty,
      score,
      timestamp: new Date().toISOString(),
    };
    scores.push(entry);
    StorageManager.set('scores', scores);

    // Check if new personal best
    const personalBest = scores
      .filter(
        (s) =>
          s.playerId === playerId &&
          s.gameId === gameId &&
          s.difficulty === difficulty &&
          s !== entry
      )
      .reduce((max, s) => Math.max(max, s.score), 0);

    return score > personalBest;
  },

  /**
   * Get top scores for a game.
   * @param {string} gameId
   * @param {number} limit
   * @returns {Array}
   */
  getTopScores(gameId, limit = 10) {
    const scores = StorageManager.get('scores', []);
    return scores
      .filter((s) => s.gameId === gameId)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  /**
   * Get a player's best score for a game.
   * @param {string} gameId
   * @param {string} playerId
   * @returns {number}
   */
  getPlayerBest(gameId, playerId) {
    const scores = StorageManager.get('scores', []);
    return scores
      .filter((s) => s.gameId === gameId && s.playerId === playerId)
      .reduce((max, s) => Math.max(max, s.score), 0);
  },

  // --- Audit helpers ---

  /**
   * Log an audit action.
   * @param {string} playerId
   * @param {string} action
   * @param {object} data
   */
  logAudit(playerId, action, data = {}) {
    const audit = StorageManager.get('audit', []);
    audit.push({
      playerId,
      action,
      ...data,
      timestamp: new Date().toISOString(),
    });
    // Keep only last 500 audit entries
    if (audit.length > 500) {
      audit.splice(0, audit.length - 500);
    }
    StorageManager.set('audit', audit);
  },

  /**
   * Handle quota exceeded — try to free space.
   * @private
   */
  _onQuotaExceeded(failedKey) {
    console.warn(
      `[StorageManager] Storage quota exceeded while writing "${failedKey}". Trimming audit log.`
    );
    const audit = StorageManager.get('audit', []);
    if (audit.length > 50) {
      StorageManager.set('audit', audit.slice(-50));
    }
  },
};

export default StorageManager;

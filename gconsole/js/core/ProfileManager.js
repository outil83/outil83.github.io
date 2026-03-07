/**
 * ProfileManager — Handles player profiles, switching, and leaderboard calculation.
 * Depends on StorageManager.
 */

import StorageManager from './StorageManager.js';

const AVATARS = ['🎮', '👾', '🕹️', '🏆', '⭐', '🎲', '🎯', '🚀'];

const ProfileManager = {
  /**
   * Get all profiles.
   * @returns {Array<{id: string, name: string, avatar: string, createdAt: string}>}
   */
  getAll() {
    return StorageManager.get('profiles', []);
  },

  /**
   * Get the active profile.
   * @returns {object|null}
   */
  getActive() {
    const id = StorageManager.get('activeProfile', null);
    if (!id) return null;
    const profiles = this.getAll();
    return profiles.find((p) => p.id === id) || null;
  },

  /**
   * Set the active profile by ID.
   * @param {string} id
   * @returns {boolean}
   */
  setActive(id) {
    const profiles = this.getAll();
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return false;
    StorageManager.set('activeProfile', id);
    StorageManager.logAudit(id, 'profile_switch');
    return true;
  },

  /**
   * Create a new profile.
   * @param {string} name
   * @param {string} [avatar]
   * @returns {object} The created profile
   */
  create(name, avatar = null) {
    const profiles = this.getAll();
    const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const profile = {
      id,
      name: name.trim(),
      avatar: avatar || AVATARS[profiles.length % AVATARS.length],
      createdAt: new Date().toISOString(),
    };
    profiles.push(profile);
    StorageManager.set('profiles', profiles);
    StorageManager.logAudit(id, 'profile_created');
    return profile;
  },

  /**
   * Delete a profile by ID.
   * @param {string} id
   */
  delete(id) {
    let profiles = this.getAll();
    profiles = profiles.filter((p) => p.id !== id);
    StorageManager.set('profiles', profiles);

    // If active profile was deleted, clear it
    const activeId = StorageManager.get('activeProfile', null);
    if (activeId === id) {
      if (profiles.length > 0) {
        StorageManager.set('activeProfile', profiles[0].id);
      } else {
        StorageManager.remove('activeProfile');
      }
    }
  },

  /**
   * Check if any profiles exist.
   * @returns {boolean}
   */
  hasProfiles() {
    return this.getAll().length > 0;
  },

  /**
   * Get leaderboard for a specific game.
   * @param {string} gameId
   * @param {number} [limit=10]
   * @returns {Array<{rank: number, playerName: string, playerId: string, score: number}>}
   */
  getLeaderboard(gameId, limit = 10) {
    const scores = StorageManager.get('scores', []);
    const profiles = this.getAll();
    const profileMap = {};
    profiles.forEach((p) => (profileMap[p.id] = p));

    // Get best score per player for this game
    const bestScores = {};
    scores
      .filter((s) => s.gameId === gameId)
      .forEach((s) => {
        if (!bestScores[s.playerId] || s.score > bestScores[s.playerId].score) {
          bestScores[s.playerId] = s;
        }
      });

    return Object.values(bestScores)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, i) => ({
        rank: i + 1,
        playerName: profileMap[s.playerId]?.name || 'Unknown',
        playerId: s.playerId,
        score: s.score,
        difficulty: s.difficulty,
        timestamp: s.timestamp,
      }));
  },

  /**
   * Get the global leaderboard across all games.
   * @param {number} [limit=10]
   * @returns {Array}
   */
  getGlobalLeaderboard(limit = 10) {
    const scores = StorageManager.get('scores', []);
    const profiles = this.getAll();
    const profileMap = {};
    profiles.forEach((p) => (profileMap[p.id] = p));

    // Aggregate total best scores across all games per player
    const playerTotals = {};
    scores.forEach((s) => {
      const key = `${s.playerId}_${s.gameId}`;
      if (!playerTotals[key] || s.score > playerTotals[key].score) {
        playerTotals[key] = s;
      }
    });

    // Sum up per player
    const playerSums = {};
    Object.values(playerTotals).forEach((s) => {
      if (!playerSums[s.playerId]) {
        playerSums[s.playerId] = 0;
      }
      playerSums[s.playerId] += s.score;
    });

    return Object.entries(playerSums)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([playerId, totalScore], i) => ({
        rank: i + 1,
        playerName: profileMap[playerId]?.name || 'Unknown',
        playerId,
        totalScore,
      }));
  },

  /**
   * Available avatars.
   */
  AVATARS,
};

export default ProfileManager;

# Functional Design Document — GConsole Game Portal

## 1. Overview

GConsole is a static Game Portal that allows users to select and play browser-based games. It supports multiple player profiles, score tracking, and leaderboard viewing. External data sync is handled via Google Forms.

---

## 2. User Personas

| Persona | Device | Primary Input |
|---|---|---|
| Casual Mobile Gamer | Smartphone | Touch |
| Tablet User | iPad / Android Tablet | Touch + Keyboard |
| Desktop Gamer | PC / Laptop | Mouse + Keyboard |
| Console/TV Gamer | Smart TV / Console | Gamepad / Controller |

---

## 3. User Flows

### 3.1 First-Time Visit

1. User opens the portal URL.
2. Portal detects no active profile in Local Storage.
3. A modal prompts the user to **Create Profile** (name, avatar selection).
4. Profile is saved to Local Storage and set as active.
5. User lands on the **Game Selection Screen**.

### 3.2 Returning Visit

1. User opens the portal URL.
2. Portal loads the active profile from Local Storage.
3. User lands on the **Game Selection Screen** with their profile displayed.

### 3.3 Profile Switching

1. User clicks the **Profile** button in the top navigation bar.
2. A dropdown/modal shows all saved profiles.
3. User selects a different profile or creates a new one.
4. Active profile updates; leaderboard and scores refresh.

### 3.4 Game Selection & Launch

1. User sees a grid of game cards on the landing page.
2. Each card shows: game thumbnail, title, best score (for active player).
3. User clicks/taps a game card.
4. Portal navigates to `/games/{game-name}/index.html?player={activePlayerId}`.
5. The game page loads, reads the active player from URL params or Local Storage.

### 3.5 In-Game Score Submission

1. Game session ends (win, lose, or quit).
2. Game module calls `StorageManager.saveScore(gameId, playerId, score, difficulty)`.
3. Score is persisted to Local Storage.
4. If the score is a new personal best, a toast notification is shown.

### 3.6 Leaderboard Viewing

1. User clicks the **Leaderboard** button on the landing page.
2. A panel/modal displays:
   - **Global Leaderboard**: Top 10 scores across all players per game.
   - **Personal Bests**: Active player's best scores per game and difficulty.
3. User can filter by game.

### 3.7 Google Forms Integration

1. User clicks **Sync Data** in the profile menu.
2. Portal opens a pre-filled Google Form in a new tab with:
   - Player profile JSON
   - High scores JSON
   - Recent actions audit log
3. User submits the form to sync data externally.

---

## 4. Screen Inventory

| Screen | Route | Description |
|---|---|---|
| Game Selection (Landing) | `/index.html` | Grid of game cards, profile bar, leaderboard button |
| Profile Modal | Overlay on Landing | Create/switch player profiles |
| Leaderboard Panel | Overlay on Landing | View scores by game and player |
| Pacman | `/games/pacman/index.html` | Pacman game screen |
| Chess | `/games/chess/index.html` | Chess game screen |
| Road Runner | `/games/roadrunner/index.html` | Road Runner game screen |

---

## 5. Data Model (Local Storage)

### 5.1 Profiles
```json
{
  "gconsole_profiles": [
    {
      "id": "p1",
      "name": "Player One",
      "avatar": "avatar1",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "gconsole_activeProfile": "p1"
}
```

### 5.2 Scores
```json
{
  "gconsole_scores": [
    {
      "playerId": "p1",
      "gameId": "pacman",
      "difficulty": "normal",
      "score": 15000,
      "timestamp": "2025-01-15T12:30:00Z"
    }
  ]
}
```

### 5.3 Audit Log
```json
{
  "gconsole_audit": [
    {
      "playerId": "p1",
      "action": "game_start",
      "gameId": "pacman",
      "timestamp": "2025-01-15T12:25:00Z"
    }
  ]
}
```

---

## 6. Google Forms Field Mapping

| Form Field | Source |
|---|---|
| Player Name | `profile.name` |
| Player ID | `profile.id` |
| Scores JSON | `JSON.stringify(playerScores)` |
| Audit JSON | `JSON.stringify(auditLog)` |
| Submission Date | Auto-generated |

---

## 7. Ad Placement Strategy

| Screen Size | Ad Slots |
|---|---|
| Mobile (`<600px`) | 1 banner below game grid |
| Tablet (`600-1024px`) | 1 banner + 1 sidebar |
| Desktop (`1024-1440px`) | 1 banner + 2 sidebar |
| TV (`>1440px`) | 2 banners + 2 sidebar |

Ad placeholders are managed by `AdManager.js` and injected dynamically based on viewport width.

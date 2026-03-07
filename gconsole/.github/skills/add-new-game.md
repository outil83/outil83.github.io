---
description: Scaffold and register a new game in the GConsole portal. Creates the required file structure, wires up StorageManager and InputManager, and registers the game in app.js.
---

# Add a New Game to GConsole

Follow these steps to add a new game named `{game-name}` to the portal.

## 1. Create the Game Directory

Create the following files under `games/{game-name}/`:

```
games/{game-name}/
├── index.html
├── game.js
└── style.css
```

## 2. `index.html`

- Link `../../css/main.css` for shared portal styles.
- Link `./style.css` for game-specific styles.
- Add a `<script type="module" src="./game.js"></script>` tag.
- Use semantic HTML5 structure (`<header>`, `<main>`, `<footer>`).
- No inline `<script>` blocks.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GConsole — {Game Name}</title>
  <link rel="stylesheet" href="../../css/main.css">
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <header class="game-header">...</header>
  <main class="game-main">...</main>
  <footer class="game-footer">...</footer>
  <script type="module" src="./game.js"></script>
</body>
</html>
```

## 3. `game.js`

- Import `StorageManager` and `InputManager` via relative paths.
- Read the active player from `StorageManager.get('activeProfile')`.
- Subscribe to `InputManager` intents — never raw keyboard/touch/gamepad events.
- Save scores via `StorageManager.saveScore(gameId, playerId, score, difficulty)`.
- Log actions via `StorageManager.logAudit(playerId, action, data)`.
- Export a default object literal (no classes, no `var`).

```js
import StorageManager from '../../js/core/StorageManager.js';
import InputManager, { INTENTS } from '../../js/core/InputManager.js';

const {game-name}Game = {
  /** @type {string|null} */
  playerId: null,

  /** Initialise the game and bind input. */
  init() {
    this.playerId = StorageManager.get('activeProfile');
    InputManager.init(document.body);
    InputManager.on(INTENTS.SELECT, () => this.onSelect());
    InputManager.on(INTENTS.PAUSE,  () => this.onPause());
    // Add further intent handlers as needed
  },

  /** Handle SELECT intent. */
  onSelect() { /* ... */ },

  /** Handle PAUSE intent. */
  onPause() { /* ... */ },

  /**
   * Call when a round ends.
   * @param {number} score
   * @param {string} difficulty
   */
  saveResult(score, difficulty) {
    StorageManager.saveScore('{game-name}', this.playerId, score, difficulty);
    StorageManager.logAudit(this.playerId, 'game_end', { score, difficulty });
  },
};

export default {game-name}Game;

{game-name}Game.init();
```

## 4. `style.css`

- Mobile-first: default styles target `< 600px`.
- Extend with `@media (min-width: 600px)`, `@media (min-width: 1024px)`, `@media (min-width: 1440px)`.
- BEM naming: `.block__element--modifier`.
- Use CSS custom properties from `:root` — do not hard-code colours or spacing.
- `:focus-visible` on all interactive elements.
- Touch targets ≥ 44×44px under `@media (any-hover: none)`.

## 5. Register in `js/app.js`

Add an entry to the `GAMES` array:

```js
{
  id: '{game-name}',
  title: '{Game Display Name}',
  description: 'Short description shown on the portal card.',
  thumbnail: 'assets/{game-name}-thumb.png',
  path: 'games/{game-name}/index.html',
}
```

## Checklist

- [ ] `games/{game-name}/index.html` created — links `main.css` and game `style.css`
- [ ] `games/{game-name}/game.js` created — imports `StorageManager` and `InputManager`
- [ ] `games/{game-name}/style.css` created — mobile-first, all 4 breakpoints, BEM classes
- [ ] Active player read via `StorageManager.get('activeProfile')`
- [ ] Scores saved via `StorageManager.saveScore(...)`
- [ ] Actions logged via `StorageManager.logAudit(...)`
- [ ] No direct `localStorage` calls
- [ ] No `var`, no inline `<script>`, no raw DOM event listeners for game input
- [ ] Game registered in `GAMES` array in `js/app.js`
- [ ] Thumbnail asset added to `assets/`

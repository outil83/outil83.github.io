<!-- Use this file to provide workspace-specific custom instructions to Copilot. -->
<!-- For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# GConsole — Copilot Workspace Instructions

## Project Overview

**GConsole** is a static web-based Game Portal built with **HTML5, Vanilla JavaScript (ES6 modules), and CSS**. There is no build step, no bundler, and no framework. All code runs directly in the browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5, semantic elements |
| Styling | Vanilla CSS (custom properties, Grid, Flexbox) |
| Logic | Vanilla JS with ES6 modules (`import`/`export`) |
| State | `localStorage` (all keys prefixed `gconsole_`) |
| External | Google Forms (pre-filled URLs for data sync) |
| Ads | Placeholder `<div>` elements (future Google Ads) |

## Architecture

- **Portal Shell** — `index.html` + `js/app.js`: Landing page with game selection grid, profile management, leaderboards, ad injection.
- **Core Modules** (`js/core/`):
  - `InputManager.js` — Unified input bus normalizing Touch, Mouse, Keyboard, Gamepad into intents (`UP`, `DOWN`, `LEFT`, `RIGHT`, `SELECT`, `BACK`, `PAUSE`).
  - `StorageManager.js` — `localStorage` CRUD wrapper with JSON serde, score helpers, audit logging.
  - `ProfileManager.js` — Player CRUD, active profile switching, leaderboard calculation. Depends on `StorageManager`.
  - `AdManager.js` — Viewport-aware ad placeholder injection with responsive breakpoints.
- **Game Modules** (`games/{name}/`): Each game is self-contained with its own `index.html`, `game.js`, and `style.css`. Games import core modules via relative paths.

## Folder Structure

```
/gconsole
├── assets/                  # Images, icons, sounds
├── css/
│   ├── main.css             # Global styles, CSS custom properties
│   └── responsive.css       # Breakpoints: <600, 600-1024, 1024-1440, >1440
├── js/
│   ├── core/
│   │   ├── InputManager.js
│   │   ├── StorageManager.js
│   │   ├── ProfileManager.js
│   │   └── AdManager.js
│   └── app.js               # Portal shell entry point
├── games/
│   ├── pacman/              # index.html, game.js, style.css
│   ├── chess/               # index.html, game.js, style.css
│   └── roadrunner/          # index.html, game.js, style.css
├── docs/
│   ├── functional_design.md
│   └── technical_design.md
├── index.html               # Portal shell
└── README.md
```

## Coding Conventions

### JavaScript
- Use **ES6 module syntax** (`import`/`export`). All `<script>` tags must use `type="module"`.
- No `var` — use `const` by default, `let` when reassignment is needed.
- Use **object literal modules** (e.g., `const StorageManager = { ... }; export default StorageManager;`) rather than classes.
- All localStorage keys must be prefixed with `gconsole_`. Always use `StorageManager` for reads/writes — never call `localStorage` directly.
- Game modules import core modules using **relative paths** (e.g., `../../js/core/StorageManager.js`).
- Use JSDoc comments for all public methods.

### CSS
- **Mobile-first** responsive design with 4 breakpoints (`<600px`, `600-1024px`, `1024-1440px`, `>1440px`).
- Use **CSS custom properties** defined in `:root` (see `css/main.css`).
- BEM-like naming: `.block__element--modifier`.
- Prefer `rem` / `em` units. Use `clamp()` for fluid typography.
- All interactive elements must have `:focus-visible` styles for keyboard/gamepad navigation.
- Minimum 44×44px touch targets on touch devices (`@media (any-hover: none)`).

### HTML
- Semantic HTML5 elements (`<header>`, `<main>`, `<footer>`, `<nav>`, `<section>`).
- ARIA attributes on interactive non-semantic elements (e.g., `role="button"`, `aria-label`).
- All game cards and interactive elements must be keyboard-focusable (`tabindex="0"`).

## Adding a New Game

Use the `/add-new-game` skill for step-by-step scaffolding instructions.

## Input Handling

All input is routed through `InputManager`. Games and the portal shell subscribe to **intents**, not raw events:

```js
import InputManager, { INTENTS } from '../../js/core/InputManager.js';
InputManager.init(document.body);
InputManager.on(INTENTS.UP, (e) => { /* handle */ });
InputManager.on(INTENTS.SELECT, (e) => { /* handle */ });
```

Supported intents: `UP`, `DOWN`, `LEFT`, `RIGHT`, `SELECT`, `BACK`, `PAUSE`.
Sources tracked in event data: `keyboard`, `touch`, `gamepad`.

## State Management

All state lives in `localStorage` via `StorageManager`:

| Key | Type | Description |
|---|---|---|
| `profiles` | `Array<Profile>` | All player profiles |
| `activeProfile` | `string` | Active player ID |
| `scores` | `Array<ScoreEntry>` | All score records |
| `audit` | `Array<AuditEntry>` | User action audit log (max 500) |

Keys are auto-prefixed with `gconsole_` by StorageManager.

## Responsive Breakpoints

| Breakpoint | Target | Grid Columns |
|---|---|---|
| `< 600px` | Mobile | 1 |
| `600 – 1024px` | Tablet | 2 |
| `1024 – 1440px` | Desktop | 3 |
| `> 1440px` | TV / Console | 4 |

## Important Constraints

- **No build tools or bundlers** — this is a static site served as-is.
- **No npm dependencies** — everything is vanilla.
- **ES6 modules require HTTP server** — `file://` protocol will not work. Use Live Server or `npx serve .`.
- **No inline `<script>` blocks** — all JS in external `.js` files.
- Ad placeholders must use the CSS class `.ad-slot` and be managed through `AdManager`.
- Google Forms integration uses pre-filled URLs — no API keys or OAuth needed.

## Running Locally

```bash
npx serve .
# or use VS Code Live Server extension on index.html
```

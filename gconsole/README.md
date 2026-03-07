# 🎮 GConsole - Game Portal

A static web application (HTML5, Vanilla JS, CSS) serving as a modular Game Portal with support for multiple games, player profiles, leaderboards, and responsive design across all device sizes.

## Features

### 🕹️ Game Library
- **Pacman** - Classic arcade maze game
- **Chess** - Two-player strategy board game
- **Road Runner** - Endless runner action game
- More games can be added via the modular architecture

### 👤 Player Profiles & Leaderboards
- Create and switch between multiple player profiles
- Per-game, per-difficulty high score tracking
- Global leaderboard across all players
- All data persisted in Local Storage

### 📱 Responsive Design Strategy
| Breakpoint | Target | Layout |
|---|---|---|
| `< 600px` | Mobile | Single column, large touch targets |
| `600px – 1024px` | Tablet | 2-column grid, touch-optimized |
| `1024px – 1440px` | Desktop | 3-column grid, hover states |
| `> 1440px` | TV / Console | 4-column grid, overscan-safe, gamepad focus |

### 🎮 Multi-Modal Input
- **Primary:** Touch and Mouse
- **Secondary:** Keyboard and Gamepad/Controller
- Unified `InputManager` normalizes all inputs into application intents

### 💰 Monetization (Future)
- Ad placeholder `<div>` elements are injected based on available screen real estate
- Ready for Google AdSense / Google Ads integration

### 🔗 External Integration
- Google Forms integration for syncing player profiles, scores, leaderboard data, and user action audits

## Getting Started

1. Open the project folder in VS Code or any static file server.
2. Serve `index.html` via a local HTTP server (e.g., Live Server extension).
3. Select a player profile or create one.
4. Choose a game from the landing page to start playing.

## Project Structure

```
/gconsole
  /assets          - Images, icons, sounds
  /css             - Global stylesheets
  /js/core         - Reusable ES6 modules
  /games/{name}    - Self-contained game modules
  /docs            - Design documentation
  index.html       - Portal shell / landing page
```

## Adding a New Game

1. Create a new folder under `/games/{game-name}/`
2. Add `index.html`, `game.js`, and `style.css`
3. Register the game in the game registry inside `app.js`
4. The portal shell will automatically render the new game card

## License

MIT

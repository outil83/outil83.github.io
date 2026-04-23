# Copilot Instructions for outil83.github.io

This document provides guidance for working on the various apps and projects within the outil83.github.io portfolio.

---

## 1. Account Dashboard (stmts/)

### Purpose
A single-page application (SPA) that connects to Google Sheets, reads transaction data, and displays financial widgets with drill-down tables for detailed analysis.

### Key Files
- `index.html` - UI shell with Bootstrap and Material Icons
- `dashboard.js` - Main application logic (Google API auth, data fetching, widget rendering)
- `HELP.md` - Detailed documentation

### Key Responsibilities
- **Google API Integration**: Handles OAuth via Google Identity Services
- **Drive & Sheets API**: Creates/finds `stmt-dashboard` folder and `account-transactions` sheet
- **Transaction Management**: Reads and aggregates data into categories (Cashflow, Investment, Income, Expenses)
- **UI Components**: Renders widgets with filtering, sorting, and drill-down tables

### Development Guidelines
- All Google API interaction happens in `dashboard.js`
- Transaction data format: txn_source, txn_date, narration, txn_amount, etc.
- Scopes required: `drive.file`, `spreadsheets`, `profile`, `email`
- Widget rendering is data-driven; update `renderDashboardWidgets()` when modifying dashboard layout
- Use vanilla JS; no framework dependencies

### When Modifying
- **New transaction categories**: Update aggregation logic and widget rendering
- **Data validation**: Enhance in `setupDriveAndSheet()` when reading sheet values
- **UI changes**: Keep responsive design; test on mobile and desktop

---

## 2. Game Console (gconsole/)

### Purpose
A modular game portal providing a central hub for browser-based games with multi-profile support, leaderboards, and responsive design across all devices.

### Key Files
- `index.html` - Portal shell / landing page
- `app.js` - Main application logic and game registry
- `js/core/` - Reusable ES6 modules (AdManager, InputManager, ProfileManager, StorageManager)
- `games/{name}/` - Self-contained game modules (Pacman, Chess)
- `README.md` - Full feature and architecture documentation

### Key Responsibilities
- **Game Registry**: Centralized registration and loading of games
- **Player Profiles**: Create, switch, and manage multiple profiles via LocalStorage
- **Leaderboards**: Track per-game, per-difficulty high scores globally
- **Input Manager**: Normalize touch, mouse, keyboard, and gamepad inputs
- **Responsive Design**: Adapt to mobile (<600px), tablet (600–1024px), desktop (1024–1440px), and TV (>1440px)
- **Monetization**: Ad placeholder support for Google AdSense integration

### Development Guidelines
- All games are self-contained modules with their own `index.html`, `game.js`, `style.css`
- Use LocalStorage for data persistence (profiles, scores)
- InputManager provides unified input API; use it for multi-modal support
- Follow modular architecture; avoid tight coupling between games
- CSS must support the responsive breakpoint strategy

### When Adding/Modifying
- **New game**: Create folder under `/games/{game-name}/`, implement game logic, register in game registry
- **Leaderboard changes**: Update ProfileManager and StorageManager
- **UI updates**: Ensure they work across all responsive breakpoints
- **Input handling**: Use InputManager to standardize across all input types

---

## 3. School Activities (school/)

### Purpose
Educational content providing learning resources including Marathi alphabets and multiplication tables.

### Key Files
- `index.html` - Landing page
- `marathi-alphabets.html` - Marathi alphabet learning page
- `table-times.html` - Multiplication tables learning page

### Development Guidelines
- Static HTML pages with embedded styling
- Focus on accessibility and clear typography for educational use
- Keep content well-organized and easy to navigate

### When Modifying
- Add new educational pages by following the same HTML structure
- Ensure all pages are linked from `index.html`
- Test responsiveness on mobile and tablet devices

---

## 4. Pacman Game (pacman/)

### Purpose
A standalone Pacman arcade game implementation playable directly in the browser.

### Key Files
- `index.html` - Game shell and UI
- `js/game.js` - Core game logic (movement, collision, scoring)
- `style.css` - Game styling
- `sounds/` - Audio assets

### Development Guidelines
- Vanilla JavaScript implementation
- Game state management in `game.js`
- CSS handles visual rendering and animations
- Audio files stored in `sounds/` folder

### When Modifying
- **Game mechanics**: Update collision detection and movement logic in `game.js`
- **Difficulty/Speed**: Adjust timing and difficulty parameters
- **Visuals**: Modify CSS for layout and animations
- **Audio**: Add or replace sound files in `sounds/` folder

---

## 5. Chores for Kids (chores/)

### Purpose
A task/chore management application designed to help children learn responsibility through gamified chore tracking and point accumulation.

### Key Files
- `index.html` - Main UI
- `js/scripts.js` - Core application logic
- `js/sheet.js` - Data handling and persistence
- `css/styles.css` - Primary styling
- `css/cookiealert.css` - Cookie consent styling
- `assets/` - Images and other media
- `json/` - Static data files

### Key Responsibilities
- **Chore Management**: Display and track chore assignments and completion
- **Points System**: Award points for completed chores
- **Leaderboard/Scores**: Display points and progress
- **Data Persistence**: Store chore data and points

### Development Guidelines
- Uses Bootstrap for responsive design
- Implements cookie alert for compliance
- Data storage likely via JSON or LocalStorage
- Focus on kid-friendly UI with clear task display

### When Modifying
- **New chores**: Update data source (JSON or storage)
- **Points system**: Modify scoring logic in `scripts.js`
- **UI improvements**: Keep it simple and visually engaging for children
- **Navigation**: Update navbar and contact sections as needed

---

## General Guidelines for All Apps

1. **Testing**: Test all changes on mobile, tablet, and desktop viewports
2. **Accessibility**: Ensure keyboard navigation and screen reader support
3. **Performance**: Minimize external dependencies; prefer vanilla JS or lightweight libraries
4. **Code Style**: Use consistent formatting and clear variable naming
5. **Documentation**: Update README or HELP files when modifying features
6. **Responsive Design**: Each app should work seamlessly across all device sizes
7. **Browser Compatibility**: Test on modern browsers (Chrome, Firefox, Safari, Edge)


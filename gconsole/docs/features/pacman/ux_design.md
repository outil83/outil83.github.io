# UX Design — GConsole Pacman

## User Flow

```
Launch games/pacman/index.html
        │
        ▼
   [START SCREEN]
   Score: 0  Level: 1
   Pacman, ghosts, egg visible but frozen
        │
   Press Enter / tap Start
        │
        ▼
   [PLAYING]
   Tap/click canvas → pacman navigates to point
   Path trace rendered
   Ghosts chase pacman
        │
   ┌────┴──────────────────────────────────────┐
   │                                           │
   Pacman eats egg                     Ghost eats pacman
   → ghosts turn weak (5s)             → score −1
   → new egg spawns (3s delay)         → pacman respawns
   → pacman can eat ghost              → path cleared
        │                                       │
   Pacman eats weak ghost                       │
   → score +1                                   │
   → ghost respawns (2s delay)                  │
        │                                       │
        └────────────────────────────────────────┘
        │
   Press Esc / tap Pause
        │
        ▼
   [PAUSED]
   Overlay: "PAUSED"  Resume button
        │
   Press Enter / tap Resume
        │
        ▼
   [PLAYING] (resumed)
        │
   Player navigates away / closes tab
        │
        ▼
   Score saved to StorageManager
```

---

## Screen Layouts

### Start / Game Screen

```
┌─────────────────────────────────────┐
│  GConsole Pacman          [≡ Menu]  │  ← <header>
├─────────────────────────────────────┤
│  Score: 0      Level: 1             │  ← .hud
│  [▶ Start]           [⏸ Pause]      │
├─────────────────────────────────────┤
│                                     │
│                                     │
│       ●  (pacman)                   │
│                       👻 (ghost)    │  ← <canvas> fills remaining height
│              🥚 (egg)               │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  [Ad Slot]                          │  ← .ad-slot
└─────────────────────────────────────┘
```

### Paused Overlay

```
┌─────────────────────────────────────┐
│  (game canvas dimmed underneath)    │
│                                     │
│         ┌─────────────┐             │
│         │  ⏸ PAUSED   │             │
│         │             │             │
│         │  [▶ Resume] │             │
│         └─────────────┘             │
│                                     │
└─────────────────────────────────────┘
```

### Entity Visual Specs

| Entity | Normal State | Weak/Eaten State |
|---|---|---|
| Pacman | Yellow circle with wedge mouth (canvas arc) | Flashes white when just respawned (0.5s) |
| Ghost | Coloured rounded rectangle with eyes (canvas) | Blue-grey, wavy bottom, semi-transparent |
| Egg | White oval with speckles | Disappears on eat; new egg fades in |
| Path trace | Dashed white/yellow line from pacman to target | Cleared on pacman respawn |

---

## Touch & Input Patterns

| Action | Touch | Mouse | Keyboard | InputManager Intent |
|---|---|---|---|---|
| Navigate pacman | Tap canvas point | Click canvas point | — | (raw canvas event, not an intent) |
| Start game | Tap Start button | Click Start button | `Enter` | `SELECT` |
| Pause game | Tap Pause button | Click Pause button | `Esc` | `BACK` / `PAUSE` |
| Resume game | Tap Resume button | Click Resume button | `Enter` | `SELECT` |

**Touch target sizes:**
- HUD buttons (Start, Pause, Resume): minimum 48×48px, 12px gap.
- Canvas navigation: entire canvas surface is the touch target.

---

## Responsive Behaviour

| Breakpoint | Canvas behaviour | HUD layout |
|---|---|---|
| `< 600px` (mobile portrait) | Canvas fills full viewport width; height = width (square, max available). HUD stacks above canvas. | Single row: Score \| Level \| Pause btn \| Start btn |
| `600–1024px` (tablet) | Canvas is centered, max 560px wide, square. | Same single-row HUD, slightly larger font |
| `1024–1440px` (desktop) | Canvas centered, max 800px wide, square. HUD above canvas. | Score left, level centre, buttons right |
| `> 1440px` (TV/console) | Canvas centered, max 900px wide. | Same as desktop, scaled up via `clamp()` |

Canvas always maintains **1:1 aspect ratio**. The game coordinate system is 600×600 logical units; scaled to actual canvas pixel size.

---

## Accessibility

- HUD buttons: `role="button"`, `aria-label` ("Start game", "Pause game", "Resume game").
- `tabindex="0"` on all HUD buttons; `:focus-visible` ring visible.
- Current score and level exposed via `aria-live="polite"` region so screen readers announce changes.
- Pause overlay traps focus on Resume button.
- Colour contrast: HUD text on dark background ≥ 4.5:1.
- Pacman and ghost distinguished by shape, not just colour (accessible for colour-blind users).

---

## Feedback & States

| Event | Visual Feedback | Duration |
|---|---|---|
| Pacman respawn | Pacman flashes white | 500ms |
| Ghost eaten | Ghost shrinks and fades out | 300ms, then ghost icon gone until respawn |
| Ghost weak | Ghost turns blue-grey + wobble animation | Duration of weak timer (5s) |
| Egg eaten | Egg flash then disappear | 200ms |
| New egg spawn | Egg fades in | 400ms |
| Score +1 | "+1" floating text above pacman, green | 800ms float-up then fade |
| Score −1 | "−1" floating text above pacman, red | 800ms float-up then fade |
| Game paused | Canvas 50% opacity overlay with "PAUSED" text | Until resumed |
| Path trace | Dashed yellow line, animated dash-offset | While target is set |

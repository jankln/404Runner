# 404 Runner

A minimalist, high-speed browser runner inspired by the Chrome offline dino. Built as a single-page canvas game with crisp monochrome visuals, responsive controls, and progressive difficulty.

## Highlights
- Instant start: Space, click, or tap
- Jump, duck, dodge with AABB collisions
- Speed and spawn rate ramp as you score
- Day/night cycle with reduced-motion support
- Local highscore persistence
- Sound effects with toggle
- Desktop + mobile friendly

## Controls
- Jump: Space / ArrowUp / Tap
- Duck: ArrowDown (hold) / Swipe down
- Pause: P
- Restart: Space or R (after Game Over)

## Tech
- HTML + CSS + Vanilla JS
- Canvas rendering
- requestAnimationFrame + delta time physics
- localStorage for highscores

## Run locally
Open `index.html` in a browser. For a local server, run one of these:

```bash
python -m http.server 8080
```

```bash
npx serve .
```

Then visit `http://localhost:8080`.

## Accessibility
- Reduced motion toggle in the footer
- Respects `prefers-reduced-motion` on first load

## Project structure
- `index.html` UI shell and overlays
- `styles.css` layout, typography, and visual direction
- `app.js` game loop, physics, and input handling

## License
MIT

# 🎩 Monopoly — Web Edition

A complete, browser-based Monopoly game built with **vanilla HTML, CSS and
JavaScript** — no build step, no dependencies. Just open `index.html`.

![preview](preview.png)

## ▶ Play

```bash
# any static server works, e.g.:
cd monopoly
python3 -m http.server 8000
# then open http://localhost:8000
```

Or simply double-click `index.html` to open it in your browser.

## ✨ Features — the full rule set

- **40-space classic US board** with all properties, railroads and utilities.
- **2–6 players**, any mix of **humans (hot-seat)** and **computer (AI)** players.
- **Dice & movement** with doubles (roll again; three doubles → Jail).
- **Buy or auction** every unowned property you land on.
- **Rent** for properties, railroads (scaled by count) and utilities (dice ×4 / ×10).
- **Monopolies** double the base rent and unlock building.
- **Houses & hotels** with even-building rules and a limited bank supply (32 houses, 12 hotels).
- **Mortgaging & redeeming** (with the 10% interest on redemption).
- **Chance & Community Chest** — all 16 + 16 cards, including *Get Out of Jail Free*.
- **Jail** — pay $50 bail, use a card, or roll for doubles (3-turn limit).
- **Income Tax ($200)** and **Luxury Tax ($100)**.
- **Pass GO → collect $200.**
- **Player-to-player trading** — swap properties and cash, with AI acceptance logic.
- **Debt resolution** — raise funds by selling buildings / mortgaging, or go **bankrupt**.
- **Win condition** — last solvent tycoon standing.

## 🏗 Architecture

The code is split into a UI-agnostic rules engine and a renderer:

| File | Responsibility |
|------|----------------|
| `js/data.js` | Static data: board spaces, prices, rents, the 32 cards, tokens. |
| `js/game.js` | `MonopolyGame` — the rules engine and state machine (no DOM). |
| `js/ui.js`   | `UI` — board rendering, animated tokens, panels, dice, modals. |
| `js/main.js` | `Controller` — setup screen, wiring, and the computer-player driver. |
| `css/style.css` | All styling — the classic felt board, tiles, panels and modals. |

The engine exposes its state and a small set of methods; the UI/AI controller
reads `game.pending` to know which decision is currently open and drives turns
by calling public methods. Engine ↔ UI communicate only through a handful of
hooks (`render`, `log`, `showCard`, `animateMove`, `gameOver`), so the rules
are fully testable headless.

## 🤖 Computer players

AI opponents buy sensibly (keeping a cash cushion, prioritising sets that
complete a monopoly), build evenly on monopolies when flush, bid in auctions up
to ~125% of list price, handle Jail, liquidate assets under debt, and evaluate
incoming trade offers by value.

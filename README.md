# Rookie – a free chess trainer

A chess trainer for beginners as a Progressive Web App for iPhone, iPad and Mac – completely free, offline-capable, no App Store, no account, no tracking. English and German.

**Live:** https://chess.maximilianauer.at · **Version:** 0.2.1

| Home                                                                                                                                                    | Coach                                                                                                                    | Play                                                                                                   | Game review                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| <img src="docs/screenshots/home-light.png" width="200" alt="Home: daily plan as the largest tile, then puzzle rating, strength, daily goal and streak"> | <img src="docs/screenshots/coach-light.png" width="200" alt="Coach tab: current rating, win rate and accuracy as tiles"> | <img src="docs/screenshots/play-light.png" width="200" alt="Playing a bot with the coach switched on"> | <img src="docs/screenshots/analysis-light.png" width="200" alt="Game review: each move classified and explained"> |
| <img src="docs/screenshots/home-dark.png" width="200" alt="Home in dark mode">                                                                          | <img src="docs/screenshots/coach-dark.png" width="200" alt="Coach tab in dark mode">                                     | <img src="docs/screenshots/play-dark.png" width="200" alt="Play in dark mode">                         | <img src="docs/screenshots/analysis-dark.png" width="200" alt="Game review in dark mode">                         |

**Desktop** (Mac, iPad landscape)

| Light                                                                                                                                                                                     | Dark                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| <img src="docs/screenshots/desktop-home-light.png" width="420" alt="Home on desktop in light mode: sidebar, daily plan, daily goal, streak, puzzle rating, strength, form and stars">     | <img src="docs/screenshots/desktop-home-dark.png" width="420" alt="Home on desktop in dark mode">            |
| <img src="docs/screenshots/desktop-analysis-light.png" width="420" alt="Game review on desktop in light mode: a mistake on the board, the engine's top moves and accuracy per move type"> | <img src="docs/screenshots/desktop-analysis-dark.png" width="420" alt="Game review on desktop in dark mode"> |

Screenshots use generated sample data (`scripts/screenshots/`), not real games.

## Features

- **Play** against 8 bots with personality (≈ 400–1650) – Stockfish 19 (WebAssembly) in the browser, hints, takebacks, optional clock
- **Play with a coach** – feedback on every move, warnings about attacked pieces, take back mistakes with an explanation
- **Daily plan** – a personal training plan every day, built from your weaknesses and due reviews; it is always the first tile on Home, with one clear next step
- **Progress at a glance** – Home shows puzzle rating with trend, estimated strength on the way to 1200, daily goal, streak, form and stars as tiles
- **Coach tab** – how you are playing right now (rating, win rate, accuracy, blunders per game), a five-sided skill profile, your last 30 games, accuracy per game and concrete things to work on
- **Stars** – every lesson, opening line and endgame earns up to three stars; progress per area in your profile
- **Tactics** – fork, pin, skewer, discovered attack, back-rank mate: explained, then practised with puzzles
- **Puzzle Storm** and **play a friend** on one device
- **Replay your mistakes** from your own games and find the better move
- **Chess basics** – 15 interactive lessons from zero (piece mini-games, check, mate, castling, promotion, en passant)
- **Puzzles** – 38,400 hand-picked puzzles from the free Lichess database, Glicko-2 rating, theme filter, puzzle of the day, spaced repetition (FSRS) for missed ones
- **Game review** – every move classified (brilliant to blunder) and explained in plain language („your knight on g5 is unprotected“), the engine's top 3 moves for each position, evaluation graph, PGN import/export
- **Your mistakes become puzzles** – from bot games and imported games
- **Endgame trainer** – 10 lessons with the technique explained step by step, then practice against perfect tablebase play with live feedback on every move
- **Opening courses** – 14 openings and defences with explained lines; guided learning with hints, Stockfish explains wrong moves; learned lines go into your repertoire for spaced repetition
- **Linked accounts** – link your Lichess / Chess.com username once, new games are imported and analysed automatically
- **Profile & statistics** – rating history, activity, results by colour/time control/opponent strength, openings, accuracy by game phase, typical mistakes, personal insights
- **Optional account** – passkey sign-in (no email, no password), progress synced across devices; export and delete at any time
- **Install prompt** on phones – one-tap install on Android, step-by-step guide on iPhone/iPad
- Calm tile-based design with pastel areas and monospace numbers; contrast checked against WCAG AA (`node scripts/contrast.mjs`)
- Light/dark mode, English/German, 7 board themes, 6 piece sets, animation speed, 3 sound styles, backup export/import, works offline

## Development

```bash
npm install          # also copies Stockfish to static/engine
npm run dev          # http://localhost:5173
npm run build && npm run preview
```

Tests:

```bash
npm run test:unit -- --run   # Vitest
npm run test:e2e             # Playwright: iPhone & Mac Safari (WebKit) + Chromium
npm run check && npm run lint
```

Screenshots and design checks:

```bash
node scripts/screenshots/gen-fixture.mjs        # sample games played by Stockfish (committed)
npm run build && npm run preview -- --port 4173 &
node scripts/screenshots/shoot.mjs out/          # all key pages, 4 sizes, light/dark, overflow check
node scripts/contrast.mjs                        # WCAG contrast of the pastel tokens
```

Data scripts (results are committed):

```bash
# Puzzle packs from the Lichess puzzle database (CC0)
curl -L -o .data/lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
node scripts/build-puzzles.ts

# Opening names from lichess-org/chess-openings (CC0)
node scripts/build-openings.ts
```

> Running Node 23 locally? Use `npm install --engine-strict=false`. Node 22 or 24 is recommended (see `.nvmrc`).

### Translations

All UI text lives in `src/lib/i18n/en.ts` (default) and `src/lib/i18n/de.ts`. A unit test makes sure both have exactly the same keys.

## Deployment (Cloudflare Pages, free)

1. Repository on GitHub, connected to a Cloudflare Pages project.
2. Build command `npm run build`, output directory `build`, environment variable `NODE_VERSION = 22`.
3. Custom domain `chess.maximilianauer.at` (Pages → Custom domains).
4. Every push to `main` deploys automatically.

[`static/_headers`](static/_headers) sets COOP/COEP so Stockfish can use multiple threads.

### Install on iPhone / iPad

Safari → open https://chess.maximilianauer.at → **Share** → **Add to Home Screen**.

### Install on Mac

Safari → open the site → **File** → **Add to Dock** (macOS Sonoma or later).

## Licence

GPL-3.0-or-later – see [LICENSE](LICENSE). Third-party projects and their licences are listed in the app under _Profile → About Rookie_.

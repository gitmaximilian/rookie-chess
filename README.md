# Rookie – a free chess trainer

A chess trainer for beginners as a Progressive Web App for iPhone, iPad and Mac – completely free, offline-capable, no App Store, no account, no tracking. English and German.

**Live:** https://chess.maximilianauer.at

## Features

- **Play** against 8 bots with personality (≈ 400–1650) – Stockfish 19 (WebAssembly) in the browser, hints, takebacks, optional clock
- **Play with a coach** – feedback on every move, warnings about attacked pieces, take back mistakes with an explanation
- **Chess basics** – 15 interactive lessons from zero (piece mini-games, check, mate, castling, promotion, en passant)
- **Puzzles** – 38,400 hand-picked puzzles from the free Lichess database, Glicko-2 rating, theme filter, puzzle of the day, spaced repetition (FSRS) for missed ones
- **Game analysis** – blunders, mistakes and inaccuracies, explained in plain language („your knight on g5 is unprotected“), evaluation graph, PGN import/export
- **Your mistakes become puzzles** – from bot games and imported games
- **Endgame trainer** – 7 lessons with the technique explained step by step, then practice against perfect tablebase play with live feedback on every move
- **Opening courses** – 14 openings and defences with explained lines; guided learning with hints, Stockfish explains wrong moves; learned lines go into your repertoire for spaced repetition
- **Linked accounts** – link your Lichess / Chess.com username once, new games are imported and analysed automatically
- **Profile & statistics** – rating history, activity, results by colour/time control/opponent strength, openings, accuracy by game phase, typical mistakes, personal insights
- **Optional account** – passkey sign-in (no email, no password), progress synced across devices; export and delete at any time
- **Install prompt** on phones – one-tap install on Android, step-by-step guide on iPhone/iPad
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

# Zugzwang – kostenloser Schach-Trainer

Ein Schach-Trainer als Progressive Web App für iPhone, iPad und Mac – komplett kostenlos, offline-fähig, ohne App Store, ohne Konto, ohne Tracking.

- **Spielen** gegen Stockfish (WebAssembly, läuft im Browser)
- **Puzzles** aus der freien Lichess-Datenbank
- **Eröffnungen & Endspiele** mit Spaced Repetition

Der Fahrplan steht in [PLAN.md](PLAN.md).

## Entwicklung

```bash
npm install          # kopiert Stockfish automatisch nach static/engine
npm run dev          # http://localhost:5173
npm run build && npm run preview
```

Tests:

```bash
npm run test:unit -- --run   # Vitest
npm run test:e2e             # Playwright: iPhone- & Mac-Safari (WebKit) + Chromium
npm run check && npm run lint
```

> Lokal mit Node 23? Dann `npm install --engine-strict=false`. Empfohlen ist Node 22 oder 24 (siehe `.nvmrc`).

## Deployment auf Cloudflare Pages (gratis)

1. Repo auf GitHub anlegen und pushen:
   `gh repo create schach-trainer --public --source=. --push`
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → Repo wählen.
3. Build-Einstellungen:
   - Framework preset: **SvelteKit**
   - Build command: `npm run build`
   - Output directory: `build`
   - Umgebungsvariable: `NODE_VERSION = 22`
4. Fertig – jeder Push auf `main` wird automatisch veröffentlicht unter `https://<projekt>.pages.dev`.

Die Datei [`static/_headers`](static/_headers) setzt die COOP/COEP-Header, damit Stockfish mehrere Threads nutzen kann.

### Auf iPhone / iPad installieren

Safari → Adresse öffnen → **Teilen** → **Zum Home-Bildschirm**.

### Auf dem Mac installieren

Safari → Adresse öffnen → **Ablage** → **Zum Dock hinzufügen** (macOS Sonoma oder neuer).

## Lizenz

GPL-3.0-or-later – siehe [LICENSE](LICENSE). Verwendete Projekte und ihre Lizenzen stehen in der App unter _Profil → Über Zugzwang_.

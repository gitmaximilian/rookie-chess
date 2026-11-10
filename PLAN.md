# Plan: Kostenloser Schach-Trainer „Zugzwang“ (PWA für iOS & macOS)

## Kontext

Ziel ist ein dauerhaft kostenloser Schach-Trainer, der als PWA in Safari auf iPhone, iPad und Mac läuft. Es gibt keinen App Store, keinen Developer Account, kein Backend und keine laufenden Kosten.

Deine Antworten:

- **Spielstärke:** Anfänger (< 1200). Der Fokus liegt auf Grundlagen, Taktik und verständlichen Erklärungen.
- **Stack:** Svelte.
- **Nutzer:** Die App ist öffentlich, der Quellcode liegt öffentlich auf GitHub.
- **Konten:** GitHub und Cloudflare sind vorhanden.

Umgesetzt wird in einem eigenen Projektordner `~/schach-trainer`, nicht im temporären Session-Ordner. Der Name „Zugzwang“ ist nur ein Arbeitstitel.

## Stack (Entscheidung)

| Bereich           | Wahl                                                                                  | Lizenz     | Grund                                                   |
| ----------------- | ------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| Framework         | SvelteKit 2 + Svelte 5 + TypeScript, `adapter-static`                                 | MIT        | Kleine Bundles, schnell auf dem iPhone, rein statisch   |
| PWA               | `@vite-pwa/sveltekit` (Workbox)                                                       | MIT        | Manifest, Service Worker, Offline-Cache                 |
| Brett             | `chessground` (Lichess)                                                               | GPL-3      | Bewährt auf Touch, Pfeile und Markierungen, Animationen |
| Regeln/PGN        | `chessops`                                                                            | GPL-3      | Passt zu chessground, kann PGN, FEN und SAN             |
| Engine            | `stockfish` (npm, nmrugg) in den Builds lite-single und lite (Multi-Thread), ca. 7 MB | GPL-3      | Läuft als WASM im Web Worker, Netz unter 25 MB          |
| Speicher          | Dexie (IndexedDB)                                                                     | Apache-2   | Versionierte Schemas, gute Abfragen                     |
| Spaced Repetition | `ts-fsrs`                                                                             | MIT        | Moderner Algorithmus (FSRS), sauber typisiert           |
| Rating            | eigene Glicko-2-Implementierung (ca. 150 Zeilen)                                      | —          | Klein und gut testbar                                   |
| Tests             | Vitest, Playwright (WebKit)                                                           | MIT/Apache | Unit- und E2E-Tests mit Safari-Engine                   |

**Lizenzen:** Stockfish, chessground und chessops stehen unter GPL-3. Deshalb steht das ganze Projekt unter **GPL-3**. Da der Code ohnehin öffentlich ist, ist das kein Problem. Pflichten: `LICENSE`-Datei, eine Seite „Über/Lizenzen“ mit Quellenangaben und ein Link zum Quellcode.

Die Lichess-Puzzles und die Eröffnungsnamen (`lichess-org/chess-openings`) stehen unter CC0. Ein Hinweis auf die Quelle ist dort nicht vorgeschrieben, wird aber trotzdem angezeigt.

## Wichtige Erkenntnisse (vorab)

1. **Stockfish für Anfänger:** `UCI_Elo` geht erst ab ca. 1320. Für Gegner unter 1200 baue ich eigene Bot-Stufen. Sie nutzen `Skill Level` 0–5, eine Begrenzung der Rechentiefe (Knoten) und eine gewichtete Zufallswahl aus mehreren Kandidatenzügen (MultiPV). So entstehen z. B. 8 Bots von ca. 400 bis ca. 1500 ELO, mit menschlichen Fehlern statt nur „schwachen“ Zügen.
2. **Push-Benachrichtigungen brauchen einen Absender:** iOS kann ohne Server keine geplanten Benachrichtigungen auslösen. Das geht nur über einen kostenlosen Cloudflare Worker mit Cron. Deshalb ist Push eine **optionale späte Phase**, für die tägliche Trainingsserie gibt es vorher einen Hinweis direkt in der App.
3. **Lichess Opening Explorer:** Die API verlangt inzwischen eventuell ein Login-Token. Das prüfe ich in Phase 5. Für Anfänger reichen offline die Eröffnungsnamen (CC0) und die eigenen Repertoire-Bäume. Der Explorer bleibt eine Zusatzfunktion.
4. **COOP/COEP-Header:** Safari unterstützt nur `require-corp`, nicht `credentialless`. Abfragen an Lichess und Chess.com laufen über CORS (`fetch`) und funktionieren damit. Externe Bilder vermeide ich, alle Assets kommen vom eigenen Server.
5. **Öffentliche Seite in Deutschland:** Es gibt keine Cookies und kein Tracking. Eine kurze Datenschutzerklärung kommt trotzdem rein (Cloudflare-Logs, Abfragen an Lichess und Chess.com). Ob ein Impressum nötig ist, musst du prüfen. Das ist keine Rechtsberatung.

## Architektur

```
schach-trainer/
├─ src/
│  ├─ lib/
│  │  ├─ chess/        # chessops-Hilfen: Zugvalidierung, PGN/FEN, SAN, Material
│  │  ├─ engine/       # EngineService: Worker-Pool, UCI-Protokoll, Warteschlange, Thread-Erkennung
│  │  ├─ bots/         # Bot-Stufen (Anfänger-Schwächung), Persönlichkeiten
│  │  ├─ training/     # glicko2.ts, srs.ts (ts-fsrs), puzzleSelector.ts, streak.ts
│  │  ├─ analysis/     # Partieanalyse, Fehlerklassen, Erklärungen in einfachem Deutsch
│  │  ├─ db/           # Dexie-Schema, Repos, export/import (JSON mit Versionsnummer)
│  │  ├─ data/         # Laden der Puzzle-Pakete, Cache-Logik
│  │  ├─ api/          # lichess.ts, chesscom.ts, tablebase.ts (mit Timeout und Offline-Fallback)
│  │  └─ ui/           # Board.svelte (chessground-Wrapper), EvalBar, MoveList, Sheet, TabBar, Sidebar
│  ├─ routes/          # / (Start), /spielen, /puzzles, /analyse, /eroeffnungen, /endspiele, /import, /statistik, /einstellungen, /ueber
│  └─ app.css          # Design-Tokens (Hell/Dunkel), Safe Areas
├─ static/
│  ├─ engine/          # stockfish-*.js/.wasm (+ .nnue, falls separat)
│  ├─ puzzles/         # index.json + Pakete p-<rating>-<n>.json
│  ├─ pieces/, boards/ # freie Figurensets (z. B. cburnett, CC BY-SA, Quelle angeben)
│  └─ _headers         # COOP/COEP, Cache-Control
├─ scripts/build-puzzles.ts   # Aufbereitung der Lichess-CSV
├─ tests/ (unit), e2e/ (Playwright WebKit)
└─ LICENSE (GPL-3), README.md
```

**Datenfluss:** Die UI nutzt Svelte-Stores bzw. Runes. Dahinter liegen die Services `engine`, `training` und `db`. Die Engine läuft nur im Worker und blockiert nie die Oberfläche. Analyse-Aufträge laufen über eine Warteschlange mit Priorität: Live-Hinweise vor Hintergrund-Analysen.

**Dexie-Schema (v1):** `settings`, `games` (PGN, Ergebnis, Bot, Analyse), `puzzleAttempts`, `puzzleCards` (FSRS-Zustand), `ratings` (Glicko-2-Verlauf je Bereich), `repertoire` (Knoten: FEN, Zug, Eltern-Knoten, Farbe, FSRS), `endgameProgress`, `streak`.

## Datenaufbereitung (`scripts/build-puzzles.ts`)

- Liest `lichess_db_puzzle.csv.zst` als Stream (Node + `fzstd`).
- Filter: `Popularity ≥ 85`, `NbPlays ≥ 300`, `RatingDeviation ≤ 90`.
- Rating-Bereich 400–2000, mit Schwerpunkt auf 400–1400 für Anfänger.
- Feste Mengen pro 100er-Rating-Bereich und pro Hauptthema (mateIn1, mateIn2, fork, pin, hangingPiece, …).
- Kompaktes Format: `[id, fen, moves, rating, themesBitmask]`. Das sind ca. 90 Byte pro Puzzle.
- Ergebnis: ca. 40.000 Puzzles in Paketen von ca. 1 MB. Cloudflare komprimiert die Dateien automatisch.
- `index.json` beschreibt die Pakete (Rating-Bereich, Themen, Anzahl).
- Der Service Worker speichert bei der Installation nur die Pakete passend zum aktuellen Rating (±300). Weitere werden nachgeladen und danach offline gespeichert.
- R2 wird erst nötig, wenn deutlich mehr als ca. 500 MB Daten zusammenkommen. Das kommt in den Abschnitt „Später“.

## Phasen

### Phase 0: Grundgerüst und Deployment

- SvelteKit + TS + ESLint/Prettier + Vitest + Playwright, `adapter-static`, PWA-Plugin.
- Manifest (Name, Icons inkl. `apple-touch-icon`, `display: standalone`), `apple-mobile-web-app-*`-Metatags, `viewport-fit=cover`.
- Layout mit Tab-Leiste (iPhone) bzw. Seitenleiste (≥ 768 px), Hell/Dunkel-Modus, Safe Areas.
- GitHub-Repo → Cloudflare Pages (Build `npm run build`, Ausgabe `build`), `_headers` mit COOP/COEP.
- Eigene Domain **`schach.maximilianauer.at`** als Custom Domain im Pages-Projekt. Die Domain liegt schon bei Cloudflare, deshalb legt Cloudflare den DNS-Eintrag und das HTTPS-Zertifikat automatisch an.
- **Fertig, wenn:** die leere App unter `https://schach.maximilianauer.at` läuft, sich auf dem iPhone auf den Home-Bildschirm legen lässt, offline startet und `crossOriginIsolated === true` ist.

### Phase 1: MVP – Spielen und Puzzles

- `Board.svelte` (chessground-Wrapper: Tippen und Ziehen, Bauernumwandlung, Brett drehen, letzter Zug, Schach-Markierung).
- `EngineService`: Worker laden, Multi-Thread erkennen und sonst Single-Thread nutzen, Threads auf dem iPhone auf 2 begrenzen, `stop`/`ucinewgame`, Bewertung auslesen.
- **Spielen:** 8 Anfänger-Bots (siehe Erkenntnis 1), Farbwahl, optionale Bedenkzeit, Zug zurücknehmen, Hinweis (Pfeil zum besten Zug), Partie speichern.
- **Puzzles (Grundversion):** `build-puzzles.ts`, Laden der Pakete, Puzzle lösen (Gegnerzug wird animiert vorgespielt), richtig/falsch, Lösung zeigen, Rating per Glicko-2.
- Export/Import als JSON in den Einstellungen, `navigator.storage.persist()`, Backup-Erinnerung nach 14 Tagen.
- **Fertig, wenn:** ich auf dem iPhone im Flugmodus gegen einen Bot spielen und Puzzles lösen kann, das Rating sich ändert und ein Export sich auf dem Mac importieren lässt.

### Phase 2: Puzzle-Training ausbauen

- Themenfilter (für Anfänger: „Matt in 1“, „Hängende Figur“, „Gabel“, „Fesselung“, …) mit deutschen Namen und kurzer Erklärung pro Thema.
- Falsch gelöste Puzzles werden per FSRS wiederholt („Wiederholen“-Liste, fällige zuerst).
- Puzzle-Serie (z. B. „5 am Stück“), ein Puzzle des Tages (per Datum aus dem Paket gewählt).
- **Fertig, wenn:** falsche Puzzles nach dem FSRS-Zeitplan wiederkommen und der Themenfilter stimmt.

### Phase 3: Partieanalyse mit Erklärungen

- Analyse im Hintergrund (Tiefe bzw. Knoten begrenzt), Bewertungskurve (SVG), Zugliste mit Markierungen ?! ? ??.
- Fehlerklassen über die Gewinnwahrscheinlichkeit (Lichess-Formel), Pfeil zum besten Zug, die beste Variante zum Durchklicken.
- **Erklärungen für Anfänger** (einfache Regeln, kein Sprachmodell): „Figur hängt“, „Matt übersehen“, „Gabel erlaubt“, „Dame ungeschützt“, „Material verloren“.
- PGN importieren (einfügen/Datei) und exportieren. Tastatur am Mac: ←/→ durch die Züge, Leertaste für den besten Zug.
- **Fertig, wenn:** eine Bot-Partie nach dem Ende mit Kurve, Fehlern und deutschen Erklärungen analysiert wird.

### Phase 4: Endspieltrainer

- Kuratierte Lektionen für Anfänger: K+D gegen K, K+T gegen K, Bauernendspiele (Opposition, Quadratregel), Lucena/Philidor als Bonus.
- Gegner ist die Lichess-Tablebase-API (Timeout 3 s, Ergebnis wird gespeichert), offline übernimmt Stockfish.
- Ziel pro Lektion („Matt in ≤ N Zügen“, „Remis halten“), Fortschritt und Sterne.
- **Fertig, wenn:** K+D gegen K online und offline spielbar ist und als bestanden gezählt wird.

### Phase 5: Eröffnungstrainer

- Eröffnungsnamen aus `chess-openings` (CC0) offline, mit Anzeige in jeder Partie.
- Repertoire-Editor als Baum (Weiß/Schwarz), Züge auf dem Brett eingeben, Kommentare.
- Training: Die App spielt eine Gegnervariante, du musst deinen Repertoire-Zug finden, wiederholt nach FSRS.
- Fertige Anfänger-Repertoires (z. B. Italienisch für Weiß, Caro-Kann/1…e5 für Schwarz) zum Importieren.
- Opening Explorer: Zugang prüfen, bei Bedarf optional mit Lichess-Token oder ganz weglassen.
- **Fertig, wenn:** sich ein Repertoire anlegen lässt und fällige Züge abgefragt werden.

### Phase 6: Eigene Partien importieren

- Lichess (`/api/games/user/{name}`, NDJSON-Stream) und Chess.com (`/pub/player/{name}/games/{YYYY}/{MM}`), beide öffentlich mit CORS.
- Analyse im Hintergrund über die Warteschlange, Patzer und Fehler werden zu **eigenen Puzzles** (Stellung vor dem Fehler, Lösung = bester Zug) und laufen über FSRS.
- **Fertig, wenn:** nach Eingabe meines Benutzernamens die letzten 20 Partien importiert, analysiert und als „Meine Fehler“-Puzzles spielbar sind.

### Phase 7: Statistik, Feinschliff, Bedienungshilfen

- Startseite als Dashboard: Tagesziel, Serie, fällige Wiederholungen, Rating-Verlauf, schwächste Themen.
- Mehrere Brett- und Figurensets, Sounds (abschaltbar), Animationsgeschwindigkeit.
- Bedienungshilfen: Kontraste (WCAG AA), Dynamic-Type-freundliche `rem`-Größen, Fokus-Reihenfolge, Ansage von Zügen für Screenreader.
- Seiten „Über/Lizenzen“ und Datenschutz.
- **Fertig, wenn:** Lighthouse PWA/Performance/A11y ≥ 90 und die manuelle Checkliste unten bestanden ist.

### Später (optional)

- **Push:** Cloudflare Worker (gratis) + Cron + KV für die tägliche Erinnerung per Web Push (VAPID).
- **R2:** große Puzzle-Bestände (alle ca. 5 Mio.) zum Nachladen.
- **Capacitor:** dieselbe Web-App in eine iOS/macOS-Hülle packen. Dafür sind Xcode und für den App Store der Developer Account (99 $/Jahr) nötig. Der Code bleibt gleich, die Engine kann dort optional nativ laufen.

## Deployment-Anleitung (kommt ins README)

1. `gh repo create schach-trainer --public` und pushen.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → Repo wählen.
3. Build: Framework „SvelteKit“, Befehl `npm run build`, Ausgabe `build`, `NODE_VERSION=22`.
4. `static/_headers`:
   ```
   /*
     Cross-Origin-Opener-Policy: same-origin
     Cross-Origin-Embedder-Policy: require-corp
   /engine/*
     Cache-Control: public, max-age=31536000, immutable
   /puzzles/*
     Cache-Control: public, max-age=604800
   ```
5. **Eigene Domain:** Pages-Projekt → Custom domains → „Set up a custom domain“ → `schach.maximilianauer.at` → Activate. Weil `maximilianauer.at` schon bei Cloudflare liegt, wird der CNAME automatisch angelegt, und HTTPS ist nach wenigen Minuten aktiv. Die Hauptdomain bleibt frei für deine Website. Optional: unter Rules eine Weiterleitung von `*.pages.dev` auf die eigene Domain, damit es nur eine Adresse gibt (wichtig, weil IndexedDB-Daten an die Adresse gebunden sind).
6. Auf dem iPhone in Safari `https://schach.maximilianauer.at` öffnen → Teilen → Zum Home-Bildschirm. Auf dem Mac: Ablage → Zum Dock hinzufügen.

## Risiken

| Risiko                                        | Gegenmaßnahme                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Safari löscht IndexedDB                       | `persist()`, Installation auf dem Home-Bildschirm empfehlen, Backup-Erinnerung, Export in 1 Tipp            |
| Engine langsam oder Wärme auf älteren iPhones | Lite-Netz, Begrenzung über Knoten statt Zeit, maximal 2 Threads, Hintergrund-Analyse nur bei geöffneter App |
| App-Größe/erster Start                        | Engine und Puzzle-Pakete werden erst bei Bedarf gespeichert, die Grundversion ist unter 1 MB                |
| Speicherlimit in WASM auf iOS                 | Hash auf 16–32 MB begrenzen                                                                                 |
| API-Grenzen von Lichess/Chess.com             | Abfragen nacheinander, Ergebnisse speichern, Wiederholung mit wachsender Wartezeit                          |
| GPL-Pflichten                                 | `LICENSE`, Seite mit Quellcode-Link, Liste der Quellen                                                      |

## Prüfung

- **Unit-Tests (Vitest):** Glicko-2 gegen die Beispielrechnung aus Glickmans Paper, FSRS-Zeitplan, Einteilung der Fehlerklassen, Erkennung für die Erklärungen (hängende Figur, Gabel), PGN-Rundlauf, Export/Import-Rundlauf, Puzzle-Parser.
- **E2E (Playwright, WebKit + iPhone-Emulation):** Bot-Partie bis Matt, Puzzle lösen/verfehlen, Offline-Modus (`context.setOffline`), Export → Import.
- **Engine-Test:** `crossOriginIsolated` prüfen, Bestzug in einer bekannten Matt-in-2-Stellung.
- **Manuelle Checkliste (je Phase, auf echtem iPhone und Mac):** Installation auf Home-Bildschirm/Dock, Start im Flugmodus, Notch/Safe Areas, Ziehen ohne Scrollen der Seite, kein Doppeltipp-Zoom, Dark Mode, Tastaturkürzel am Mac, Akku und Wärme nach 10 Minuten Analyse.

## Arbeitsweise

- Phase 0 und die Engine-/Offline-Teile aus Phase 1 mit Opus. Die UI-lastigen Phasen 2–7 können mit Sonnet laufen.
- `PLAN.md` (dieser Plan) liegt im Repo, nach jeder Phase gibt es einen Commit und ein Deployment.

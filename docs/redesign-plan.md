# Redesign v0.2.0 – Bento-Designsprache

Stand: 13. November 2026. Inspiration: 0xCal (Bento-Kacheln, Pastell, Monospace-Zahlen). Rookies Logo, Name und Akzentfarbe „Glut“ bleiben.

## Ziel

Anfänger unter 1200 sollen ihren Fortschritt auf einen Blick sehen und den nächsten Schritt sofort finden. Jede Kachel zeigt **eine** Kennzahl, groß und in Monospace, optional mit einem Mini-Verlauf. Der Tagesplan bleibt die erste und größte Kachel.

## Entscheidungen

| Thema          | Entscheidung                                                                                           | Grund                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Kacheln        | `StatTile` (S/M/L), Radius 28 px, Pastellfläche je Bereich, keine Schatten, kein Rahmen                | Ruhe; Farbe statt Linien trennt Bereiche                                         |
| Bereiche       | Spielen (Koralle), Partien (Sand), Coach (Himmel), Puzzles (Lavendel), Lernen (Minze), Sterne (Butter) | abgeleitet aus den bestehenden `--c-*`-Farben                                    |
| Zahlen-Schrift | IBM Plex Mono (OFL, `@fontsource`, selbst gehostet)                                                    | frei lizenziert, eigenständig, gute Ziffern                                      |
| Fließtext      | System-Sans (SF Pro auf Apple), `hyphens: auto`                                                        | Coach-Texte und Lektionen bleiben gut lesbar; deutsche Langwörter trennen sauber |
| Überschriften  | Bricolage Grotesque (wie bisher) für Seitentitel, Mono für Kachel-Labels                               | Wiedererkennung von Rookie                                                       |
| Kontrast       | Text auf Pastell ≥ 4,5:1, große Zahlen ≥ 3:1, geprüft mit `node scripts/contrast.mjs`                  | WCAG AA, nachgerechnet                                                           |
| Dunkelmodus    | eigene gedeckte Pastelle (z. B. `#1f2a3d` statt grellem Blau)                                          | nicht grell, geprüft gegen dunkle Fläche                                         |
| Tab-Leiste     | dunkel in beiden Modi, Beschriftung bleibt, aktiver Tab als Pastell-Pille in Bereichsfarbe             | deutliche Orientierung, 6 Bereiche lesbar                                        |
| Brettseiten    | nur Schrift, Rundungen, Farben – keine bunten Kacheln um das Brett                                     | Brett bleibt im Fokus; `dock.ts`-Reservierung unverändert                        |
| Wenig Rahmen   | `.card` ohne Schatten, nur sehr leichte Linie, Radius 24 px                                            | ruhiger                                                                          |

## Bewusst nicht übernommen

- Monospace für Fließtext (schlecht lesbar, lange deutsche Wörter).
- Tab-Leiste nur mit Icons.
- Grafiken, Logo, Texte oder exakte Schrift von 0xCal.
- Bunte Kacheln auf Brettseiten.

## Etappen

1. **Fundament** – Tokens (`src/app.css`), Schrift, Komponenten `StatTile`, `BentoGrid`, `SegmentedSwitch`, `Sparkline`; `.card` auf neue Tokens.
2. **Übersichten** – Home (Tagesplan → Puzzle-Wertung, Spielstärke, Form, Sterne, Serie, Tagesziel), Coach (So spielst du gerade, Fünfeck, Genauigkeit, letzte 30 Partien, Woran arbeiten), Profil (Sterne je Bereich, Wertungsverlauf).
3. **Listen und Hubs** – Partien (Formstreifen, Höhepunkte, Tagesgruppen), Lernen, Eröffnungen, Puzzles-Kopf, Einstellungen, Onboarding.
4. **Brettseiten, Tab-Leiste, Seitenleiste** – nur Tokens.

Nach jeder Etappe: Screenshots 393×659, 393×852, 820×1180, 1280×800 (hell/dunkel) mit `scripts/screenshots/shoot.mjs`, kein horizontaler Überlauf, `npm run check`, `npm run lint`, `npx vitest run`, `npm run test:e2e`; Commit und Push auf `main`, Live-Prüfung im iPhone-Format.

## Werkzeuge

- `node scripts/screenshots/gen-fixture.mjs` – erzeugt Testdaten (32 von Stockfish gespielte, analysierte Anfänger-Partien, Puzzle-Verlauf, Aktivität).
- `node scripts/screenshots/shoot.mjs <ordner>` – Screenshots + Überlauf-Prüfung.
- `node scripts/contrast.mjs` – Kontrastprüfung der Pastell-Tokens.

## Abschluss

Version 0.2.0 (Einstellungen › Über), README-Screenshots `docs/screenshots/`, Tag `v0.2.0`, GitHub-Release, Website-Projektseite aktualisieren.

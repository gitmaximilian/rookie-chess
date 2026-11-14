# Rookie – Plan nach dem Produkt-Review (14. November 2026)

Grundlage: [product-review-2026-11-14.md](product-review-2026-11-14.md). Ziel dieser Runde: **eine ehrliche Zahl für dein Niveau, ein Penta, dem man trauen kann, keine falschen Lektionen.** Neue Funktionen nur, wo die Messung sie trägt.

Je Etappe: `npm run check`, `npm run lint`, Vitest, Playwright grün; Unit-Tests für jede geänderte Lernlogik; Screenshots in 393×659, 393×852, 820×1180, 1280×800 hell/dunkel ohne Überlauf; Persona-Simulation (`personas.spec.ts`); deutscher Commit, Push auf `main`, Live-Check.

---

## Etappe 1 – Richtige Lektionen, saubere Kleinigkeiten (S)

**Ziel:** Keine Lektion lobt einen Zug, der eine Figur einstellt; keine Aufgabe markiert einen gleich guten Zug als falsch.

- `lib/basics/lessons.ts`: Schach-Aufgabe 3 akzeptiert nur ♘d1 (gedeckt); Text „…so dazwischen, dass er gedeckt ist“.
- `lib/basics/positional.ts`: Bauernstruktur-Aufgabe fragt nach dem Zurückschlagen _mit Bauer im Zentrum_.
- `lib/endgames/lessons.ts`: Kommentar auf das tatsächliche Prüfverfahren (Tablebase/Stockfish) korrigieren.
- Neuer Test `lib/basics/lessons.spec.ts`: Jede akzeptierte Lösung einer „Dazwischenziehen“-Aufgabe steht auf einem gedeckten Feld (die Klasse Fehler, nicht nur der Einzelfall).
- Leerzeichen vor „·“ (Coach-Kopf, Grundlagen-Liste).
- Tablet-Bento der Startseite (820 px): Kacheln nicht unter Lesebreite.

**Messkriterium:** Tiefe-18-Prüfung ohne „akzeptierter Zug verliert“; Bilder 820×1180 ohne abgeschnittene Beschriftung.

## Etappe 2 – Penta, dem man trauen kann (M)

**Ziel:** Jede Ecke, die das Penta zeigt, ist besser als Raten; die Ecken überschneiden sich nicht.

- **Neu geeicht** (`scripts/research/skill-study.mjs`, `skill-fit.mjs`): Eröffnung und Endspiel ohne Patzer (wie Strategie) – Patzer zählen nur bei Sicherheit. `SKILL_TABLE` aus dem neuen Lauf; `collectSkills` entsprechend.
- **Mindestmengen nach Holdout** (`MIN_SAMPLE`): Sicherheit 250 Züge, Taktik 35 Gegnerfehler, Eröffnung 60, Stellungsspiel 150, Endspiel 80. Test hält die Werte und ihre Herleitung fest.
- **Untere Kante:** Elo-Entsprechung unterhalb des ersten Bands linear fortsetzen (bis 300) statt bei 506 abschneiden.
- **Elo-Wirkung** auf 25 gerundet, Text „etwa“.
- **„Strategie“ heißt „Stellungsspiel“** (wie die Lektionen).
- Fünfeck: „–“-Ecken mit „noch zu wenige Partien“; Tooltip „Gesamt“ richtig.
- Holdout-Ergebnis in `docs/research-2026-11-13.md` (Nachtrag) als Kennzahl.

**Messkriterium:** Holdout mit neuer Eichung: Gesamt-MAE ≤ 240, jede gezeigte Ecke MAE < 450 (Raten: 500); Teilkorrelation Sicherheit–Eröffnung sinkt.
**Risiko:** Ecken erscheinen später (mehr Partien nötig) – dafür sagt der Hinweis genau, wie viele noch fehlen.

## Etappe 3 – Eine Spielstärke, eine Skala, eine Stufe (M)

**Ziel:** Überall dieselbe Zahl für dein Niveau, und daraus dieselbe Stufe.

- `lib/training/strength.ts`: **Lichess-Skala** (an ihr sind Penta, Stufen und alle Schwellen geeicht). Quellen: Online-Wertung (Lichess direkt, Chess.com +150), Puzzle-Wertung (−50, nach Sicherheit gewichtet), **Penta-Gesamt aus den eigenen Partien** (Gewicht wächst mit der Zahl analysierter Partien), besiegte Bots (schwach). Ergebnis mit Herkunft („aus Partien ≈ …, Puzzles ≈ …“).
- Coach und Lernen: `LevelFocus` immer mit dieser Zahl; das Penta zeigt seine Elo-Entsprechung als Teil davon.
- Schwellen (`SCAN_UNTIL`, `POSITIONAL_FROM`, `SAFETY_UNTIL`, Lektionsstufen) prüfen: sie stammen aus Lichess-Bändern und bleiben.

**Messkriterium:** Test: gleiche Daten → Coach-Stufe = Lern-Stufe; mit Testdaten zeigen Coach-Kopf, Penta-Detail und Startseite dieselbe Spielstärke.
**Risiko:** Angezeigte Spielstärke steigt für viele um ~100–150 (Skalenwechsel, keine Verbesserung). Einmaliger Hinweis in der Spielstärke-Erklärung („seit 0.7: Lichess-Skala“).

## Etappe 4 – Eine Patzer-Zahl (S)

**Ziel:** „Patzer je 30 Züge“ bedeutet überall dasselbe.

- Gemeinsame Definition (Penta-Sicherheit: ≥ 30 Prozentpunkte in offener Stellung, je 30 Züge in offener Stellung) für Fortschrittskarte (`progress.ts`), Spielerprofil (`gamestats.ts` `blundersPer30`) und Tagesplan-Schwelle (`planData.ts`). Bezugswerte aus `SKILL_TABLE`.
- Coach-Kachel „Patzer pro Partie“ → **„Gewinnstellungen verwertet“** (x von y; Lichess um dein Niveau ≈ 69 %): die eine neue Zahl aus der Kandidaten-Prüfung.
- Coach: Phasen-Rat („Mittelspiel: nur 79 % Genauigkeit“) entfällt – das Penta misst Phasen genauer und widerspricht sonst.

**Messkriterium:** Test: Fortschrittskarte, Profil und Penta liefern für dieselben Partien dieselbe Patzerrate.

## Etappe 5 – Stimmige Testdaten, Abschluss (S)

- `scripts/screenshots/gen-fixture.mjs`: Wertungen passend zur gespielten Qualität (Lichess- und Puzzle-Wertung nahe dem gemessenen Niveau).
- Version 0.7.0, README, Tag, GitHub-Release, Website gemäß `portfolio/PUBLISHING.md`.

---

## Bewusst nicht

- **Neue Penta-Ecken** (Verwerten, Verteidigen, Zeitnot, Rechnen): gemessen – sie trennen die Niveaus unter 1400 nicht (Verwerten flach 65–70 %), messen den Gegner (Verteidigen) oder kommen kaum vor (Zeitnot 1–3 % der Züge). Verwerten wird stattdessen eine konkrete Zahl (Etappe 4).
- **Eigene Eichung für Bot-Partien:** bräuchte viele Mensch-gegen-Bot-Partien; ohne Tracking nicht zu sammeln. Bis dahin: Grenze im Penta-Kleingedruckten.
- **Skala „100 = Weltspitze“ ändern:** passt zur Website und zum Penta-Gedanken; die Elo-Entsprechung daneben ist die Zahl, die zählt.
- **Desktop-Analyse auf Tiefe 11 senken:** Tiefe 13 erklärt besser; der Unterschied zur Eichung ist nicht gemessen und vermutlich klein.
- **Coach-Seite neu aufbauen** (4 800 px): Etappe 4 nimmt den widersprüchlichen Teil heraus; ein Umbau ohne Beleg für bessere Nutzung wäre Geschmack.
- **Begrüßung „Hallo!“:** niedrig, bleibt.

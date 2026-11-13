# Rookie – Verbesserungsplan (13. November 2026)

Abgeleitet aus [review-2026-11-13.md](review-2026-11-13.md). Reihenfolge nach Wirkung pro Aufwand. Nach jeder Etappe: `npm run check`, `npm run lint`, `npx vitest run`, `npx playwright test`, Screenshots 4 Größen hell/dunkel ohne Überlauf, Commit, Push, Live-Prüfung.

## Etappe 1 – Fehler und Unklarheiten, die jeden Tag stören (S)

Ziel: Nichts auf dem Bildschirm ist falsch, unsichtbar oder unverständlich.

| Änderung                                                                                                                                                 | Dateien                                                                      | Fertig, wenn …                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Brettbeschriftung: Spalten (a–h) und Zeilen (1–8) jeweils in der Gegenfarbe ihres Feldes                                                                 | `lib/ui/board/board.css`                                                     | auf jedem Brett alle 16 Beschriftungen lesbar sind (beide Ausrichtungen); E2E-Test prüft Farbe ≠ Feldfarbe |
| Coach-Kommentar: Warnung zur Antwort des Gegners steht vor Lob und Zugbeschreibung                                                                       | `routes/play/+page.svelte` (`judged`)                                        | nach 1.e4 f5 steht „Achtung: dein Bauer auf e4 …“ in den sichtbaren zwei Zeilen                            |
| Eingestellte Figur benennen: „Dame eingestellt“ statt „Figur eingestellt“                                                                                | `lib/coach/coach.ts`, i18n                                                   | Text nennt die Figur (DE/EN)                                                                               |
| Eröffnungs-Einsichten mit Farbe: „… (mit Schwarz)“ / „… (mit Weiß)“                                                                                      | `lib/training/gamestats.ts`, i18n                                            | beste/schwächste Eröffnung widersprechen sich nicht mehr; Unit-Test                                        |
| Notation einheitlich mit Figurensymbolen: Variantenvorschau und Kursbeschreibungen                                                                       | neue Hilfe `figurineText()` in `lib/chess/notation.ts`; Kursseite, Kursliste | keine „Nf3“/„Sf3“ mehr neben „♘f3“; Unit-Test                                                              |
| Partienliste ohne Kürzel: „1 Sieg · 1 Niederlage“ statt „1S 1N“; „2 Patzer · 1 Fehler“ statt „2?? 1?“; Farbe als „mit Weiß/Schwarz“ im Screenreader-Text | `lib/ui/GameListItem.svelte`, `routes/analysis/+page.svelte`                 | keine Schachsymbol-Kürzel ohne Wort                                                                        |
| Vorläufige Wertungen: „950 · vorläufig“ statt „950?“                                                                                                     | `HomeSummary`, Coach, Puzzles                                                | kein „?“ hinter Zahlen                                                                                     |
| Wertungs-Umschalter in der Statistik als `SegmentedSwitch`                                                                                               | `routes/coach/stats/+page.svelte`                                            | gleiche Optik wie die übrigen Umschalter                                                                   |
| Tippflächen ≥ 44 px (unsichtbar erweitert, Optik bleibt): Segment-Umschalter, Filterchips, Sprungmarken, Textlinks                                       | Token `.hit44` in `app.css`, `SegmentedSwitch`, Puzzles, Einstellungen, Play | Prüfskript meldet keine Fläche < 44 px auf den Hauptseiten                                                 |

## Etappe 2 – Ein Schwerpunkt, ein nächster Schritt (M)

Ziel: Start, Tagesplan und Coach empfehlen dasselbe; Spielen ist Teil des Trainings.

- **Neues Modul `lib/training/focus.ts`**: `pickFocus({ motifs, weakTheme })` liefert genau einen Schwerpunkt. Vorrang hat der häufigste Fehler aus eigenen Partien (z. B. hängende Figuren → Puzzle-Thema `hangingPiece`), sonst das schwächste Puzzle-Thema. `MOTIF_THEME` zieht aus der Coach-Seite hierher.
- **Tagesplan** (`plan.ts`, `planData.ts`): Puzzle-Aufgabe nutzt den Schwerpunkt; sie zählt alle heute gelösten Puzzles (gleiche Zahl wie die Kachel „Tagesziel“), der Knopf öffnet die Puzzles zum Schwerpunkt. Neue Aufgabe **„Eine Partie mit Coach spielen“** (`kind: 'play'`), wenn der Schwerpunkt aus dem Onboarding „Partien spielen“ ist (dann zuerst) oder seit zwei Tagen keine Partie gespielt wurde; erledigt durch eine beendete Bot-Partie heute.
- **Coach-Tab**: Die erste Empfehlung ist der Schwerpunkt und heißt so („Dein Schwerpunkt“), mit demselben Ziel wie im Tagesplan; doppelte Empfehlungen (gleiches Thema) entfallen. Das Spielerprofil beschreibt nur noch („Am niedrigsten: Taktik …“) und hat keinen eigenen „Trainieren“-Knopf mehr.
- Texte DE/EN: `plan.task.play`, `coachTab.focus`, `skills.lowest`.
- Tests: `plan.spec.ts` (Partie-Aufgabe bei Schwerpunkt „play“ und nach 2 Tagen Pause; Puzzle-Zählung), `focus.spec.ts`.
- **Fertig, wenn** Start, Tagesplan und Coach mit den Testdaten dasselbe Thema nennen und die Planaufgabe dieselbe Zahl zeigt wie die Kachel.

## Etappe 3 – Weniger, aber klarere Übersichten (M)

- **Coach-Übersicht** ohne die Blöcke, die der Tab „Statistik“ schon zeigt (Online-Wertung mit Verlauf, Monat für Monat, Was auffällt); dafür ein Link „Wertung, Eröffnungen und mehr → Statistik“. Ziel: Seite etwa halb so lang.
- **Spielstärke erklärt**: Kachel-Untertitel nennt die Grundlage („aus Lichess, Puzzles und Bots“); Tippen öffnet den Coach.
- **Neue Nutzer**: Startseite zeigt statt leerer Kacheln eine Startkachel („Spiel deine erste Partie“ / „Löse dein erstes Puzzle“); Kacheln erscheinen, sobald es Werte gibt.
- **Analysebrett** nicht mehr auf der Startseite (bleibt in „Partien“ und im Partienkopf).
- **Eröffnungskurse**: Abzeichen „Empfohlen zum Start“ für die leichten Kurse je Farbe (Italienisch, 1…e5, Damengambit abgelehnt).
- **Puzzles**: Themen-Chips hinter „Themen“ eingeklappt; oben nur Für dich, Des Tages, Wiederholen, Meine Fehler, Puzzle-Sturm.
- **Fertig, wenn** die Coach-Übersicht < 2 600 px hoch ist (393 px breit, Testdaten) und ein neuer Nutzer keine Kachel mit „–“ sieht.

## Etappe 4 – Sicherung laden ohne Datenverlust (S)

- „Sicherung laden“ führt standardmäßig zusammen (wie beim Konto und beim Umzug: `receive()` aus `lib/move/move.ts` wird zu `mergeBackup()` in `lib/db/backup.ts`); „Alles ersetzen“ bleibt als zweite, ausdrücklich bestätigte Wahl.
- Unit-Test: Zusammenführen verliert weder lokale noch importierte Partien/Versuche.
- **Fertig, wenn** Laden einer alten Sicherung keine neueren Daten löscht.

## Etappe 5 – Abschluss

Version 0.3.0, README-Screenshots erneuern (Aussehen ändert sich sichtbar: Brettbeschriftung, Coach, Start), Tag `v0.3.0`, GitHub-Release, Website-Status „v0.3.0“ (nur Projekttexte, gemäß `PUBLISHING.md`).

## Bewusst nicht in diesem Plan

- **Riesige Routen-Dateien aufteilen** (play, analysis, course): reiner Umbau ohne sichtbare Wirkung, hohes Risiko für das stabile Brett-Layout. Eigene Aufgabe mit eigener Testphase.
- **Brett per Tastatur bedienbar**: chessground unterstützt es nicht; bräuchte eine eigene Zugeingabe – zu groß für diese Runde.
- **Tab-Leiste umbauen** (6 Tabs): die Bereiche sind getrennt verständlich; das Problem waren doppelte Inhalte, nicht die Tabs.
- **Genauigkeitsformel**: geprüft, entspricht der vereinfachten Lichess-Formel und ist eher strenger; die hohen Werte in den Bildern stammen aus den Testdaten.
- **Push-Erinnerungen**: brauchen einen Server-Absender (siehe PLAN.md), außerhalb des Ziels dieser Runde.

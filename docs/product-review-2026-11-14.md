# Rookie – Produkt-Review (14. November 2026, v0.6.1)

Maßstab: Bringt Rookie Einsteiger nachweisbar und schnell Richtung 1600 – und nutzen sie es gern?
Rollen: Trainer, Lernforscher, Produktdesigner, Engineer. Nichts ist gesetzt, auch nicht das zuletzt Gebaute.

**Grundlage**

- **Holdout-Prüfung des Skill-Pentas** an echten Spielern, die nicht in der Eichung stecken: 154 Lichess-Spieler (je 12–24 Rapid/Classical-Partien vom 1.–2. Oktober 2026, 14 je Band 400–2400), 2 802 Partien mit Stockfish Tiefe 11 wie die Eichung; 13 Spieler, die auch in den Eichdaten vorkommen, ausgeschlossen → 139–141 Spieler. Gerechnet mit dem **App-Code** (`skillMirror`, `overallLevel` aus `lib/training/skills.ts`, gebündelt), nicht mit einer Nachbildung.
- **Kandidaten für neue Penta-Ecken** (Verwerten, Verteidigen, Zeitnot) an den 1 560 Eich-Partien (2 944 Spieler-Partien, 400–2600) mit Uhrzeiten.
- **Schachinhalte**: alle 22 Aufgaben der Lektionen (Grundlagen, Taktik, Stellungsspiel), 30 Endspiel-Startstellungen, 37 Eröffnungsvarianten (≈ 470 Halbzüge) mit Stockfish Tiefe 18 (MultiPV 6, jede akzeptierte Lösung einzeln nachgerechnet).
- **Design**: alle 22 Seiten in 393×659, 393×852, 820×1180, 1280×800, hell/dunkel (176 Bilder, Testdaten), Coach und Start zusätzlich als ganze Seite; frischer Durchlauf als Neuling (Onboarding → erste Lektion).
- **Code**: `lib/training/{skills,strength,levels,plan,planData,progress,gamestats}.ts`, `lib/analysis/{classify,run}.ts`, Coach- und Lernseite.

Messskripte liegen außerhalb des Repos (Scratchpad); die Eichskripte im Repo (`scripts/research/skill-study.mjs`, `skill-fit.mjs`) sind die Grundlage, die Holdout-Auswertung ist unten vollständig beschrieben und reproduzierbar.

Belegstufen: **gemessen** (eigene Messung, Zahl genannt) · **Literatur** · **Erfahrung** (Trainerpraxis) · **Vermutung**.
Schweregrad: **kritisch** (bricht Lernen oder Vertrauen) · **hoch** · **mittel** · **niedrig**. Aufwand: S/M/L.

---

## 1. Skill-Penta – sind die Ecken richtig, fehlt etwas?

### 1.1 Wie gut trifft das Penta echte Spieler? (gemessen, Holdout)

Fehler der Elo-Entsprechung gegenüber der echten Lichess-Wertung, 139 Spieler, Median 16 Partien:

|                             | r        | mittlerer Fehler (MAE) | Verzerrung | fehlt bei |
| --------------------------- | -------- | ---------------------- | ---------- | --------- |
| Raten (immer Mittelwert)    | –        | 501                    | 0          | –         |
| **Gesamt** (`overallLevel`) | **0,86** | **226**                | −3         | 2         |
| Sicherheit                  | 0,83     | 255                    | −8         | 2         |
| Taktik                      | 0,66     | 378                    | +3         | 0         |
| Eröffnung                   | 0,89     | 209                    | +13        | 0         |
| Strategie                   | 0,57     | 360                    | −96        | 64 (46 %) |
| Endspiel                    | 0,66     | 304                    | −7         | 54 (39 %) |

Mit nur **8 Partien**: Gesamt MAE 287, Strategie r = 0,09 (reines Rauschen), Taktik MAE 532 – schlechter als Raten.

Fehler nach Stichprobe (alle Fenster 6/12/30 Partien zusammen):

| Ecke                  | kleine Stichprobe  | mittel       | groß                   |
| --------------------- | ------------------ | ------------ | ---------------------- |
| Taktik (Gegnerfehler) | 10–19: **MAE 621** | 20–34: 533   | 35–59: 437 · ≥ 60: 329 |
| Strategie (Züge)      | 80–149: 389        | ≥ 150: 271   |                        |
| Endspiel (Züge)       | 40–79: 351         | 80–149: 293  | ≥ 150: 212             |
| Sicherheit (Züge)     | 150–249: 316       | 250–399: 307 | ≥ 400: 232             |
| Eröffnung (Züge)      | 60–119: 232        | 120–199: 234 | ≥ 200: 200             |

**Befunde**

1. **Das Gesamtniveau ist brauchbar** – ab ~12 Partien ±230 Elo, ohne Gesamtverzerrung, deutlich besser als eine einzelne Partie (±465, Recherche 13.11.). Das Penta ist also kein Spielzeug; die Idee trägt. **gemessen**
2. **Die Mindestmengen sind zu klein.** Taktik erscheint ab 10 Gegnerfehlern – dort ist sie schlechter als Raten (MAE 621 > 501). Strategie ab 80 Zügen (MAE 389), Endspiel ab 40 (351). Die App zeigt diese Werte mit „≈ 1700“ und einer Spanne, die zwar breit ist (Taktik ±430 im Mittel), aber nicht verhindert, dass die Ecke das Bild prägt. **hoch · S · gemessen**
3. **Ränder:** Im Band 400–600 zeigt das Penta im Mittel 910 (+351), bei 2400 −142. Die Tabelle beginnt bei 506, darunter wird abgeschnitten, dazu Regression zur Mitte. Für die Zielgruppe (Neulinge) heißt das: Ein 500er bekommt eher die Stufe „Brett sehen (800–1200)“ als „Fundament“. **mittel · S · gemessen (n = 12, unsicher)**
4. **Eröffnung und Endspiel enthalten Patzer, Strategie nicht.** Die Genauigkeit der Eröffnung zählt auch eingestellte Figuren mit; Teilkorrelation Sicherheit–Eröffnung bei gleicher Wertung 0,47 (höchste aller Paare). Folge: Wer in der Eröffnung Figuren einstellt, bekommt den Rat „Eröffnungsprinzipien und ein Kurs je Farbe“ – richtig wäre der Blunder-Check. Das Verlustmodell (Elo-Wirkung) trennt schon sauber (Patzer → Sicherheit), nur die angezeigten Ecken nicht. Inkonsistent. **hoch · M (Neueichung) · gemessen**
5. Die übrigen Ecken überschneiden sich wenig (Teilkorrelationen −0,12 bis 0,46). Fünf getrennte Fähigkeiten sind vertretbar. **gemessen**
6. **„+100 Elo“ auf 5 Elo genau** ist Scheingenauigkeit: Das Gesamtniveau selbst schwankt ±230, die Wirkung ist ein Zusammenhang (Querschnitt), keine Ursache. Der Hinweis steht klein darunter. **mittel · S · gemessen/Literatur**
7. **Bot-Partien:** Die Eichung stammt aus Mensch-gegen-Mensch-Partien. Rookie-Bots patzen deutlich seltener als gleich „starke“ Menschen (Bruno 1,8 Patzer je 30 Züge, Menschen um 900 ≈ 4; `scripts/research/bot-human.mjs`). „Taktik = Gegnerfehler bestrafen“ hat gegen Bots weniger und andere Gelegenheiten. Für reine Bot-Spieler ist die Taktik-Ecke deshalb unsicherer als gemessen. **mittel · L (bräuchte Mensch-gegen-Bot-Daten) · gemessen (Bots)/Vermutung (Wirkung)**
8. **Analysetiefe:** Eichung Tiefe 11 (= iPhone), Desktop analysiert mit Tiefe 13 (`lib/analysis/run.ts:26`). Tiefere Analyse findet andere „beste“ Züge; die Wirkung auf die Ecken ist nicht gemessen. **niedrig · S · Vermutung**

### 1.2 Fehlt eine Ecke? (gemessen, 2 944 Spieler-Partien)

| Band | Verwerten: Punkte aus Stellungen ≥ 85 % | Verteidigen: Punkte aus ≤ 15 % | Züge in Zeitnot | Niederlagen durch Zeit |
| ---- | --------------------------------------- | ------------------------------ | --------------- | ---------------------- |
| 400  | 65 %                                    | 29 %                           | 2,0 %           | 20 %                   |
| 800  | 68 %                                    | 30 %                           | 1,4 %           | 7 %                    |
| 1200 | 69 %                                    | 25 %                           | 2,1 %           | 10 %                   |
| 1600 | 74 %                                    | 21 %                           | 2,8 %           | 8 %                    |
| 2000 | 81 %                                    | 16 %                           | 3,5 %           | 9 %                    |
| 2400 | 88 %                                    | 9 %                            | 9,8 %           | 7 %                    |

- **Verwerten** (eine klar gewonnene Stellung auch gewinnen) ist von 400 bis 1400 **flach bei 65–70 %** und steigt erst ab 1600. Es trennt die Niveaus der Zielgruppe also nicht – aber es ist ein großer, greifbarer Punktverlust: Fast jede dritte Gewinnstellung geht verloren. Holdout: r = 0,44 mit der Wertung (Sicherheit 0,83). Die Ursache sind Patzer in Gewinnstellungen – die zählt die Ecke Sicherheit bereits. → **keine eigene Ecke, aber als Zahl in der Sicherheits-Karte** („Aus 9 Gewinnstellungen 6 gewonnen“) – das macht die Sicherheit konkret. **gemessen**
- **Verteidigen** fällt mit der Wertung (29 % → 9 %), weil die Gegner besser verwerten – misst den Gegner, nicht dich. → keine Ecke. **gemessen**
- **Zeitnot** betrifft unter 1800 nur 1–3 % der Züge, Rookie-Partien laufen meist ohne Uhr, und Importe holen keine Uhrzeiten (`clocks=false`, `lib/import/importers.ts:114`). → keine Ecke. Auffällig nur: 20 % der Niederlagen um 400 sind Zeitverluste – ein Hinweis für Online-Spieler, kein Trainingsfeld. **gemessen**
- **Rechnen/Kandidatenzüge** lässt sich aus Partien nicht sauber messen; die Puzzle-Wertung deckt es ab und fließt in die Spielstärke. → keine Ecke. **Erfahrung**

**Ergebnis:** Die fünf Ecken bleiben – aber sauber getrennt (Patzer nur bei Sicherheit), mit Mindestmengen, die besser als Raten sind, und mit „Verwerten“ als konkreter Zahl unter Sicherheit. „Strategie“ heißt in den Lektionen „Stellungsspiel“ – ein Begriff für beides.

### 1.3 Zwei Zahlen für dasselbe – und zwei verschiedene Stufen (kritisch)

Mit denselben Daten (Testdaten, [coach-part1.jpg](review-2026-11-14/coach-part1.jpg), [learn-393x852-light.jpg](review-2026-11-14/learn-393x852-light.jpg)):

- Coach oben: „Spielstärke ≈ 900“ (`lib/training/strength.ts`: Lichess −150, Puzzle −200, Bots).
- Coach weiter unten: Penta „Gesamt 54/100 ≈ 1525“ und **Stufe „Sicher spielen, erste Pläne (1200–1600)“** – `LevelFocus` nimmt dort das Penta (`routes/coach/+page.svelte:448`).
- Lernen: **Stufe „Das Brett sehen (800–1200)“** – dort nimmt `LevelFocus` die Spielstärke (`routes/learn/+page.svelte:136`).

Dazu zwei Skalen: Das Penta und alle Stufengrenzen sind an **Lichess-Wertungen** geeicht, die Spielstärke rechnet Lichess −150 („FIDE-ähnlich“). Selbst bei einem perfekten Penta liegen die beiden Zahlen bei verknüpftem Lichess-Konto ~150 auseinander.

Die 1525 in den Testdaten sind ein Fehler der **Testdaten** (Engine-Züge mit eingestreuten Zufallszügen: ruhige Züge zu genau), nicht des Modells – der Holdout zeigt keine Gesamtverzerrung. Der Bruch in der App bleibt: **zwei Niveaus, zwei Skalen, zwei Stufen.** **kritisch · M · gemessen**

### 1.4 Darstellung

- „100 = Weltspitze“: Ein 900er sieht 32/100. Ehrlich, aber für Einsteiger wenig motivierend; die Elo-Entsprechung ist ohnehin die aussagekräftigere Zahl. **niedrig · Erfahrung** (bleibt, siehe Plan „Bewusst nicht“)
- „Endspiel –“ ohne Erklärung im Fünfeck; erst in der Detailkarte steht, wie viele Partien fehlen. **niedrig · S**
- Tooltip „Gewichtetes Mittel der fünf Fähigkeiten“ stimmt nicht (es ist das Verlustmodell). **niedrig · S**

---

## 2. Produkt als Nutzer (Personas)

**Neuling 400, Tag 1** (frischer Durchlauf): zwei Fragen (Regeln? Schwerpunkt?) → direkt in „Schach-Grundlagen“, Lektion 1. **2 Klicks bis zum Lernen** – gut. Die Lektionen sind kurz (2–5 Schritte). Kein Befund. **gemessen**

**Aufsteiger 900, Tag 7/30** (Testdaten, 32 Partien): Startseite zeigt einen klaren Tagesplan (4 Aufgaben, ~20 min) – gut. Die Coach-Seite dagegen ist **4 800 px lang** und gibt drei Empfehlungsblöcke hintereinander:

1. „Daran solltest du arbeiten“ (Hängende Figuren 45×, Puzzle-Thema Abzug 50 %, **„Mittelspiel: nur 79 % Genauigkeit“**),
2. „Was auf deinem Niveau zählt“ (Stufe, vier Schritte),
3. Penta „Größter Hebel: Sicherheit“.

Block 1 nennt das Mittelspiel eine Schwäche, das Penta direkt darunter zeigt **Strategie 76/100 als stärkste Ecke**. Zwei Maße für dieselbe Phase widersprechen sich ([coach-part1.jpg](review-2026-11-14/coach-part1.jpg), [coach-part2.jpg](review-2026-11-14/coach-part2.jpg)). **hoch · M · gemessen**

**Drei Patzer-Zahlen auf einer Seite:** „Patzer je 30 Züge 1,5“ (Fortschrittskarte, Zugbewertung mit „entschieden“-Regel, alle Züge), „Patzer 3,0 pro Partie“ (Kachel), „3,1 Patzer je 30 Züge“ (Penta-Sicherheit, nur offene Stellungen). Ein 12-Jähriger fragt zu Recht: Wie viele denn jetzt? Die Fortschrittskarte vergleicht außerdem mit Lichess-Werten, die nach der Penta-Definition gemessen wurden. **hoch · S · gemessen**

**Fortgeschrittener 1400:** Stufe „Sicher spielen, erste Pläne“ passt; Stellungsspiel-Lektionen und Eröffnungskurse vorhanden. Lücke: Turmendspiele über Lucena/Philidor hinaus fehlen nicht – sind da (`lib/endgames/lessons.ts`). Kein neuer Befund.

---

## 3. Design (176 Bilder, keine horizontale Überlaufstelle)

1. **Tablet 820×1180: Start-Bento zu eng.** Seitenleiste + drei Spalten lassen ~150 px je Kachel: „SPIELSTÄR…“ abgeschnitten, „30 Puzzles“ am Rand abgeschnitten, Tagesplan-Aufgaben brechen in 4–5 Zeilen mit Trennstrichen („Schwer-punkt“), daneben hohe, leere Kacheln ([home-820x1180-dark.jpg](review-2026-11-14/home-820x1180-dark.jpg)). **mittel · S**
2. **Fehlende Leerzeichen vor „·“:** „32 Partien· Spielstärke ≈ 900“ (Coach), „Als Nächstes ·2 Schritte“ (Grundlagen). Svelte schluckt das Leerzeichen am Zeilenumbruch. **niedrig · S**
3. **Begrüßung „Hallo!“** ohne Inhalt (schon im Review vom 13.11., niedrig). Bleibt niedrig.
4. **Coach-Desktop:** Fortschrittskacheln lassen rechts eine leere Lücke (Raster 3+2). **niedrig · S**
5. Brettbeschriftung, Kontraste, Tippflächen: seit 13.11. behoben, kein neuer Befund.

---

## 4. Schachinhalte (Stockfish Tiefe 18)

Geprüft: 525 Stellungen – 22 Lektionsaufgaben (jede akzeptierte Lösung einzeln nachgerechnet, MultiPV 6), 30 Endspiel-Startstellungen, alle Halbzüge der 37 Eröffnungsvarianten (gespielter Zug gegen besten Zug).

1. **Lektion „Schach“, Aufgabe 3 ist falsch gestellt:** „Zieh mit dem Springer dazwischen!“ (Weiß Ke1, Sc3, schwarzer Turm a1). Akzeptiert werden ♘b1 **und** ♘d1 – aber nach ♘b1 schlägt der Turm den ungedeckten Springer (Stockfish −4,4 statt +1,1). Die App lobt „der König ist wieder sicher“ für einen Zug, der eine Figur einstellt – das Gegenteil dessen, was Rookie überall sonst lehrt (`lib/basics/lessons.ts:334`). **hoch · S · gemessen**
2. **Stellungsspiel „Bauernstruktur“, Aufgabe 1 ist mehrdeutig:** „Wie schlägst du zurück?“ – nur …exd5 zählt, …♘xd5 ist laut Stockfish gleichwertig (−0,26 gegen −0,22). Die Frage muss sagen, worum es geht (Bauer im Zentrum), sonst wird ein guter Zug als falsch markiert (`lib/basics/positional.ts:170`). **mittel · S · gemessen**
3. Weitere Abweichungen sind gewollt: Konzeptaufgaben („Turm auf die offene Linie“, „Rochiere“) akzeptieren das Konzept, auch wenn ein anderer Zug minimal besser ist (≤ 0,3); Taktik-Muster in Stellungen mit wenig Material (Gabel, Fesselung, en passant) haben Bewertung ≈ 0 – das Muster zählt, nicht das Ergebnis. Kein Befund.
4. **Eröffnungen: kein eigener Kurszug verliert mehr als 0,5 Bauern** (Tiefe 18). Zwei Treffer bei Tiefe 8 (Schottisch Mieses 6.e5, Königsindisch …g6) waren Rauschen geringer Tiefe. **gemessen**
5. **Endspiele:** alle Startstellungen passen zum Ziel (Matt/Umwandlung/Remis). Der Kommentar in `lib/endgames/lessons.ts` verweist auf ein Prüfskript `scripts/check-endgames`, das es nicht gibt. **niedrig · S**

---

## 5. Training und Lernmodell

1. **Tagesplan je Stufe** passt zu den Daten: unter 1200 täglich Brett-Scan und Blunder-Check, Puzzles mit Schwerpunkt, Partie alle zwei Tage; ab 1150 Stellungsspiel. Die Stufe richtet sich aber nach der Spielstärke, die Coach-Stufe nach dem Penta (→ 1.3). **gemessen (Code)**
2. Puzzle-Schwierigkeit zielt auf ~80 % (`difficulty.ts`), Fehler kommen mit Abständen wieder (FSRS) – geprüft am 13.11., kein neuer Befund.
3. **Lücken auf dem Weg zu 1600:** Rechnen/Kandidatenzüge nur indirekt (Puzzles, „Erst du“); Zeitmanagement bewusst nicht (1.2); Eröffnungsfallen kommen in Kursen vor. Kein Handlungsbedarf mit Beleg.

## 6. Technik

1. Penta-Logik ist gut getestet (`skills.spec.ts`, 143 Zeilen); die **Eichung selbst hat keinen Holdout-Test** im Repo – der Befund 1.1 wäre ohne diese Runde unbemerkt geblieben. **mittel · S** (Holdout-Ergebnis als dokumentierte Kennzahl, Mindestmengen per Test festhalten)
2. Datenintegrität, Migrationen, Sync: keine Änderung seit der letzten Prüfung; kein Befund.
3. Performance: unverändert (Startseite ~330 KB, Engine erst beim Spielen).

---

## Top 15 nach erwartetem Lerngewinn pro Aufwand

| #   | Befund                                                                                           | Schwere  | Aufwand |
| --- | ------------------------------------------------------------------------------------------------ | -------- | ------- |
| 1   | Eine Spielstärke, eine Skala, eine Stufe (Penta fließt in die Spielstärke; Lichess-Skala)        | kritisch | M       |
| 2   | Penta-Mindestmengen nach Holdout (Taktik ≥ 35, Strategie ≥ 150, Endspiel ≥ 80, Sicherheit ≥ 250) | hoch     | S       |
| 3   | Patzer nur bei Sicherheit: Eröffnung/Endspiel ohne Patzer, neu geeicht                           | hoch     | M       |
| 4   | Eine Patzer-Zahl in der ganzen App                                                               | hoch     | S       |
| 5   | Coach: Phasen-Rat („Mittelspiel 79 %“) streichen – das Penta sagt es genauer                     | hoch     | S       |
| 6   | Falsche/zu strenge Lektionsaufgaben korrigieren (4.1)                                            | hoch     | S       |
| 7   | „Verwerten“ als Zahl in der Sicherheits-Karte                                                    | mittel   | S       |
| 8   | Elo-Wirkung auf 25 runden, „etwa“                                                                | mittel   | S       |
| 9   | Untere Kante: Penta unter 506 nicht mehr abschneiden                                             | mittel   | S       |
| 10  | Tablet-Bento der Startseite                                                                      | mittel   | S       |
| 11  | Holdout-Kennzahl als Test/Doku festhalten                                                        | mittel   | S       |
| 12  | Testdaten (Fixture) stimmig machen: Wertungen passend zum Spiel                                  | mittel   | S       |
| 13  | „Strategie“ → „Stellungsspiel“ (ein Begriff)                                                     | niedrig  | S       |
| 14  | Leerzeichen vor „·“                                                                              | niedrig  | S       |
| 15  | Penta: „–“-Ecken erklären, Tooltip korrigieren                                                   | niedrig  | S       |
